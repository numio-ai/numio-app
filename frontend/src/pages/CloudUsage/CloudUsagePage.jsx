import React, { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import { formatCurrency } from "../../utils/format";
import { toCsv, downloadCsv } from "../../utils/csvExport";
import { blockSpacing } from "../../constants/designTokens";
import TimeRangeSelector, { useTimeRange } from "../../components/TimeRangeSelector";
import {
  getTotalCost,
  getCostTimeSeries,
  getCostByDimension,
} from "../../api/dashboard";
import ErrorMessageShared from "../../components/ErrorMessage";
import CostSourceLabel from "../../components/CostSourceLabel";

// ---------------------------------------------------------------------------
// Styles (follows existing design system)
// ---------------------------------------------------------------------------

const card = {
  background: "var(--card)",
  border: "1px solid #e5e5e5",
  borderRadius: "12px",
  padding: "20px 24px",
};

const sectionLabel = {
  fontSize: 12,
  fontWeight: 500,
  color: "#9ca3af",
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  marginBottom: 12,
};

const selectStyle = {
  fontSize: 12,
  color: "#6b7280",
  background: "var(--card)",
  border: "1px solid var(--border)",
  borderRadius: 6,
  padding: "6px 10px",
  cursor: "pointer",
};

const DIMENSION_OPTIONS = [
  { value: "service", label: "Service" },
  { value: "team", label: "Team" },
  { value: "project", label: "Project" },
  { value: "account", label: "Account" },
  { value: "region", label: "Region" },
  { value: "environment", label: "Environment" },
];

const GRANULARITY_OPTIONS = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
];

const CHART_COLORS = [
  "#6366f1", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6",
  "#ec4899", "#14b8a6", "#f97316", "#06b6d4", "#84cc16",
];

// ---------------------------------------------------------------------------
// Small helper components
// ---------------------------------------------------------------------------

function LoadingPlaceholder({ height = 80 }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "8px 0", height, justifyContent: "center" }}>
      <div style={{ height: 10, width: "40%", borderRadius: 4, background: "linear-gradient(90deg, #f1f3f5 25%, #f9fafb 50%, #f1f3f5 75%)", backgroundSize: "800px 100%", animation: "numio-shimmer 1.5s infinite linear" }} />
      <div style={{ height: 18, width: "60%", borderRadius: 4, background: "linear-gradient(90deg, #f1f3f5 25%, #f9fafb 50%, #f1f3f5 75%)", backgroundSize: "800px 100%", animation: "numio-shimmer 1.5s infinite linear" }} />
      <style>{`@keyframes numio-shimmer { 0% { background-position: -400px 0; } 100% { background-position: 400px 0; } }`}</style>
    </div>
  );
}

function ErrorMessage({ message, onRetry }) {
  return <ErrorMessageShared message={message} onRetry={onRetry} />;
}

function EmptyState({ message, showSetupCTA = false }) {
  if (showSetupCTA) {
    return <SetupCTAInline message={message} />;
  }
  return (
    <div style={{ fontSize: 13, color: "#9ca3af", padding: "12px 0" }}>
      {message}
    </div>
  );
}

function SetupCTAInline({ message }) {
  return (
    <div className="flex flex-col items-center justify-center py-8 px-4 rounded-lg border"
      style={{ borderColor: "var(--border)", background: "var(--bg-inset)", textAlign: "center" }}>
      <p style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 8 }}>{message}</p>
      <a href="/settings?tab=integrations" className="btn btn--primary btn--sm" style={{ textDecoration: "none" }}>
        Connect your AWS account to get started &rarr;
      </a>
    </div>
  );
}

// ---------------------------------------------------------------------------
// useFetch — generic hook for API data with loading/error
// ---------------------------------------------------------------------------

