/**
 * Diagnostic empty-state rescue for dashboard widgets.
 *
 * Replaces generic "No data" with a checklist that explains *why* the
 * widget is empty — account state, ingestion progress, or the query's
 * time range. Stage derivation lives in src/lib/widgetPipelineStage.js
 * so logic is unit-tested without React.
 *
 * Usage:
 *   <PipelineDiagnosticCard
 *     dataSource="cur"
 *     startDate={startDate}
 *     endDate={endDate}
 *     fallback={<span>No data for this period</span>}
 *     onChangeTimeRange={() => timeRange.open()}
 *   />
 *
 * When the pipeline is in a "synced" state (i.e. the empty result is
 * legitimate), renders the `fallback` prop. Otherwise renders the
 * appropriate diagnostic.
 */
import React from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, Clock, AlertTriangle, Info, ArrowUpRight } from "lucide-react";
import { useIngestionStatus } from "../context/IngestionStatusContext";
import { deriveWidgetStage } from "../lib/widgetPipelineStage";

const CUR_DOCS_URL = "https://docs.aws.amazon.com/cur/latest/userguide/what-is-cur.html";

const cardStyle = {
  display: "flex",
  flexDirection: "column",
  gap: 10,
  padding: "16px 18px",
  borderRadius: 10,
  background: "var(--bg-inset, #f9fafb)",
  border: "1px solid var(--border, #e5e5e5)",
};

const headlineStyle = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  fontSize: 13,
  fontWeight: 600,
  color: "var(--text, #111827)",
};

const checklistItemStyle = (state) => ({
  display: "flex",
  alignItems: "center",
  gap: 8,
  fontSize: 12,
  color:
    state === "fail"
      ? "#b91c1c"
      : state === "pending"
      ? "var(--text-secondary, #6b7280)"
      : "var(--text, #374151)",
});

function Icon({ state, size = 14 }) {
  if (state === "ok") return <CheckCircle2 size={size} color="#16a34a" aria-hidden />;
  if (state === "pending") return <Clock size={size} color="#6b7280" aria-hidden />;
  return <AlertTriangle size={size} color="#dc2626" aria-hidden />;
}

function Checklist({ items }) {
  return (
    <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 4 }}>
      {items.map((it, i) => (
        <li key={i} style={checklistItemStyle(it.state)}>
          <Icon state={it.state} />
          <span>{it.label}</span>
        </li>
      ))}
    </ul>
  );
}

function Footer({ primary, secondary }) {
  return (
    <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 4, flexWrap: "wrap" }}>
      {primary}
      {secondary}
    </div>
  );
}

function OpenIngestionLink({ children = "View pipeline details" }) {
  return (
    <Link
      to="/ingestion"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        fontSize: 12,
        fontWeight: 500,
        color: "var(--primary, #3b82f6)",
        textDecoration: "none",
      }}
    >
      {children} <ArrowUpRight size={12} />
    </Link>
  );
}

