import React from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { IconReport, IconDots, IconPlus, IconDownload, IconFilter, IconSliders, IconCalendar } from "../../components/Icons";
import { overviewSummary } from "../../mocks/mockOverview";
import { execCardClass, execHeaderClass, compactSummaryBarStyle, formatCurrentMonth } from "../../constants/designTokens";
import { useBudget } from "../../context/BudgetContext";
import { formatCurrency } from "../../utils/format";

/* Report names — aligned with mockCostReports / Overview teams */
const reportNames = {
  all: "All Resources",
  prod: "All Resources — Prod",
  dev: "Development Costs",
  mgmt: "Management Account",
  "budget-eng-devops": "Engineering / DevOps",
  "budget-ml": "ML Platform",
  "budget-data": "Data & Analytics",
  "budget-marketing": "Marketing",
  "budget-sales": "Sales",
  "budget-corporate": "Corporate / Other",
};

const rows = [
  { service: "Amazon Elastic Compute Cloud - Compute", cost: "$14.02" },
  { service: "Amazon Virtual Private Cloud", cost: "$4.11" },
  { service: "Amazon Elastic Block Storage (EBS)", cost: "$3.33" },
  { service: "AWS Secrets Manager", cost: "$0.82" },
  { service: "Amazon EC2 Container Registry (ECR)", cost: "$0.05" },
  { service: "Amazon Simple Storage Service", cost: "$0.01" },
  { service: "AWS Lambda", cost: "$0.00" }
];

const chartPoints = [
  { label: "01/01/2026", value: 1 },
  { label: "01/04/2026", value: 3 },
  { label: "01/07/2026", value: 5 },
  { label: "01/10/2026", value: 7 },
  { label: "01/13/2026", value: 10 },
  { label: "01/16/2026", value: 14 },
  { label: "01/19/2026", value: 18 },
  { label: "01/21/2026", value: 22 }
];

// TODO: Replace with API call to /api/reports/{reportId}/anomalies
const mockAnomalies = [
  {
    id: "anom-001",
    severity: "CRITICAL",
    title: "EC2 costs 15x above baseline",
    timestamp: "Jan 15, 3:24 PM",
    impact: "+$450/day",
    owner: "deploy-bot",
    description: "5 new m5.2xlarge instances launched in us-east-1",
  },
  {
    id: "anom-002",
    severity: "WARNING",
    title: "S3 egress spike detected",
    timestamp: "Jan 18, 11:42 AM",
    impact: "+$120/day",
    owner: "ml-team",
    description: "Unusual data transfer from s3://ml-models bucket",
  },
  {
    id: "anom-003",
    severity: "INFO",
    title: "New tagging gaps detected",
    timestamp: "Jan 20, 8:11 AM",
    impact: null,
    owner: null,
    description: "12 EC2 instances missing required cost allocation tags",
  },
];

// TODO: Replace with API call to /api/reports/{reportId}/forecast
const mockForecast = {
  projectedCost: 43.05,
  confidenceRange: 5.2,
  confidencePercent: 88,
  budget: 500,
  drivers: [
    "EC2 usage trending up 15% week-over-week",
    "S3 storage growth remains steady at 3% monthly",
    "RDS costs stable, no significant changes expected",
  ],
  budgetStatusMessage: "On track to finish 91% under budget ($456.95 remaining)",
  chartData: [
    { date: "2026-01-01", actual: 6.5, forecast: null },
    { date: "2026-01-07", actual: 9.2, forecast: null },
    { date: "2026-01-14", actual: 14.3, forecast: null },
    { date: "2026-01-21", actual: 22.32, forecast: null },
    { date: "2026-01-28", actual: null, forecast: 32.5, lower: 28.0, upper: 37.0 },
    { date: "2026-01-31", actual: null, forecast: 43.05, lower: 37.85, upper: 48.25 },
  ],
};

