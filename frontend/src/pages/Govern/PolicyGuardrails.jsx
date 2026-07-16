import React from "react";
import { Link } from "react-router-dom";
import EnvBadge from "../../components/EnvBadge";
import { policySummary, policies, lastUpdated } from "../../mocks/mockPolicies";
export default function PolicyGuardrails() {
  const violations = policies.filter((p) => p.violations && p.violations.length > 0);

  return (
    <div style={{ padding: "24px" }}>
      <div style={{ marginBottom: "20px" }}>
        <h1 style={{ fontSize: "16px", fontWeight: 500, color: "#111827", margin: 0 }}>Govern</h1>
        <p style={{ fontSize: "13px", color: "#6b7280", marginTop: "4px" }}>
          Real-time policy evaluation and violations. Aligned with Overview.
        </p>
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 24 }}>
        <Link to="/govern/policies" className="view-link">View policies →</Link>
      </div>

        <section className="card" style={{ marginBottom: 24, display: "flex", flexWrap: "wrap", alignItems: "center", gap: 16 }}>
          <p className="card-label" style={{ marginBottom: 0, width: "100%" }}>
            COMPLIANCE
          </p>
          <p className="text-2xl font-semibold tracking-tight shrink-0" style={{ color: "var(--text)" }}>
            {policySummary.compliance.percentCompliant}%
          </p>
          <span className="shrink-0 text-xs" style={{ color: "var(--text-tertiary)" }}>
            {policySummary.totalPolicies} policies · {policySummary.violations.total} active violation{policySummary.violations.total !== 1 ? "s" : ""}
          </span>
          {policySummary.violations.total > 0 && (
            <span className="shrink-0 px-2 py-0.5 rounded text-[11px] font-medium text-amber-600 bg-amber-50">
              {policySummary.violations.critical} critical
            </span>
          )}
          <span className="text-xs shrink-0 ml-auto" style={{ color: "var(--text-tertiary)" }}>
            Updated {lastUpdated}
          </span>
        </section>

        <section className="card" style={{ marginBottom: 24 }}>
          <p className="card-label">VIOLATIONS</p>
          <p className="text-xs mb-4" style={{ color: "var(--text-tertiary)" }}>
            Policies with current violations. Open a ticket to remediate.
          </p>
          {violations.length === 0 ? (
            <p className="text-sm" style={{ color: "var(--text-tertiary)" }}>
              No active violations.
            </p>
          ) : (
            <div className="space-y-3">
              {violations.map((policy) => (
                <div
                  key={policy.id}
                  className="flex flex-wrap items-center justify-between gap-3 py-3 border-b last:border-b-0"
                  style={{ borderColor: "var(--border)" }}
                >
                  <div>
                    <span className="font-medium" style={{ color: "var(--text)" }}>{policy.name}</span>
                    <p className="text-xs mt-0.5" style={{ color: "var(--text-tertiary)" }}>{policy.rule.description}</p>
                  </div>
                  <div className="flex gap-2">
                    <button type="button" className="btn btn--outline btn--sm">Why this is a violation</button>
                    <button type="button" className="btn btn--primary btn--sm">Open ticket</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Compliance Overview */}
          <section className="card">
            <p className="card-label">COMPLIANCE OVERVIEW</p>
            <p className="text-xs mb-4" style={{ color: "var(--text-tertiary)" }}>
              Policy compliance across environments
            </p>
            <div className="space-y-3">
              <div className="flex items-center justify-between py-2 border-b" style={{ borderColor: "var(--border)" }}>
                <EnvBadge env="prod" />
                <span className="text-sm font-medium" style={{ color: "var(--success)" }}>92% compliant</span>
                <span className="text-xs" style={{ color: "var(--text-tertiary)" }}>(2 violations)</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b" style={{ borderColor: "var(--border)" }}>
                <EnvBadge env="staging" />
                <span className="text-sm font-medium" style={{ color: "var(--success)" }}>100% compliant</span>
              </div>
              <div className="flex items-center justify-between py-2" style={{ borderColor: "var(--border)" }}>
                <EnvBadge env="dev" />
                <span className="text-sm font-medium" style={{ color: "var(--success)" }}>96% compliant</span>
                <span className="text-xs" style={{ color: "var(--text-tertiary)" }}>(1 violation)</span>
              </div>
            </div>
          </section>

          {/* Recent Guardrail Activity */}
          <section className="card">
            <p className="card-label">RECENT ACTIVITY</p>
            <p className="text-xs mb-4" style={{ color: "var(--text-tertiary)" }}>
              Guardrail events from the last 7 days
            </p>
            <div className="space-y-3">
              <div className="flex items-start gap-2 py-2 border-b" style={{ borderColor: "var(--border)" }}>
                <span className="text-xs font-medium shrink-0" style={{ color: "var(--danger)" }}>Blocked</span>
                <div>
                  <span className="text-sm" style={{ color: "var(--text)" }}>Unapproved GPU type p4.8xlarge in prod</span>
                  <span className="text-xs ml-1" style={{ color: "var(--text-tertiary)" }}>2 hours ago</span>
                </div>
              </div>
              <div className="flex items-start gap-2 py-2 border-b" style={{ borderColor: "var(--border)" }}>
                <span className="text-xs font-medium shrink-0" style={{ color: "var(--success)" }}>Allowed</span>
                <div>
                  <span className="text-sm" style={{ color: "var(--text)" }}>EC2 t3.medium launch in staging</span>
                  <span className="text-xs ml-1" style={{ color: "var(--text-tertiary)" }}>5 hours ago</span>
                </div>
              </div>
              <div className="flex items-start gap-2 py-2 border-b" style={{ borderColor: "var(--border)" }}>
                <span className="text-xs font-medium shrink-0" style={{ color: "var(--danger)" }}>Blocked</span>
                <div>
                  <span className="text-sm" style={{ color: "var(--text)" }}>Untagged S3 bucket creation</span>
                  <span className="text-xs ml-1" style={{ color: "var(--text-tertiary)" }}>1 day ago</span>
                </div>
              </div>
              <div className="flex items-start gap-2 py-2" style={{ borderColor: "var(--border)" }}>
                <span className="text-xs font-medium shrink-0" style={{ color: "var(--primary)" }}>Policy updated</span>
                <div>
                  <span className="text-sm" style={{ color: "var(--text)" }}>"Required tags" added Owner field</span>
                  <span className="text-xs ml-1" style={{ color: "var(--text-tertiary)" }}>2 days ago</span>
                </div>
              </div>
            </div>
          </section>
        </div>
    </div>
  );
}
