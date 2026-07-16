import { createContext, useContext, useState, useEffect } from "react";
import {
  generateMTDSpend,
  generateLastMonthTotal,
  generateForecast,
  generateTeamBreakdown,
  generateAIBreakdown,
  getMonthContext,
} from "../data/mockSpendData";

const BUDGET_KEY = "numio_budget_config";

const defaultBudget = {
  monthlyBudget: 50000,
  currency: "USD",
  fiscalMonthStart: 1,
};

const BudgetContext = createContext(null);

function computeData(budget) {
  const { days, mtdTotal, dailyAverage } = generateMTDSpend(budget);
  const forecast = generateForecast(mtdTotal, budget);
  const lastMonth = generateLastMonthTotal(budget);
  const teams = generateTeamBreakdown(mtdTotal);
  const ai = generateAIBreakdown(mtdTotal);
  const calendar = getMonthContext();
  return { days, mtdTotal, dailyAverage, forecast, lastMonth, teams, ai, calendar };
}

export function BudgetProvider({ children }) {
  const [budgetConfig, setBudgetConfig] = useState(() => {
    try {
      const stored = localStorage.getItem(BUDGET_KEY);
      return stored ? JSON.parse(stored) : defaultBudget;
    } catch {
      return defaultBudget;
    }
  });

  const [data, setData] = useState(() =>
    computeData(budgetConfig.monthlyBudget)
  );

  // Recompute when budget changes
  useEffect(() => {
    setData(computeData(budgetConfig.monthlyBudget));
  }, [budgetConfig.monthlyBudget]);

  // Recompute at midnight when day rolls over
  useEffect(() => {
    const now = new Date();
    const msUntilMidnight =
      new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1) - now;

    const timer = setTimeout(() => {
      setData(computeData(budgetConfig.monthlyBudget));
    }, msUntilMidnight);

    return () => clearTimeout(timer);
  }, [budgetConfig.monthlyBudget]);

  const updateBudget = (newBudget) => {
    const parsed = parseFloat(newBudget);
    if (isNaN(parsed) || parsed <= 0) return;
    const updated = { ...budgetConfig, monthlyBudget: parsed };
    setBudgetConfig(updated);
    try {
      localStorage.setItem(BUDGET_KEY, JSON.stringify(updated));
    } catch (_) {}
  };

  const mtdSpend = data.mtdTotal;
  const forecast = data.forecast;
  const monthlyBudget = budgetConfig.monthlyBudget;

  const derived = {
    monthlyBudget,
    mtdSpend,
    forecast,
    dailyAverage: data.dailyAverage,
    dailySpend: data.days,
    lastMonthTotal: data.lastMonth,
    teamBreakdown: data.teams,
    aiBreakdown: data.ai,
    calendar: data.calendar,
    remaining: monthlyBudget - mtdSpend,
    percentUsed: Math.round((mtdSpend / monthlyBudget) * 100),
    percentForecast: Math.round((forecast / monthlyBudget) * 100),
    isOnTrack: forecast <= monthlyBudget,
    isOverBudget: mtdSpend > monthlyBudget,
    isForecastOverBudget: forecast > monthlyBudget,
    status:
      mtdSpend > monthlyBudget
        ? "over"
        : forecast > monthlyBudget
        ? "at-risk"
        : "on-track",
    statusLabel:
      mtdSpend > monthlyBudget
        ? "Over budget"
        : forecast > monthlyBudget
        ? "At risk of exceeding budget"
        : "On track to stay under budget",
    statusColor:
      mtdSpend > monthlyBudget
        ? "#dc2626"
        : forecast > monthlyBudget
        ? "#d97706"
        : "#16a34a",
    lastUpdated: "today",
    refresh: () => {},
    loading: false,
    error: null,
    // Backward compatibility for components that read these from context
    daysElapsed: data.calendar.daysElapsed,
    daysRemaining: data.calendar.daysRemaining,
    daysInMonth: data.calendar.daysInMonth,
    progressRatio: data.calendar.daysElapsed / data.calendar.daysInMonth,
  };

  return (
    <BudgetContext.Provider value={{ ...derived, updateBudget }}>
      {children}
    </BudgetContext.Provider>
  );
}

export function useBudget() {
  const ctx = useContext(BudgetContext);
  if (!ctx) throw new Error("useBudget must be used within BudgetProvider");
  return ctx;
}
