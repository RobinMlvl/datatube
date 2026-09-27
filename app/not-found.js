import Link from "next/link";
import { SearchX } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-center">
      <SearchX className="h-7 w-7 text-label-3" />
      <h1 className="title-2">Not found</h1>
      <p className="subhead">This page does not exist, or the item was removed.</p>
      <Link href="/" className="btn btn-secondary mt-2">Back to Library</Link>
    </div>
  );
}
