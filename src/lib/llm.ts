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

function provider(): "gemini" | "anthropic" | null {
  if (process.env.GEMINI_API_KEY) return "gemini";
  if (process.env.ANTHROPIC_API_KEY) return "anthropic";
  return null;
}

export function isAiEnabled(): boolean {
  return provider() !== null;
}

// Default models — overridable via env. Gemini Flash chosen for free tier
// generosity (~1,500 req/day). Claude default kept on Opus to match prior
// behaviour for setups still on Anthropic.
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.0-flash";
const CLAUDE_MODEL = process.env.CLAUDE_MODEL || "claude-opus-4-7";

// Back-compat alias so older imports of `MODEL` still resolve to something
// sensible. Concierge / call sites don't actually pass this to chat() any
// more — chat() picks the model based on provider.
export const MODEL = provider() === "anthropic" ? CLAUDE_MODEL : GEMINI_MODEL;

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
  if (p === "gemini") return chatGemini(args);
  if (p === "anthropic") return chatAnthropic(args);
  throw new Error(
    "No AI provider configured. Set GEMINI_API_KEY (recommended) or ANTHROPIC_API_KEY in your env.",
  );
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
