// pages/TagGovernance/styles.js
// Shared inline style constants for the Tag Governance redesign.
// Mirrors the design system tokens (tokens.css) but as JS objects so we
// can compose them in inline styles without inventing new CSS classes.

export const TG_TOKENS = {
  // tones
  text: 'var(--text-primary, #111827)',
  text2: 'var(--text-secondary, #374151)',
  muted: 'var(--text-muted, #6b7280)',
  xMuted: 'var(--text-xs-muted, #9ca3af)',
  border: 'var(--border, #efefef)',
  borderStrong: '#e5e5e5',
  surface: 'var(--bg-surface, #ffffff)',
  surfaceMuted: '#fafafa',
  bg: 'var(--bg-page, #f7f7f7)',
  // accents
  accent: 'var(--accent, #2563eb)',
  ai: 'var(--ai-accent, #6366f1)',
  aiBg: 'var(--ai-accent-light, #eef2ff)',
  ai2: 'var(--ai-accent-text, #4f46e5)',
  success: 'var(--success, #16a34a)',
  successBg: 'var(--success-bg, #f0fdf4)',
  warn: 'var(--warning, #d97706)',
  warnBg: 'var(--warning-bg, #fffbeb)',
  danger: 'var(--danger, #dc2626)',
  dangerBg: 'var(--danger-bg, #fef2f2)',
  aws: '#c2410c',
  awsBg: '#fff7ed',
  awsBd: '#fed7aa',
};

export const tgCard = {
  background: TG_TOKENS.surface,
  border: `1px solid ${TG_TOKENS.border}`,
  borderRadius: 12,
  padding: '20px 24px',
};

export const tgBtnPrimary = {
  background: TG_TOKENS.text, color: '#fff', border: 'none', borderRadius: 6,
  fontSize: 12, fontWeight: 500, padding: '6px 12px',
  cursor: 'pointer', fontFamily: 'inherit',
  display: 'inline-flex', alignItems: 'center', gap: 6,
};

export const tgBtnGhost = {
  background: TG_TOKENS.surface, color: TG_TOKENS.text2,
  border: `1px solid ${TG_TOKENS.border}`, borderRadius: 6,
  fontSize: 12, fontWeight: 500, padding: '6px 12px',
  cursor: 'pointer', fontFamily: 'inherit',
  display: 'inline-flex', alignItems: 'center', gap: 6,
};

export const tgBtnAi = {
  ...tgBtnPrimary,
  background: TG_TOKENS.ai, borderColor: TG_TOKENS.ai,
};

export const tgSectionLabel = {
  fontSize: 11, fontWeight: 600, color: TG_TOKENS.xMuted,
  textTransform: 'uppercase', letterSpacing: '0.08em',
};

export const tgInlineCode = {
  fontFamily: "'JetBrains Mono', ui-monospace, Menlo, monospace",
  fontSize: 11, background: TG_TOKENS.aiBg, color: TG_TOKENS.ai2,
  padding: '1px 5px', borderRadius: 3,
};

export const tgMonoFont = "'JetBrains Mono', ui-monospace, Menlo, monospace";
