import React, { useState } from "react";
import { Link } from "react-router-dom";
import {
  aiAppsData as _aiApps,
  aiWorkloadsSummary as _aiSummary,
} from "../../mocks/mockAIWorkloads";
const aiAppsData = _aiApps || [];
const aiWorkloadsSummary = { totalSpend: 0, totalTokens: "0", costPer1k: "$0", gpuWastedPerDay: 0, spendTrend: "—", ..._aiSummary };
import { blockSpacing } from "../../constants/designTokens";
import { useRole, useRoleConfig } from "../../context/RoleContext";
import TimeRangeSelector, { useTimeRange } from "../../components/TimeRangeSelector";

function PendingRedesignPanel({ message }) {
  return (
    <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, padding: "32px 24px", textAlign: "center" }}>
      <p style={{ fontSize: 14, color: "var(--text-secondary)", margin: 0 }}>{message}</p>
    </div>
  );
}

function formatCurrency(amount, forceCents = false) {
  if (forceCents || amount < 100) return amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return amount.toLocaleString("en-US", { maximumFractionDigits: 0 });
}
function formatTokens(k) {
  if (k >= 1000) return `${(k / 1000).toFixed(1)}M`;
  return `${k}K`;
}
function formatCompactCost(cost) {
  if (cost >= 1000) return `$${(cost / 1000).toFixed(1)}K`;
  return `$${cost.toLocaleString()}`;
}

const TABS = ["Overview", "Recommendations", "Apps", "Tokens", "Cost", "Projects"];

const ROLE_TAB_ACCESS = {
  finance: TABS,
  technical: TABS,
  data: TABS,
};

