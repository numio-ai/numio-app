import React, { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { RefreshCw, AlertTriangle, CheckCircle2, TrendingUp, Copy, ChevronDown, ChevronRight, Plus, X, Pencil, Trash2, Eye, ClipboardCopy } from "lucide-react";
import { formatCurrency } from "../../utils/format";
import * as api from "../../api/tagGovernance";
import LoadingSpinner from "../../components/LoadingSpinner";
import PolicyEditorModal from "./PolicyEditorModal";
import CampaignDetailModal from "./CampaignDetailModal";
import CreateCampaignModal from "./CreateCampaignModal";

// ---------------------------------------------------------------------------
// Style tokens (matching existing app patterns)
// ---------------------------------------------------------------------------
const sectionLabel = {
  fontSize: 10, fontWeight: 500, color: "#9ca3af",
  textTransform: "uppercase", letterSpacing: "0.8px", margin: 0,
};
const cardBox = {
  background: "#fff", border: "1px solid #e5e5e5", borderRadius: 12,
  padding: "20px 24px", marginBottom: 16,
};
const btnPrimary = {
  background: "#111827", color: "#fff", border: "none", borderRadius: 8,
  fontSize: 13, fontWeight: 500, padding: "8px 18px", cursor: "pointer",
  display: "inline-flex", alignItems: "center", gap: 6,
};
const btnSecondary = {
  background: "#f9fafb", color: "#111827", border: "1px solid #e5e5e5",
  borderRadius: 8, fontSize: 12, fontWeight: 500, padding: "6px 14px",
  cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4,
};
const thStyle = {
  fontSize: 10, fontWeight: 500, color: "#9ca3af",
  textTransform: "uppercase", letterSpacing: "0.8px", textAlign: "left",
  padding: "8px 12px",
};
const tdStyle = { fontSize: 13, color: "#111827", padding: "10px 12px" };

function covColor(pct) {
  if (pct >= 85) return "#16a34a";
  if (pct >= 70) return "#d97706";
  return "#dc2626";
}

function statusBadge(status) {
  const map = {
    active: { bg: "#f0fdf4", color: "#16a34a", border: "#dcfce7", label: "Active" },
    completed: { bg: "#f0f9ff", color: "#0284c7", border: "#bae6fd", label: "Completed" },
    archived: { bg: "#f9fafb", color: "#6b7280", border: "#e5e5e5", label: "Archived" },
  };
  const s = map[status] || map.active;
  return (
    <span style={{ fontSize: 11, fontWeight: 500, color: s.color, background: s.bg, border: `1px solid ${s.border}`, borderRadius: 9999, padding: "2px 10px" }}>
      {s.label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Loading / Empty / Error states
// ---------------------------------------------------------------------------
function LoadingState({ message = "Loading..." }) {
  return (
    <div style={{ ...cardBox, padding: "24px" }}>
      <LoadingSpinner message={message} />
    </div>
  );
}

function EmptyState({ title, subtitle }) {
  return (
    <div style={{ ...cardBox, textAlign: "center", padding: "48px 24px" }}>
      <AlertTriangle size={24} color="#d97706" style={{ marginBottom: 12 }} />
      <p style={{ fontSize: 14, fontWeight: 500, color: "#111827", margin: "0 0 4px 0" }}>{title}</p>
      <p style={{ fontSize: 13, color: "#6b7280", margin: 0 }}>{subtitle}</p>
    </div>
  );
}

function ErrorState({ message, onRetry }) {
  return (
    <div style={{ ...cardBox, textAlign: "center", padding: "48px 24px" }}>
      <AlertTriangle size={24} color="#dc2626" style={{ marginBottom: 12 }} />
      <p style={{ fontSize: 14, fontWeight: 500, color: "#dc2626", margin: "0 0 8px 0" }}>Error loading data</p>
      <p style={{ fontSize: 13, color: "#6b7280", margin: "0 0 12px 0" }}>{message}</p>
      {onRetry && <button type="button" style={btnSecondary} onClick={onRetry}>Retry</button>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------
export default function TagGovernancePage() {
  const [searchParams] = useSearchParams();

  // Data state
  const [summary, setSummary] = useState(null);
  const [byTag, setByTag] = useState(null);
  const [byAccount, setByAccount] = useState(null);
  const [trend, setTrend] = useState(null);
  const [nonCompliant, setNonCompliant] = useState(null);
  const [policies, setPolicies] = useState(null);
  const [campaigns, setCampaigns] = useState(null);

  // UI state
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState("dashboard"); // dashboard | policies | campaigns
  const [policyModal, setPolicyModal] = useState({ open: false, policy: null });
  const [campaignDetail, setCampaignDetail] = useState(null);
  const [createCampaign, setCreateCampaign] = useState({ open: false, resourceIds: [] });
  const [selectedResources, setSelectedResources] = useState(new Set());

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [summaryRes, byTagRes, byAccountRes, trendRes, nonCompliantRes, policiesRes, campaignsRes] =
        await Promise.all([
          api.getComplianceSummary(),
          api.getComplianceByDimension("per_tag"),
          api.getComplianceByDimension("per_account"),
          api.getComplianceTrend(),
          api.listNonCompliant({ limit: 50 }),
          api.listPolicies(),
          api.listCampaigns(),
        ]);
      setSummary(summaryRes);
      setByTag(byTagRes);
      setByAccount(byAccountRes);
      setTrend(trendRes);
      setNonCompliant(nonCompliantRes);
      setPolicies(policiesRes);
      setCampaigns(campaignsRes);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // Handle URL query params for deep-linking (e.g., ?filter=missing-tag&tag=team)
  const filterTag = searchParams.get("tag");
  const filterType = searchParams.get("filter");

  const overallScore = summary?.overall?.cost_weighted_score != null
    ? Number(summary.overall.cost_weighted_score)
    : null;

  const tabs = [
    { id: "dashboard", label: "Dashboard" },
    { id: "policies", label: `Policies (${policies?.count ?? 0})` },
    { id: "campaigns", label: `Campaigns (${campaigns?.count ?? 0})` },
  ];

  const handleCreateCampaignFromSelected = () => {
    setCreateCampaign({ open: true, resourceIds: Array.from(selectedResources) });
  };

  const handleCampaignCreated = () => {
    setCreateCampaign({ open: false, resourceIds: [] });
    setSelectedResources(new Set());
    loadData();
  };

  const handlePolicySaved = () => {
    setPolicyModal({ open: false, policy: null });
    loadData();
  };

  const handleDeletePolicy = async (id) => {
    try {
      await api.deletePolicy(id);
      loadData();
    } catch (err) {
      alert("Failed to delete policy: " + err.message);
    }
  };

  return (
    <div className="overview-page" style={{ padding: 32, maxWidth: 1060, background: "#f9fafb" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 16, fontWeight: 500, color: "#111827", margin: 0, marginBottom: 4, lineHeight: 1.2 }}>Tag Governance</h1>
          <p style={{ fontSize: 14, color: "#6b7280", fontWeight: 400, margin: 0 }}>Monitor tagging compliance, manage policies, and drive remediation</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" style={btnSecondary} onClick={loadData}>
            <RefreshCw size={14} /> Refresh
          </button>
          <button type="button" style={btnPrimary} onClick={() => setPolicyModal({ open: true, policy: null })}>
            <Plus size={14} /> New Policy
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 0, borderBottom: "1px solid #e5e5e5", marginBottom: 24 }}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            style={{
              background: "none", border: "none", borderBottom: activeTab === tab.id ? "2px solid #111827" : "2px solid transparent",
              padding: "10px 20px", fontSize: 13, fontWeight: activeTab === tab.id ? 500 : 400,
              color: activeTab === tab.id ? "#111827" : "#6b7280", cursor: "pointer",
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {error && <ErrorState message={error} onRetry={loadData} />}
      {loading && !error && <LoadingState message="Loading compliance data..." />}

      {!loading && !error && activeTab === "dashboard" && (
        <DashboardTab
          summary={summary}
          byTag={byTag}
          byAccount={byAccount}
          trend={trend}
          nonCompliant={nonCompliant}
          campaigns={campaigns}
          overallScore={overallScore}
          filterTag={filterTag}
          filterType={filterType}
          selectedResources={selectedResources}
          setSelectedResources={setSelectedResources}
          onCreateCampaign={handleCreateCampaignFromSelected}
          onViewCampaign={setCampaignDetail}
        />
      )}

      {!loading && !error && activeTab === "policies" && (
        <PoliciesTab
          policies={policies}
          onEdit={(p) => setPolicyModal({ open: true, policy: p })}
          onDelete={handleDeletePolicy}
          onCreate={() => setPolicyModal({ open: true, policy: null })}
        />
      )}

      {!loading && !error && activeTab === "campaigns" && (
        <CampaignsTab
          campaigns={campaigns}
          onView={setCampaignDetail}
        />
      )}

      {/* Modals */}
      {policyModal.open && (
        <PolicyEditorModal
          policy={policyModal.policy}
          onClose={() => setPolicyModal({ open: false, policy: null })}
          onSaved={handlePolicySaved}
        />
      )}
      {campaignDetail && (
        <CampaignDetailModal
          campaignId={campaignDetail}
          onClose={() => setCampaignDetail(null)}
          onUpdated={loadData}
        />
      )}
      {createCampaign.open && (
        <CreateCampaignModal
          resourceIds={createCampaign.resourceIds}
          onClose={() => setCreateCampaign({ open: false, resourceIds: [] })}
          onCreated={handleCampaignCreated}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Dashboard Tab
// ---------------------------------------------------------------------------
function DashboardTab({ summary, byTag, byAccount, trend, nonCompliant, campaigns, overallScore, filterTag, filterType, selectedResources, setSelectedResources, onCreateCampaign, onViewCampaign }) {
  if (!summary?.overall) {
    return <EmptyState title="No compliance data yet" subtitle="Run a compliance audit first, or create tag policies to get started." />;
  }

  const trendData = (trend?.trend || []).map((p) => ({
    date: new Date(p.snapshot_date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    score: Number(p.cost_weighted_score),
  }));

  // Filter non-compliant list by URL params if present
  let filteredResults = nonCompliant?.results || [];
  if (filterTag) {
    filteredResults = filteredResults.filter((r) => r.tag_name === filterTag);
  }
  if (filterType === "missing-tag") {
    filteredResults = filteredResults.filter((r) => r.status === "missing_tag");
  } else if (filterType === "invalid-value") {
    filteredResults = filteredResults.filter((r) => r.status === "invalid_value");
  }

  const toggleResource = (id) => {
    setSelectedResources((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <>
      {/* KPI Strip */}
      <section style={{ background: "var(--card)", borderLeft: "4px solid #3B5BDB", borderRadius: 12, padding: "16px 24px", marginBottom: 24, display: "flex", gap: 40, flexWrap: "wrap", alignItems: "flex-start" }} aria-label="Compliance Summary">
        <div>
          <p style={{ ...sectionLabel, marginBottom: 6 }}>COMPLIANCE SCORE</p>
          <p style={{ fontSize: 28, fontWeight: 600, color: covColor(overallScore), margin: 0 }}>{Math.round(overallScore)}%</p>
          <p style={{ fontSize: 11, color: "#9ca3af", margin: 0 }}>cost-weighted</p>
        </div>
        <div>
          <p style={{ ...sectionLabel, marginBottom: 6 }}>TOTAL RESOURCES</p>
          <p style={{ fontSize: 22, fontWeight: 600, color: "#111827", margin: 0 }}>{summary.total_resources.toLocaleString()}</p>
        </div>
        <div>
          <p style={{ ...sectionLabel, marginBottom: 6 }}>COMPLIANT</p>
          <p style={{ fontSize: 22, fontWeight: 600, color: "#16a34a", margin: 0 }}>{summary.compliant_resources.toLocaleString()}</p>
        </div>
        <div>
          <p style={{ ...sectionLabel, marginBottom: 6 }}>NON-COMPLIANT</p>
          <p style={{ fontSize: 22, fontWeight: 600, color: "#dc2626", margin: 0 }}>{summary.non_compliant_resources.toLocaleString()}</p>
        </div>
        <div>
          <p style={{ ...sectionLabel, marginBottom: 6 }}>UNTAGGED SPEND</p>
          <p style={{ fontSize: 22, fontWeight: 600, color: "#d97706", margin: 0 }}>{formatCurrency(summary.untagged_spend)}</p>
        </div>
      </section>

      {/* Two-column: By Tag + By Account */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 16, marginBottom: 16 }}>
        <div style={cardBox}>
          <p style={{ ...sectionLabel, marginBottom: 16 }}>COMPLIANCE BY TAG</p>
          {byTag?.scores?.length ? byTag.scores.map((s) => (
            <div key={s.dimension_value} style={{ marginBottom: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
                <span style={{ color: "#111827", fontWeight: 500 }}>{s.dimension_value}</span>
                <span style={{ color: covColor(Number(s.cost_weighted_score)), fontWeight: 600 }}>{Math.round(Number(s.cost_weighted_score))}%</span>
              </div>
              <div style={{ height: 3, borderRadius: 9999, background: "#f3f4f6", overflow: "hidden" }}>
                <div style={{ width: `${Number(s.cost_weighted_score)}%`, height: "100%", background: covColor(Number(s.cost_weighted_score)), borderRadius: 9999 }} />
              </div>
            </div>
          )) : <p style={{ fontSize: 13, color: "#9ca3af" }}>No data</p>}
        </div>
        <div style={cardBox}>
          <p style={{ ...sectionLabel, marginBottom: 16 }}>COMPLIANCE BY ACCOUNT</p>
          {byAccount?.scores?.length ? byAccount.scores.map((s) => (
            <div key={s.dimension_value} style={{ marginBottom: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
                <span style={{ color: "#111827", fontWeight: 500 }}>{s.dimension_value}</span>
                <span style={{ color: covColor(Number(s.cost_weighted_score)), fontWeight: 600 }}>{Math.round(Number(s.cost_weighted_score))}%</span>
              </div>
              <div style={{ height: 3, borderRadius: 9999, background: "#f3f4f6", overflow: "hidden" }}>
                <div style={{ width: `${Number(s.cost_weighted_score)}%`, height: "100%", background: covColor(Number(s.cost_weighted_score)), borderRadius: 9999 }} />
              </div>
            </div>
          )) : <p style={{ fontSize: 13, color: "#9ca3af" }}>No data</p>}
        </div>
      </div>

      {/* Compliance Trend */}
      {trendData.length > 0 && (
        <div style={cardBox}>
          <p style={{ ...sectionLabel, marginBottom: 16 }}>COMPLIANCE TREND</p>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={trendData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#9ca3af" }} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: "#9ca3af" }} tickFormatter={(v) => `${v}%`} />
              <Tooltip formatter={(v) => [`${Number(v).toFixed(1)}%`, "Compliance"]} />
              <Line type="monotone" dataKey="score" stroke="#3B5BDB" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Non-compliant resources */}
      <div style={cardBox}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div>
            <p style={{ ...sectionLabel, margin: 0 }}>TOP NON-COMPLIANT RESOURCES</p>
            {(filterTag || filterType) && (
              <p style={{ fontSize: 11, color: "#6366f1", margin: "4px 0 0 0" }}>
                Filtered: {filterTag && `tag=${filterTag}`} {filterType && `type=${filterType}`}
              </p>
            )}
          </div>
          {selectedResources.size > 0 && (
            <button type="button" style={btnPrimary} onClick={onCreateCampaign}>
              <Plus size={14} /> Create Campaign ({selectedResources.size})
            </button>
          )}
        </div>
        {filteredResults.length === 0 ? (
          <p style={{ fontSize: 13, color: "#9ca3af", textAlign: "center", padding: 24 }}>No non-compliant resources found</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #f3f4f6" }}>
                  <th style={{ ...thStyle, width: 32 }}>
                    <input
                      type="checkbox"
                      checked={filteredResults.length > 0 && filteredResults.every((r) => selectedResources.has(r.resource_id))}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedResources(new Set(filteredResults.map((r) => r.resource_id)));
                        } else {
                          setSelectedResources(new Set());
                        }
                      }}
                    />
                  </th>
                  <th style={thStyle}>Resource</th>
                  <th style={thStyle}>Type</th>
                  <th style={thStyle}>Account</th>
                  <th style={thStyle}>Tag</th>
                  <th style={thStyle}>Issue</th>
                  <th style={{ ...thStyle, textAlign: "right" }}>Cost Impact</th>
                </tr>
              </thead>
              <tbody>
                {filteredResults.map((r) => (
                  <tr key={r.id} style={{ borderBottom: "1px solid #f9fafb" }}>
                    <td style={tdStyle}>
                      <input type="checkbox" checked={selectedResources.has(r.resource_id)} onChange={() => toggleResource(r.resource_id)} />
                    </td>
                    <td style={tdStyle}>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>{r.resource_name || r.resource_arn || "—"}</div>
                    </td>
                    <td style={{ ...tdStyle, fontSize: 12, color: "#6b7280" }}>{r.resource_type || "—"}</td>
                    <td style={{ ...tdStyle, fontSize: 12, color: "#6b7280" }}>{r.account_id || "—"}</td>
                    <td style={tdStyle}>
                      <span style={{ background: "#f5f0ff", color: "#8b5cf6", border: "1px solid #ede9fe", borderRadius: 4, fontSize: 11, fontWeight: 500, padding: "2px 8px", fontFamily: "monospace" }}>
                        {r.tag_name || "—"}
                      </span>
                    </td>
                    <td style={tdStyle}>
                      <span style={{ fontSize: 12, color: r.status === "missing_tag" ? "#dc2626" : "#d97706" }}>
                        {r.status === "missing_tag" ? "Missing" : "Invalid value"}
                      </span>
                    </td>
                    <td style={{ ...tdStyle, textAlign: "right", fontWeight: 500, fontVariantNumeric: "tabular-nums" }}>
                      {formatCurrency(r.resource_cost)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {nonCompliant && nonCompliant.total_non_compliant_cost && (
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12, fontSize: 12, color: "#6b7280" }}>
            Total non-compliant cost: <span style={{ fontWeight: 600, color: "#dc2626", marginLeft: 4 }}>{formatCurrency(nonCompliant.total_non_compliant_cost)}</span>
          </div>
        )}
      </div>

      {/* Active Campaigns */}
      <div style={cardBox}>
        <p style={{ ...sectionLabel, marginBottom: 16 }}>ACTIVE CAMPAIGNS</p>
        {campaigns?.campaigns?.length ? campaigns.campaigns.map((c) => (
          <div
            key={c.id}
            style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 0", borderBottom: "1px solid #f9fafb", cursor: "pointer" }}
            onClick={() => onViewCampaign(c.id)}
          >
            <div>
              <span style={{ fontSize: 14, fontWeight: 500, color: "#111827" }}>{c.name}</span>
              <span style={{ marginLeft: 12 }}>{statusBadge(c.status)}</span>
              {c.description && <p style={{ fontSize: 12, color: "#6b7280", margin: "4px 0 0 0" }}>{c.description}</p>}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <span style={{ fontSize: 12, color: "#6b7280" }}>{c.resource_count} resources</span>
              {c.before_compliance_score != null && (
                <span style={{ fontSize: 12, color: "#9ca3af" }}>Baseline: {Math.round(Number(c.before_compliance_score))}%</span>
              )}
              <ChevronRight size={16} color="#9ca3af" />
            </div>
          </div>
        )) : <p style={{ fontSize: 13, color: "#9ca3af", textAlign: "center", padding: 24 }}>No campaigns yet. Select non-compliant resources above to create one.</p>}
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Policies Tab
// ---------------------------------------------------------------------------
function PoliciesTab({ policies, onEdit, onDelete, onCreate }) {
  if (!policies?.policies?.length) {
    return (
      <div style={{ ...cardBox, textAlign: "center", padding: "48px 24px" }}>
        <p style={{ fontSize: 14, fontWeight: 500, color: "#111827", margin: "0 0 8px 0" }}>No tag policies defined</p>
        <p style={{ fontSize: 13, color: "#6b7280", margin: "0 0 16px 0" }}>Create your first policy to start monitoring tag compliance.</p>
        <button type="button" style={btnPrimary} onClick={onCreate}><Plus size={14} /> Create Policy</button>
      </div>
    );
  }

  return (
    <div>
      {policies.policies.map((p) => (
        <div key={p.id} style={cardBox}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 14, fontWeight: 500, color: "#111827" }}>{p.name}</span>
                <span style={{ fontSize: 11, fontWeight: 500, color: p.is_active ? "#16a34a" : "#9ca3af", background: p.is_active ? "#f0fdf4" : "#f9fafb", border: `1px solid ${p.is_active ? "#dcfce7" : "#e5e5e5"}`, borderRadius: 9999, padding: "2px 8px" }}>
                  {p.is_active ? "Active" : "Inactive"}
                </span>
                {p.priority != null && (
                  <span style={{ fontSize: 11, color: "#9ca3af" }}>Priority: {p.priority}</span>
                )}
              </div>
              {p.description && <p style={{ fontSize: 13, color: "#6b7280", margin: "4px 0 0 0" }}>{p.description}</p>}
            </div>
            <div style={{ display: "flex", gap: 4 }}>
              <button type="button" style={btnSecondary} onClick={() => onEdit(p)}><Pencil size={12} /> Edit</button>
              <button type="button" style={{ ...btnSecondary, color: "#dc2626" }} onClick={() => { if (confirm("Delete this policy?")) onDelete(p.id); }}><Trash2 size={12} /></button>
            </div>
          </div>
          {/* Rules */}
          <div style={{ marginTop: 12 }}>
            <p style={{ ...sectionLabel, marginBottom: 8 }}>RULES ({p.rules.length})</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {p.rules.map((rule) => (
                <div key={rule.id} style={{ background: "#f9fafb", border: "1px solid #e5e5e5", borderRadius: 8, padding: "8px 12px", fontSize: 12 }}>
                  <span style={{ fontWeight: 500, fontFamily: "monospace", color: "#8b5cf6" }}>{rule.tag_name}</span>
                  <span style={{ color: "#9ca3af", marginLeft: 8 }}>type: {rule.value_type}</span>
                  {rule.allowed_values?.length > 0 && (
                    <span style={{ color: "#9ca3af", marginLeft: 8 }}>values: {rule.allowed_values.join(", ")}</span>
                  )}
                  {rule.applicable_resource_types?.length > 0 && (
                    <span style={{ color: "#9ca3af", marginLeft: 8 }}>resources: {rule.applicable_resource_types.join(", ")}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Campaigns Tab
// ---------------------------------------------------------------------------
function CampaignsTab({ campaigns, onView }) {
  if (!campaigns?.campaigns?.length) {
    return (
      <EmptyState
        title="No remediation campaigns"
        subtitle="Create a campaign from the Dashboard tab by selecting non-compliant resources."
      />
    );
  }

  return (
    <div>
      {campaigns.campaigns.map((c) => (
        <div
          key={c.id}
          style={{ ...cardBox, cursor: "pointer" }}
          onClick={() => onView(c.id)}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 14, fontWeight: 500, color: "#111827" }}>{c.name}</span>
                {statusBadge(c.status)}
              </div>
              {c.description && <p style={{ fontSize: 13, color: "#6b7280", margin: "4px 0 0 0" }}>{c.description}</p>}
            </div>
            <div style={{ textAlign: "right" }}>
              <span style={{ fontSize: 13, fontWeight: 500, color: "#111827" }}>{c.resource_count} resources</span>
              {c.deadline && (
                <p style={{ fontSize: 11, color: "#9ca3af", margin: "2px 0 0 0" }}>
                  Due: {new Date(c.deadline).toLocaleDateString()}
                </p>
              )}
            </div>
          </div>
          {c.target_compliance_goal != null && (
            <div style={{ marginTop: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#9ca3af", marginBottom: 4 }}>
                <span>Target: {Number(c.target_compliance_goal)}%</span>
                {c.before_compliance_score != null && <span>Baseline: {Math.round(Number(c.before_compliance_score))}%</span>}
              </div>
              <div style={{ height: 3, borderRadius: 9999, background: "#f3f4f6", overflow: "hidden" }}>
                <div style={{ width: `${Number(c.target_compliance_goal)}%`, height: "100%", background: "#3B5BDB", borderRadius: 9999 }} />
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
