// src/data/mockSpendData.js

// Seeded random — deterministic per day, different each day
function seededRandom(seed) {
  const x = Math.sin(seed * 9301 + 49297) * 233280;
  return x - Math.floor(x);
}

// Day-of-week multiplier — realistic cloud spend pattern
// Weekdays higher, weekends lower (engineering teams not deploying)
function dayOfWeekMultiplier(date) {
  const dow = new Date(date).getDay(); // 0=Sun, 6=Sat
  const multipliers = {
    0: 0.55, // Sunday — minimal
    1: 1.15, // Monday — ramp up
    2: 1.2, // Tuesday — peak
    3: 1.18, // Wednesday — peak
    4: 1.12, // Thursday — slightly lower
    5: 0.95, // Friday — winding down
    6: 0.6, // Saturday — low
  };
  return multipliers[dow];
}

// Generate spend for a specific day
function generateDailySpend(date, monthlyBudget) {
  const d = new Date(date);
  const dayOfMonth = d.getDate();
  const seed = d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + dayOfMonth;

  // Base: monthly budget distributed across 30 days with slight front-loading
  // Real cloud spend tends to be higher mid-month due to billing cycles
  const baseDailyRate = monthlyBudget / 30;

  // Mid-month spike (days 10-20 tend to be higher)
  const midMonthMultiplier = dayOfMonth >= 10 && dayOfMonth <= 20 ? 1.12 : 1.0;

  // Natural variance ±18%
  const variance = (seededRandom(seed) - 0.5) * 0.36;

  // Weekend/weekday pattern
  const dowMultiplier = dayOfWeekMultiplier(date);

  const dailySpend = baseDailyRate * midMonthMultiplier * dowMultiplier * (1 + variance);

  return Math.round(dailySpend * 100) / 100; // round to cents
}

// Generate full month of daily spend up to today
export function generateMTDSpend(monthlyBudget) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const today = now.getDate();

  const days = [];
  let cumulative = 0;

  for (let day = 1; day <= today; day++) {
    const date = new Date(year, month, day).toISOString().split("T")[0];
    const amount = generateDailySpend(date, monthlyBudget);
    cumulative += amount;
    days.push({ date, amount: Math.round(amount), cumulative: Math.round(cumulative) });
  }

  return {
    days,
    mtdTotal: Math.round(cumulative),
    dailyAverage: today > 0 ? Math.round(cumulative / today) : 0,
  };
}

// Generate last month's total for comparison
export function generateLastMonthTotal(monthlyBudget) {
  const now = new Date();
  const year = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
  const month = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
  const daysInLastMonth = new Date(year, month + 1, 0).getDate();

  let total = 0;
  for (let day = 1; day <= daysInLastMonth; day++) {
    const date = new Date(year, month, day).toISOString().split("T")[0];
    total += generateDailySpend(date, monthlyBudget);
  }
  return Math.round(total);
}

// Forecast: project current burn rate to end of month
export function generateForecast(mtdTotal, monthlyBudget) {
  const now = new Date();
  const today = now.getDate();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

  if (today === 0) return mtdTotal;

  const dailyBurnRate = mtdTotal / today;
  const projectedTotal = Math.round(dailyBurnRate * daysInMonth);

  return projectedTotal;
}

// Generate team breakdown — proportional slices of MTD total
export function generateTeamBreakdown(mtdTotal) {
  // Fixed proportions with slight daily variance
  const now = new Date();
  const seed = now.getDate();

  const teams = [
    { name: "Engineering / DevOps", baseShare: 0.469, seed: seed + 1 },
    { name: "ML Platform", baseShare: 0.224, seed: seed + 2 },
    { name: "Data & Analytics", baseShare: 0.134, seed: seed + 3 },
    { name: "Marketing", baseShare: 0.075, seed: seed + 4 },
    { name: "Sales", baseShare: 0.055, seed: seed + 5 },
    { name: "Corporate / Other", baseShare: 0.043, seed: seed + 6 },
  ];

  const trends = [8, 23, -3, 12, 0, -5]; // percent change vs last month, matches team order
  return teams.map((team, i) => {
    const variance = (seededRandom(team.seed) - 0.5) * 0.04;
    const share = team.baseShare + variance;
    return {
      name: team.name,
      amount: Math.round(mtdTotal * share),
      share: Math.round(share * 100),
      trend: trends[i],
    };
  });
}

// Generate AI workload spend — subset of MTD total
export function generateAIBreakdown(mtdTotal) {
  const aiShare = 0.484; // AI is ~48% of total spend
  const aiTotal = Math.round(mtdTotal * aiShare);

  const workloads = [
    { name: "Chatbot Prod", model: "GPT-4", share: 0.462 },
    { name: "Code Assistant", model: "Claude 3.5", share: 0.256 },
    { name: "Doc Summarizer", model: "GPT-3.5", share: 0.159 },
    { name: "Internal Search", model: "Embeddings", share: 0.069 },
    { name: "Other", model: "Mixed", share: 0.054 },
  ];

  return {
    total: aiTotal,
    workloads: workloads.map((w) => ({
      ...w,
      amount: Math.round(aiTotal * w.share),
      percent: Math.round(w.share * 100),
    })),
  };
}

// Calendar context helpers
export function getMonthContext() {
  const now = new Date();
  const today = now.getDate();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const daysRemaining = daysInMonth - today;
  const monthName = now.toLocaleString("default", { month: "long" });
  const year = now.getFullYear();
  const percentOfMonthElapsed = Math.round((today / daysInMonth) * 100);

  return {
    today,
    daysElapsed: today,
    daysInMonth,
    daysRemaining,
    monthName,
    year,
    percentOfMonthElapsed,
  };
}