export default function CostReportDetail() {
  const { id } = useParams();
  const reportName = reportNames[id] || `Report ${id}`;
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = React.useState("overview");
  const { mtdSpend, monthlyBudget, lastUpdated } = useBudget();

  const anomalies = mockAnomalies;
  const forecast = mockForecast;

  const handleInvestigate = (anomalyId) => {
    console.log("Investigate anomaly", anomalyId);
    navigate(`/anomalies/${anomalyId}`);
  };

  const renderOverviewTab = () => (
    <>
      <div className="costReport__chartCard">
        <div className="costReport__metric">
          <div className="costReport__metricValue">$22.32</div>
          <div className="costReport__metricLabel">Accrued Costs</div>
        </div>
        <div className="costReport__chartControls">
          <button className="iconSquare iconSquare--ghost" type="button">
            <span className="iconText">GRD</span>
          </button>
          <button className="iconSquare iconSquare--ghost" type="button">
            <span className="iconText">BAR</span>
          </button>
          <button className="iconSquare iconSquare--ghost iconSquare--active" type="button">
            <span className="iconText">LINE</span>
          </button>
          <button className="iconSquare iconSquare--ghost" type="button">
            <span className="iconText">AREA</span>
          </button>
          <button className="iconSquare iconSquare--ghost" type="button">
            <span className="iconText">PIE</span>
          </button>
        </div>

        <div className="costReport__chart">
          <div className="costReport__chartGrid">
            <span>$30.00</span>
            <span>$20.00</span>
            <span>$10.00</span>
            <span>$0.00</span>
          </div>
          <svg
            className="costReport__chartSvg"
            viewBox="0 0 640 220"
            role="img"
            aria-label="Accrued costs by day"
          >
            <polyline
              fill="none"
              stroke="var(--purple)"
              strokeWidth="2"
              points="20,200 90,185 160,170 230,150 300,130 370,105 440,80 520,60"
            />
            {chartPoints.map((point, index) => {
              const x = 20 + index * 70;
              const y = 200 - point.value * 6;
              return <circle key={point.label} cx={x} cy={y} r="3" fill="var(--purple)" />;
            })}
          </svg>
          <div className="costReport__chartXAxis">
            {chartPoints.map((point) => (
              <span key={point.label}>{point.label}</span>
            ))}
          </div>
        </div>
      </div>

      <div className="costReport__tableCard">
        <div className="costReport__tableToolbar">
          <div className="costReport__tableLeft">
            <button className="iconSquare iconSquare--ghost" type="button">
              <span className="iconText">%</span>
            </button>
            <button className="iconSquare iconSquare--ghost" type="button">
              <span className="iconText">$</span>
            </button>
          </div>
          <div className="costReport__tableRight">
            <button className="filterBtn filterBtn--dropdown" type="button">
              Cumulative
            </button>
            <button className="filterBtn" type="button">
              By Date
            </button>
          </div>
        </div>
        <table className="table table--cost" aria-label="Cost by service">
          <thead>
            <tr>
              <th className="th th--left">
                Service <span className="th__funnel" aria-hidden="true">≡</span>
              </th>
              <th className="th th--sort">
                <span className="th__sortActive">Accrued Costs</span>{" "}
                <span className="th__arrow" aria-hidden="true">↓</span>
                <div className="th__subtle">Jan 1 - Jan 21, 2026</div>
              </th>
              <th className="th">
                Previous Period Costs{" "}
                <span className="th__funnel" aria-hidden="true">≡</span>
                <div className="th__subtle">Dec 1 - Dec 21, 2025</div>
              </th>
              <th className="th">
                Change <span className="th__funnel" aria-hidden="true">≡</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.service}>
                <td className="td td--left">
                  <div className="serviceCell">
                    <div className="serviceActions">
                      <button className="iconSquare iconSquare--mini" type="button">
                        <span className="iconText">TAB</span>
                      </button>
                      <button className="iconSquare iconSquare--mini" type="button">
                        <span className="iconText">ALRT</span>
                      </button>
                      <button className="iconSquare iconSquare--mini" type="button">
                        <span className="iconText">CFG</span>
                      </button>
                    </div>
                    <span className="serviceBadge">aws</span>
                    <span>{row.service}</span>
                  </div>
                </td>
                <td className="td">{row.cost}</td>
                <td className="td">$0.00</td>
                <td className="td" />
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );

  const renderAnomaliesTab = () => (
    <section className={execCardClass} style={{ marginBottom: "24px", borderColor: "var(--border)", borderRadius: "var(--radius-lg)", padding: "var(--card-padding)" }}>
      <p className={execHeaderClass}>ANOMALIES (LAST 30 DAYS): {anomalies.length}</p>
      {anomalies.length > 0 ? (
        <div className="anomaliesList">
          {anomalies.map((anomaly) => (
            <div key={anomaly.id} className={`anomalyCard anomalyCard--${anomaly.severity.toLowerCase()}`}>
              <div className="anomalyCard__header">
                <span className={`badge badge--${anomaly.severity.toLowerCase()}`}>{anomaly.severity}</span>
                <span className="anomalyCard__timestamp">{anomaly.timestamp}</span>
              </div>
              <h4 className="anomalyCard__title">{anomaly.title}</h4>
              <div className="anomalyCard__meta">
                {anomaly.impact && <span>Impact: {anomaly.impact}</span>}
                {anomaly.owner && <span>• Owner: {anomaly.owner}</span>}
              </div>
              <p className="anomalyCard__description">{anomaly.description}</p>
              <button
                className="btn btn--ghost btn--sm"
                type="button"
                onClick={() => handleInvestigate(anomaly.id)}
              >
                {anomaly.severity === "INFO" ? "View Details →" : "Investigate →"}
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="emptyState emptyState--inline">
          <p>No anomalies detected in this period</p>
        </div>
      )}
    </section>
  );

  const renderForecastsTab = () => {
    const chartWidth = 640;
    const chartHeight = 220;
    const actualPoints = forecast.chartData.filter((p) => p.actual !== null);
    const forecastPoints = forecast.chartData.filter((p) => p.forecast !== null);
    const allValues = forecast.chartData.flatMap((p) => [p.actual, p.forecast, p.lower, p.upper]).filter(Boolean);
    const maxValue = Math.max(...allValues, forecast.budget);

    const pointForIndex = (index, value) => {
      const x = 20 + index * (chartWidth - 40) / (forecast.chartData.length - 1);
      const y = chartHeight - (value / maxValue) * (chartHeight - 30);
      return { x, y };
    };

    return (
      <section className={execCardClass} style={{ marginBottom: "24px", borderColor: "var(--border)", borderRadius: "var(--radius-lg)", padding: "var(--card-padding)" }}>
        <p className={execHeaderClass}>30-DAY FORECAST</p>
        <div className="forecastSummary">
          <div className="forecastSummary__metric">
            <div className="forecastSummary__label">Projected End-of-Month Cost</div>
            <div className="forecastSummary__value">${forecast.projectedCost}</div>
          </div>
          <div className="forecastSummary__metric">
            <div className="forecastSummary__label">Confidence</div>
            <div className="forecastSummary__value">±${forecast.confidenceRange} ({forecast.confidencePercent}%)</div>
          </div>
        </div>

        <div className="forecastChart">
          <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="forecastChart__svg" role="img" aria-label="30-day forecast">
            <line x1="20" y1={chartHeight - (forecast.budget / maxValue) * (chartHeight - 30)} x2={chartWidth - 20} y2={chartHeight - (forecast.budget / maxValue) * (chartHeight - 30)} stroke="#ef4444" strokeWidth="2" />
            <polygon
              fill="rgba(59,130,246,0.15)"
              points={[
                ...forecastPoints.map((p, i) => {
                  const idx = forecast.chartData.indexOf(p);
                  const { x, y } = pointForIndex(idx, p.upper);
                  return `${x},${y}`;
                }),
                ...forecastPoints.slice().reverse().map((p) => {
                  const idx = forecast.chartData.indexOf(p);
                  const { x, y } = pointForIndex(idx, p.lower);
                  return `${x},${y}`;
                }),
              ].join(" ")}
            />
            <polyline
              fill="none"
              stroke="#2563eb"
              strokeWidth="2"
              points={actualPoints.map((p) => {
                const idx = forecast.chartData.indexOf(p);
                const { x, y } = pointForIndex(idx, p.actual);
                return `${x},${y}`;
              }).join(" ")}
            />
            <polyline
              fill="none"
              stroke="#2563eb"
              strokeWidth="2"
              strokeDasharray="6 6"
              points={forecastPoints.map((p) => {
                const idx = forecast.chartData.indexOf(p);
                const { x, y } = pointForIndex(idx, p.forecast);
                return `${x},${y}`;
              }).join(" ")}
            />
          </svg>
          <div className="forecastChart__axis">
            {forecast.chartData.map((point) => (
              <span key={point.date}>{point.date.slice(5)}</span>
            ))}
          </div>
        </div>

        <div className="forecastDrivers">
          <h4>Key Drivers:</h4>
          <ul>
            {forecast.drivers.map((driver) => (
              <li key={driver}>{driver}</li>
            ))}
          </ul>
        </div>

        <div className="forecastBudget">
          <h4>Budget Status:</h4>
          <p>{forecast.budgetStatusMessage}</p>
        </div>
      </section>
    );
  };

  return (
    <div className="main">
      <div className="costReport">
        <header className="costReport__header">
          <div className="costReport__titleBlock">
            <span className="costReport__icon">
              <IconReport className="icon icon--report" />
            </span>
            <div>
              <div className="costReport__kicker">Cost Reports · {formatCurrentMonth()}</div>
              <div className="costReport__title">{reportName}</div>
              <p className="text-sm mt-1" style={{ color: "var(--text-tertiary)" }}>
                Aligned with Overview. MTD {formatCurrency(mtdSpend)} · Budget {formatCurrency(monthlyBudget)}
              </p>
            </div>
          </div>
          <div className="costReport__actions">
            <Link to="/inbox" className="text-sm font-medium" style={{ color: "var(--primary)", marginRight: "12px" }}>View Inbox →</Link>
            <span className="costReport__updated">Updated {lastUpdated}</span>
            <button className="iconSquare iconSquare--light" type="button">
              <IconDots className="icon" />
            </button>
            <button className="iconSquare iconSquare--light" type="button">
              <IconPlus className="icon" />
            </button>
            <button className="iconSquare iconSquare--light" type="button">
              <IconDownload className="icon" />
            </button>
            <button className="btn btn--primary" type="button">
              Save as New
            </button>
          </div>
        </header>

        <div className="costReport__tabs">
          <button
            className={`subTab ${activeTab === "overview" ? "subTab--active" : ""}`}
            type="button"
            onClick={() => setActiveTab("overview")}
          >
            Overview
          </button>
          <button
            className={`subTab ${activeTab === "anomalies" ? "subTab--active" : ""}`}
            type="button"
            onClick={() => setActiveTab("anomalies")}
          >
            Anomalies
          </button>
          <button
            className={`subTab ${activeTab === "forecasts" ? "subTab--active" : ""}`}
            type="button"
            onClick={() => setActiveTab("forecasts")}
          >
            Forecasts
          </button>
        </div>

        <div className="costReport__toolbar">
          <div className="costReport__filters">
            <button className="filterBtn" type="button">
              <IconFilter className="icon icon--filter" />
              Filters
            </button>
            <button className="filterBtn" type="button">
              <span className="filterBtn__label">Group By</span>
              <span className="filterBtn__value">Ungrouped</span>
            </button>
            <button className="filterBtn" type="button">
              <IconSliders className="icon icon--filter" />
              Cost Settings
            </button>
            <button className="filterBtn" type="button">
              <IconSliders className="icon icon--filter" />
              Chart Settings
            </button>
          </div>
          <div className="costReport__range">
            <button className="filterBtn" type="button">
              <IconCalendar className="icon icon--filter" />
              This Month
            </button>
            <button className="filterBtn" type="button">
              Jan 1 - Jan 31, 2026
            </button>
            <button className="filterBtn filterBtn--dropdown" type="button">
              Cumulative
            </button>
          </div>
        </div>

        {activeTab === "overview" && renderOverviewTab()}
        {activeTab === "anomalies" && renderAnomaliesTab()}
        {activeTab === "forecasts" && renderForecastsTab()}
      </div>
    </div>
  );
}
