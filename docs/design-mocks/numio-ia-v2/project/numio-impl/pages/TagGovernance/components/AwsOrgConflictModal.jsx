// pages/TagGovernance/components/AwsOrgConflictModal.jsx
//
// Resolves schema disagreements between Numio's local tag schema and the
// AWS Organizations tag policy. User picks: AWS wins / Numio wins / manual.
import React, { useEffect, useState } from 'react';
import { X, AlertTriangle, Cloud } from 'lucide-react';
import { detectSchemaConflicts } from '../../../mocks/mockTagManagement';
import { TG_TOKENS, tgBtnPrimary, tgBtnGhost, tgSectionLabel, tgInlineCode, tgMonoFont } from '../styles';
import { SourceChip } from './tagPrimitives';

export default function AwsOrgConflictModal({ tagKeys, onResolve, onClose }) {
  const [resolution, setResolution] = useState('aws-wins');
  const conflicts = detectSchemaConflicts(tagKeys);
  // For the first version we resolve one conflict at a time; pick the first.
  const conflict = conflicts[0];

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (!conflict) {
    return (
      <div onClick={onClose} style={backdropStyle}>
        <div onClick={(e) => e.stopPropagation()} style={{ ...cardStyle, width: 360, padding: '24px' }}>
          <p style={{ margin: 0, fontSize: 13, color: TG_TOKENS.text }}>No schema conflicts detected.</p>
        </div>
      </div>
    );
  }

  return (
    <div onClick={onClose} style={backdropStyle}>
      <div onClick={(e) => e.stopPropagation()} style={{ ...cardStyle, width: 580 }}>

        {/* Head */}
        <div style={{ padding: '18px 22px 14px', borderBottom: `1px solid ${TG_TOKENS.border}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <div style={{ width: 28, height: 28, borderRadius: 14, background: TG_TOKENS.awsBg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <AlertTriangle size={14} color={TG_TOKENS.aws} strokeWidth={2} />
            </div>
            <h2 style={{ fontSize: 15, fontWeight: 600, color: TG_TOKENS.text, margin: 0 }}>
              Schema conflict with AWS Organizations
            </h2>
          </div>
          <p style={{ fontSize: 12.5, color: TG_TOKENS.muted, margin: '0 0 0 38px', lineHeight: 1.5 }}>
            AWS Org's tag policy and your Numio schema both define{' '}
            <code style={tgInlineCode}>{conflict.key}</code>, but with different rules.
          </p>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflow: 'auto', padding: '16px 22px' }}>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 18 }}>
            <DiffCol
              title="Numio schema" source="numio"
              values={conflict.numioRule?.allowedValues || []}
              extra={conflict.onlyInNumio}
            />
            <DiffCol
              title="AWS Org policy" source="aws-org"
              values={conflict.awsRule?.allowedValues || []}
              extra={conflict.onlyInAws}
            />
          </div>

          <div style={{ ...tgSectionLabel, marginBottom: 8 }}>How should we resolve this?</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <ResolveOption
              id="aws-wins" current={resolution} onSelect={setResolution}
              title="Use AWS Org as source of truth"
              desc={`Adopt AWS values (adds ${conflict.onlyInAws.join(', ') || 'no new'}). Numio schema mirrors AWS automatically going forward.`}
              recommended
            />
            <ResolveOption
              id="numio-wins" current={resolution} onSelect={setResolution}
              title="Keep Numio schema, ignore AWS additions"
              desc={`${conflict.onlyInAws.join(', ') || 'New AWS values'} remain rejected by Numio. Resources using them will be flagged as invalid.`}
            />
            <ResolveOption
              id="manual" current={resolution} onSelect={setResolution}
              title="Pick which values to adopt manually"
              desc="Choose each new value individually. Future drift on either side will re-open this prompt."
            />
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: '12px 22px', borderTop: `1px solid ${TG_TOKENS.border}`,
          display: 'flex', gap: 8, alignItems: 'center',
        }}>
          <span style={{ fontSize: 11, color: TG_TOKENS.muted }}>This decision is logged to the audit log.</span>
          <div style={{ flex: 1 }} />
          <button style={tgBtnGhost} onClick={onClose}>Cancel</button>
          <button
            style={tgBtnPrimary}
            onClick={() => onResolve?.({ key: conflict.key, resolution })}
          >Apply resolution</button>
        </div>
      </div>
    </div>
  );
}

function DiffCol({ title, source, values, extra = [] }) {
  return (
    <div style={{ border: `1px solid ${TG_TOKENS.border}`, borderRadius: 8, overflow: 'hidden' }}>
      <div style={{
        padding: '8px 12px', borderBottom: `1px solid ${TG_TOKENS.border}`,
        background: source === 'aws-org' ? TG_TOKENS.awsBg : TG_TOKENS.surfaceMuted,
        display: 'flex', alignItems: 'center', gap: 6,
      }}>
        <span style={{
          fontSize: 11.5, fontWeight: 600,
          color: source === 'aws-org' ? TG_TOKENS.aws : TG_TOKENS.text,
        }}>{title}</span>
        <SourceChip source={source} />
      </div>
      <div style={{ padding: '8px 12px', display: 'flex', flexWrap: 'wrap', gap: 3 }}>
        {values.map(v => (
          <span key={v} style={{
            fontFamily: tgMonoFont, fontSize: 11,
            color: extra.includes(v) ? TG_TOKENS.aws : TG_TOKENS.text2,
            background: extra.includes(v) ? TG_TOKENS.awsBg : TG_TOKENS.surfaceMuted,
            border: `1px solid ${extra.includes(v) ? TG_TOKENS.awsBd : TG_TOKENS.border}`,
            padding: '1px 6px', borderRadius: 4,
            fontWeight: extra.includes(v) ? 600 : 400,
          }}>{v}{extra.includes(v) && ' +'}</span>
        ))}
      </div>
    </div>
  );
}

function ResolveOption({ id, current, onSelect, title, desc, recommended }) {
  const selected = current === id;
  return (
    <label
      onClick={() => onSelect(id)}
      style={{
        display: 'flex', gap: 12, padding: '10px 12px',
        border: `1px solid ${selected ? TG_TOKENS.text : TG_TOKENS.border}`,
        borderRadius: 8, cursor: 'pointer',
        background: selected ? '#fafaf9' : TG_TOKENS.surface,
      }}
    >
      <div style={{
        width: 16, height: 16, borderRadius: 8,
        border: `1.5px solid ${selected ? TG_TOKENS.text : TG_TOKENS.borderStrong}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2,
      }}>
        {selected && <div style={{ width: 8, height: 8, borderRadius: 4, background: TG_TOKENS.text }} />}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
          <span style={{ fontSize: 12.5, fontWeight: 600, color: TG_TOKENS.text }}>{title}</span>
          {recommended && (
            <span style={{
              fontSize: 9, fontWeight: 700, color: TG_TOKENS.success,
              background: TG_TOKENS.successBg, border: '1px solid #d1fae5',
              padding: '0 5px', borderRadius: 3, letterSpacing: '0.04em',
            }}>RECOMMENDED</span>
          )}
        </div>
        <p style={{ fontSize: 11.5, color: TG_TOKENS.muted, margin: 0, lineHeight: 1.45 }}>{desc}</p>
      </div>
    </label>
  );
}

const backdropStyle = {
  position: 'fixed', inset: 0, background: 'rgba(17,24,39,0.5)', zIndex: 100,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  fontFamily: 'Inter, system-ui, sans-serif',
};

const cardStyle = {
  background: TG_TOKENS.surface, borderRadius: 12,
  boxShadow: '0 24px 64px rgba(0,0,0,0.25)',
  maxHeight: '90vh', display: 'flex', flexDirection: 'column',
};
