import React from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Folder, Search, Star, Plus } from "lucide-react";
import { costReports, AI_TEAMS } from "../../mocks/mockCostReports";
import { useBudget } from "../../context/BudgetContext";
import { formatCurrency } from "../../constants/designTokens";

const CURRENT_USER = "James Cooper";

const TAB_ALL = "all";
const TAB_AI = "ai";
const TAB_CLOUD = "cloud";

export default function CostReportsList() {
  const [search, setSearch] = React.useState("");
  const [tab, setTab] = React.useState(TAB_ALL);
  const [searchParams] = useSearchParams();
  const { mtdSpend, monthlyBudget, calendar, aiBreakdown } = useBudget();
  const showCreated = searchParams.get("created") === "true";
  const showStarred = searchParams.get("starred") === "true";
  const showRecent = searchParams.get("recent") === "true";

  const aiSpendTotal = aiBreakdown?.total ?? 0;
  const aiSharePct = mtdSpend > 0 ? Math.round((aiSpendTotal / mtdSpend) * 100) : 0;

  let reportsByParam = costReports;
  if (showCreated) {
    reportsByParam = costReports.filter((r) => r.createdBy === CURRENT_USER);
  }
  if (showStarred) {
    reportsByParam = costReports.filter((r) => r.starred === true);
  }
  if (showRecent) {
    reportsByParam = [...costReports]
      .sort((a, b) => new Date(b.lastViewed || 0) - new Date(a.lastViewed || 0))
      .slice(0, 5);
  }

  if (tab === TAB_AI) {
    reportsByParam = reportsByParam.filter((r) => r.team && AI_TEAMS.includes(r.team));
  }
  if (tab === TAB_CLOUD) {
    reportsByParam = reportsByParam.filter((r) => !r.team || !AI_TEAMS.includes(r.team));
  }

  const filteredReports = reportsByParam.filter(
    (r) =>
      r.name.toLowerCase().includes(search.toLowerCase()) ||
      (r.team && r.team.toLowerCase().includes(search.toLowerCase()))
  );

  let pageTitle = "Costs";
  let pageSubtitle = `${calendar?.monthName ?? "February"} ${calendar?.year ?? new Date().getFullYear()} · ${calendar?.daysRemaining ?? 0} days remaining · ${formatCurrency(aiSpendTotal)} AI spend tracked`;
  if (showCreated) {
    pageTitle = "Costs";
    pageSubtitle = "Created by me · Cost reports you have created.";
  }
  if (showStarred) {
    pageTitle = "Costs";
    pageSubtitle = "Starred by me · Your starred cost reports for quick access.";
  }
  if (showRecent) {
    pageTitle = "Costs";
    pageSubtitle = "Recently viewed · Cost reports you have recently opened.";
  }

  const isEmpty = filteredReports.length === 0;
  const emptyCreated = showCreated && reportsByParam.length === 0;
  const emptyStarred = showStarred && reportsByParam.length === 0;
  const emptyRecent = showRecent && reportsByParam.length === 0;
  const emptyTabFilter = isEmpty && !emptyCreated && !emptyStarred && !emptyRecent;

  return (
    <div style={{ padding: "24px 24px 0" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "20px" }}>
        <div>
          <h1 style={{ fontSize: "16px", fontWeight: 500, color: "#111827", margin: 0 }}>{pageTitle}</h1>
          <p style={{ fontSize: "13px", color: "#6b7280", marginTop: "4px" }}>
            {pageSubtitle}
          </p>
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          <button
            type="button"
            style={{
              padding: "7px 14px",
              fontSize: "13px",
              fontWeight: 500,
              color: "#111827",
              background: "#ffffff",
              border: "1px solid #e5e5e5",
              borderRadius: "8px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <Folder size={14} /> New Folder
          </button>
          <Link
            to="/costs/reports/new"
            style={{
              padding: "7px 14px",
              fontSize: "13px",
              fontWeight: 500,
              color: "#111827",
              background: "#ffffff",
              border: "1px solid #e5e5e5",
              borderRadius: "8px",
              display: "flex",
              alignItems: "center",
              gap: "6px",
              textDecoration: "none",
            }}
          >
            <Plus size={14} /> New Cost Report
          </Link>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: "1px",
          background: "#efefef",
          border: "1px solid #efefef",
          borderRadius: "12px",
          overflow: "hidden",
          marginBottom: "20px",
        }}
      >
        {[
          { label: "MTD SPEND", value: `$${formatCurrency(mtdSpend)}`, sub: "total spend this month" },
          { label: "AI SPEND", value: `$${formatCurrency(aiSpendTotal)}`, sub: "AI workload spend" },
          { label: "AI SHARE", value: `${aiSharePct}%`, sub: "AI as % of total MTD" },
          { label: "BUDGET", value: `$${formatCurrency(monthlyBudget)}`, sub: `${calendar?.daysRemaining ?? 0} days remaining` },
        ].map((s) => (
          <div key={s.label} style={{ background: "#fff", padding: "14px 16px" }}>
            <div style={{ fontSize: "10px", fontWeight: 500, letterSpacing: "0.08em", textTransform: "uppercase", color: "#9ca3af", marginBottom: "6px" }}>{s.label}</div>
            <div style={{ fontSize: "20px", fontWeight: 600, color: "#111827" }}>{s.value}</div>
            <div style={{ fontSize: "11px", color: "#9ca3af", marginTop: "2px" }}>{s.sub}</div>
          </div>
        ))}
      </div>

      <section className="card page-content__full">
        {emptyCreated && (
          <div style={{ padding: "48px 16px", textAlign: "center" }}>
            <p className="card-metric" style={{ marginBottom: 8, fontSize: "var(--text-lg)" }}>No reports created yet</p>
            <p className="card-secondary" style={{ marginBottom: 16 }}>Create your first cost report to get started.</p>
            <Link
              to="/costs/reports/new"
              style={{
                padding: "7px 14px",
                fontSize: "13px",
                fontWeight: 500,
                color: "#111827",
                background: "#ffffff",
                border: "1px solid #e5e5e5",
                borderRadius: "8px",
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                textDecoration: "none",
              }}
            >
              New Cost Report
            </Link>
          </div>
        )}
        {emptyStarred && (
          <div style={{ padding: "48px 16px", textAlign: "center" }}>
            <p className="card-metric" style={{ marginBottom: 8, fontSize: "var(--text-lg)" }}>No starred reports</p>
            <p className="card-secondary">Star a report to see it here.</p>
          </div>
        )}
        {emptyRecent && (
          <div style={{ padding: "48px 16px", textAlign: "center" }}>
            <p className="card-metric" style={{ marginBottom: 8, fontSize: "var(--text-lg)" }}>No recently viewed reports</p>
            <p className="card-secondary">Open a report to see it here.</p>
          </div>
        )}
        {!emptyCreated && !emptyStarred && !emptyRecent && (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
                <div style={{ display: "flex", gap: 0, borderBottom: "1px solid var(--border)" }}>
                  {[
                    { id: TAB_ALL, label: "All Reports" },
                    { id: TAB_AI, label: "AI Cost Reports" },
                    { id: TAB_CLOUD, label: "Cloud Reports" },
                  ].map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setTab(t.id)}
                      style={{
                        padding: "8px 14px",
                        marginBottom: "-1px",
                        fontSize: 13,
                        fontWeight: tab === t.id ? 500 : 400,
                        color: tab === t.id ? "#111827" : "#6b7280",
                        background: "none",
                        border: "none",
                        borderBottom: tab === t.id ? "2px solid #111827" : "2px solid transparent",
                        cursor: "pointer",
                        marginRight: 16,
                      }}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="searchField" style={{ minWidth: 200, marginBottom: 0 }}>
                <input
                  type="text"
                  placeholder="Search reports..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="searchField__input"
                />
                <span className="searchField__icon"><Search size={16} strokeWidth={1.5} /></span>
              </div>
            </div>
            {emptyTabFilter ? (
              <div style={{ padding: "48px 16px", textAlign: "center" }}>
                <p className="card-metric" style={{ marginBottom: 8, fontSize: "var(--text-lg)" }}>
                  {tab === TAB_AI ? "No AI cost reports" : "No reports in this category"}
                </p>
                <p className="card-secondary">Try another tab or adjust your filters.</p>
              </div>
            ) : (
            <div style={{ borderRadius: 12, border: "1px solid var(--border)", overflow: "hidden" }}>
              <table className="w-full" style={{ fontSize: 13 }}>
                <thead>
                  <tr style={{ background: "var(--neutral-bg)", borderBottom: "1px solid var(--border)" }}>
                    <th className="text-left px-4 py-3 font-semibold w-10" style={{ color: "var(--text-xs-muted)", fontSize: 11 }}></th>
                    <th className="text-left px-4 py-3 font-semibold" style={{ color: "var(--text-xs-muted)", fontSize: 11 }}>NAME</th>
                    <th className="text-left px-4 py-3 font-semibold" style={{ color: "var(--text-xs-muted)", fontSize: 11 }}>TEAM</th>
                    <th className="text-left px-4 py-3 font-semibold" style={{ color: "var(--text-xs-muted)", fontSize: 11 }}>TOTAL SPEND</th>
                    <th className="text-left px-4 py-3 font-semibold" style={{ color: "var(--text-xs-muted)", fontSize: 11 }}>AI SPEND</th>
                    <th className="text-left px-4 py-3 font-semibold" style={{ color: "var(--text-xs-muted)", fontSize: 11 }}>CREATED ON</th>
                    <th className="text-left px-4 py-3 font-semibold w-12" style={{ color: "var(--text-xs-muted)", fontSize: 11 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredReports.map((report) => (
                    <tr key={report.id} style={{ borderBottom: "1px solid var(--border)" }} title={`${report.name}: ${formatCurrency(report.spend || 0)} · ${report.team || "—"}`}>
                      <td className="px-4 py-3"><input type="checkbox" className="rounded" /></td>
                      <td className="px-4 py-3">
                        <Link to={`/costs/reports/${report.id}`} className="view-link">{report.name}</Link>
                      </td>
                      <td className="px-4 py-3">{report.team ? <span className="tag">{report.team}</span> : "—"}</td>
                      <td className="px-4 py-3 font-semibold" style={{ color: "var(--text-primary)" }}>${formatCurrency(report.spend || 0)}</td>
                      <td className="px-4 py-3" style={{ color: "var(--text)" }}>{report.aiSpend != null ? `$${formatCurrency(report.aiSpend)}` : "—"}</td>
                      <td className="px-4 py-3 card-secondary">{report.createdOn}</td>
                      <td className="px-4 py-3">
                        <button type="button" className="p-1 rounded" style={{ color: report.starred ? "var(--warning)" : "var(--text-muted)" }} title={report.starred ? "Unstar" : "Star"}>
                          <Star size={16} strokeWidth={1.5} style={{ verticalAlign: "middle" }} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}
