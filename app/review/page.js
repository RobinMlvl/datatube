import { connection } from "next/server";
import { CheckCircle2 } from "lucide-react";
import ReviewItem from "@/components/ReviewItem";
import { getDb } from "@/lib/db.mjs";
import { reviewQueue, themeOptions } from "@/lib/queries.mjs";

export default async function ReviewPage() {
  await connection();
  const db = getDb();
  const items = reviewQueue(db);
  const themes = themeOptions(db);
  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="large-title">To review</h1>
      <p className="subhead mt-2">Jev could not place these videos with enough confidence. DeepSeek proposes a theme: accept it, rename it, or pick an existing one.</p>
      {items.length === 0 ? (
        <div className="card mt-8 flex flex-col items-center gap-2 p-8 text-center">
          <CheckCircle2 size={28} className="text-positive" aria-hidden="true" />
          <p className="headline">All sorted</p>
          <p className="subhead">Nothing waits for a theme.</p>
        </div>
      ) : (
        <ul className="mt-6 space-y-3">
          {items.map((v) => (
            <li key={v.id}>
              <ReviewItem video={{ id: v.id, title: v.title, channel: v.channel, proposal: v.proposal, confidencePermille: v.classifyConfidence, summary: v.summary }} themes={themes} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
