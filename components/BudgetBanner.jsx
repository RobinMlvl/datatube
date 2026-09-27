// Shown on the Library (under the YouTube pause notice) and on the Spend page. Silent while the
// month is fine; a `.notice` once spend gets close to, or reaches, the monthly budget.
import Link from "next/link";
import { AlertTriangle, PauseCircle } from "lucide-react";
import { formatUsd } from "@/lib/costs.mjs";

export default function BudgetBanner({ budget }) {
  if (budget.level === "none" || budget.level === "ok") return null;
  const percent = Math.round(budget.usedPermille / 10);
  const spent = formatUsd(budget.spentMicrousd);
  const total = formatUsd(budget.budgetMicrousd);
  const resets = new Date(budget.resetsAt).toLocaleDateString("en-US", { month: "short", day: "numeric" });

  if (budget.level === "warning") {
    return (
      <div className="notice notice-caution">
        <AlertTriangle className="h-4 w-4 shrink-0 text-caution" />
        <p>
          You have used {percent}% of this month&apos;s budget ({spent} of {total}).
        </p>
      </div>
    );
  }

  return (
    <div className="notice notice-negative">
      <PauseCircle className="h-4 w-4 shrink-0 text-negative" />
      <p>
        Monthly budget reached ({spent} of {total}) — summaries and sorting are paused until {resets}, or until you{" "}
        <Link href="/settings" className="text-accent hover:underline">
          raise the budget in Settings
        </Link>
        .
      </p>
    </div>
  );
}
