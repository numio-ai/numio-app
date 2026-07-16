import React, { useState, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "./context/ThemeContext";
import { RoleProvider } from "./context/RoleContext";
import { AuthProvider } from "./context/AuthContext";
import { IngestionStatusProvider } from "./context/IngestionStatusContext";
import RequireAuth from "./components/RequireAuth";
import RequireAdmin from "./components/RequireAdmin";
import SlimTopBar from "./components/SlimTopBar";
import IngestionFailureBanner from "./components/IngestionFailureBanner";
import CommandPalette from "./components/CommandPalette";
import { ChatProvider } from "./components/ChatProvider";
import { ChatSidebarProvider } from "./context/ChatSidebarContext";
import { MobileNavProvider } from "./context/MobileNavContext";
import { NotificationProvider } from "./context/NotificationContext";
import OverviewLayout from "./components/OverviewLayout";
import CostsLayout from "./components/CostsLayout";
import Login from "./pages/Login";
import ErrorBoundary from "./components/ErrorBoundary";
import LoadingSpinner from "./components/LoadingSpinner";

const Accounts = React.lazy(() => import("./pages/Accounts"));
const AnomalyInvestigation = React.lazy(() => import("./pages/AnomalyInvestigation"));

const CostReportsList = React.lazy(() => import("./pages/CostReporting/CostReportsList"));
const CostReportDetail = React.lazy(() => import("./pages/CostReporting/CostReportDetail"));
const Dashboards = React.lazy(() => import("./pages/CostReporting/Dashboards"));
const SavedFilters = React.lazy(() => import("./pages/CostReporting/SavedFilters"));

const BudgetsPage = React.lazy(() => import("./pages/Budgets/BudgetsPage"));

const PoliciesPage = React.lazy(() => import("./pages/Policies/PoliciesPage"));
const CostAllocation = React.lazy(() => import("./pages/Govern/CostAllocation"));
const PolicyGuardrails = React.lazy(() => import("./pages/Govern/PolicyGuardrails"));
const GovernIssues = React.lazy(() => import("./pages/Govern/Issues"));
const GovernAuditLog = React.lazy(() => import("./pages/Govern/AuditLog"));

const SettingsPage = React.lazy(() => import("./pages/Settings/SettingsPage"));
const IamSetupGuide = React.lazy(() => import("./pages/Settings/IamSetupGuide"));
const Notifications = React.lazy(() => import("./pages/Settings/Notifications"));

const Profile = React.lazy(() => import("./pages/Account/Profile"));
const Support = React.lazy(() => import("./pages/Account/Support"));
const Deactivation = React.lazy(() => import("./pages/Account/Deactivation"));

const InboxPage = React.lazy(() => import("./pages/Inbox/InboxPage"));
const UsagePage = React.lazy(() => import("./pages/Usage/UsagePage"));
const RecommendationsPage = React.lazy(() => import("./pages/Recommendations/RecommendationsPage"));
const AutopilotPage = React.lazy(() => import("./pages/Autopilot/AutopilotPage"));
const AIUsagePage = React.lazy(() => import("./pages/AIUsage/AIUsagePage"));
const CloudUsagePage = React.lazy(() => import("./pages/CloudUsage/CloudUsagePage"));
const ResourcesPage = React.lazy(() => import("./pages/Resources/ResourcesPage"));
const TagGovernancePage = React.lazy(() => import("./pages/TagGovernance/TagGovernancePage"));
const IngestionPage = React.lazy(() => import("./pages/Ingestion/IngestionPage"));
const DataExplorerPage = React.lazy(() => import("./pages/DataExplorer/DataExplorerPage"));

function NotFound() {
  return (
    <div style={{ padding: "48px 24px", textAlign: "center" }}>
      <h1 style={{ fontSize: 24, fontWeight: 600, color: "#111827", margin: 0 }}>404 — Page not found</h1>
      <p style={{ fontSize: 14, color: "#6b7280", marginTop: 8 }}>
        This page is no longer available in the current navigation.
      </p>
    </div>
  );
}

export default function App() {
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);

  return (
    <ThemeProvider>
      <BrowserRouter>
        <AuthProvider>
        <ChatSidebarProvider>
        <MobileNavProvider>
        <ChatProvider>
          <NotificationProvider>
          <RoleProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="*" element={
              <RequireAuth>
                <ErrorBoundary>
                <IngestionStatusProvider>
                <div className="app">
                  <IngestionFailureBanner />
                  <SlimTopBar onOpenCommandPalette={() => setCommandPaletteOpen(true)} />
                  <CommandPalette open={commandPaletteOpen} onClose={() => setCommandPaletteOpen(false)} />
                  <main>
                    <Suspense fallback={<LoadingSpinner message="Loading page…" height={400} />}>
                    <Routes>
            <Route element={<OverviewLayout />}>
              <Route path="/" element={<Navigate to="/inbox" replace />} />
              <Route path="/inbox" element={<InboxPage />} />
              <Route path="/usage" element={<UsagePage />} />
              <Route path="/recommendations" element={<RecommendationsPage />} />
              <Route path="/autopilot" element={<AutopilotPage />} />

              <Route path="/ai-usage" element={<AIUsagePage />} />
              <Route path="/cloud-usage" element={<CloudUsagePage />} />
              <Route path="/resources" element={<ResourcesPage />} />
              <Route path="/tag-governance" element={<TagGovernancePage />} />
              <Route path="/govern/notifications" element={<Notifications />} />

              <Route path="/ingestion" element={<IngestionPage />} />
              <Route
                path="/data-explorer"
                element={
                  <RequireAdmin>
                    <DataExplorerPage />
                  </RequireAdmin>
                }
              />

              <Route path="/anomalies/:id" element={<AnomalyInvestigation />} />
              <Route path="/accounts" element={<Accounts />} />

              <Route path="/costs" element={<CostsLayout />}>
                <Route index element={<Navigate to="/cloud-usage" replace />} />
                <Route path="ai-usage" element={<Navigate to="/ai-usage" replace />} />
                <Route path="cloud-usage" element={<Navigate to="/cloud-usage" replace />} />
                <Route path="reports" element={<CostReportsList />} />
                <Route path="reports/new" element={<CostReportDetail />} />
                <Route path="reports/:id" element={<CostReportDetail />} />
                <Route path="dashboards" element={<Dashboards />} />
                <Route path="saved_filters" element={<SavedFilters />} />
                <Route path="created" element={<Navigate to="/costs?created=true" replace />} />
                <Route path="starred" element={<Navigate to="/costs?starred=true" replace />} />
                <Route path="recent" element={<Navigate to="/costs?recent=true" replace />} />
              </Route>
              <Route path="/reporting" element={<CostReportsList />} />
              <Route path="/reports/new" element={<CostReportDetail />} />
              <Route path="/reports/:id" element={<CostReportDetail />} />
              <Route path="/dashboards" element={<Dashboards />} />
              <Route path="/saved_filters" element={<SavedFilters />} />

              <Route path="/govern" element={<Navigate to="/budgets" replace />} />
              <Route path="/budgets" element={<BudgetsPage />} />
              <Route path="/policies" element={<PoliciesPage />} />
              <Route path="/govern/guardrails" element={<PolicyGuardrails />} />
              <Route path="/govern/cost-allocation" element={<CostAllocation />} />
              <Route path="/govern/audit" element={<GovernAuditLog />} />
              <Route path="/govern/issues" element={<GovernIssues />} />
              <Route path="/issues" element={<GovernIssues />} />

              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/settings/workspaces" element={<Navigate to="/settings?tab=workspaces" replace />} />
              <Route path="/settings/workspaces/:id" element={<Navigate to="/settings?tab=workspaces" replace />} />
              <Route path="/settings/autopilot" element={<Navigate to="/settings?tab=workspaces" replace />} />
              <Route path="/settings/access_tokens/personal" element={<Navigate to="/settings?tab=access_tokens" replace />} />
              <Route path="/settings/audit_logs" element={<Navigate to="/settings?tab=audit_logs" replace />} />
              <Route path="/settings/payment" element={<Navigate to="/settings?tab=payment" replace />} />
              <Route path="/settings/integrations" element={<Navigate to="/settings?tab=integrations" replace />} />
              <Route path="/settings/notifications" element={<Navigate to="/govern/notifications" replace />} />
              <Route path="/settings/automation-safety" element={<Navigate to="/settings?tab=automation-safety" replace />} />
              <Route path="/settings/users" element={<Navigate to="/settings?tab=people" replace />} />
              <Route path="/settings/tags" element={<Navigate to="/settings?tab=tags" replace />} />
              <Route path="/settings/kubernetes" element={<Navigate to="/settings?tab=integrations" replace />} />
              <Route path="/settings/aws" element={<Navigate to="/settings?tab=integrations" replace />} />
              <Route path="/settings/iam-setup-guide" element={<IamSetupGuide />} />

              <Route path="/account/profile" element={<Profile />} />
              <Route path="/account/profile/support" element={<Support />} />
              <Route path="/account/profile/deactivate" element={<Deactivation />} />

              <Route path="*" element={<NotFound />} />
            </Route>
                    </Routes>
                    </Suspense>
                  </main>
                </div>
                </IngestionStatusProvider>
              </ErrorBoundary>
              </RequireAuth>
            } />
          </Routes>
          </RoleProvider>
          </NotificationProvider>
        </ChatProvider>
        </MobileNavProvider>
        </ChatSidebarProvider>
        </AuthProvider>
      </BrowserRouter>
    </ThemeProvider>
  );
}
