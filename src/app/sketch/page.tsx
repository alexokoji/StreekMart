import { Permission } from "@/lib/enums";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { timeAgo } from "@/lib/utils";
import { SketchStudio } from "./SketchStudio";

// Sketch Studio is gated to users with DESIGNER permission.
// FEATURE_SKETCH_3D enables the live Three.js mockup tab; otherwise it
// renders a disabled tab so the canvas still works.
const ENABLE_3D = process.env.FEATURE_SKETCH_3D === "1";

export default async function SketchPage() {
  const user = await requireUser(Permission.DESIGNER);
  const sketches = await prisma.sketch.findMany({
    where: { authorId: user.id },
    orderBy: { createdAt: "desc" },
    take: 24,
  });

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs font-semibold uppercase tracking-widest text-gold-700">Sketch Studio</p>
        <h1 className="mt-1 font-display text-3xl font-bold">Bring your ideas to life.</h1>
        <p className="mt-1 max-w-2xl text-sm text-ink-600">
          Sketch a fashion piece, tag the garment, and preview it on a 3D mannequin in real
          time. Save designs to your studio to reuse them in products and posts.
        </p>
      </header>

      <SketchStudio enable3D={ENABLE_3D} />

      {sketches.length > 0 && (
        <section>
          <h2 className="mb-3 font-display text-lg font-semibold">Your studio</h2>
          <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {sketches.map((s) => (
              <figure key={s.id} className="card overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={s.imageData} alt={s.title} className="aspect-square w-full bg-white object-contain" />
                <figcaption className="p-3">
                  <p className="text-sm font-medium">{s.title}</p>
                  <p className="text-[11px] text-ink-500">
                    {s.garment} · {timeAgo(s.createdAt)}
                  </p>
                </figcaption>
              </figure>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
