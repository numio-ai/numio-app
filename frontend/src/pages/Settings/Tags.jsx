import React from "react";
import { Link } from "react-router-dom";
import { tagPolicy as _tp } from "../../mocks/mockTags";
const tagPolicy = { requiredKeys: [], optionalKeys: [], ..._tp };
import { execCardClass, execHeaderClass } from "../../constants/designTokens";
import { useBudget } from "../../context/BudgetContext";

/** Validate tag key:value format and naming rules. Returns { valid, message }. */
function validateTagInput(value) {
  const trimmed = value.trim();
  if (!trimmed) return { valid: false, message: null };
  if (!/^[a-z0-9_-]+:[a-z0-9_.-]+$/.test(trimmed)) {
    return {
      valid: false,
      message: "Use format key:value, lowercase, no spaces (e.g. env:production).",
    };
  }
  const key = trimmed.split(":")[0];
  const reserved = ["aws", "numio"];
  if (reserved.some((p) => key === p || key.startsWith(p + "-"))) {
    return { valid: false, message: `Key cannot use reserved prefix: ${key}.` };
  }
  const allowedKeys = [
    ...tagPolicy.requiredKeys.map((r) => r.key),
    ...tagPolicy.optionalKeys.map((o) => o.key),
    "env",
    "team",
    "project",
  ];
  if (!allowedKeys.includes(key)) {
    return { valid: true, message: `"${key}" is not in the standard tag list. You can still add it.`, warning: true };
  }
  return { valid: true, message: null };
}

/** aiSpendPct = share of AI/ML spend for sorting (project:ml-training, team:platform first) */
const BASE_TAGS = [
  { name: "env:production", share: 0.323, aiSpendPct: 0.05, color: "#2563eb" },
  { name: "env:staging", share: 0.086, aiSpendPct: 0.08, color: "#7c3aed" },
  { name: "project:ml-training", share: 0.059, aiSpendPct: 0.28, color: "#0891b2" },
  { name: "team:platform", share: 0.038, aiSpendPct: 0.22, color: "#059669" },
  { name: "env:dev", share: 0.027, aiSpendPct: 0.12, color: "#d97706" },
];

