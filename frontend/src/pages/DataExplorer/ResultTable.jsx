import React from "react";

/**
 * Renders a query result. Three states:
 *  - empty rows  → "No rows returned"
 *  - normal      → header + body
 *  - truncated   → header + body + truncation banner above the meta line
 */
export default function ResultTable({ result }) {
  const { columns = [], rows = [], row_count = 0, truncated, elapsed_ms } = result;

  return (
    <div className="dx-result">
      {truncated && (
        <div
          role="status"
          className="dx-truncation-banner"
          style={{
            background: "#fef3c7",
            border: "1px solid #fcd34d",
            color: "#92400e",
            padding: "8px 12px",
            borderRadius: 6,
            marginBottom: 8,
            fontSize: 13,
          }}
        >
          Result truncated to {row_count} rows. Refine the query (LIMIT, WHERE) to see more.
        </div>
      )}
      <div
        className="dx-result-meta"
        style={{ fontSize: 12, color: "#6b7280", marginBottom: 6 }}
      >
        {row_count} {row_count === 1 ? "row" : "rows"} · {elapsed_ms} ms
      </div>
      {rows.length === 0 ? (
        <div
          className="dx-result-empty"
          style={{
            padding: 24,
            textAlign: "center",
            border: "1px dashed #e5e7eb",
            borderRadius: 6,
            color: "#6b7280",
            fontSize: 13,
          }}
        >
          No rows returned.
        </div>
      ) : (
        <div style={{ overflow: "auto", border: "1px solid #e5e7eb", borderRadius: 6 }}>
          <table
            className="dx-result-table"
            style={{ borderCollapse: "collapse", width: "100%", fontSize: 13 }}
          >
            <thead>
              <tr>
                {columns.map((col) => (
                  <th
                    key={col}
                    style={{
                      textAlign: "left",
                      padding: "8px 10px",
                      borderBottom: "1px solid #e5e7eb",
                      background: "#f9fafb",
                      position: "sticky",
                      top: 0,
                      fontWeight: 600,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, ri) => (
                <tr key={ri}>
                  {row.map((cell, ci) => (
                    <td
                      key={ci}
                      style={{
                        padding: "6px 10px",
                        borderBottom: "1px solid #f3f4f6",
                        whiteSpace: "nowrap",
                        fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                        color: cell === null ? "#9ca3af" : "#111827",
                      }}
                    >
                      {cell === null ? "NULL" : String(cell)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
