// pages/TagGovernance/components/RiskyWriteModal.jsx
//
// Confirmation modal shown before applying a tag change that touches
// production OR aggregates more than $1k/mo of spend. Always logged.
import React, { useEffect } from 'react';
import { X, AlertTriangle, Shield } from 'lucide-react';
import { TG_TOKENS, tgBtnPrimary, tgBtnGhost, tgSectionLabel, tgMonoFont } from '../styles';
import { TagKey, TagVal, TypeChip } from './tagPrimitives';

export default function RiskyWriteModal({
  resources, change, onConfirm, onClose,
}) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const totalSpend = resources.reduce((a, r) => a + (r.spend ?? 0), 0);
  const prod = resources.filter(r => r.tags.env === 'production' || r.tags.env === 'prod');
  const envSummary = ['production', 'staging', 'dev', 'prod']
    .map(env => ({ env, n: resources.filter(r => r.tags.env === env).length }))
    .filter(s => s.n > 0)
    .map(s => `${s.env} (${s.n})`).join(' · ');

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(17,24,39,0.5)', zIndex: 100,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: 'Inter, system-ui, sans-serif',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 620, maxWidth: '90vw', maxHeight: '90vh',
          background: TG_TOKENS.surface, borderRadius: 12,
          boxShadow: '0 24px 64px rgba(0,0,0,0.25)',
          display: 'flex', flexDirection: 'column',
        }}
      >
        {/* Head */}
        <div style={{ padding: '18px 22px 14px', borderBottom: `1px solid ${TG_TOKENS.border}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <div style={{
              width: 28, height: 28, borderRadius: 14,
              background: TG_TOKENS.warnBg,
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <AlertTriangle size={14} color={TG_TOKENS.warn} strokeWidth={2} />
            </div>
            <h2 style={{ fontSize: 15, fontWeight: 600, color: TG_TOKENS.text, margin: 0 }}>
              {prod.length > 0 ? 'Confirm — change affects production' : 'Confirm — high-spend change'}
            </h2>
          </div>
          <p style={{ fontSize: 12.5, color: TG_TOKENS.muted, margin: '0 0 0 38px', lineHeight: 1.5 }}>
            Numio asks for confirmation on any write that touches prod or affects more than $1k/mo.
          </p>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflow: 'auto', padding: '16px 22px' }}>
          {change && (
            <>
              <SectionLabel>What will change</SectionLabel>
              <div style={{
                background: TG_TOKENS.surfaceMuted, border: `1px solid ${TG_TOKENS.border}`,
                borderRadius: 8, padding: '10px 14px', marginBottom: 16,
                display: 'flex', alignItems: 'center', gap: 12,
                fontFamily: tgMonoFont, fontSize: 12,
              }}>
                <TagKey name={change.key} size={11} />
                <span style={{ color: TG_TOKENS.muted }}>:</span>
                {change.from ? (
                  <TagVal k="" v={change.from} size={11} style={{ opacity: 0.6, textDecoration: 'line-through' }} />
                ) : (
                  <span style={{ color: TG_TOKENS.danger, fontStyle: 'italic' }}>(missing)</span>
                )}
                <span style={{ color: TG_TOKENS.muted, fontSize: 11 }}>→</span>
                {change.value != null ? <TagVal k="" v={change.value} size={11} /> : <span style={{ color: TG_TOKENS.muted, fontStyle: 'italic' }}>(clear)</span>}
                <div style={{ flex: 1 }} />
                <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 11, color: TG_TOKENS.muted }}>
                  on {resources.length} resource{resources.length === 1 ? '' : 's'}
                </span>
              </div>
            </>
          )}

          <SectionLabel>Impact</SectionLabel>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 16 }}>
            <ImpactBox label="Resources" value={resources.length} />
            <ImpactBox label="Monthly spend" value={'$' + totalSpend.toLocaleString()} tone={totalSpend > 1000 ? 'warn' : undefined} />
            <ImpactBox label="Environments" value={envSummary || '—'} small />
          </div>

          <SectionLabel>Affected resources <span style={{ color: TG_TOKENS.muted, fontWeight: 400 }}>· {resources.length}</span></SectionLabel>
          <div style={{ border: `1px solid ${TG_TOKENS.border}`, borderRadius: 8, overflow: 'hidden', marginBottom: 16, maxHeight: 240, overflowY: 'auto' }}>
            {resources.map((r, i) => (
              <div key={r.id} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '8px 12px', borderTop: i ? `1px solid ${TG_TOKENS.border}` : 'none',
                background: r.tags.env === 'production' || r.tags.env === 'prod' ? '#fff8e6' : TG_TOKENS.surface,
              }}>
                <TypeChip type={r.type} />
                <span style={{ fontSize: 12, color: TG_TOKENS.text2, flex: 1 }}>{r.name}</span>
                {(r.tags.env === 'production' || r.tags.env === 'prod') && (
                  <span style={{ fontSize: 10, fontWeight: 600, color: TG_TOKENS.warn, background: TG_TOKENS.warnBg, border: '1px solid #fde68a', padding: '1px 5px', borderRadius: 3 }}>PROD</span>
                )}
                <span style={{ fontSize: 11, color: TG_TOKENS.muted, fontVariantNumeric: 'tabular-nums', minWidth: 64, textAlign: 'right' }}>
                  ${(r.spend ?? 0).toLocaleString()}/mo
                </span>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11.5, color: TG_TOKENS.muted, padding: '8px 0' }}>
            <Shield size={12} color={TG_TOKENS.muted} strokeWidth={1.75} />
            <span>
              Logged to audit log as <b style={{ color: TG_TOKENS.text2 }}>tag.set</b>{' '}
              · revertible from <a href="/govern/audit" style={{ color: TG_TOKENS.ai2, textDecoration: 'none' }}>/govern/audit</a>
            </span>
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: '12px 22px', borderTop: `1px solid ${TG_TOKENS.border}`,
          display: 'flex', gap: 8, alignItems: 'center',
        }}>
          <div style={{ flex: 1 }} />
          <button style={tgBtnGhost} onClick={onClose}>Cancel</button>
          <button style={tgBtnPrimary} onClick={onConfirm}>
            Apply to {resources.length} resource{resources.length === 1 ? '' : 's'}
          </button>
        </div>
      </div>
    </div>
  );
}

function SectionLabel({ children }) {
  return <div style={{ ...tgSectionLabel, marginBottom: 8 }}>{children}</div>;
}

function ImpactBox({ label, value, tone, small }) {
  const color = tone === 'warn' ? TG_TOKENS.warn : tone === 'danger' ? TG_TOKENS.danger : TG_TOKENS.text;
  return (
    <div style={{
      background: TG_TOKENS.surfaceMuted, border: `1px solid ${TG_TOKENS.border}`,
      borderRadius: 8, padding: '10px 12px',
    }}>
      <div style={{
        fontSize: 10, color: TG_TOKENS.xMuted, textTransform: 'uppercase',
        letterSpacing: '0.08em', fontWeight: 600, marginBottom: 4,
      }}>{label}</div>
      <div style={{
        fontSize: small ? 13 : 18, fontWeight: 600, color,
        fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.01em',
      }}>{value}</div>
    </div>
  );
}