export default function Tags() {
  const { mtdSpend } = useBudget();

  const tags = BASE_TAGS.map((tag) => ({
    ...tag,
    amount: Math.round(mtdSpend * tag.share),
    percent: Math.round(tag.share * 100),
  }))
    .sort((a, b) => (b.aiSpendPct ?? 0) - (a.aiSpendPct ?? 0));

  const [userTags, setUserTags] = React.useState([]);
  const [newTag, setNewTag] = React.useState("");
  const validation = validateTagInput(newTag);
  const allTags = [...tags, ...userTags];

  const handleAddTag = (e) => {
    e.preventDefault();
    const trimmed = newTag.trim();
    if (!trimmed || !validation.valid || allTags.some((t) => t.name === trimmed)) return;
    setUserTags((prev) => [...prev, { name: trimmed, amount: 0, percent: 0, color: "#6b7280" }]);
    setNewTag("");
  };

  const handleDeleteTag = (tagName) => {
    setUserTags((prev) => prev.filter((t) => t.name !== tagName));
  };

  const handleEditTag = (tagName) => {
    setNewTag(tagName);
    handleDeleteTag(tagName);
  };

  return (
    <div className="pageContent settings-page-content">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h1 style={{ fontSize: "16px", fontWeight: 500, color: "#111827", margin: 0 }}>Tags</h1>
            <p style={{ fontSize: "13px", color: "#6b7280", marginTop: "4px" }}>
              Tags group resources and AI workloads across reports
            </p>
          </div>
          <Link to="/inbox" className="text-sm font-medium" style={{ color: "var(--primary)" }}>View Inbox →</Link>
        </div>

        <section
          className={execCardClass}
          style={{ marginBottom: "24px", borderColor: "var(--border)", borderRadius: "var(--radius-lg)", padding: "var(--card-padding)" }}
        >
          <p className={execHeaderClass}>TAG POLICY & NAMING</p>
          <p className="text-sm mb-4" style={{ color: "var(--text-secondary)" }}>
            Use these standards so cost allocation and reports stay consistent across resources.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4">
            <div>
              <h3 style={{ fontSize: "10px", fontWeight: 500, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: "8px" }}>Required tags</h3>
              <ul className="text-sm space-y-1" style={{ color: "var(--text)" }}>
                {tagPolicy.requiredKeys.map((r) => (
                  <li key={r.key}>
                    <code className="px-1.5 py-0.5 rounded text-xs" style={{ background: "var(--bg-inset)", border: "1px solid var(--border)" }}>{r.key}</code>
                    {" — "}{r.description}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 style={{ fontSize: "10px", fontWeight: 500, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: "8px" }}>Optional tags</h3>
              <ul className="text-sm space-y-1" style={{ color: "var(--text)" }}>
                {tagPolicy.optionalKeys.map((o) => (
                  <li key={o.key}>
                    <code className="px-1.5 py-0.5 rounded text-xs" style={{ background: "var(--bg-inset)", border: "1px solid var(--border)" }}>{o.key}</code>
                    {" — "}{o.description}
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <div className="mb-4">
            <h3 style={{ fontSize: "10px", fontWeight: 500, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: "8px" }}>Naming rules</h3>
            <ul className="text-sm list-disc pl-5 space-y-1" style={{ color: "var(--text-secondary)" }}>
              {tagPolicy.namingRules.map((rule, i) => (
                <li key={i}>{rule}</li>
              ))}
            </ul>
          </div>
          <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>
            <strong>Examples:</strong> {tagPolicy.examples.join(", ")}
          </p>
        </section>

        <section
          className={execCardClass}
          style={{ marginBottom: "24px", borderColor: "var(--border)", borderRadius: "var(--radius-lg)", padding: "var(--card-padding)" }}
        >
          <p className={execHeaderClass}>EXISTING TAGS</p>
          <div>
            {allTags.map((tag) => (
              <div key={tag.name} style={{ padding: "12px 0", borderBottom: "1px solid #f5f5f5" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "6px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: tag.color }} />
                    <span style={{ fontSize: "13px", color: "#111827" }}>{tag.name}</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <span style={{ fontSize: "13px", fontWeight: 500, color: "#111827" }}>
                      ${tag.amount.toLocaleString()}
                    </span>
                    <span style={{ fontSize: "12px", color: "#9ca3af", width: "32px", textAlign: "right" }}>
                      {tag.percent}%
                    </span>
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={() => handleEditTag(tag.name)}
                      onKeyDown={(e) => e.key === "Enter" && handleEditTag(tag.name)}
                      style={{ fontSize: "12px", color: "#2563eb", cursor: "pointer" }}
                    >
                      Edit
                    </span>
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={() => handleDeleteTag(tag.name)}
                      onKeyDown={(e) => e.key === "Enter" && handleDeleteTag(tag.name)}
                      style={{ fontSize: "12px", color: "#dc2626", cursor: "pointer" }}
                    >
                      Delete
                    </span>
                  </div>
                </div>
                <div style={{ width: "100%", height: "3px", borderRadius: "9999px", background: "#f3f4f6" }}>
                  <div
                    style={{
                      height: "3px",
                      borderRadius: "9999px",
                      width: `${tag.percent}%`,
                      background: tag.color,
                      transition: "width 400ms ease",
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4">
            <Link to="/inbox" className="text-sm font-medium" style={{ color: "var(--primary)" }}>
              View in Inbox →
            </Link>
          </div>
        </section>

        <section
          className={execCardClass}
          style={{ borderColor: "var(--border)", borderRadius: "var(--radius-lg)", padding: "var(--card-padding)" }}
        >
          <p className={execHeaderClass}>ADD TAG</p>
          <form onSubmit={handleAddTag} style={{ display: "flex", gap: "12px", alignItems: "flex-start", flexWrap: "wrap" }}>
            <label style={{ flex: "1 1 200px", minWidth: 0 }}>
              <span style={{ display: "block", fontSize: "var(--text-xs)", fontWeight: 600, marginBottom: "4px", color: "var(--text-tertiary)" }}>
                Tag key:value (must match naming rules above)
              </span>
              <input
                type="text"
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                placeholder="env:production"
                style={{
                  padding: "8px 12px",
                  fontSize: "13px",
                  color: "#111827",
                  border: `1px solid ${validation.valid || !newTag.trim() ? "#e5e5e5" : "var(--danger)"}`,
                  borderRadius: "8px",
                  outline: "none",
                  width: "100%",
                  maxWidth: "280px",
                  background: "var(--card)",
                }}
                aria-invalid={!validation.valid && validation.message ? "true" : undefined}
                aria-describedby={validation.message ? "tag-validation-msg" : undefined}
              />
              {validation.message && (
                <p
                  id="tag-validation-msg"
                  className="text-xs mt-1"
                  style={{ color: validation.warning ? "var(--warning)" : "var(--danger)" }}
                >
                  {validation.message}
                </p>
              )}
            </label>
            <button
              type="submit"
              disabled={!newTag.trim() || !validation.valid}
              style={{
                padding: "7px 14px",
                fontSize: "13px",
                fontWeight: 500,
                color: "#111827",
                background: "var(--card)",
                border: "1px solid #e5e5e5",
                borderRadius: "8px",
                cursor: "pointer",
              }}
            >
              Add Tag
            </button>
          </form>
        </section>
    </div>
  );
}
