import { createContext, useContext, useState, useEffect } from "react";

const STORAGE_KEY = "numio_active_role";

const ROLES = [
  {
    id: "finance",
    label: "Finance View",
    sublabel: "CFO · Budget & cost focus",
    short: "Finance",
  },
  {
    id: "technical",
    label: "Technical View",
    sublabel: "CTO · CIO · Engineering",
    short: "Technical",
  },
  {
    id: "data",
    label: "Data & AI View",
    sublabel: "Head of Data · ML Engineering",
    short: "Data & AI",
  },
];

export { ROLES };

const VALID_IDS = ["finance", "technical", "data"];

const RoleContext = createContext(null);

export function RoleProvider({ children }) {
  const [roleId, setRoleIdState] = useState(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return VALID_IDS.includes(stored) ? stored : "finance";
    } catch (_) {}
    return "finance";
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, roleId);
    } catch (_) {}
  }, [roleId]);

  const setRole = (id) => {
    if (ROLES.some((r) => r.id === id)) setRoleIdState(id);
  };

  const role = ROLES.find((r) => r.id === roleId) || ROLES[0];

  return (
    <RoleContext.Provider value={{ role, setRole, roleId: role.id }}>
      {children}
    </RoleContext.Provider>
  );
}

export function useRole() {
  const ctx = useContext(RoleContext);
  if (!ctx) throw new Error("useRole must be used within RoleProvider");
  return ctx;
}

export function useRoleLevel() {
  const { roleId } = useRole();
  const levels = { finance: 1, data: 2, technical: 3 };
  return levels[roleId] ?? 1;
}

const ROLE_LEVELS = { CFO: 1, CIO: 2, "Head of Data": 3, "VP Engineering": 4, CTO: 5 };

export function useCanSee(minRole) {
  const level = useRoleLevel();
  return level >= (ROLE_LEVELS[minRole] ?? 1);
}

export const ROLE_CONFIG = {
  finance: {
    label: "Finance View",
    overview: {
      summaryBanner: true,
      aiUsageCard: true,
      cloudUsageCard: true,
      lmgateCard: false,
      infraHealth: false,
    },
    aiCard: {
      showTopApp: true,
      showTopProvider: true,
      showGpuWaste: false,
      showCostPerToken: true,
      showInfraHealth: false,
    },
    cloudCard: {
      showTopProvider: true,
      showTopService: true,
      showWasteSignal: true,
      showBudgetStatus: true,
      showGovernance: true,
    },
    greeting: "Budget & Cost Focus",
  },
  data: {
    label: "Data & AI View",
    overview: {
      summaryBanner: true,
      aiUsageCard: true,
      cloudUsageCard: false,
      lmgateCard: true,
      infraHealth: false,
    },
    aiCard: {
      showTopApp: true,
      showTopProvider: true,
      showGpuWaste: false,
      showCostPerToken: true,
      showInfraHealth: false,
    },
    cloudCard: {
      showTopProvider: false,
      showTopService: false,
      showWasteSignal: false,
      showBudgetStatus: false,
      showGovernance: false,
    },
    greeting: "AI Models & Data Engineering",
  },
  technical: {
    label: "Technical View",
    overview: {
      summaryBanner: true,
      aiUsageCard: true,
      cloudUsageCard: true,
      lmgateCard: true,
      infraHealth: true,
    },
    aiCard: {
      showTopApp: true,
      showTopProvider: true,
      showGpuWaste: true,
      showCostPerToken: true,
      showInfraHealth: true,
    },
    cloudCard: {
      showTopProvider: true,
      showTopService: true,
      showWasteSignal: true,
      showBudgetStatus: false,
      showGovernance: false,
    },
    greeting: "Infrastructure & Engineering",
  },
};

export function useRoleConfig() {
  const { roleId } = useRole();
  return ROLE_CONFIG[roleId] ?? ROLE_CONFIG.finance;
}
