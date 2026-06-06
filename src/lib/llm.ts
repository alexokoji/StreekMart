// Provider-agnostic chat interface used by every AI call site on StreekMart.
//
// Gemini is the primary provider (free tier ~1,500 req/day on Flash) with
// Anthropic as a graceful fallback when ANTHROPIC_API_KEY is set instead.
// Call sites import `chat()` and `isAiEnabled()` from here — they don't
// touch a provider SDK directly. Swapping providers is a one-file change.

import {
  GoogleGenerativeAI,
  type Content,
  type FunctionDeclaration,
  type Part,
  type Tool as GeminiTool,
} from "@google/generative-ai";
import Anthropic from "@anthropic-ai/sdk";

// ── Public types ──────────────────────────────────────────────────────────

export type ChatToolCall = {
  id: string;
  name: string;
  input: Record<string, unknown>;
};

export type ChatTurn =
  // Plain user OR assistant text turn — single shape so call sites built
  // from a generic { role: "user" | "assistant", content } source pass
  // structural check without per-branch narrowing.
  | { role: "user" | "assistant"; content: string }
  // assistant message containing function_calls + optional preamble text
  | { role: "assistant"; toolCalls: ChatToolCall[]; text?: string }
  // user message returning tool results
  | {
      role: "user";
      toolResults: Array<{ toolUseId: string; content: string; isError?: boolean }>;
    };

export type ChatTool = {
  name: string;
  description: string;
  parameters: Record<string, unknown>; // JSON Schema (object)
};

export type ChatStopReason = "end_turn" | "tool_use" | "max_tokens" | "other";

export type ChatResult = {
  text: string;
  toolCalls: ChatToolCall[];
  stopReason: ChatStopReason;
};

// ── Provider detection ────────────────────────────────────────────────────

function provider(): "groq" | "gemini" | "anthropic" | null {
  // Groq first: free tier works globally (incl. Nigeria) and includes
  // tool-use on Llama 3.3 70B. Gemini falls in here too if you later top
  // up its credits — both keys can coexist.
  if (process.env.GROQ_API_KEY) return "groq";
  if (process.env.GEMINI_API_KEY) return "gemini";
  if (process.env.ANTHROPIC_API_KEY) return "anthropic";
  return null;
}

export function isAiEnabled(): boolean {
  return provider() !== null;
}

// Default models — overridable via env. Groq Llama 3.3 70B chosen for the
// best free-tier model that still supports tool calling. Gemini Flash kept
// for the same reason for setups using Gemini. Claude default kept on Opus.
const GROQ_MODEL = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.0-flash";
const CLAUDE_MODEL = process.env.CLAUDE_MODEL || "claude-opus-4-7";

// Back-compat alias so older imports of `MODEL` still resolve to something
// sensible. Concierge / call sites don't actually pass this to chat() any
// more — chat() picks the model based on provider.
export const MODEL =
  provider() === "anthropic"
    ? CLAUDE_MODEL
    : provider() === "gemini"
      ? GEMINI_MODEL
      : GROQ_MODEL;

// ── Public entry point ────────────────────────────────────────────────────

export async function chat(args: {
  system: string;
  messages: ChatTurn[];
  tools?: ChatTool[];
  maxTokens?: number;
  // Pass an OpenAPI/JSON-schema object to force JSON output matching the
  // shape. Translates to Gemini's responseSchema or Anthropic's
  // output_config.format.json_schema. Mutually exclusive with `tools`.
  responseJsonSchema?: Record<string, unknown>;
}): Promise<ChatResult> {
  const p = provider();
  if (p === "groq") return chatGroq(args);
  if (p === "gemini") return chatGemini(args);
  if (p === "anthropic") return chatAnthropic(args);
  throw new Error(
    "No AI provider configured. Set GROQ_API_KEY (recommended) or GEMINI_API_KEY or ANTHROPIC_API_KEY in your env.",
  );
}

// ── Groq implementation (OpenAI-compatible REST) ─────────────────────────

