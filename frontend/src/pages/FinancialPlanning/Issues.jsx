import React from "react";
import { Link } from "react-router-dom";
import { IconCommitment } from "../../components/Icons";
import { execCardClass, execHeaderClass, compactSummaryBarStyle, formatCurrentMonth } from "../../constants/designTokens";
import { useBudget } from "../../context/BudgetContext";
import { formatCurrency } from "../../utils/format";

export default function Issues() {
  const { mtdSpend, lastUpdated } = useBudget();
  return (
    <div className="pageContent">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h1 className="text-xl font-semibold" style={{ color: "var(--text)" }}>
              Issues
            </h1>
            <p className="text-sm mt-1" style={{ color: "var(--text-tertiary)" }}>
              Track and manage cost optimization issues.
            </p>
          </div>
          <Link to="/inbox" className="text-sm font-medium" style={{ color: "var(--primary)" }}>
            View Inbox →
          </Link>
        </div>

        <section
          className="flex flex-wrap items-center gap-4 py-3 px-4 rounded-xl border bg-white"
          style={compactSummaryBarStyle}
        >
          <p className="text-[11px] font-semibold uppercase tracking-[0.05em] shrink-0" style={{ color: "var(--text-tertiary)" }}>
            MTD · {formatCurrentMonth()}
          </p>
          <p className="text-2xl font-semibold tracking-tight shrink-0" style={{ color: "var(--text)" }}>
            {formatCurrency(mtdSpend)}
          </p>
          <span className="text-xs shrink-0 ml-auto" style={{ color: "var(--text-tertiary)" }}>
            Updated {lastUpdated}
          </span>
        </section>

        <section
          className={execCardClass}
          style={{ borderColor: "var(--border)", borderRadius: "var(--radius-lg)", padding: "var(--card-padding)", textAlign: "center" }}
        >
          <p className={execHeaderClass}>ISSUES</p>
          <div className="py-8">
            <IconCommitment className="icon icon--large mx-auto mb-4" style={{ color: "var(--success)" }} />
            <h2 className="text-lg font-semibold mb-2" style={{ color: "var(--text)" }}>No issues found</h2>
            <p className="text-sm mb-4" style={{ color: "var(--text-tertiary)" }}>
              No cost optimization issues detected. Overview and Govern pages reflect current state.
            </p>
            <Link to="/govern/issues" className="btn btn--outline btn--sm">View Govern issues</Link>
          </div>
        </section>
      </div>
  );
}
