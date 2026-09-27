import Link from "next/link";

function Row({ theme }) {
  return (
    <Link href={`/themes/${theme.id}`} className="flex items-center justify-between gap-2 rounded-md px-2 py-1 hover:bg-neutral-100">
      <span className="truncate">{theme.name}</span>
      <span className="tabular-nums text-neutral-500">{theme.videoCount}</span>
    </Link>
  );
}

export default function ThemeTree({ tree }) {
  if (!tree.length) return <p className="mt-2 px-2 text-sm text-neutral-500">No theme yet. They appear as videos are sorted.</p>;
  return (
    <ul className="mt-2 space-y-0.5 text-sm">
      {tree.map((t) => (
        <li key={t.id}>
          <Row theme={t} />
          {t.children.length > 0 && (
            <ul className="ml-3 border-l border-neutral-200 pl-2">
              {t.children.map((c) => <li key={c.id}><Row theme={c} /></li>)}
            </ul>
          )}
        </li>
      ))}
    </ul>
  );
}
