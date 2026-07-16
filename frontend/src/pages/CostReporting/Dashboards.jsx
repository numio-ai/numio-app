import React from "react";
import { Link } from "react-router-dom";
import { IconDashboard } from "../../components/Icons";
import CostsMtdBanner from "../../components/CostsMtdBanner";

export default function Dashboards() {
  return (
    <div style={{ padding: "24px 24px 0" }}>
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          marginBottom: "20px",
        }}
      >
        <div>
          <h1 style={{ fontSize: "16px", fontWeight: 500, color: "#111827", margin: 0 }}>
            Dashboards
          </h1>
          <p style={{ fontSize: "13px", color: "#6b7280", marginTop: "4px" }}>
            Create custom dashboards to visualize your cost data. Aligned with Overview.
          </p>
        </div>
        <Link
          to="/dashboards/new"
          style={{
            padding: "7px 14px",
            fontSize: "13px",
            fontWeight: 500,
            color: "#111827",
            background: "#ffffff",
            border: "1px solid #e5e5e5",
            borderRadius: "8px",
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            textDecoration: "none",
          }}
        >
          New dashboard
        </Link>
      </div>

      <CostsMtdBanner />

      <section
        style={{
          background: "#ffffff",
          border: "1px solid #efefef",
          borderRadius: "12px",
          padding: "20px 24px",
          textAlign: "center",
          marginBottom: "24px",
        }}
      >
        <div style={{ padding: "32px 0" }}>
          <IconDashboard className="icon icon--large mx-auto mb-4" style={{ color: "var(--text-tertiary)" }} />
          <h2 style={{ fontSize: "14px", fontWeight: 500, color: "#111827", margin: "0 0 8px 0" }}>
            No dashboards yet
          </h2>
          <p style={{ fontSize: "13px", color: "#6b7280", marginBottom: "16px" }}>
            Create your first dashboard to get started with custom visualizations.
          </p>
          <Link
            to="/dashboards/new"
            style={{
              padding: "7px 14px",
              fontSize: "13px",
              fontWeight: 500,
              color: "#111827",
              background: "#ffffff",
              border: "1px solid #e5e5e5",
              borderRadius: "8px",
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              textDecoration: "none",
            }}
          >
            Create dashboard
          </Link>
        </div>
      </section>
    </div>
  );
}
