import React from "react";
import {
  IconKey,
  IconAudit,
  IconBilling,
  IconIntegration,
  IconUsers,
  IconTag,
  IconWorkspace,
  IconUser,
  IconSupport,
  IconTrash,
} from "../components/Icons";

/** Unified General Settings sidebar — same on /settings/* and /account/profile/* */
export const settingsGeneralSidebarItems = [
  {
    label: "API Access Tokens",
    path: "/settings/access_tokens/personal",
    icon: <IconKey className="icon" />,
    isActive: (loc) => loc.pathname === "/settings/access_tokens/personal",
  },
  {
    label: "Audit Logs",
    path: "/settings/audit_logs",
    icon: <IconAudit className="icon" />,
    isActive: (loc) => loc.pathname === "/settings/audit_logs",
  },
  {
    label: "Billing & Plans",
    path: "/settings/payment",
    icon: <IconBilling className="icon" />,
    isActive: (loc) => loc.pathname === "/settings/payment",
  },
  {
    label: "Integrations",
    path: "/settings/integrations",
    icon: <IconIntegration className="icon" />,
    isActive: (loc) => loc.pathname === "/settings/integrations",
  },
  {
    label: "Automation Safety",
    path: "/settings/automation-safety",
    icon: <IconAudit className="icon" />,
    isActive: (loc) => loc.pathname === "/settings/automation-safety",
  },
  {
    label: "People",
    path: "/settings/users",
    icon: <IconUsers className="icon" />,
    isActive: (loc) => loc.pathname === "/settings/users",
  },
  {
    label: "Tags",
    path: "/settings/tags",
    icon: <IconTag className="icon" />,
    isActive: (loc) => loc.pathname === "/settings/tags",
  },
  {
    label: "Workspaces",
    path: "/settings/workspaces",
    icon: <IconWorkspace className="icon" />,
    isActive: (loc) => loc.pathname.startsWith("/settings/workspaces"),
  },
];

/** Unified Personal Settings sidebar */
export const settingsPersonalSidebarItems = [
  {
    label: "Profile",
    path: "/account/profile",
    icon: <IconUser className="icon" />,
    exact: true,
    isActive: (loc) => loc.pathname === "/account/profile",
  },
  {
    label: "Support",
    path: "/account/profile/support",
    icon: <IconSupport className="icon" />,
    isActive: (loc) => loc.pathname === "/account/profile/support",
  },
  {
    label: "Deactivation",
    path: "/account/profile/deactivate",
    icon: <IconTrash className="icon" />,
    isActive: (loc) => loc.pathname === "/account/profile/deactivate",
  },
];