type GroqMessage =
  | { role: "system"; content: string }
  | { role: "user"; content: string }
  | { role: "assistant"; content: string | null; tool_calls?: GroqToolCall[] }
  | { role: "tool"; tool_call_id: string; content: string };

type GroqToolCall = {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
};

async function chatGroq(args: {
  system: string;
  messages: ChatTurn[];
  tools?: ChatTool[];
  maxTokens?: number;
  responseJsonSchema?: Record<string, unknown>;
}): Promise<ChatResult> {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new Error("GROQ_API_KEY is not set.");

  const messages: GroqMessage[] = [{ role: "system", content: args.system }];
  for (const t of args.messages) {
    for (const m of turnToGroqMessages(t)) messages.push(m);
  }

  const body: Record<string, unknown> = {
    model: GROQ_MODEL,
    messages,
    max_tokens: args.maxTokens ?? 2048,
  };

  if (args.tools?.length) {
    body.tools = args.tools.map((t) => ({
      type: "function",
      function: {
        name: t.name,
        description: t.description,
        parameters: t.parameters,
      },
    }));
  }
  if (args.responseJsonSchema) {
    // Groq supports OpenAI's "json_object" mode. Schema isn't enforced by
    // the API — call sites already validate the parsed JSON with zod, so
    // a malformed response is caught downstream. Forcing a system hint
    // about the expected shape keeps the model on the rails.
    body.response_format = { type: "json_object" };
    messages[0] = {
      role: "system",
      content:
        args.system +
        "\n\nIMPORTANT: respond ONLY with a valid JSON object matching this JSON Schema (no prose, no markdown fence): " +
        JSON.stringify(args.responseJsonSchema),
    };
  }

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Groq ${res.status}: ${txt.slice(0, 300)}`);
  }
  const data = (await res.json()) as {
    choices?: Array<{
      finish_reason?: string;
      message?: {
        role?: string;
        content?: string | null;
        tool_calls?: GroqToolCall[];
      };
    }>;
  };

  const choice = data.choices?.[0];
  const msg = choice?.message;
  const text = (msg?.content ?? "").trim();

  const toolCalls: ChatToolCall[] = (msg?.tool_calls ?? []).map((tc) => {
    let input: Record<string, unknown> = {};
    try {
      input = tc.function.arguments ? (JSON.parse(tc.function.arguments) as Record<string, unknown>) : {};
    } catch {
      input = {};
    }
    return { id: tc.id, name: tc.function.name, input };
  });

  let stopReason: ChatStopReason = "other";
  if (choice?.finish_reason === "tool_calls" || toolCalls.length > 0) stopReason = "tool_use";
  else if (choice?.finish_reason === "stop") stopReason = "end_turn";
  else if (choice?.finish_reason === "length") stopReason = "max_tokens";

  return { text, toolCalls, stopReason };
}

// One ChatTurn can map to multiple wire messages: a user "toolResults"
// turn fans out to one `role: "tool"` message per call so each result
// stays paired with its tool_call_id, which is what Groq/OpenAI expect.
function turnToGroqMessages(t: ChatTurn): GroqMessage[] {
  if ("content" in t && typeof t.content === "string") {
    if (t.role === "assistant") return [{ role: "assistant", content: t.content }];
    return [{ role: "user", content: t.content }];
  }
  if (t.role === "assistant" && "toolCalls" in t) {
    return [
      {
        role: "assistant",
        content: t.text ?? null,
        tool_calls: t.toolCalls.map((tc) => ({
          id: tc.id,
          type: "function",
          function: { name: tc.name, arguments: JSON.stringify(tc.input ?? {}) },
        })),
      },
    ];
  }
  if (t.role === "user" && "toolResults" in t) {
    return t.toolResults.map((r) => ({
      role: "tool",
      tool_call_id: r.toolUseId,
      content: r.isError ? `ERROR: ${r.content}` : r.content,
    }));
  }
  return [{ role: "user", content: "" }];
}

// ── Gemini implementation ────────────────────────────────────────────────

let _gemini: GoogleGenerativeAI | null = null;
function geminiClient(): GoogleGenerativeAI {
  if (_gemini) return _gemini;
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY is not set.");
  _gemini = new GoogleGenerativeAI(key);
  return _gemini;
}

async function chatGemini(args: {
  system: string;
  messages: ChatTurn[];
  tools?: ChatTool[];
  maxTokens?: number;
  responseJsonSchema?: Record<string, unknown>;
}): Promise<ChatResult> {
  const tools: GeminiTool[] | undefined = args.tools?.length
    ? [
        {
          functionDeclarations: args.tools.map(
            (t): FunctionDeclaration => ({
              name: t.name,
              description: t.description,
              parameters: sanitizeSchemaForGemini(t.parameters) as unknown as FunctionDeclaration["parameters"],
            }),
          ),
        },
      ]
    : undefined;

  const model = geminiClient().getGenerativeModel({
    model: GEMINI_MODEL,
    systemInstruction: args.system,
    tools,
  });

  const contents: Content[] = args.messages.map((m) => turnToGeminiContent(m));

  const generationConfig: Record<string, unknown> = {
    maxOutputTokens: args.maxTokens ?? 2048,
  };
  if (args.responseJsonSchema) {
    generationConfig.responseMimeType = "application/json";
    generationConfig.responseSchema = sanitizeSchemaForGemini(args.responseJsonSchema);
  }

  const res = await model.generateContent({ contents, generationConfig });
  const candidate = res.response.candidates?.[0];

  const text =
    res.response.text?.()?.trim() ??
    candidate?.content?.parts
      ?.filter((p): p is Part & { text: string } => typeof (p as { text?: string }).text === "string")
      .map((p) => p.text)
      .join("")
      .trim() ??
    "";

  const toolCalls: ChatToolCall[] = [];
  for (const part of candidate?.content?.parts ?? []) {
    const fc = (part as { functionCall?: { name?: string; args?: Record<string, unknown> } })
      .functionCall;
    if (fc && fc.name) {
      toolCalls.push({
        // Gemini doesn't return ids; we synthesise one so the loop can pair
        // the call with its result on the next turn.
        id: `call_${toolCalls.length}_${fc.name}`,
        name: fc.name,
        input: fc.args ?? {},
      });
    }
  }

  let stopReason: ChatStopReason = "end_turn";
  if (toolCalls.length > 0) stopReason = "tool_use";
  else if (candidate?.finishReason === "MAX_TOKENS") stopReason = "max_tokens";

  return { text, toolCalls, stopReason };
}

function turnToGeminiContent(t: ChatTurn): Content {
  // Plain user/assistant text turn
  if ("content" in t && typeof t.content === "string") {
    return {
      role: t.role === "assistant" ? "model" : "user",
      parts: [{ text: t.content }],
    };
  }
  // Assistant tool-call turn (replay during a tool loop)
  if (t.role === "assistant" && "toolCalls" in t) {
    const parts: Part[] = [];
    if (t.text) parts.push({ text: t.text });
    for (const tc of t.toolCalls) {
      parts.push({ functionCall: { name: tc.name, args: tc.input } });
    }
    return { role: "model", parts };
  }
  // User tool-result turn
  if (t.role === "user" && "toolResults" in t) {
    const parts: Part[] = t.toolResults.map((r) => ({
      functionResponse: {
        // Gemini expects the function name on the response part; we encoded
        // it into the synthesised id (`call_<i>_<name>`). Split it back out.
        name: r.toolUseId.split("_").slice(2).join("_") || r.toolUseId,
        response: r.isError ? { error: r.content } : safeJson(r.content),
      },
    }));
    return { role: "user", parts };
  }
  // Fallback — should not happen given the union exhausts above
  return { role: "user", parts: [{ text: "" }] };
}

function safeJson(s: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(s) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return { result: parsed };
  } catch {
    return { result: s };
  }
}

// Gemini's responseSchema is OpenAPI 3.0 — strip fields it doesn't accept
// (additionalProperties, $schema). Recurse through nested objects/arrays.
// Also map `type: ["string", "null"]` → `type: "string", nullable: true`.
function sanitizeSchemaForGemini(schema: Record<string, unknown>): Record<string, unknown> {
  function walk(node: unknown): unknown {
    if (Array.isArray(node)) return node.map(walk);
    if (!node || typeof node !== "object") return node;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
      if (k === "additionalProperties" || k === "$schema") continue;
      if (k === "type" && Array.isArray(v)) {
        // ["string","null"] → string + nullable:true
        const types = v.filter((t): t is string => typeof t === "string");
        const nullable = types.includes("null");
        const real = types.find((t) => t !== "null");
        if (real) out.type = real;
        if (nullable) out.nullable = true;
        continue;
      }
      out[k] = walk(v);
    }
    return out;
  }
  return walk(schema) as Record<string, unknown>;
}

// ── Anthropic implementation (fallback) ──────────────────────────────────

let _anthropic: Anthropic | null = null;
function anthropicClient(): Anthropic {
  if (_anthropic) return _anthropic;
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("ANTHROPIC_API_KEY is not set.");
  _anthropic = new Anthropic({ apiKey: key });
  return _anthropic;
}

async function chatAnthropic(args: {
  system: string;
  messages: ChatTurn[];
  tools?: ChatTool[];
  maxTokens?: number;
  responseJsonSchema?: Record<string, unknown>;
}): Promise<ChatResult> {
  const client = anthropicClient();

  const tools: Anthropic.Tool[] | undefined = args.tools?.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: t.parameters as Anthropic.Tool["input_schema"],
  }));

  const messages: Anthropic.MessageParam[] = args.messages.map(turnToAnthropic);

  const create: Anthropic.MessageCreateParamsNonStreaming = {
    model: CLAUDE_MODEL,
    max_tokens: args.maxTokens ?? 2048,
    system: [
      { type: "text", text: args.system, cache_control: { type: "ephemeral" } },
    ],
    ...(tools ? { tools } : {}),
    messages,
  };
  if (args.responseJsonSchema) {
    // Anthropic's recent JSON-schema enforcement field. We cast through
    // unknown because the SDK types may lag the field's GA rollout.
    (create as unknown as { output_config?: unknown }).output_config = {
      format: { type: "json_schema", schema: args.responseJsonSchema },
    };
  }

  const response = await client.messages.create(create);

  const text = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();

  const toolCalls: ChatToolCall[] = response.content
    .filter((b): b is Anthropic.ToolUseBlock => b.type === "tool_use")
    .map((b) => ({ id: b.id, name: b.name, input: (b.input ?? {}) as Record<string, unknown> }));

  let stopReason: ChatStopReason = "other";
  if (response.stop_reason === "end_turn" || response.stop_reason === "stop_sequence") {
    stopReason = "end_turn";
  } else if (response.stop_reason === "tool_use") {
    stopReason = "tool_use";
  } else if (response.stop_reason === "max_tokens") {
    stopReason = "max_tokens";
  }

  return { text, toolCalls, stopReason };
}

function turnToAnthropic(t: ChatTurn): Anthropic.MessageParam {
  if ("content" in t && typeof t.content === "string") {
    return { role: t.role, content: t.content };
  }
  if (t.role === "assistant" && "toolCalls" in t) {
    const blocks: Anthropic.ContentBlockParam[] = [];
    if (t.text) blocks.push({ type: "text", text: t.text });
    for (const tc of t.toolCalls) {
      blocks.push({ type: "tool_use", id: tc.id, name: tc.name, input: tc.input });
    }
    return { role: "assistant", content: blocks };
  }
  if (t.role === "user" && "toolResults" in t) {
    return {
      role: "user",
      content: t.toolResults.map(
        (r): Anthropic.ToolResultBlockParam => ({
          type: "tool_result",
          tool_use_id: r.toolUseId,
          content: r.content,
          ...(r.isError ? { is_error: true } : {}),
        }),
      ),
    };
  }
  return { role: "user", content: "" };
}
