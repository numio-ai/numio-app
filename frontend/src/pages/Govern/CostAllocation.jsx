import React from "react";
import { Link } from "react-router-dom";
import { allocationSummary, allocationTree, tagRecommendations, lastUpdated } from "../../mocks/mockCostAllocation";
export default function CostAllocation() {
  const untaggedCount = tagRecommendations.length;

  return (
    <div style={{ padding: "24px" }}>
      <div style={{ marginBottom: "20px" }}>
        <h1 style={{ fontSize: "16px", fontWeight: 500, color: "#111827", margin: 0 }}>Govern</h1>
        <p style={{ fontSize: "13px", color: "#6b7280", marginTop: "4px" }}>
          Attribute spend across teams, projects, owners, and environments. Aligned with Overview.
        </p>
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 24 }}>
        <Link to="/inbox" className="view-link">View Inbox →</Link>
      </div>

        {/* Compact summary bar */}
        <section
          className="flex flex-wrap items-center gap-4 py-3 px-4 rounded-xl border bg-white"
          style={{ marginBottom: "24px", borderColor: "var(--border)", borderRadius: "var(--radius-lg)" }}
        >
          <p className="text-[11px] font-semibold uppercase tracking-[0.05em] shrink-0" style={{ color: "var(--text-tertiary)" }}>
            ALLOCATION · {allocationSummary.period}
          </p>
          <p className="text-2xl font-semibold tracking-tight shrink-0" style={{ color: "var(--text)" }}>
            {allocationSummary.total}
          </p>
          <span className="shrink-0 text-xs" style={{ color: "var(--text-tertiary)" }}>
            Unallocated {allocationSummary.unallocated}
          </span>
          {untaggedCount > 0 && (
            <span className="shrink-0 px-2 py-0.5 rounded text-[11px] font-medium text-amber-600 bg-amber-50">
              {untaggedCount} untagged resource{untaggedCount !== 1 ? "s" : ""}
            </span>
          )}
          <span className="text-xs shrink-0 ml-auto" style={{ color: "var(--text-tertiary)" }}>
            Updated {lastUpdated}
          </span>
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Allocation summary */}
          <section
            className="card"
            style={{ borderColor: "var(--border)", borderRadius: "var(--radius-lg)", padding: "var(--card-padding)" }}
          >
            <p className="card-label">ALLOCATION SUMMARY</p>
            <p className="text-xs mb-4" style={{ color: "var(--text-tertiary)" }}>
              Total attributed spend and unallocated amount for {allocationSummary.period}
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-2xl font-semibold" style={{ color: "var(--text)" }}>{allocationSummary.total}</p>
                <p className="text-xs mt-0.5" style={{ color: "var(--text-tertiary)" }}>Total allocated</p>
              </div>
              <div>
                <p className="text-2xl font-semibold" style={{ color: "var(--text)" }}>{allocationSummary.unallocated}</p>
                <p className="text-xs mt-0.5" style={{ color: "var(--text-tertiary)" }}>Unallocated</p>
              </div>
            </div>
          </section>

          {/* Attribution tree - take full width on lg when paired with summary */}
          <section
            className="card"
            style={{ borderColor: "var(--border)", borderRadius: "var(--radius-lg)", padding: "var(--card-padding)" }}
          >
            <p className="card-label">ATTRIBUTION TREE</p>
            <p className="text-xs mb-4" style={{ color: "var(--text-tertiary)" }}>
              Spend by org unit and team
            </p>
            <div className="space-y-4">
              {allocationTree.map((node) => (
                <div key={node.label}>
                  <div className="flex justify-between items-center py-2 border-b" style={{ borderColor: "var(--border)" }}>
                    <span className="font-medium" style={{ color: "var(--text)" }}>{node.label}</span>
                    <span className="text-sm font-semibold" style={{ color: "var(--text)" }}>{node.value}</span>
                  </div>
                  <div className="pl-4 mt-1 space-y-1">
                    {node.children.map((child) => (
                      <div key={child.label} className="flex justify-between items-center py-1 text-sm" style={{ color: "var(--text-secondary)" }}>
                        <span>{child.label}</span>
                        <span>{child.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* Untagged resources */}
        <section
          className="card"
          style={{ borderColor: "var(--border)", borderRadius: "var(--radius-lg)", padding: "var(--card-padding)" }}
        >
          <p className="card-label">UNTAGGED RESOURCES</p>
          <p className="text-xs mb-4" style={{ color: "var(--text-tertiary)" }}>
            Resources missing cost allocation tags. Add tags to improve attribution.
          </p>
          <div className="overflow-x-auto -mx-1">
            <table className="table table--compact w-full">
              <thead>
                <tr>
                  <th className="th th--left" style={{ borderColor: "var(--border)" }}>Resource</th>
                  <th className="th" style={{ borderColor: "var(--border)" }}>Missing tag</th>
                  <th className="th" style={{ borderColor: "var(--border)" }}>Owner</th>
                  <th className="th th--actions" style={{ borderColor: "var(--border)" }}></th>
                </tr>
              </thead>
              <tbody>
                {tagRecommendations.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="td td--empty" style={{ borderColor: "var(--border)", color: "var(--text-tertiary)" }}>
                      No untagged resources. All resources have required allocation tags.
                    </td>
                  </tr>
                ) : (
                  tagRecommendations.map((rec) => (
                    <tr key={rec.resource}>
                      <td className="td td--left" style={{ borderColor: "var(--border)", color: "var(--text)" }}>{rec.resource}</td>
                      <td className="td" style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}>{rec.missing}</td>
                      <td className="td" style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}>{rec.owner}</td>
                      <td className="td td--actions" style={{ borderColor: "var(--border)" }}>
                        <button type="button" className="btn btn--outline btn--sm">Tag now</button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
    </div>
  );
}