export default function PipelineDiagnosticCard({
  dataSource,
  startDate,
  endDate,
  fallback = null,
  onChangeTimeRange,
}) {
  const { statuses, accounts, loading } = useIngestionStatus();

  if (loading) {
    return (
      <div style={{ fontSize: 13, color: "var(--text-tertiary, #9ca3af)", padding: "12px 0" }}>
        Checking data pipeline…
      </div>
    );
  }

  const { stage } = deriveWidgetStage({
    accounts,
    statuses,
    dataSource,
    startDate,
    endDate,
  });

  if (stage === "synced") return fallback;

  // Render per stage
  switch (stage) {
    case "no_account":
      return (
        <div style={cardStyle}>
          <div style={headlineStyle}>
            <Info size={16} color="var(--primary, #3b82f6)" aria-hidden />
            Connect an AWS account to see cost data
          </div>
          <Checklist
            items={[
              { state: "fail", label: "No AWS accounts connected" },
              { state: "pending", label: "Awaiting first CUR export" },
              { state: "pending", label: "Awaiting first successful ingestion" },
            ]}
          />
          <Footer
            primary={
              <Link
                to="/settings?tab=integrations"
                className="btn btn--primary btn--sm"
                style={{ textDecoration: "none" }}
              >
                Connect AWS account
              </Link>
            }
            secondary={<OpenIngestionLink />}
          />
        </div>
      );

    case "account_invalid":
      return (
        <div style={cardStyle}>
          <div style={headlineStyle}>
            <AlertTriangle size={16} color="#dc2626" aria-hidden />
            Connection to your AWS account has a problem
          </div>
          <Checklist
            items={[
              { state: "ok", label: "Account registered" },
              { state: "fail", label: "Connection invalid (role ARN, external ID, or CUR config)" },
              { state: "pending", label: "Ingestion blocked until fixed" },
            ]}
          />
          <Footer
            primary={
              <Link
                to="/settings?tab=integrations"
                className="btn btn--primary btn--sm"
                style={{ textDecoration: "none" }}
              >
                Fix connection
              </Link>
            }
            secondary={<OpenIngestionLink />}
          />
        </div>
      );

    case "awaiting_first_export":
      return (
        <div style={cardStyle}>
          <div style={headlineStyle}>
            <Clock size={16} color="#0369a1" aria-hidden />
            Waiting for your first CUR export
          </div>
          <Checklist
            items={[
              { state: "ok", label: "AWS account connected" },
              { state: "pending", label: "CUR export not yet detected in S3" },
              { state: "pending", label: "First ingestion typically runs within a day of the first export" },
            ]}
          />
          <Footer
            primary={
              <a
                href={CUR_DOCS_URL}
                target="_blank"
                rel="noreferrer"
                className="btn btn--ghost btn--sm"
                style={{ textDecoration: "none" }}
              >
                Learn about CUR exports <ArrowUpRight size={12} style={{ marginLeft: 4 }} />
              </a>
            }
            secondary={<OpenIngestionLink />}
          />
        </div>
      );

    case "running":
      return (
        <div style={cardStyle}>
          <div style={headlineStyle}>
            <Clock size={16} color="#0369a1" aria-hidden />
            Ingestion is running right now
          </div>
          <Checklist
            items={[
              { state: "ok", label: "AWS account connected" },
              { state: "ok", label: "CUR export detected" },
              { state: "pending", label: "Ingestion in progress — refresh in a few minutes" },
            ]}
          />
          <Footer secondary={<OpenIngestionLink />} />
        </div>
      );

    case "failed":
      return (
        <div style={cardStyle}>
          <div style={headlineStyle}>
            <AlertTriangle size={16} color="#dc2626" aria-hidden />
            Most recent ingestion run failed
          </div>
          <Checklist
            items={[
              { state: "ok", label: "AWS account connected" },
              { state: "fail", label: "Latest ingestion run failed" },
              { state: "pending", label: "Data shown may be stale until the failure is resolved" },
            ]}
          />
          <Footer primary={<OpenIngestionLink>View details</OpenIngestionLink>} />
        </div>
      );

    case "recently_ingested_no_data_in_range":
      return (
        <div style={cardStyle}>
          <div style={headlineStyle}>
            <Info size={16} color="var(--primary, #3b82f6)" aria-hidden />
            No data for this time range yet
          </div>
          <Checklist
            items={[
              { state: "ok", label: "AWS account connected" },
              { state: "ok", label: "Ingestion is running successfully" },
              { state: "pending", label: "Your current range predates the earliest ingested data" },
            ]}
          />
          <Footer
            primary={
              onChangeTimeRange ? (
                <button
                  type="button"
                  onClick={onChangeTimeRange}
                  className="btn btn--primary btn--sm"
                >
                  Change time range
                </button>
              ) : null
            }
            secondary={<OpenIngestionLink />}
          />
        </div>
      );

    default:
      return fallback;
  }
}