function SummaryBar() {
  const { totalSpend, totalTokens, costPer1k, gpuWastedPerDay, spendTrend } = aiWorkloadsSummary;
  const totalInputK = aiAppsData.reduce((s, r) => s + r.inputK, 0);
  const totalOutputK = aiAppsData.reduce((s, r) => s + r.outputK, 0);
  const stats = [
    { label: "Total AI Spend", value: `$${formatCurrency(totalSpend)}/mo` },
    { label: "Tokens", value: totalTokens },
    { label: "Cost/1K", value: costPer1k },
    { label: "GPU Waste/day", value: `$${gpuWastedPerDay}`, valueColor: "#d97706" },
    { label: "MoM trend", value: spendTrend },
  ];
  return (
    <section
      style={{ background: "var(--card)", borderLeft: "4px solid #3B5BDB", borderRadius: 12, padding: "16px 24px", marginBottom: 24, display: "flex", gap: 40, alignItems: "flex-start" }}
      aria-label="AI usage summary"
    >
      {stats.map(({ label, value, valueColor }) => (
        <div key={label}>
          <p style={{ fontSize: "12px", fontWeight: 500, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>{label}</p>
          <p style={{ fontSize: "22px", fontWeight: 600, color: valueColor ?? "#111827", margin: 0 }}>{value}</p>
        </div>
      ))}
    </section>
  );
}

const AI_PROJECTS_ROWS = [
  { id: "ap1", project: "Sales Copilot", team: "Sales", topModel: "GPT-4", tokenUsage: "4.2M tokens", mtdSpend: 3840, trend: "+31%", status: "Over budget", expanded: false },
  { id: "ap2", project: "Chatbot Prod", team: "ML Platform", topModel: "GPT-4", tokenUsage: "3.1M tokens", mtdSpend: 8092, trend: "+18%", status: "At risk", expanded: false },
  { id: "ap3", project: "Internal Search", team: "Engineering", topModel: "Claude Haiku", tokenUsage: "1.8M tokens", mtdSpend: 892, trend: "-3%", status: "On track", expanded: false },
  { id: "ap4", project: "Data Enrichment", team: "Data & Analytics", topModel: "GPT-3.5", tokenUsage: "2.1M tokens", mtdSpend: 630, trend: "+2%", status: "On track", expanded: false },
];

function TabContent({ activeTab, roleId, isFinance, isTechnical, isData, periodLabel = "FEBRUARY 2026" }) {
  const allowed = ROLE_TAB_ACCESS[roleId] || ROLE_TAB_ACCESS.finance;
  const canView = allowed.includes(activeTab);
  const [expandedProjects, setExpandedProjects] = React.useState({});
  const toggleProject = (id) => setExpandedProjects((p) => ({ ...p, [id]: !p[id] }));

  const apps = [
    { name: "Chatbot Prod", team: "Engineering", provider: "OpenAI", model: "GPT-4", spendMTD: 4120, budget: 5000, trend: "+18%", dir: "up", pct: 46, status: "healthy" },
    { name: "Code Assistant", team: "Engineering", provider: "Anthropic", model: "Claude 3.5", spendMTD: 2280, budget: 3000, trend: "+5%", dir: "up", pct: 26, status: "healthy" },
    { name: "Doc Summarizer", team: "Data", provider: "OpenAI", model: "GPT-3.5", spendMTD: 1240, budget: 2000, trend: "-3%", dir: "down", pct: 14, status: "healthy" },
    { name: "Internal Search", team: "Engineering", provider: "Cohere", model: "Embed v3", spendMTD: 620, budget: 1000, trend: "-8%", dir: "down", pct: 7, status: "healthy" },
    { name: "Sales Copilot", team: "Sales", provider: "OpenAI", model: "GPT-4", spendMTD: 380, budget: 400, trend: "+42%", dir: "up", pct: 4, status: "warning" },
    { name: "ML Training", team: "ML Platform", provider: "OpenAI", model: "GPT-4", spendMTD: 280, budget: 500, trend: "+12%", dir: "up", pct: 3, status: "healthy" },
  ];
  const totalAISpend = apps.reduce((s, a) => s + a.spendMTD, 0);
  const optimizations = [
    { title: "Switch Doc Summarizer to GPT-3.5 Turbo batch", detail: "Currently on standard API · batch mode 50% cheaper", saving: 620, effort: "Low", category: "Model switch" },
    { title: "Sales Copilot approaching budget limit", detail: "$380 of $400 budget used · 7 days remaining in month", saving: 320, effort: "Low", category: "Budget control" },
    { title: "Consolidate ML Training jobs to off-peak", detail: "2 jobs running 9am–6pm · off-peak 30% cheaper", saving: 180, effort: "Low", category: "Scheduling" },
    { title: "Negotiate volume discount with OpenAI", detail: "$6,780 MTD spend qualifies for 10–15% volume pricing", saving: 678, effort: "Medium", category: "Procurement" },
    { title: "Replace GPT-4 in Internal Search with Embed v3", detail: "Embedding tasks don't need GPT-4 · Cohere 80% cheaper", saving: 496, effort: "Medium", category: "Model switch" },
  ];

  const costByModel = [
    { model: "GPT-4", provider: "OpenAI", spendMTD: 5512, pct: 62, inputTokens: 6200000, outputTokens: 1800000, costPer1k: 0.52, trend: "+18%", dir: "up" },
    { model: "Claude 3.5 Sonnet", provider: "Anthropic", spendMTD: 2280, pct: 26, inputTokens: 3100000, outputTokens: 980000, costPer1k: 0.38, trend: "+5%", dir: "up" },
    { model: "GPT-3.5 Turbo", provider: "OpenAI", spendMTD: 648, pct: 7, inputTokens: 2800000, outputTokens: 420000, costPer1k: 0.2, trend: "-3%", dir: "down" },
    { model: "Embed v3", provider: "Cohere", spendMTD: 480, pct: 5, inputTokens: 1100000, outputTokens: 0, costPer1k: 0.1, trend: "-8%", dir: "down" },
  ];
  const costByTeam = [
    { team: "Engineering", spendMTD: 6980, budget: 8000, pct: 87 },
    { team: "ML Platform", spendMTD: 980, budget: 1500, pct: 65 },
    { team: "Data", spendMTD: 620, budget: 1000, pct: 62 },
    { team: "Sales", spendMTD: 340, budget: 400, pct: 85 },
  ];
  const monthlyTrend = [
    { month: "Sep", spend: 4200 },
    { month: "Oct", spend: 5100 },
    { month: "Nov", spend: 6300 },
    { month: "Dec", spend: 7180 },
    { month: "Jan", spend: 7560 },
    { month: "Feb", spend: 8920 },
  ];
  const providerColor = { OpenAI: "#f59e0b", Anthropic: "#8b5cf6", Cohere: "#3b82f6" };
  const providerPillStyle = (p) =>
    p === "OpenAI" ? { background: "#fff8f0", color: "#f59e0b", border: "1px solid #fde68a" } : p === "Anthropic" ? { background: "#f5f0ff", color: "#8b5cf6", border: "1px solid #ede9fe" } : { background: "#f0f7ff", color: "#3b82f6", border: "1px solid #dbeafe" };

  const tokensByModel = [
    { model: "GPT-4", provider: "OpenAI", input: 6200000, output: 1800000, total: 8000000, pct: 56, costPer1k: 0.52, efficiency: "High cost", effColor: "#dc2626" },
    { model: "Claude 3.5 Sonnet", provider: "Anthropic", input: 3100000, output: 980000, total: 4080000, pct: 29, costPer1k: 0.38, efficiency: "Efficient", effColor: "#16a34a" },
    { model: "GPT-3.5 Turbo", provider: "OpenAI", input: 2800000, output: 420000, total: 3220000, pct: 23, costPer1k: 0.2, efficiency: "Efficient", effColor: "#16a34a" },
    { model: "Embed v3", provider: "Cohere", input: 1100000, output: 0, total: 1100000, pct: 8, costPer1k: 0.1, efficiency: "Very efficient", effColor: "#16a34a" },
  ];
  const tokensByApp = [
    { app: "Chatbot Prod", team: "Engineering", tokens: 5100000, pct: 36, costImpact: 4120 },
    { app: "Code Assistant", team: "Engineering", tokens: 4080000, pct: 29, costImpact: 2280 },
    { app: "Doc Summarizer", team: "Data", tokens: 3220000, pct: 23, costImpact: 1240 },
    { app: "Internal Search", team: "Engineering", tokens: 1100000, pct: 8, costImpact: 620 },
    { app: "Other", team: "—", tokens: 700000, pct: 5, costImpact: 660 },
  ];
  const effBadgeStyle = (eff) => (eff === "High cost" ? { background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca" } : { background: "#f0fdf4", color: "#16a34a", border: "1px solid #dcfce7" });

  if (!canView) return null;

  if (activeTab === "Overview") return <PendingRedesignPanel message="The AI workload overview is being redesigned for the unified Usage page." />;

  if (activeTab === "Projects") {
    const statusStyle = (s) => (s === "Over budget" ? { background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca" } : s === "At risk" ? { background: "#fffbeb", color: "#d97706", border: "1px solid #fde68a" } : { background: "#f0fdf4", color: "#16a34a", border: "1px solid #dcfce7" });
    return (
      <div style={{ padding: 0 }}>
        <p style={{ fontSize: 10, fontWeight: 500, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 12 }}>AI PROJECTS · {periodLabel}</p>
        <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 100px 100px 100px 80px 80px 90px", gap: 12, fontSize: 10, fontWeight: 500, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.8px", padding: "12px 16px", borderBottom: "1px solid var(--border)" }}>
            <span>PROJECT</span><span>TEAM</span><span>TOP MODEL</span><span>TOKEN USAGE</span><span>MTD SPEND</span><span>TREND</span><span>STATUS</span>
          </div>
          {AI_PROJECTS_ROWS.map((r) => (
            <div key={r.id}>
              <div role="button" tabIndex={0} onClick={() => toggleProject(r.id)} onKeyDown={(e) => e.key === "Enter" && toggleProject(r.id)} style={{ display: "grid", gridTemplateColumns: "1fr 100px 100px 100px 80px 80px 90px", gap: 12, alignItems: "center", padding: "12px 16px", borderBottom: "1px solid var(--border)", cursor: "pointer", background: expandedProjects[r.id] ? "var(--bg-muted)" : "transparent" }}>
                <span style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)" }}>{r.project}</span>
                <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>{r.team}</span>
                <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>{r.topModel}</span>
                <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>{r.tokenUsage}</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)" }}>${r.mtdSpend.toLocaleString()}</span>
                <span style={{ fontSize: 12, color: r.trend.startsWith("+") ? "#d97706" : "#16a34a" }}>{r.trend}</span>
                <span style={{ fontSize: 11, fontWeight: 500, borderRadius: 4, padding: "2px 8px", display: "inline-block", width: "fit-content", ...statusStyle(r.status) }}>{r.status}</span>
              </div>
              {expandedProjects[r.id] && (
                <div style={{ padding: "12px 16px 16px", background: "var(--bg-muted)", borderBottom: "1px solid var(--border)", fontSize: 12 }}>
                  <p style={{ margin: "0 0 8px 0", color: "var(--text-tertiary)" }}>Top services: {r.topModel} · Token usage {r.tokenUsage}</p>
                  <p style={{ margin: "0 0 8px 0", color: "var(--text-muted)" }}>Daily spend (last 7 days): bar placeholder</p>
                  <Link to="/ai-usage" style={{ fontSize: 13, fontWeight: 500, color: "#3B5BDB" }}>View in AI Usage →</Link>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (activeTab === "Recommendations" && isFinance) {
    const totalSavings = optimizations.reduce((s, o) => s + o.saving, 0);
    const lowEffortCount = optimizations.filter((o) => o.effort === "Low").length;
    const effortStyle = (e) => (e === "Low" ? { background: "#f0fdf4", color: "#16a34a", border: "1px solid #dcfce7" } : { background: "#fffbeb", color: "#d97706", border: "1px solid #fde68a" });
    return (
      <div style={{ padding: "0" }}>
        <div style={{ display: "flex", gap: "24px", flexWrap: "wrap", marginBottom: "20px" }}>
          <div>
            <p style={{ fontSize: "10px", fontWeight: 500, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: "4px" }}>Total Opportunities</p>
            <p style={{ fontSize: "22px", fontWeight: 600, color: "#111827", margin: 0 }}>5</p>
          </div>
          <div>
            <p style={{ fontSize: "10px", fontWeight: 500, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: "4px" }}>Estimated Savings</p>
            <p style={{ fontSize: "22px", fontWeight: 600, color: "#111827", margin: 0 }}>$2,294/mo</p>
          </div>
          <div>
            <p style={{ fontSize: "10px", fontWeight: 500, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: "4px" }}>Low Effort</p>
            <p style={{ fontSize: "22px", fontWeight: 600, color: "#111827", margin: 0 }}>3 actions</p>
          </div>
        </div>
        <div style={{ background: "#fff", border: "1px solid #e5e5e5", borderRadius: 12, padding: "20px 24px", marginBottom: 12 }}>
          <p style={{ fontSize: 10, fontWeight: 500, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 12 }}>SAVINGS OPPORTUNITIES · RANKED BY IMPACT</p>
          {optimizations.map((o) => (
            <div key={o.title} style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "14px 0", borderBottom: "1px solid #f9fafb" }}>
              <div>
                <p style={{ fontSize: "13px", fontWeight: 500, color: "#111827", margin: 0 }}>{o.title}</p>
                <p style={{ fontSize: "12px", color: "#6b7280", marginTop: "3px" }}>{o.detail}</p>
                <span style={{ fontSize: "11px", borderRadius: "4px", padding: "2px 7px", border: "1px solid #e5e5e5", background: "#f9fafb", color: "#6b7280", display: "inline-block", marginTop: "6px" }}>{o.category}</span>
              </div>
              <div style={{ textAlign: "right", flexShrink: 0, marginLeft: "24px" }}>
                <p style={{ fontSize: "14px", fontWeight: 600, color: "#16a34a", margin: 0 }}>${o.saving}/mo</p>
                <span style={{ fontSize: "11px", fontWeight: 500, borderRadius: "9999px", padding: "2px 8px", marginTop: "4px", display: "inline-block", ...effortStyle(o.effort) }}>{o.effort}</span>
              </div>
            </div>
          ))}
          <div style={{ display: "flex", justifyContent: "space-between", paddingTop: "14px", marginTop: "2px" }}>
            <p style={{ fontSize: "12px", color: "#9ca3af", margin: 0 }}>5 opportunities identified</p>
            <p style={{ fontSize: "14px", fontWeight: 600, color: "#16a34a", margin: 0 }}>$2,294/mo total savings</p>
          </div>
        </div>
      </div>
    );
  }
  if (activeTab === "Recommendations") return <PendingRedesignPanel message="Recommendations have moved to the new /recommendations page." />;

  if (activeTab === "Apps") {
    if (isFinance) {
      const sortedApps = [...apps].sort((a, b) => b.spendMTD - a.spendMTD);
      const barColor = (a) => (a.status === "warning" ? "#dc2626" : a.dir === "up" && a.pct > 40 ? "#d97706" : "#6366f1");
      return (
        <div style={{ padding: "0" }}>
          <p style={{ fontSize: "10px", fontWeight: 500, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: "16px" }}>AI APPLICATIONS · SPEND BY APP · MTD</p>
          {sortedApps.map((a) => {
            const row = (
              <>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", paddingBottom: "14px", marginBottom: a.status === "warning" ? "8px" : "14px", borderBottom: a.status === "warning" ? "none" : "1px solid #f9fafb" }}>
                  <div>
                    <p style={{ fontSize: "13px", fontWeight: 500, color: "#111827", margin: 0 }}>{a.name}</p>
                    <span style={{ fontSize: "11px", color: "#6b7280", background: "#f9fafb", border: "1px solid #e5e5e5", borderRadius: "4px", padding: "1px 7px", display: "inline-block", marginTop: "3px" }}>{a.team}</span>
                  </div>
                  <div style={{ flex: 1, margin: "0 20px", paddingTop: "8px" }}>
                    <div style={{ height: "3px", borderRadius: "9999px", background: "#f3f4f6", overflow: "hidden" }}>
                      <div style={{ height: "3px", borderRadius: "9999px", width: `${a.pct}%`, background: barColor(a) }} />
                    </div>
                    <p style={{ fontSize: "11px", color: "#9ca3af", marginTop: "4px" }}>{a.provider} · {a.model}</p>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <p style={{ fontSize: "14px", fontWeight: 600, color: "#111827", margin: 0 }}>${a.spendMTD.toLocaleString()}</p>
                    <p style={{ fontSize: "11px", color: "#9ca3af", margin: 0 }}>of ${a.budget.toLocaleString()} budget</p>
                    <p style={{ fontSize: "12px", fontWeight: 500, marginTop: "2px", color: a.dir === "up" ? "#d97706" : "#16a34a" }}>{a.dir === "up" ? "↑ " : "↓ "}{a.trend}</p>
                  </div>
                </div>
                {a.status === "warning" && <p style={{ fontSize: "11px", color: "#d97706", margin: 0 }}>⚠ Sales Copilot at 95% of budget · 7 days remaining</p>}
              </>
            );
            if (a.status === "warning") return <div key={a.name} style={{ background: "#fffbeb", borderRadius: "8px", padding: "12px 14px", border: "1px solid #fde68a", marginBottom: "14px" }}>{row}</div>;
            return <div key={a.name}>{row}</div>;
          })}
          <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 12, marginTop: 4, borderTop: "1px solid #f3f4f6" }}>
            <p style={{ fontSize: 12, color: "#9ca3af", margin: 0 }}>6 active apps · 3 providers</p>
            <p style={{ fontSize: 13, fontWeight: 600, color: "#111827", margin: 0 }}>${totalAISpend.toLocaleString()} total MTD</p>
          </div>
        </div>
      );
    }
    const totalCost = aiAppsData.reduce((s, r) => s + r.cost, 0);
    return (
      <div className="overview-page p-6 md:p-8 max-w-6xl">
        <section className="overview-card" style={{ marginBottom: blockSpacing }}>
          <p style={{ fontSize: "10px", fontWeight: 500, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 8 }}>AI APPS BY MODEL</p>
          <div className="space-y-2">
            {aiAppsData.map((row) => {
              const pctOfTotal = totalCost > 0 ? (row.cost / totalCost) * 100 : 0;
              const total = row.inputK + row.outputK;
              const inputPct = total > 0 ? row.inputK / total : 1;
              const outputPct = total > 0 ? row.outputK / total : 0;
              return (
                <div key={row.app}>
                  <div className="flex items-center gap-3 py-2 text-sm" style={{ borderBottom: "1px solid var(--border-light)" }}>
                    <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: "var(--ai-accent)" }} />
                    <span className="flex-1 truncate" style={{ color: "var(--text)" }}>{row.app} · {row.model}</span>
                    <span className="shrink-0" style={{ color: "var(--text)" }}>{formatCompactCost(row.cost)}</span>
                    <span className="shrink-0 text-xs" style={{ color: "var(--text-tertiary)" }}>{row.pct}%</span>
                  </div>
                  <div className="rounded-full overflow-hidden mt-1 flex w-full" style={{ height: "3px", background: "var(--bg-inset)", borderRadius: "var(--radius-full)" }}>
                    <div className="h-full rounded-l-full shrink-0" style={{ width: `${pctOfTotal * inputPct}%`, backgroundColor: "var(--primary)" }} />
                    <div className="h-full rounded-r-full shrink-0" style={{ width: `${pctOfTotal * outputPct}%`, backgroundColor: "#8b5cf6" }} />
                  </div>
                  <div className="flex justify-between mt-1 text-xs" style={{ color: "var(--text-tertiary)" }}>
                    <span>Input: {formatTokens(row.inputK)}</span>
                    <span>Output: {row.outputK ? formatTokens(row.outputK) : "—"}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    );
  }

  if (activeTab === "Tokens") {
    if (isFinance) {
      return (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "16px" }}>
          <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "12px", padding: "20px 24px" }}>
            <p style={{ fontSize: "10px", fontWeight: 500, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: "16px" }}>TOKEN SPEND BY MODEL · MTD</p>
            {tokensByModel.map((m) => {
              const spend = Math.round((m.costPer1k * m.total) / 1000);
              return (
                <div key={m.model} style={{ padding: "10px 0", borderBottom: "1px solid #f9fafb" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "4px" }}>
                    <span style={{ fontSize: "13px", fontWeight: 500, color: "#111827", fontFamily: "monospace" }}>{m.model}</span>
                    <span style={{ fontSize: "13px", fontWeight: 600, color: "#111827" }}>${spend.toLocaleString()}</span>
                  </div>
                  <div style={{ height: "3px", borderRadius: "9999px", background: "#f3f4f6", overflow: "hidden", marginBottom: "4px" }}>
                    <div style={{ height: "3px", borderRadius: "9999px", width: `${m.pct}%`, background: providerColor[m.provider] }} />
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "4px" }}>
                    <span style={{ fontSize: "11px", color: "#9ca3af" }}>${m.costPer1k}/1K tokens</span>
                    <span style={{ fontSize: "10px", fontWeight: 500, borderRadius: "9999px", padding: "1px 7px", marginTop: "4px", display: "inline-block", ...effBadgeStyle(m.efficiency) }}>{m.efficiency}</span>
                  </div>
                </div>
              );
            })}
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: "12px", fontSize: "12px", color: "#9ca3af" }}>
              <span>14.2M total tokens</span>
              <span style={{ fontWeight: 600, color: "#111827" }}>$8,920 total spend</span>
            </div>
          </div>
          <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "12px", padding: "20px 24px" }}>
            <p style={{ fontSize: "10px", fontWeight: 500, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: "16px" }}>COST IMPACT BY APP · MTD</p>
            {tokensByApp.map((a) => (
              <div key={a.app} style={{ padding: "10px 0", borderBottom: "1px solid #f9fafb" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "4px" }}>
                  <span style={{ fontSize: "13px", fontWeight: 500, color: "#111827" }}>{a.app}</span>
                  <span style={{ fontSize: "13px", fontWeight: 600, color: "#111827" }}>${a.costImpact.toLocaleString()}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                  <span style={{ fontSize: "11px", color: "#6b7280", background: "#f9fafb", border: "1px solid #e5e5e5", borderRadius: "4px", padding: "1px 7px" }}>{a.team}</span>
                </div>
                <div style={{ height: "3px", borderRadius: "9999px", background: "#f3f4f6", overflow: "hidden", marginBottom: "4px" }}>
                  <div style={{ height: "3px", borderRadius: "9999px", width: `${a.pct}%`, background: "#6366f1" }} />
                </div>
                <span style={{ fontSize: "11px", color: "#9ca3af" }}>{(a.tokens / 1000000).toFixed(1)}M tokens</span>
              </div>
            ))}
            <p style={{ fontSize: "12px", color: "#9ca3af", marginTop: "12px", margin: "12px 0 0 0" }}>5 active applications · 14.2M tokens this month</p>
          </div>
        </div>
      );
    }
    const totalInput = tokensByModel.reduce((s, m) => s + m.input, 0);
    const totalOutput = tokensByModel.reduce((s, m) => s + m.output, 0);
    const inputOutputRatio = totalOutput > 0 ? (totalInput / totalOutput).toFixed(1) : "—";
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "12px", padding: "20px 24px", marginBottom: "16px" }}>
          <p style={{ fontSize: "10px", fontWeight: 500, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: "16px" }}>TOKEN CONSUMPTION BY MODEL · MTD</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 80px 100px 100px 80px 90px 90px", gap: "0 12px", alignItems: "center", paddingBottom: "10px", borderBottom: "1px solid #f3f4f6", marginBottom: "2px" }}>
            <span style={{ fontSize: "10px", fontWeight: 500, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.8px" }}>MODEL</span>
            <span style={{ fontSize: "10px", fontWeight: 500, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.8px" }}>PROVIDER</span>
            <span style={{ fontSize: "10px", fontWeight: 500, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.8px" }}>TOTAL</span>
            <span style={{ fontSize: "10px", fontWeight: 500, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.8px" }}>INPUT</span>
            <span style={{ fontSize: "10px", fontWeight: 500, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.8px" }}>OUTPUT</span>
            <span style={{ fontSize: "10px", fontWeight: 500, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.8px" }}>COST/1K</span>
            <span style={{ fontSize: "10px", fontWeight: 500, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.8px" }}>EFFICIENCY</span>
          </div>
          {tokensByModel.map((m) => (
            <div key={m.model} style={{ display: "grid", gridTemplateColumns: "1fr 80px 100px 100px 80px 90px 90px", gap: "0 12px", alignItems: "center", padding: "12px 0", borderBottom: "1px solid #f9fafb" }}>
              <span style={{ fontSize: "13px", fontWeight: 500, color: "#111827", fontFamily: "monospace" }}>{m.model}</span>
              <span style={{ fontSize: "11px", fontWeight: 500, borderRadius: "9999px", padding: "2px 8px", ...providerPillStyle(m.provider) }}>{m.provider}</span>
              <span style={{ fontSize: "13px", fontWeight: 500, color: "#111827" }}>{(m.total / 1000000).toFixed(1)}M</span>
              <span style={{ fontSize: "12px", color: "#374151" }}>{(m.input / 1000000).toFixed(1)}M</span>
              <span style={{ fontSize: "12px", color: "#6b7280" }}>{m.output === 0 ? "—" : `${(m.output / 1000000).toFixed(1)}M`}</span>
              <span style={{ fontSize: "12px", fontFamily: "monospace", color: m.costPer1k > 0.4 ? "#d97706" : "#374151" }}>${m.costPer1k}</span>
              <span style={{ fontSize: "10px", fontWeight: 500, borderRadius: "9999px", padding: "1px 7px", ...effBadgeStyle(m.efficiency) }}>{m.efficiency}</span>
            </div>
          ))}
          <div style={{ marginTop: "14px", display: "flex", gap: "32px", flexWrap: "wrap" }}>
            <div>
              <p style={{ fontSize: "16px", fontWeight: 600, color: "#111827", margin: 0 }}>{inputOutputRatio} : 1</p>
              <p style={{ fontSize: "11px", color: "#9ca3af", margin: "2px 0 0 0" }}>input / output ratio</p>
            </div>
            <div>
              <p style={{ fontSize: "16px", fontWeight: 600, color: "#d97706", margin: 0 }}>GPT-4</p>
              <p style={{ fontSize: "11px", color: "#9ca3af", margin: "2px 0 0 0" }}>56% of all tokens</p>
            </div>
            <div>
              <p style={{ fontSize: "16px", fontWeight: 600, color: "#16a34a", margin: 0 }}>Embed v3</p>
              <p style={{ fontSize: "11px", color: "#9ca3af", margin: "2px 0 0 0" }}>$0.10/1K · 10× cheaper than GPT-4</p>
            </div>
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "16px" }}>
          <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "12px", padding: "20px 24px" }}>
            <p style={{ fontSize: "10px", fontWeight: 500, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: "16px" }}>BY APPLICATION · MTD</p>
            {tokensByApp.map((a) => (
              <div key={a.app} style={{ padding: "10px 0", borderBottom: "1px solid #f9fafb" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "4px" }}>
                  <span style={{ fontSize: "13px", fontWeight: 500, color: "#111827" }}>{a.app}</span>
                  <span style={{ fontSize: "13px", fontWeight: 500, color: "#111827" }}>{(a.tokens / 1000000).toFixed(1)}M</span>
                </div>
                <span style={{ fontSize: "11px", color: "#6b7280", background: "#f9fafb", border: "1px solid #e5e5e5", borderRadius: "4px", padding: "1px 7px", display: "inline-block", marginBottom: "4px" }}>{a.team}</span>
                <div style={{ height: "3px", borderRadius: "9999px", background: "#f3f4f6", overflow: "hidden", marginBottom: "4px" }}>
                  <div style={{ height: "3px", borderRadius: "9999px", width: `${a.pct}%`, background: "#6366f1" }} />
                </div>
                <span style={{ fontSize: "11px", color: "#9ca3af" }}>{a.pct}% of total</span>
              </div>
            ))}
            <p style={{ fontSize: "12px", color: "#9ca3af", marginTop: "12px", margin: "12px 0 0 0" }}>14.2M total · 5 apps</p>
          </div>
          <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "12px", padding: "20px 24px" }}>
            <p style={{ fontSize: "10px", fontWeight: 500, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: "16px" }}>INPUT vs OUTPUT · BY MODEL</p>
            {tokensByModel.map((m) => (
              <div key={m.model} style={{ marginBottom: "12px" }}>
                <p style={{ fontSize: "12px", fontWeight: 500, color: "#111827", fontFamily: "monospace", marginBottom: "6px", margin: "0 0 6px 0" }}>{m.model}</p>
                <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px" }}>
                  <span style={{ fontSize: "10px", color: "#9ca3af", width: "28px" }}>In</span>
                  <div style={{ flex: 1, background: "#f3f4f6", borderRadius: "3px", height: "6px", overflow: "hidden" }}>
                    <div style={{ width: `${m.total > 0 ? (m.input / m.total) * 100 : 0}%`, height: "6px", background: "#6366f1", borderRadius: "3px" }} />
                  </div>
                  <span style={{ fontSize: "11px", color: "#374151", marginLeft: "8px" }}>{(m.input / 1000000).toFixed(1)}M</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px" }}>
                  <span style={{ fontSize: "10px", color: "#9ca3af", width: "28px" }}>Out</span>
                  <div style={{ flex: 1, background: "#f3f4f6", borderRadius: "3px", height: "6px", overflow: "hidden" }}>
                    <div style={{ width: `${m.total > 0 ? (m.output / m.total) * 100 : 0}%`, height: "6px", background: "#a5b4fc", borderRadius: "3px" }} />
                  </div>
                  <span style={{ fontSize: "11px", color: "#374151", marginLeft: "8px" }}>{m.output === 0 ? "—" : `${(m.output / 1000000).toFixed(1)}M`}</span>
                </div>
              </div>
            ))}
            <p style={{ fontSize: "11px", color: "#9ca3af", marginTop: "8px", margin: "8px 0 0 0" }}>
              <span style={{ display: "inline-block", width: "8px", height: "8px", background: "#6366f1", borderRadius: "2px", marginRight: "4px", verticalAlign: "middle" }} /> Input
              {" "}
              <span style={{ display: "inline-block", width: "8px", height: "8px", background: "#a5b4fc", borderRadius: "2px", marginRight: "4px", verticalAlign: "middle" }} /> Output
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (activeTab === "Cost") {
    const costTotal = costByModel.reduce((s, m) => s + m.spendMTD, 0);
    const maxSpend = 8920;
    const showCostDetail = isTechnical || isData;
    const gridCols = showCostDetail ? "1fr 80px 100px 80px 90px 80px" : "1fr 80px 100px 80px";
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "12px", padding: "20px 24px", marginBottom: "16px" }}>
          <p style={{ fontSize: "10px", fontWeight: 500, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: "16px" }}>COST BY MODEL · MTD</p>
          <div style={{ display: "grid", gridTemplateColumns: gridCols, gap: "0 12px", alignItems: "center", paddingBottom: "10px", borderBottom: "1px solid #f3f4f6", marginBottom: "2px" }}>
            <span style={{ fontSize: "10px", fontWeight: 500, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.8px" }}>MODEL</span>
            <span style={{ fontSize: "10px", fontWeight: 500, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.8px" }}>PROVIDER</span>
            <span style={{ fontSize: "10px", fontWeight: 500, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.8px" }}>SPEND</span>
            <span style={{ fontSize: "10px", fontWeight: 500, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.8px" }}>SHARE</span>
            {showCostDetail && <span style={{ fontSize: "10px", fontWeight: 500, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.8px" }}>COST/1K</span>}
            {showCostDetail && <span style={{ fontSize: "10px", fontWeight: 500, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.8px" }}>TREND</span>}
          </div>
          {costByModel.map((m) => (
            <div key={m.model} style={{ display: "grid", gridTemplateColumns: gridCols, gap: "0 12px", alignItems: "center", padding: "12px 0", borderBottom: "1px solid #f9fafb" }}>
              <div>
                <p style={{ fontSize: "13px", fontWeight: 500, color: "#111827", fontFamily: "monospace", margin: 0 }}>{m.model}</p>
                <p style={{ fontSize: "11px", color: "#9ca3af", margin: "2px 0 0 0" }}>{m.provider}</p>
              </div>
              <span style={{ fontSize: "11px", fontWeight: 500, borderRadius: "9999px", padding: "2px 8px", ...providerPillStyle(m.provider) }}>{m.provider}</span>
              <span style={{ fontSize: "13px", fontWeight: 500, color: "#111827" }}>${m.spendMTD.toLocaleString()}</span>
              <div>
                <div style={{ height: "3px", borderRadius: "9999px", background: "#f3f4f6", overflow: "hidden" }}>
                  <div style={{ height: "3px", borderRadius: "9999px", width: `${m.pct}%`, background: providerColor[m.provider] }} />
                </div>
                <p style={{ fontSize: "11px", color: "#9ca3af", marginTop: "3px", margin: "3px 0 0 0" }}>{m.pct}%</p>
              </div>
              {showCostDetail && <span style={{ fontSize: "12px", color: m.model === "GPT-4" ? "#d97706" : "#374151" }}>${m.costPer1k}</span>}
              {showCostDetail && <span style={{ fontSize: "12px", fontWeight: 500, color: m.dir === "up" ? "#d97706" : "#16a34a" }}>{m.dir === "up" ? "↑" : "↓"}{m.trend}</span>}
            </div>
          ))}
          <div style={{ display: "flex", justifyContent: "space-between", paddingTop: "12px", fontSize: "12px", color: "#9ca3af" }}>
            <span>4 models · 3 providers</span>
            <span style={{ fontWeight: 600, color: "#111827" }}>${costTotal.toLocaleString()} total MTD</span>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "16px" }}>
          <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "12px", padding: "20px 24px" }}>
            <p style={{ fontSize: "10px", fontWeight: 500, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: "16px" }}>BY TEAM · MTD</p>
            {costByTeam.map((t) => (
              <div key={t.team} style={{ padding: "10px 0", borderBottom: "1px solid #f9fafb" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "4px" }}>
                  <span style={{ fontSize: "13px", fontWeight: 500, color: "#111827" }}>{t.team}</span>
                  <span style={{ fontSize: "13px", fontWeight: 500, color: "#111827" }}>${t.spendMTD.toLocaleString()}</span>
                </div>
                <div style={{ height: "3px", borderRadius: "9999px", background: "#f3f4f6", overflow: "hidden", marginBottom: "4px" }}>
                  <div style={{ height: "3px", borderRadius: "9999px", width: `${t.pct}%`, background: "#6366f1" }} />
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: "11px", color: "#9ca3af" }}>${t.spendMTD.toLocaleString()} of ${t.budget.toLocaleString()}</span>
                  <span style={{ fontSize: "11px", fontWeight: 500, color: t.pct > 80 ? "#d97706" : "#9ca3af" }}>{t.pct}%</span>
                </div>
              </div>
            ))}
          </div>
          <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "12px", padding: "20px 24px" }}>
            <p style={{ fontSize: "10px", fontWeight: 500, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: "16px" }}>SPEND TREND · SEP–FEB</p>
            <div style={{ display: "flex", alignItems: "flex-end", gap: "8px", height: "120px", paddingBottom: "4px" }}>
              {monthlyTrend.map((d) => (
                <div key={d.month} style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: 1, height: "100%", justifyContent: "flex-end" }}>
                  <span style={{ fontSize: "10px", color: d.month === "Feb" ? "#6366f1" : "#374151", marginBottom: "4px", fontWeight: d.month === "Feb" ? 600 : 400 }}>{(d.spend / 1000).toFixed(1)}K</span>
                  <div
                    style={{
                      width: "100%",
                      maxWidth: "32px",
                      height: `${(d.spend / maxSpend) * 80}px`,
                      background: d.month === "Feb" ? "#6366f1" : "#e0e7ff",
                      borderRadius: "4px 4px 0 0",
                    }}
                  />
                  <span style={{ fontSize: "10px", color: "#9ca3af", marginTop: "6px" }}>{d.month}</span>
                </div>
              ))}
            </div>
            <p style={{ fontSize: "12px", color: "#9ca3af", marginTop: "8px", margin: "8px 0 0 0" }}>↑ 112% growth · Sep 2025 → Feb 2026</p>
          </div>
        </div>
      </div>
    );
  }

  return null;
}

export default function AIUsagePage() {
  const [activeTab, setActiveTab] = useState("Overview");
  const { role } = useRole();
  const roleConfig = useRoleConfig();
  const roleId = role?.id ?? "finance";
  const isFinance = roleId === "finance";
  const isTechnical = roleId === "technical";
  const isData = roleId === "data";

  const allowedTabs = ROLE_TAB_ACCESS[roleId] || ROLE_TAB_ACCESS.finance;
  const visibleTabs = TABS.filter((t) => allowedTabs.includes(t));
  React.useEffect(() => {
    if (!visibleTabs.includes(activeTab)) {
      setActiveTab(visibleTabs[0] || TABS[0]);
    }
  }, [roleId]);

  const timeRange = useTimeRange("MTD");

  return (
    <div className="overview-page" style={{ padding: 32, maxWidth: 960, background: "#f9fafb" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16, marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 16, fontWeight: 500, color: "#111827", margin: 0, marginBottom: 4, lineHeight: 1.2 }}>AI Usage</h1>
          <p style={{ fontSize: 14, color: "#6b7280", fontWeight: 400 }}>
            Token consumption, model spend, and optimization across all AI workloads
          </p>
          <p style={{ fontSize: 12, color: "#9ca3af", marginTop: 6, fontWeight: 500 }}>
            View: {roleConfig.greeting}
          </p>
        </div>
        <TimeRangeSelector value={timeRange.value} onChange={timeRange.setValue} customFrom={timeRange.customFrom} customTo={timeRange.customTo} onCustomFromChange={timeRange.setCustomFrom} onCustomToChange={timeRange.setCustomTo} />
      </div>
      <SummaryBar />
      <div style={{ display: "flex", gap: 6, marginBottom: 20 }}>
        {visibleTabs.map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            style={{
              padding: "4px 12px",
              fontSize: 12,
              fontWeight: activeTab === tab ? 600 : 400,
              borderRadius: 6,
              border: `1px solid ${activeTab === tab ? "#111827" : "#e5e5e5"}`,
              background: activeTab === tab ? "#111827" : "#fff",
              color: activeTab === tab ? "#fff" : "#6b7280",
              cursor: "pointer",
              whiteSpace: "nowrap",
              transition: "all 120ms ease",
            }}
          >
            {tab}
          </button>
        ))}
      </div>
      <TabContent activeTab={activeTab} roleId={roleId} isFinance={isFinance} isTechnical={isTechnical} isData={isData} periodLabel={timeRange.periodLabel} />
    </div>
  );
}
