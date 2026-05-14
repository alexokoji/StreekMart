"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import type { Garment } from "@/lib/enums";
import { SketchCanvas } from "./SketchCanvas";

// Three.js is heavy and only used on the Mockup tab. Defer it until that
// tab opens so the initial sketch page stays light.
const MockupViewer = dynamic(
  () => import("./MockupViewer").then((m) => m.MockupViewer),
  { ssr: false, loading: () => <div className="aspect-[4/3] w-full animate-pulse rounded-xl bg-ink-100" /> },
);

type Tab = "sketch" | "mockup";

export function SketchStudio({ enable3D }: { enable3D: boolean }) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("sketch");
  const [title, setTitle] = useState("");
  const [garment, setGarment] = useState<Garment>("dress");
  const [dataUrl, setDataUrl] = useState<string>("");
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!dataUrl) return;
    setSaving(true);
    try {
      const res = await fetch("/api/sketches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim() || `Sketch ${new Date().toLocaleString()}`,
          garment,
          imageData: dataUrl,
        }),
      });
      if (res.ok) {
        setTitle("");
        router.refresh();
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="card p-4">
      <div role="tablist" className="mb-4 inline-flex rounded-xl bg-ink-100 p-1">
        <TabButton active={tab === "sketch"} onClick={() => setTab("sketch")}>Sketch pad</TabButton>
        <TabButton
          active={tab === "mockup"}
          onClick={() => setTab("mockup")}
          disabled={!enable3D}
          title={enable3D ? undefined : "Set FEATURE_SKETCH_3D=1 in .env to enable"}
        >
          3D Mockup
        </TabButton>
      </div>

      {tab === "sketch" ? (
        <SketchCanvas
          title={title}
          setTitle={setTitle}
          garment={garment}
          setGarment={setGarment}
          onSnapshot={setDataUrl}
          onSave={save}
          saving={saving}
        />
      ) : enable3D ? (
        <div className="space-y-3">
          <p className="text-xs text-ink-600">
            Live preview of your <span className="font-semibold">{garment}</span> sketch on a
            low-poly mannequin. Switch back to the Sketch pad tab to make changes — they
            sync automatically.
          </p>
          {dataUrl ? (
            <MockupViewer dataUrl={dataUrl} garment={garment} />
          ) : (
            <div className="aspect-[4/3] w-full rounded-xl border border-dashed border-ink-200 bg-ink-50 p-6 text-center text-sm text-ink-500">
              Draw something on the Sketch pad tab to see it here.
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-ink-200 bg-ink-50 p-8 text-center text-sm text-ink-500">
          3D mockup is off. Set <code>FEATURE_SKETCH_3D=1</code> in <code>.env</code> to enable.
        </div>
      )}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  disabled,
  title,
  children,
}: {
  active: boolean;
  onClick: () => void;
  disabled?: boolean;
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
        active ? "bg-white text-ink-900 shadow-soft" : "text-ink-600 hover:text-ink-900"
      } ${disabled ? "cursor-not-allowed opacity-40" : ""}`}
    >
      {children}
    </button>
  );
}
