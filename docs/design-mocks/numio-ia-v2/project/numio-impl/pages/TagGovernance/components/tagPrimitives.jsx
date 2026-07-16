// pages/TagGovernance/components/tagPrimitives.jsx
// Reusable visual atoms for tag UI: pills, coverage bar, type chip.
import React from 'react';
import { TG_TOKENS, tgMonoFont } from '../styles';

// Stable hue assignment per tag value — so "production" is always the same
// color across the whole UI. Hash the value, pick from a small palette.
const PILL_HUES = [
  { bg: '#eff5ff', fg: '#1d4ed8', bd: '#dbeafe' }, // blue
  { bg: '#ecfdf5', fg: '#047857', bd: '#d1fae5' }, // green
  { bg: '#fff7ed', fg: '#c2410c', bd: '#fed7aa' }, // orange
  { bg: '#fdf4ff', fg: '#a21caf', bd: '#f5d0fe' }, // fuchsia
  { bg: '#f0f9ff', fg: '#0369a1', bd: '#bae6fd' }, // sky
  { bg: '#fef2f2', fg: '#b91c1c', bd: '#fecaca' }, // rose
];

export function hueFor(value) {
  if (value == null) return PILL_HUES[0];
  let h = 0;
  for (let i = 0; i < value.length; i++) h = (h * 31 + value.charCodeAt(i)) | 0;
  return PILL_HUES[Math.abs(h) % PILL_HUES.length];
}

/** Pill rendering just the tag KEY (e.g. `env`). */
export function TagKey({ name, size = 12, style }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      fontFamily: tgMonoFont, fontSize: size, fontWeight: 500,
      color: TG_TOKENS.text, background: '#f3f0ff',
      border: '1px solid #e9e3ff', borderRadius: 4,
      padding: '1px 6px', lineHeight: 1.5,
      ...style,
    }}>{name}</span>
  );
}

/**
 * Pill rendering a tag value, with optional key prefix.
 *
 * Variants:
 *   - default: colored pill, hue derived from the value
 *   - missing: dashed red outline for required-but-absent tags
 *   - drift:   colored pill + amber dot indicating value differs from canonical
 */
export function TagVal({ k, v, size = 11, missing, drift, style }) {
  if (missing) {
    return (
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: 4,
        fontFamily: tgMonoFont, fontSize: size,
        color: TG_TOKENS.danger, border: `1px dashed ${TG_TOKENS.danger}55`,
        background: 'transparent', borderRadius: 4,
        padding: '1px 6px', ...style,
      }}>
        {k && <><span style={{ opacity: 0.7 }}>{k}</span><span style={{ opacity: 0.5 }}>:</span></>}
        <span style={{ fontStyle: 'italic', opacity: 0.7 }}>missing</span>
      </span>
    );
  }
  const c = hueFor(v);
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      fontFamily: tgMonoFont, fontSize: size,
      background: c.bg, color: c.fg, border: `1px solid ${c.bd}`,
      borderRadius: 4, padding: '1px 6px', lineHeight: 1.5, ...style,
    }}>
      {k && <>
        <span style={{ opacity: 0.6 }}>{k}</span>
        <span style={{ opacity: 0.4, margin: '0 1px' }}>:</span>
      </>}
      <span style={{ fontWeight: 500 }}>{v}</span>
      {drift && (
        <span title="value differs from canonical" style={{
          marginLeft: 5, width: 5, height: 5, borderRadius: 3,
          background: TG_TOKENS.warn, display: 'inline-block',
        }} />
      )}
    </span>
  );
}

/** Compact chip for resource type (EC2, RDS, S3, …). */
const TYPE_CHIP_COLORS = {
  'EC2 Instance':     { bg: '#fff7ed', fg: '#c2410c', label: 'EC2' },
  'GPU Instance':     { bg: '#fdf4ff', fg: '#a21caf', label: 'GPU' },
  'RDS Instance':     { bg: '#eef2ff', fg: '#4338ca', label: 'RDS' },
  'S3 Bucket':        { bg: '#ecfdf5', fg: '#047857', label: 'S3' },
  'Lambda Function':  { bg: '#fef9c3', fg: '#854d0e', label: 'Lambda' },
  'K8s Namespace':    { bg: '#f0f9ff', fg: '#0369a1', label: 'K8s' },
};

export function TypeChip({ type }) {
  const c = TYPE_CHIP_COLORS[type] || { bg: '#f3f4f6', fg: '#374151', label: type };
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      fontFamily: tgMonoFont, fontSize: 10,
      fontWeight: 600, letterSpacing: '0.04em',
      background: c.bg, color: c.fg,
      padding: '1px 6px', borderRadius: 3,
      textTransform: 'uppercase',
    }}>{c.label}</span>
  );
}

/** Slim coverage bar with optional inline percentage label. */
export function CoverageBar({ value, width = 64, height = 4, showLabel = false, style }) {
  const pct = Math.round(value * 100);
  const color = pct >= 85 ? TG_TOKENS.success : pct >= 60 ? TG_TOKENS.warn : TG_TOKENS.danger;
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, ...style }}>
      <div style={{ width, height, background: '#eceae6', borderRadius: 9999, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 9999 }} />
      </div>
      {showLabel && (
        <span style={{
          fontSize: 10, fontVariantNumeric: 'tabular-nums',
          color: TG_TOKENS.muted, minWidth: 22, textAlign: 'right',
        }}>{pct}%</span>
      )}
    </div>
  );
}

/** Source provenance chip — NUMIO vs AWS ORG. */
export function SourceChip({ source }) {
  const isAws = source === 'aws-org';
  return (
    <span style={{
      fontSize: 9, fontWeight: 600, letterSpacing: '0.04em',
      color: isAws ? TG_TOKENS.aws : TG_TOKENS.muted,
      background: isAws ? TG_TOKENS.awsBg : TG_TOKENS.surface,
      border: `1px solid ${isAws ? TG_TOKENS.awsBd : TG_TOKENS.border}`,
      padding: '1px 5px', borderRadius: 3,
    }}>{isAws ? 'AWS ORG' : 'NUMIO'}</span>
  );
}

/** REQ badge for required tag keys. */
export function ReqBadge({ missing }) {
  return (
    <span style={{
      fontSize: 9, fontWeight: 700, letterSpacing: '0.04em',
      color: missing ? TG_TOKENS.danger : TG_TOKENS.muted,
      background: missing ? TG_TOKENS.surface : 'transparent',
      border: `1px solid ${missing ? '#fecaca' : TG_TOKENS.border}`,
      padding: '0 4px', borderRadius: 3,
    }}>REQ</span>
  );
}