function useFetch(fetchFn, deps) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchFn()
      .then((result) => { if (!cancelled) setData(result); })
      .catch((err) => { if (!cancelled) setError(err.message || "Failed to load data"); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { data, loading, error };
}

// ---------------------------------------------------------------------------
// Total Spend Summary
// ---------------------------------------------------------------------------

function SpendSummary({ startDate, endDate, periodLabel, account }) {
  const { data, loading, error } = useFetch(
    () => getTotalCost(startDate, endDate, "daily", account || null),
    [startDate, endDate, account],
  );

  const dayCount = Math.round((new Date(endDate) - new Date(startDate)) / 86400000);
  const prevEnd = startDate;
  const prevStart = new Date(new Date(startDate).getTime() - dayCount * 86400000)
    .toISOString().slice(0, 10);

  const { data: prevData } = useFetch(
    () => getTotalCost(prevStart, prevEnd, "daily", account || null),
    [prevStart, prevEnd, account],
  );

  if (loading) return <div style={card}><LoadingPlaceholder /></div>;
  if (error) return <div style={card}><ErrorMessage message={error} /></div>;
  if (!data) return <div style={card}><EmptyState message="No cost data available." showSetupCTA /></div>;

  const total = Number(data.total);
  const prevTotal = prevData ? Number(prevData.total) : null;
  const change = prevTotal != null && prevTotal > 0
    ? ((total - prevTotal) / prevTotal) * 100
    : null;

  return (
    <div style={{ ...card, display: "flex", alignItems: "center", gap: 40 }}>
      <div>
        <p style={sectionLabel}>TOTAL SPEND · {periodLabel} <CostSourceLabel source="cur" showFreshness /></p>
        <p style={{ fontSize: 22, fontWeight: 600, color: "#111827", margin: 0 }}>
          {formatCurrency(total)}
        </p>
        {change != null && (
          <p style={{ fontSize: 12, color: change > 0 ? "#d97706" : "#16a34a", marginTop: 4 }}>
            {change > 0 ? "+" : ""}{change.toFixed(1)}% vs previous period
          </p>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Time-Series Spend Chart
// ---------------------------------------------------------------------------

function SpendChart({ startDate, endDate, dimension, granularity, account }) {
  const { data, loading, error } = useFetch(
    () => getCostTimeSeries(startDate, endDate, granularity, dimension, account || null),
    [startDate, endDate, granularity, dimension, account],
  );

  if (loading) return <div style={card}><p style={sectionLabel}>SPEND OVER TIME</p><LoadingPlaceholder height={250} /></div>;
  if (error) return <div style={card}><p style={sectionLabel}>SPEND OVER TIME</p><ErrorMessage message={error} /></div>;
  if (!data?.data?.length) return <div style={card}><p style={sectionLabel}>SPEND OVER TIME</p><EmptyState message="No spend data for this period" /></div>;

  const hasDimBreakdown = data.by_dimension?.length > 0;

  if (hasDimBreakdown) {
    const dimValues = data.by_dimension.map((d) => d.dimension_value);
    const dateMap = {};
    data.data.forEach((d) => {
      dateMap[d.start] = { date: d.start };
    });
    data.by_dimension.forEach((dim) => {
      dim.data.forEach((d) => {
        if (!dateMap[d.start]) dateMap[d.start] = { date: d.start };
        dateMap[d.start][dim.dimension_value] = Number(d.amount);
      });
    });
    const chartData = Object.values(dateMap).sort((a, b) => a.date.localeCompare(b.date));

    return (
      <div style={card}>
        <p style={sectionLabel}>SPEND OVER TIME</p>
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 10, fill: "#9ca3af" }}
              tickFormatter={(v) => { const d = new Date(v); return `${d.getMonth() + 1}/${d.getDate()}`; }}
              axisLine={false} tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 10, fill: "#9ca3af" }}
              tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
              axisLine={false} tickLine={false} width={48}
            />
            <Tooltip
              formatter={(v, name) => [formatCurrency(v), name]}
              labelFormatter={(v) => new Date(v).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e5e5e5" }}
            />
            {dimValues.map((dv, i) => (
              <Area
                key={dv} type="monotone" dataKey={dv} stackId="1"
                stroke={CHART_COLORS[i % CHART_COLORS.length]}
                fill={CHART_COLORS[i % CHART_COLORS.length]}
                fillOpacity={0.3} strokeWidth={1.5}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    );
  }

  const chartData = data.data.map((d) => ({ date: d.start, amount: Number(d.amount) }));

  return (
    <div style={card}>
      <p style={sectionLabel}>SPEND OVER TIME</p>
      <ResponsiveContainer width="100%" height={280}>
        <AreaChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
          <defs>
            <linearGradient id="cloudSpendGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#6366f1" stopOpacity={0.2} />
              <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 10, fill: "#9ca3af" }}
            tickFormatter={(v) => { const d = new Date(v); return `${d.getMonth() + 1}/${d.getDate()}`; }}
            axisLine={false} tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 10, fill: "#9ca3af" }}
            tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
            axisLine={false} tickLine={false} width={48}
          />
          <Tooltip
            formatter={(v) => [formatCurrency(v), "Spend"]}
            labelFormatter={(v) => new Date(v).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
            contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e5e5e5" }}
          />
          <Area type="monotone" dataKey="amount" stroke="#6366f1" fill="url(#cloudSpendGrad)" strokeWidth={2} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Dimension Breakdown
// ---------------------------------------------------------------------------

function DimensionBreakdown({ startDate, endDate, dimension, account, periodLabel }) {
  const { data, loading, error } = useFetch(
    () => getCostByDimension(dimension, startDate, endDate, account || null),
    [dimension, startDate, endDate, account],
  );

  const dimLabel = DIMENSION_OPTIONS.find((o) => o.value === dimension)?.label || dimension;
  const isAttributed = dimension !== "service";
  const noRules = error && isAttributed && error.includes("404");

  const handleExport = () => {
    if (!data?.data) return;
    const columns = [
      { key: "dimension_value", label: dimLabel },
      { key: "amount", label: "Amount (USD)" },
      { key: "percentage", label: "Percentage" },
    ];
    const filename = `cost-by-${dimension}-${startDate}-${endDate}.csv`;
    downloadCsv(toCsv(data.data, columns), filename);
  };

  return (
    <div style={card}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <p style={{ ...sectionLabel, marginBottom: 0 }}>SPEND BY {dimLabel.toUpperCase()} · {periodLabel}</p>
        {!loading && !error && data?.data?.length > 0 && (
          <button onClick={handleExport} style={{ ...selectStyle, cursor: "pointer" }}>
            Export CSV
          </button>
        )}
      </div>

      {loading && <LoadingPlaceholder />}
      {noRules && (
        <EmptyState message={`No attribution rules configured for "${dimLabel}". Set up rules in Cost Allocation.`} />
      )}
      {error && !noRules && <ErrorMessage message={error} />}
      {!loading && !error && data?.data?.length === 0 && (
        <EmptyState message="No cost data for this period" />
      )}
      {!loading && !error && data?.data?.length > 0 && (
        <>
          {data.data.map((item, i) => {
            const pct = Number(item.percentage);
            const isUnattributed = item.dimension_value === "unallocated" || item.dimension_value === "unattributed";

            return (
              <div
                key={item.dimension_value}
                style={{
                  display: "flex", alignItems: "center", gap: 10,
                  paddingBottom: i < data.data.length - 1 ? 10 : 0,
                  marginBottom: i < data.data.length - 1 ? 10 : 0,
                  borderBottom: i < data.data.length - 1 ? "1px solid #f3f4f6" : "none",
                }}
              >
                <span style={{
                  fontSize: 12, width: 160, flexShrink: 0, overflow: "hidden",
                  textOverflow: "ellipsis", whiteSpace: "nowrap",
                  color: isUnattributed ? "#d97706" : "#374151",
                  fontWeight: isUnattributed ? 500 : 400,
                }}>
                  {item.dimension_value}
                </span>
                <div style={{ flex: 1, height: 6, borderRadius: 9999, background: "#f3f4f6", overflow: "hidden" }}>
                  <div style={{
                    height: 6, borderRadius: 9999, width: `${pct}%`,
                    background: isUnattributed ? "#d97706" : CHART_COLORS[i % CHART_COLORS.length],
                  }} />
                </div>
                <span style={{ fontSize: 12, fontWeight: 500, color: "#111827", width: 80, textAlign: "right", flexShrink: 0 }}>
                  {formatCurrency(Number(item.amount))}
                </span>
                <span style={{ fontSize: 11, color: "#9ca3af", width: 40, textAlign: "right", flexShrink: 0 }}>
                  {pct.toFixed(0)}%
                </span>
                {isUnattributed && isAttributed && (
                  <Link
                    to={`/tag-governance?filter=missing-tag&tag=${dimension}`}
                    style={{ fontSize: 11, color: "#3B5BDB", textDecoration: "none", flexShrink: 0, whiteSpace: "nowrap" }}
                  >
                    Fix tags →
                  </Link>
                )}
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Report Builder (ad-hoc cost reports)
// ---------------------------------------------------------------------------

function ReportBuilder() {
  const [expanded, setExpanded] = useState(false);
  const timeRange = useTimeRange("MTD");
  const { startDate, endDate } = timeRange.dateRange;
  const [dimension, setDimension] = useState("service");
  const [granularity, setGranularity] = useState("daily");
  const [account, setAccount] = useState("");

  const shouldFetch = expanded;
  const { data, loading, error } = useFetch(
    () => shouldFetch
      ? getCostTimeSeries(startDate, endDate, granularity, dimension, account || null)
      : Promise.resolve(null),
    [startDate, endDate, granularity, dimension, account, shouldFetch],
  );

  const handleExport = () => {
    if (!data?.data) return;
    const hasDim = data.by_dimension?.length > 0;
    if (hasDim) {
      const dimValues = data.by_dimension.map((d) => d.dimension_value);
      const columns = [
        { key: "date", label: "Date" },
        { key: "total", label: "Total (USD)" },
        ...dimValues.map((dv) => ({ key: dv, label: dv })),
      ];
      const rows = data.data.map((bucket, idx) => {
        const row = { date: bucket.start, total: bucket.amount };
        data.by_dimension.forEach((dim) => {
          row[dim.dimension_value] = dim.data[idx]?.amount ?? "0";
        });
        return row;
      });
      downloadCsv(toCsv(rows, columns), `report-${dimension}-${granularity}-${startDate}-${endDate}.csv`);
    } else {
      const columns = [
        { key: "date", label: "Date" },
        { key: "amount", label: "Amount (USD)" },
      ];
      const rows = data.data.map((d) => ({ date: d.start, amount: d.amount }));
      downloadCsv(toCsv(rows, columns), `report-${granularity}-${startDate}-${endDate}.csv`);
    }
  };

  const dimLabel = DIMENSION_OPTIONS.find((o) => o.value === dimension)?.label || dimension;

  return (
    <div style={card}>
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          background: "none", border: "none", cursor: "pointer",
          display: "flex", alignItems: "center", gap: 8, padding: 0, width: "100%",
        }}
      >
        <span style={{
          fontSize: 12, transform: expanded ? "rotate(90deg)" : "none",
          transition: "transform 0.15s", color: "#6b7280", display: "inline-block",
        }}>
          ▶
        </span>
        <p style={{ ...sectionLabel, marginBottom: 0 }}>REPORT BUILDER</p>
      </button>

      {expanded && (
        <div style={{ marginTop: 16 }}>
          {/* Controls */}
          <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", marginBottom: 16 }}>
            <select value={dimension} onChange={(e) => setDimension(e.target.value)} style={selectStyle}>
              {DIMENSION_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <select value={granularity} onChange={(e) => setGranularity(e.target.value)} style={selectStyle}>
              {GRANULARITY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <input
              type="text"
              value={account}
              onChange={(e) => setAccount(e.target.value)}
              placeholder="Account ID"
              style={{ ...selectStyle, width: 140 }}
            />
            <TimeRangeSelector
              value={timeRange.value}
              onChange={timeRange.setValue}
              customFrom={timeRange.customFrom}
              customTo={timeRange.customTo}
              onCustomFromChange={timeRange.setCustomFrom}
              onCustomToChange={timeRange.setCustomTo}
            />
            {data?.data?.length > 0 && (
              <button onClick={handleExport} style={{ ...selectStyle, cursor: "pointer" }}>
                Export CSV
              </button>
            )}
          </div>

          {/* Results table */}
          {loading && <LoadingPlaceholder />}
          {error && <ErrorMessage message={error} />}
          {!loading && !error && !data?.data?.length && (
            <EmptyState message="No data for the selected parameters" />
          )}
          {!loading && !error && data?.data?.length > 0 && (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid #e5e5e5" }}>
                    <th style={{ textAlign: "left", padding: "8px 10px", color: "#9ca3af", fontWeight: 500 }}>Date</th>
                    <th style={{ textAlign: "right", padding: "8px 10px", color: "#9ca3af", fontWeight: 500 }}>Total</th>
                    {data.by_dimension?.map((dim) => (
                      <th key={dim.dimension_value} style={{ textAlign: "right", padding: "8px 10px", color: "#9ca3af", fontWeight: 500 }}>
                        {dim.dimension_value}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.data.map((bucket, idx) => (
                    <tr key={bucket.start} style={{ borderBottom: "1px solid #f3f4f6" }}>
                      <td style={{ padding: "8px 10px", color: "#374151" }}>{bucket.start}</td>
                      <td style={{ padding: "8px 10px", color: "#111827", fontWeight: 500, textAlign: "right" }}>
                        {formatCurrency(Number(bucket.amount))}
                      </td>
                      {data.by_dimension?.map((dim) => (
                        <td key={dim.dimension_value} style={{ padding: "8px 10px", color: "#374151", textAlign: "right" }}>
                          {formatCurrency(Number(dim.data[idx]?.amount ?? 0))}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Cloud Usage Page
// ---------------------------------------------------------------------------

export default function CloudUsagePage() {
  const timeRange = useTimeRange("MTD");
  const { startDate, endDate } = timeRange.dateRange;
  const [dimension, setDimension] = useState("service");
  const [granularity, setGranularity] = useState("daily");
  const [account, setAccount] = useState("");

  return (
    <div style={{ padding: 32, maxWidth: 960, background: "#f9fafb" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16, marginBottom: 8 }}>
        <div style={{ marginBottom: blockSpacing }}>
          <h1 style={{ fontSize: 16, fontWeight: 500, color: "#111827", margin: 0 }}>
            Cloud Usage
          </h1>
          <p style={{ fontSize: 13, color: "#6b7280", marginTop: 4 }}>
            Explore cloud costs by dimension, time range, and account
          </p>
        </div>
        <TimeRangeSelector
          value={timeRange.value}
          onChange={timeRange.setValue}
          customFrom={timeRange.customFrom}
          customTo={timeRange.customTo}
          onCustomFromChange={timeRange.setCustomFrom}
          onCustomToChange={timeRange.setCustomTo}
        />
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", marginBottom: 16 }}>
        <label style={{ fontSize: 12, color: "#9ca3af" }}>Dimension</label>
        <select value={dimension} onChange={(e) => setDimension(e.target.value)} style={selectStyle}>
          {DIMENSION_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <label style={{ fontSize: 12, color: "#9ca3af", marginLeft: 8 }}>Granularity</label>
        <select value={granularity} onChange={(e) => setGranularity(e.target.value)} style={selectStyle}>
          {GRANULARITY_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <input
          type="text"
          value={account}
          onChange={(e) => setAccount(e.target.value)}
          placeholder="Filter by Account ID"
          style={{ ...selectStyle, width: 160 }}
        />
      </div>

      {/* Content */}
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <SpendSummary
          startDate={startDate}
          endDate={endDate}
          periodLabel={timeRange.periodLabel}
          account={account}
        />
        <SpendChart
          startDate={startDate}
          endDate={endDate}
          dimension={dimension}
          granularity={granularity}
          account={account}
        />
        <DimensionBreakdown
          startDate={startDate}
          endDate={endDate}
          dimension={dimension}
          account={account}
          periodLabel={timeRange.periodLabel}
        />
        <ReportBuilder />
      </div>
    </div>
  );
}
