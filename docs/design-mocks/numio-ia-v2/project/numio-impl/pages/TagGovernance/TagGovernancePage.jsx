// pages/TagGovernance/TagGovernancePage.jsx
//
// Main entry for /tag-governance.
//
// Replaces the legacy Dashboard / Policies / Campaigns layout with the
// v5 design: Resources (heatmap + row expand + cell popover) and Schema
// (keys, allowed values, AWS Org inheritance). Audit links out to the
// existing /govern/audit page.
//
// State management:
//   - `overrides[resourceId][tagKey] = newValue` — pending edits not yet
//     persisted to the cloud. In v1 this is in-memory; backend should
//     replace with a real apply flow.
//   - `pendingConfirm` — shape of a risky write awaiting RiskyWriteModal
//     confirmation.
//   - `awsConflictOpen` — boolean for the schema-conflict modal.
//
// AI handoff: `handleAskNumio(prefill)` calls `openChat(text)` from
// `useChat()` so the right-side ChatPanel opens with the prompt pre-filled.
// User can edit and send.
//
// Permissions: edit/apply actions are gated on `user.role === "admin"`
// via the `readOnly` prop.
import React, { useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  initialTagKeys, initialResources, isRiskyWrite,
} from '../../mocks/mockTagManagement';
import { useChat } from '../../components/ChatProvider';
import { useAuth } from '../../context/AuthContext';
import { TG_TOKENS, tgBtnPrimary } from './styles';
import ResourcesTab from './components/ResourcesTab';
import SchemaTab from './components/SchemaTab';
import RiskyWriteModal from './components/RiskyWriteModal';
import AwsOrgConflictModal from './components/AwsOrgConflictModal';
import { Plus } from 'lucide-react';

const TABS = [
  { id: 'resources', label: 'Resources' },
  { id: 'schema',    label: 'Schema'    },
  { id: 'audit',     label: 'Audit log', external: '/govern/audit' },
];

export default function TagGovernancePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { openChat } = useChat();
  const isAdmin = user?.role === 'admin';

  // -------- Tab state --------
  const [activeTab, setActiveTab] = useState('resources');

  // -------- Schema (locally mutable for prototype) --------
  const [tagKeys] = useState(initialTagKeys);
  const [resources] = useState(initialResources);

  // -------- Pending tag overrides (in-memory) --------
  // shape: { [resourceId]: { [tagKey]: newValue | undefined-to-clear } }
  const [overrides, setOverrides] = useState({});

  const setOverride = useCallback((rid, key, value) => {
    setOverrides(prev => ({ ...prev, [rid]: { ...(prev[rid] || {}), [key]: value } }));
  }, []);
  const clearOverride = useCallback((rid, key) => {
    setOverrides(prev => {
      const next = { ...prev };
      if (next[rid]) {
        next[rid] = { ...next[rid] };
        delete next[rid][key];
        if (Object.keys(next[rid]).length === 0) delete next[rid];
      }
      return next;
    });
  }, []);

  // -------- Risky write confirmation --------
  // shape: { resourceIds: string[], change?: { key, value, from } }
  const [pendingConfirm, setPendingConfirm] = useState(null);

  const confirmedResources = useMemo(() => {
    if (!pendingConfirm) return [];
    const ids = new Set(pendingConfirm.resourceIds);
    return resources.filter(r => ids.has(r.id));
  }, [pendingConfirm, resources]);

  const handleConfirmBulk = useCallback((bulk) => {
    setPendingConfirm(bulk);
  }, []);

  const applyPending = useCallback(() => {
    if (!pendingConfirm) return;
    const { resourceIds, change } = pendingConfirm;
    // For v1: simulate write by stamping the override map.
    // Backend should call POST /api/v1/tags/apply and surface
    // a partial-failure toast on { failed: [...] }.
    if (change) {
      setOverrides(prev => {
        const next = { ...prev };
        for (const rid of resourceIds) {
          next[rid] = { ...(next[rid] || {}), [change.key]: change.value };
        }
        return next;
      });
    }
    setPendingConfirm(null);
  }, [pendingConfirm]);

  // -------- Schema conflict modal --------
  const [awsConflictOpen, setAwsConflictOpen] = useState(false);

  // -------- Ask Numio handoff --------
  const handleAskNumio = useCallback((prefill) => {
    openChat(prefill || '');
  }, [openChat]);

  // ============================================================
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100%',
      background: TG_TOKENS.bg, position: 'relative',
    }}>

      {/* Tabs strip lives at the top of the page content. The page header
          itself (h1 + KPIs) is rendered by ResourcesTab / SchemaTab so each
          tab owns its own framing. */}
      <div style={{
        background: TG_TOKENS.surface,
        borderBottom: `1px solid ${TG_TOKENS.border}`,
        padding: '0 24px',
        display: 'flex', alignItems: 'flex-end', gap: 0,
      }}>
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => {
              if (tab.external) navigate(tab.external);
              else setActiveTab(tab.id);
            }}
            style={{
              background: 'transparent', border: 'none',
              padding: '12px 16px', marginBottom: -1,
              borderBottom: activeTab === tab.id ? `2px solid ${TG_TOKENS.text}` : '2px solid transparent',
              fontSize: 13, fontWeight: activeTab === tab.id ? 600 : 500,
              color: activeTab === tab.id ? TG_TOKENS.text : TG_TOKENS.muted,
              cursor: 'pointer', fontFamily: 'inherit',
              display: 'inline-flex', alignItems: 'center', gap: 6,
            }}
          >
            {tab.label}
            {tab.external && (
              <span style={{ fontSize: 10, color: TG_TOKENS.xMuted }}>↗</span>
            )}
          </button>
        ))}

        <div style={{ flex: 1 }} />

        {/* Top-right page actions */}
        {activeTab === 'schema' && (
          <button
            style={{ ...tgBtnPrimary, marginBottom: 8 }}
            onClick={() => alert('TODO: open "Define key" modal')}
          >
            <Plus size={12} color="#fff" strokeWidth={2} /> Define key
          </button>
        )}
      </div>

      {/* Tab content */}
      <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {activeTab === 'resources' && (
          <ResourcesTab
            tagKeys={tagKeys}
            resources={resources}
            overrides={overrides}
            setOverride={setOverride}
            clearOverride={clearOverride}
            onConfirmBulk={handleConfirmBulk}
            onAskNumio={handleAskNumio}
            readOnly={!isAdmin}
          />
        )}

        {activeTab === 'schema' && (
          <SchemaTab
            tagKeys={tagKeys}
            resources={resources}
            onShowConflict={() => setAwsConflictOpen(true)}
          />
        )}
      </div>

      {/* Modals */}
      {pendingConfirm && (
        <RiskyWriteModal
          resources={confirmedResources}
          change={pendingConfirm.change}
          onConfirm={applyPending}
          onClose={() => setPendingConfirm(null)}
        />
      )}
      {awsConflictOpen && (
        <AwsOrgConflictModal
          tagKeys={tagKeys}
          onResolve={({ key, resolution }) => {
            // TODO wire to backend: POST /api/v1/tags/schema/conflicts/:key
            // with { resolution: 'aws-wins' | 'numio-wins' | 'manual' }
            // and refresh.
            console.log('Resolving conflict', key, resolution);
            setAwsConflictOpen(false);
          }}
          onClose={() => setAwsConflictOpen(false)}
        />
      )}
    </div>
  );
}
