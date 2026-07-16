import React from "react";
import { Link } from "react-router-dom";
import { execCardClass, execHeaderClass, compactSummaryBarStyle, formatCurrentMonth } from "../constants/designTokens";
import { useBudget } from "../context/BudgetContext";
import { formatCurrency } from "../utils/format";

export default function Accounts() {
  const { mtdSpend, lastUpdated } = useBudget();
  return (
    <div className="main">
      <div className="pageContent" style={{ maxWidth: "960px", margin: "0 auto" }}>
        <div className="flex justify-between items-start mb-6">
          <div>
            <h1 className="text-xl font-semibold" style={{ color: "var(--text)" }}>Accounts</h1>
            <p className="text-sm mt-1" style={{ color: "var(--text-tertiary)" }}>
              View cost by account.
            </p>
          </div>
          <Link to="/inbox" className="text-sm font-medium" style={{ color: "var(--primary)" }}>View Inbox →</Link>
        </div>

        <section className="flex flex-wrap items-center gap-4 py-3 px-4 rounded-xl border bg-white" style={compactSummaryBarStyle}>
          <p className="text-[11px] font-semibold uppercase tracking-[0.05em] shrink-0" style={{ color: "var(--text-tertiary)" }}>COSTS · {formatCurrentMonth()}</p>
          <p className="text-2xl font-semibold tracking-tight shrink-0" style={{ color: "var(--text)" }}>{formatCurrency(mtdSpend)}</p>
          <span className="text-xs shrink-0 ml-auto" style={{ color: "var(--text-tertiary)" }}>Updated {lastUpdated}</span>
        </section>

        <section className={execCardClass} style={{ borderColor: "var(--border)", borderRadius: "var(--radius-lg)", padding: "var(--card-padding)" }}>
          <p className={execHeaderClass}>ACCOUNTS</p>
        <table className="table table--plain w-full" aria-label="Accounts">
          <thead>
            <tr>
              <th className="th th--left">
                Account <span className="th__funnel" aria-hidden="true">≡</span>
              </th>
              <th className="th th--sort">
                <span className="th__sortActive">Month To Date</span>{" "}
                <span className="th__arrow" aria-hidden="true">↓</span>
              </th>
              <th className="th">
                Previous Month To Date{" "}
                <span className="th__funnel" aria-hidden="true">≡</span>
              </th>
              <th className="th">
                Change <span className="th__funnel" aria-hidden="true">≡</span>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="td td--left">
                <Link className="link" to="/reports/prod">Prod</Link>
              </td>
              <td className="td">$22.32</td>
              <td className="td">$1.57</td>
              <td className="td">+1327.79%</td>
            </tr>
            <tr>
              <td className="td td--left">
                <Link className="link" to="/reports/dev">Development</Link>
              </td>
              <td className="td">$6.88</td>
              <td className="td">$0.00</td>
              <td className="td" />
            </tr>
            <tr>
              <td className="td td--left">
                <Link className="link" to="/reports/mgmt">Management</Link>
              </td>
              <td className="td">$2.57</td>
              <td className="td">$2.55</td>
              <td className="td">+1.00%</td>
            </tr>
          </tbody>
        </table>
        </section>
      </div>
    </div>
  );
}
