import React, { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { Plus, ArrowLeft, Trash2, Edit3, ChevronRight, Shield } from "lucide-react";
import {
  getInfraPolicies, getInfraPolicy, createInfraPolicy, updateInfraPolicy,
  deleteInfraPolicy,
} from "../../api/dashboard";

const SEVERITY_COLORS = {
  critical: { bg: "#fef2f2", color: "#dc2626" },
  high: { bg: "#fff7ed", color: "#ea580c" },
  medium: { bg: "#fffbeb", color: "#d97706" },
  low: { bg: "#f0fdf4", color: "#16a34a" },
};

const POLICY_TYPES = [
  { value: "instance_restriction", label: "Instance Restriction" },
  { value: "spending_limit", label: "Spending Limit" },
  { value: "resource_count_limit", label: "Resource Count Limit" },
  { value: "environment_constraint", label: "Environment Constraint" },
];

const SEVERITIES = ["critical", "high", "medium", "low"];

const inputStyle = {
  fontSize: 13, border: "1px solid #d1d5db", borderRadius: 6,
  padding: "8px 10px", outline: "none", boxSizing: "border-box", width: "100%",
};
const labelStyle = {
  fontSize: 12, fontWeight: 500, color: "#374151", marginBottom: 4, display: "block",
};

function formatPolicyType(type) {
  return POLICY_TYPES.find((t) => t.value === type)?.label || type;
}

// ---------------------------------------------------------------------------
// Rule configuration by type
// ---------------------------------------------------------------------------
function RuleEditor({ type, rule, onChange }) {
  if (type === "instance_restriction") {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div>
          <label style={labelStyle}>Denied Instance Types (comma-separated)</label>
          <input style={inputStyle} value={(rule.denied_instance_types || []).join(", ")}
            onChange={(e) => onChange({ ...rule, denied_instance_types: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })}
            placeholder="e.g. p4d.24xlarge, p3.16xlarge" />
        </div>
        <div>
          <label style={labelStyle}>Allowed Instance Types (comma-separated, optional)</label>
          <input style={inputStyle} value={(rule.allowed_instance_types || []).join(", ")}
            onChange={(e) => onChange({ ...rule, allowed_instance_types: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })}
            placeholder="e.g. t3.medium, m5.large" />
        </div>
      </div>
    );
  }
  if (type === "spending_limit") {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ display: "flex", gap: 12 }}>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>Dimension</label>
            <input style={inputStyle} value={rule.dimension || ""} onChange={(e) => onChange({ ...rule, dimension: e.target.value })} placeholder="e.g. team" />
          </div>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>Dimension Value</label>
            <input style={inputStyle} value={rule.dimension_value || ""} onChange={(e) => onChange({ ...rule, dimension_value: e.target.value })} placeholder="e.g. engineering" />
          </div>
        </div>
        <div style={{ display: "flex", gap: 12 }}>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>Limit Amount ($)</label>
            <input style={inputStyle} type="number" min="1" value={rule.limit_amount || ""} onChange={(e) => onChange({ ...rule, limit_amount: Number(e.target.value) })} placeholder="5000" />
          </div>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>Period</label>
            <select style={inputStyle} value={rule.period || "monthly"} onChange={(e) => onChange({ ...rule, period: e.target.value })}>
              <option value="monthly">Monthly</option>
              <option value="quarterly">Quarterly</option>
            </select>
          </div>
        </div>
      </div>
    );
  }
  if (type === "resource_count_limit") {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ display: "flex", gap: 12 }}>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>Service</label>
            <input style={inputStyle} value={rule.service || ""} onChange={(e) => onChange({ ...rule, service: e.target.value })} placeholder="e.g. EC2" />
          </div>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>Resource Type</label>
            <input style={inputStyle} value={rule.resource_type || ""} onChange={(e) => onChange({ ...rule, resource_type: e.target.value })} placeholder="e.g. instance" />
          </div>
        </div>
        <div>
          <label style={labelStyle}>Max Count</label>
          <input style={inputStyle} type="number" min="1" value={rule.max_count || ""} onChange={(e) => onChange({ ...rule, max_count: Number(e.target.value) })} placeholder="10" />
        </div>
      </div>
    );
  }
  if (type === "environment_constraint") {
    return (
      <div>
        <label style={labelStyle}>Allowed Regions (comma-separated)</label>
        <input style={inputStyle} value={(rule.allowed_regions || []).join(", ")}
          onChange={(e) => onChange({ ...rule, allowed_regions: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })}
          placeholder="e.g. us-east-1, us-west-2" />
      </div>
    );
  }
  return null;
}

