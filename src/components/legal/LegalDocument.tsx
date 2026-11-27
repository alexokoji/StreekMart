import type { LegalDoc } from "@/lib/legalContent";

// Renders a legal document from the shared content. Uses the app's theme
// colours (so it reads properly in light AND dark mode) rather than fixed
// white / grey classes.
export function LegalDocument({ doc }: { doc: LegalDoc }) {
  // Group consecutive list items so they render as one <ul>.
  const nodes: React.ReactNode[] = [];
  let list: string[] = [];
  const flush = (key: string) => {
    if (list.length === 0) return;
    nodes.push(
      <ul key={key} className="mb-4 list-disc space-y-2 pl-6 text-ink-700 dark:text-ink-200">
        {list.map((li, i) => (
          <li key={i}>{li}</li>
        ))}
      </ul>,
    );
    list = [];
  };
  doc.blocks.forEach((b, i) => {
    if (b.t === "li") {
      list.push(b.x);
      return;
    }
    flush(`ul-${i}`);
    if (b.t === "h2") nodes.push(<h2 key={i} className="mb-3 mt-10 text-2xl font-bold text-ink-900 dark:text-white">{b.x}</h2>);
    else if (b.t === "h3") nodes.push(<h3 key={i} className="mb-2 mt-6 text-lg font-semibold text-ink-900 dark:text-white">{b.x}</h3>);
    else nodes.push(<p key={i} className="mb-4 leading-relaxed text-ink-700 dark:text-ink-200">{b.x}</p>);
  });
  flush("ul-end");

  return (
    <article className="mx-auto max-w-3xl px-1 py-6 sm:py-10">
      <h1 className="font-display text-3xl font-bold text-ink-900 dark:text-white sm:text-4xl">{doc.title}</h1>
      <p className="mt-2 text-sm text-ink-500 dark:text-ink-300">Last updated: {doc.updated}</p>
      <div className="mt-6">{nodes}</div>
    </article>
  );
}
