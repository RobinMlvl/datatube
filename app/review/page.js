import { connection } from "next/server";
import ReviewItem from "@/components/ReviewItem";
import { getDb } from "@/lib/db.mjs";
import { reviewQueue, themeOptions } from "@/lib/queries.mjs";

export default async function ReviewPage() {
  await connection();
  const db = getDb();
  const items = reviewQueue(db);
  const themes = themeOptions(db);
  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-2xl font-semibold tracking-tight">To review</h1>
      <p className="mt-1 text-sm text-neutral-500">Jev could not place these videos with enough confidence. DeepSeek proposes a theme: accept it, rename it, or pick an existing one.</p>
      {items.length === 0 ? (
        <p className="mt-8 text-sm text-neutral-500">Nothing to review.</p>
      ) : (
        <ul className="mt-6 space-y-3">
          {items.map((v) => (
            <li key={v.id}>
              <ReviewItem video={{ id: v.id, title: v.title, channel: v.channel, proposal: v.proposal, confidencePermille: v.classifyConfidence }} themes={themes} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