// ---------------------------------------------------------------------------
// Policy Form Modal
// ---------------------------------------------------------------------------
function PolicyFormModal({ policy, onClose, onSaved }) {
  const isEdit = !!policy;
  const [name, setName] = useState(policy?.name || "");
  const [description, setDescription] = useState(policy?.description || "");
  const [type, setType] = useState(policy?.type || "instance_restriction");
  const [severity, setSeverity] = useState(policy?.severity || "medium");
  const [rule, setRule] = useState(policy?.rule || {});
  const [isActive, setIsActive] = useState(policy?.is_active !== false);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  const validate = () => {
    if (!name.trim()) return "Name is required.";
    if (type === "instance_restriction") {
      if (!(rule.denied_instance_types?.length) && !(rule.allowed_instance_types?.length)) return "Specify denied or allowed instance types.";
    }
    if (type === "spending_limit") {
      if (!rule.dimension?.trim()) return "Dimension is required.";
      if (!rule.dimension_value?.trim()) return "Dimension value is required.";
      if (!rule.limit_amount || rule.limit_amount <= 0) return "Limit amount must be > 0.";
    }
    if (type === "resource_count_limit") {
      if (!rule.service?.trim()) return "Service is required.";
      if (!rule.resource_type?.trim()) return "Resource type is required.";
      if (!rule.max_count || rule.max_count <= 0) return "Max count must be > 0.";
    }
    if (type === "environment_constraint") {
      if (!(rule.allowed_regions?.length)) return "Specify at least one allowed region.";
    }
    return null;
  };

  const handleSave = async () => {
    const err = validate();
    if (err) { setError(err); return; }
    setSaving(true);
    setError(null);
    const payload = { name: name.trim(), description: description.trim() || null, type, severity, rule, is_active: isActive };
    try {
      if (isEdit) {
        await updateInfraPolicy(policy.id, payload);
      } else {
        await createInfraPolicy(payload);
      }
      onSaved();
    } catch (e) {
      setError(e.message || "Failed to save policy.");
    } finally {
      setSaving(false);
    }
  };

  // Reset rule when type changes
  const handleTypeChange = (newType) => {
    setType(newType);
    setRule({});
  };

  return (
    <>
      <div role="presentation" onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 1000 }} />
      <div role="dialog" aria-label={isEdit ? "Edit policy" : "New policy"} style={{
        position: "fixed", top: 0, right: 0, width: 520, maxWidth: "100%", height: "100vh",
        background: "var(--card)", borderLeft: "1px solid var(--border)",
        boxShadow: "-4px 0 24px rgba(0,0,0,0.1)", zIndex: 1001, overflowY: "auto", padding: 24,
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>
            {isEdit ? "Edit Policy" : "New Policy"}
          </h2>
          <button type="button" onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", padding: 4, color: "var(--text-muted)" }} aria-label="Close">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
          </button>
        </div>

        {error && (
          <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "#dc2626", marginBottom: 16 }}>
            {error}
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <label style={labelStyle}>Name</label>
            <input style={inputStyle} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. No GPU in dev environments" />
          </div>
          <div>
            <label style={labelStyle}>Description (optional)</label>
            <textarea style={{ ...inputStyle, minHeight: 60 }} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What this policy enforces" />
          </div>
          <div style={{ display: "flex", gap: 12 }}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Policy Type</label>
              <select style={inputStyle} value={type} onChange={(e) => handleTypeChange(e.target.value)}>
                {POLICY_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Severity</label>
              <select style={inputStyle} value={severity} onChange={(e) => setSeverity(e.target.value)}>
                {SEVERITIES.map((s) => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
              </select>
            </div>
          </div>

          {/* Rule configuration */}
          <div>
            <p style={{ fontSize: 11, fontWeight: 500, letterSpacing: "0.08em", textTransform: "uppercase", color: "#9ca3af", marginBottom: 8 }}>RULE CONFIGURATION</p>
            <RuleEditor type={type} rule={rule} onChange={setRule} />
          </div>

          {/* Active toggle */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} id="policy-active" />
            <label htmlFor="policy-active" style={{ fontSize: 13, color: "#374151" }}>Active</label>
          </div>

          <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
            <button type="button" disabled={saving} onClick={handleSave} style={{
              fontSize: 13, fontWeight: 500, padding: "8px 18px", borderRadius: 8,
              background: "var(--text-primary)", color: "#fff", border: "none", cursor: "pointer", opacity: saving ? 0.6 : 1,
            }}>
              {saving ? "Saving..." : isEdit ? "Save Changes" : "Create Policy"}
            </button>
            <button type="button" onClick={onClose} style={{
              fontSize: 13, fontWeight: 500, padding: "8px 18px", borderRadius: 8,
              background: "transparent", color: "var(--text-secondary)", border: "1px solid var(--border)", cursor: "pointer",
            }}>
              Cancel
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Policy Detail View
// ---------------------------------------------------------------------------
function PolicyDetail({ policyId, onBack }) {
  const [policy, setPolicy] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getInfraPolicy(policyId)
      .then((p) => { if (!cancelled) setPolicy(p); })
      .catch((e) => { if (!cancelled) setError(e.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [policyId]);

  if (loading) return <div style={{ padding: 24, color: "#9ca3af" }}>Loading policy...</div>;
  if (error) return <div style={{ padding: 24, color: "#dc2626" }}>Error: {error}</div>;
  if (!policy) return <div style={{ padding: 24, color: "#9ca3af" }}>Policy not found.</div>;

  const sev = SEVERITY_COLORS[policy.severity] || SEVERITY_COLORS.medium;
  const compliance = policy.compliance_percentage != null ? Math.round(Number(policy.compliance_percentage)) : null;
  const violations = policy.violations || [];

  return (
    <div style={{ padding: 24 }}>
      <button type="button" onClick={onBack} style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", cursor: "pointer", color: "#2563eb", fontSize: 13, fontWeight: 500, marginBottom: 16, padding: 0 }}>
        <ArrowLeft size={14} /> Back to policies
      </button>

      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
        <h1 style={{ fontSize: 18, fontWeight: 600, color: "#111827", margin: 0 }}>{policy.name}</h1>
        <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 9999, background: sev.bg, color: sev.color }}>{policy.severity}</span>
        <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 9999, background: policy.is_active ? "#f0fdf4" : "#f9fafb", color: policy.is_active ? "#16a34a" : "#6b7280" }}>
          {policy.is_active ? "Active" : "Inactive"}
        </span>
      </div>
      {policy.description && <p style={{ fontSize: 13, color: "#6b7280", marginBottom: 16 }}>{policy.description}</p>}
      <p style={{ fontSize: 12, color: "#9ca3af", marginBottom: 24 }}>
        Type: {formatPolicyType(policy.type)}
        {compliance != null && <> &middot; Compliance: {compliance}%</>}
        {policy.last_evaluated_at && <> &middot; Last evaluated: {new Date(policy.last_evaluated_at).toLocaleDateString()}</>}
      </p>

      {/* Rule details */}
      <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, padding: "20px 24px", marginBottom: 24 }}>
        <p style={{ fontSize: 11, fontWeight: 500, letterSpacing: "0.08em", textTransform: "uppercase", color: "#9ca3af", marginBottom: 12 }}>RULE CONFIGURATION</p>
        <pre style={{ fontSize: 12, color: "#374151", background: "#f9fafb", padding: 12, borderRadius: 8, overflow: "auto", margin: 0 }}>
          {JSON.stringify(policy.rule, null, 2)}
        </pre>
      </div>

      {/* Violations */}
      <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, padding: "20px 24px" }}>
        <p style={{ fontSize: 11, fontWeight: 500, letterSpacing: "0.08em", textTransform: "uppercase", color: "#9ca3af", marginBottom: 12 }}>
          CURRENT VIOLATIONS ({violations.length})
        </p>
        {violations.length === 0 ? (
          <p style={{ fontSize: 13, color: "#9ca3af" }}>No violations found. This policy is fully compliant.</p>
        ) : (
          <div>
            {/* Table header */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 100px 100px 1fr", gap: 8, fontSize: 10, fontWeight: 500, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.8px", borderBottom: "1px solid var(--border)", paddingBottom: 8, marginBottom: 0 }}>
              <span>RESOURCE</span>
              <span>SEVERITY</span>
              <span>STATUS</span>
              <span>REMEDIATION</span>
            </div>
            {violations.map((v, i) => (
              <div key={v.id || i} style={{ display: "grid", gridTemplateColumns: "1fr 100px 100px 1fr", gap: 8, alignItems: "center", padding: "10px 0", borderBottom: "1px solid var(--border)" }}>
                <div>
                  <p style={{ fontSize: 13, color: "#111827", margin: 0 }}>{v.title || v.resource_id}</p>
                  {v.resource_id && v.title && <p style={{ fontSize: 11, color: "#9ca3af", margin: 0 }}>{v.resource_id}</p>}
                </div>
                <span style={{
                  fontSize: 11, padding: "2px 8px", borderRadius: 9999, display: "inline-block", width: "fit-content",
                  background: (SEVERITY_COLORS[v.severity] || SEVERITY_COLORS.medium).bg,
                  color: (SEVERITY_COLORS[v.severity] || SEVERITY_COLORS.medium).color,
                }}>{v.severity}</span>
                <span style={{ fontSize: 12, color: "#6b7280" }}>{v.status}</span>
                <span style={{ fontSize: 12, color: "#6b7280" }}>{v.suggested_action || "—"}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Policy List Page (main export)
// ---------------------------------------------------------------------------
export default function Policies() {
  const [policies, setPolicies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState("all");
  const [formOpen, setFormOpen] = useState(false);
  const [editingPolicy, setEditingPolicy] = useState(null);
  const [selectedId, setSelectedId] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    getInfraPolicies()
      .then((data) => setPolicies(data.policies || []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Delete policy "${name}"?`)) return;
    try {
      await deleteInfraPolicy(id);
      load();
    } catch (e) {
      alert("Failed to delete: " + e.message);
    }
  };

  const openCreate = () => { setEditingPolicy(null); setFormOpen(true); };
  const openEdit = (p) => { setEditingPolicy(p); setFormOpen(true); };
  const closeForm = () => { setFormOpen(false); setEditingPolicy(null); };
  const onSaved = () => { closeForm(); load(); };

  // Detail view
  if (selectedId) {
    return <PolicyDetail policyId={selectedId} onBack={() => setSelectedId(null)} />;
  }

  const filteredPolicies = policies.filter((p) => {
    if (filter === "all") return true;
    if (filter === "active") return p.is_active;
    if (filter === "inactive") return !p.is_active;
    return p.type === filter;
  });

  const activeCount = policies.filter((p) => p.is_active).length;
  const withViolations = policies.filter((p) => p.compliance_percentage != null && Number(p.compliance_percentage) < 100).length;
  const avgCompliance = policies.length > 0
    ? Math.round(policies.reduce((sum, p) => sum + (Number(p.compliance_percentage) || 0), 0) / policies.length)
    : 0;

  return (
    <div style={{ padding: 24 }}>
      {/* Page header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 16, fontWeight: 500, color: "#111827", margin: 0, marginBottom: 4 }}>Infrastructure Policies</h1>
          <p style={{ fontSize: 13, color: "#6b7280", marginTop: 0 }}>Define and enforce infrastructure governance rules</p>
        </div>
        <button type="button" onClick={openCreate} style={{
          display: "flex", alignItems: "center", gap: 6, padding: "8px 18px", fontSize: 13, fontWeight: 500,
          color: "#fff", background: "#111827", border: "none", borderRadius: 8, cursor: "pointer",
        }}>
          <Plus size={14} /> New Policy
        </button>
      </div>

      {/* KPI strip */}
      <section style={{ background: "var(--card)", borderLeft: "4px solid #3B5BDB", border: "1px solid var(--border)", borderRadius: 12, padding: "16px 24px", marginBottom: 24, display: "flex", gap: 40, flexWrap: "wrap" }} aria-label="Summary">
        {[
          { label: "TOTAL POLICIES", value: String(policies.length) },
          { label: "ACTIVE", value: String(activeCount), noteColor: "#16a34a" },
          { label: "AVG COMPLIANCE", value: policies.length > 0 ? `${avgCompliance}%` : "—" },
          { label: "WITH VIOLATIONS", value: String(withViolations), noteColor: withViolations > 0 ? "#d97706" : undefined },
        ].map((s) => (
          <div key={s.label}>
            <p style={{ fontSize: 12, fontWeight: 500, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>{s.label}</p>
            <p style={{ fontSize: 22, fontWeight: 600, color: s.noteColor || "#111827", margin: 0 }}>{s.value}</p>
          </div>
        ))}
      </section>

      {/* Tag governance link */}
      <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, padding: "12px 20px", marginBottom: 24, display: "flex", alignItems: "center", gap: 8 }}>
        <Shield size={14} color="#6366f1" />
        <span style={{ fontSize: 13, color: "#374151" }}>For tag compliance policies, see </span>
        <Link to="/tag-governance" style={{ fontSize: 13, color: "#2563eb", textDecoration: "none", fontWeight: 500 }}>Tag Governance</Link>
      </div>

      {/* Filter */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <p style={{ fontSize: 11, fontWeight: 500, letterSpacing: "0.08em", textTransform: "uppercase", color: "#9ca3af", margin: 0 }}>ALL POLICIES</p>
        <select style={{ ...inputStyle, width: "auto", minWidth: 160 }} value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="all">All policies</option>
          <option value="active">Active only</option>
          <option value="inactive">Inactive only</option>
          {POLICY_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
      </div>

      {/* Loading / Error / Empty */}
      {loading && <p style={{ fontSize: 13, color: "#9ca3af", padding: "24px 0" }}>Loading policies...</p>}
      {error && <p style={{ fontSize: 13, color: "#dc2626", padding: "24px 0" }}>Error: {error}</p>}

      {!loading && !error && filteredPolicies.length === 0 && (
        <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, padding: "48px 24px", textAlign: "center" }}>
          <p style={{ fontSize: 14, fontWeight: 500, color: "#111827", margin: 0, marginBottom: 4 }}>
            {policies.length === 0 ? "No policies yet" : "No policies match this filter"}
          </p>
          <p style={{ fontSize: 13, color: "#9ca3af", margin: 0 }}>
            {policies.length === 0 ? "Create a policy to enforce infrastructure governance." : "Try a different filter."}
          </p>
        </div>
      )}

      {/* Policy list */}
      {!loading && filteredPolicies.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 16 }}>
          {filteredPolicies.map((p) => {
            const sev = SEVERITY_COLORS[p.severity] || SEVERITY_COLORS.medium;
            const compliance = p.compliance_percentage != null ? Math.round(Number(p.compliance_percentage)) : null;
            return (
              <div key={p.id} style={{
                background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12,
                borderLeftWidth: 4, borderLeftColor: sev.color,
                padding: "20px 24px", transition: "border-color 150ms",
              }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#d1d5db"; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border)"; }}
              >
                {/* Header */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 500, color: "#111827" }}>{p.name}</span>
                  <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 9999, background: p.is_active ? "#f0fdf4" : "#f9fafb", color: p.is_active ? "#16a34a" : "#6b7280" }}>
                    {p.is_active ? "Active" : "Inactive"}
                  </span>
                </div>

                {p.description && <p style={{ fontSize: 12, color: "#6b7280", margin: "0 0 8px 0" }}>{p.description}</p>}

                <div style={{ fontSize: 12, color: "#9ca3af", marginBottom: 8 }}>
                  {formatPolicyType(p.type)} &middot; <span style={{ color: sev.color }}>{p.severity}</span>
                </div>

                {/* Compliance bar */}
                {compliance != null && (
                  <>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                      <span style={{ fontSize: 11, color: "#9ca3af" }}>Compliance</span>
                      <span style={{ fontSize: 13, fontWeight: 600, color: compliance >= 90 ? "#16a34a" : compliance >= 70 ? "#d97706" : "#dc2626" }}>{compliance}%</span>
                    </div>
                    <div style={{ width: "100%", height: 3, borderRadius: 9999, background: "#f3f4f6", overflow: "hidden", marginBottom: 12 }}>
                      <div style={{
                        height: 3, borderRadius: 9999, width: `${compliance}%`,
                        background: compliance >= 90 ? "#16a34a" : compliance >= 70 ? "#d97706" : "#dc2626",
                        transition: "width 400ms ease",
                      }} />
                    </div>
                  </>
                )}

                {/* Actions */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 8 }}>
                  <span style={{ fontSize: 11, color: "#9ca3af" }}>
                    {p.last_evaluated_at ? `Evaluated ${new Date(p.last_evaluated_at).toLocaleDateString()}` : "Not evaluated"}
                  </span>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <button type="button" onClick={() => openEdit(p)} title="Edit" style={{ background: "none", border: "none", cursor: "pointer", padding: 2, color: "#6b7280" }}>
                      <Edit3 size={14} />
                    </button>
                    <button type="button" onClick={() => handleDelete(p.id, p.name)} title="Delete" style={{ background: "none", border: "none", cursor: "pointer", padding: 2, color: "#6b7280" }}>
                      <Trash2 size={14} />
                    </button>
                    <button type="button" onClick={() => setSelectedId(p.id)} style={{ display: "flex", alignItems: "center", gap: 2, background: "none", border: "none", cursor: "pointer", fontSize: 13, color: "#2563eb", padding: 0 }}>
                      View <ChevronRight size={14} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Form modal */}
      {formOpen && <PolicyFormModal policy={editingPolicy} onClose={closeForm} onSaved={onSaved} />}
    </div>
  );
}
