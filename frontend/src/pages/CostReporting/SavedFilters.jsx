import React from "react";
import { IconFilter } from "../../components/Icons";
import CostsMtdBanner from "../../components/CostsMtdBanner";

export default function SavedFilters() {
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
            Saved Filters
          </h1>
          <p style={{ fontSize: "13px", color: "#6b7280", marginTop: "4px" }}>
            Save and reuse filter configurations across reports. Aligned with Overview.
          </p>
        </div>
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
          New saved filter
        </button>
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
          <IconFilter className="icon icon--large mx-auto mb-4" style={{ color: "var(--text-tertiary)" }} />
          <h2 style={{ fontSize: "14px", fontWeight: 500, color: "#111827", margin: "0 0 8px 0" }}>
            No saved filters
          </h2>
          <p style={{ fontSize: "13px", color: "#6b7280", marginBottom: "16px" }}>
            Create saved filters to quickly apply common filter configurations.
          </p>
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
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            Create saved filter
          </button>
        </div>
      </section>
    </div>
  );
}
