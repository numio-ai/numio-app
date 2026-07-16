// pages/TagGovernance/components/CellPopover.jsx
//
// Floating value picker that appears below a heatmap cell when clicked.
// Lets the user pick from the allowed values, clear the tag, or escalate
// to the chat panel for an AI suggestion.
import React, { useEffect, useRef, useState } from 'react';
import { X, Check, AlertTriangle, Sparkles, Plus } from 'lucide-react';
import { TagKey, TagVal, ReqBadge } from './tagPrimitives';
import { TG_TOKENS, tgMonoFont, tgInlineCode } from '../styles';

export default function CellPopover({
  keyDef, currentValue, cellState, canonical,
  onPick, onClear, onClose, onAskNumio,
}) {
  const [filter, setFilter] = useState('');
  const inputRef = useRef(null);

  useEffect(() => { inputRef.current?.focus(); }, []);
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const filtered = (keyDef.allowedValues || [])
    .filter(v => v.toLowerCase().includes(filter.toLowerCase()));

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      style={{
        position: 'absolute', top: '100%', left: '50%',
        transform: 'translateX(-50%)', marginTop: 4, zIndex: 30,
        width: 220, background: TG_TOKENS.surface,
        border: `1px solid ${TG_TOKENS.borderStrong}`, borderRadius: 8,
        boxShadow: '0 14px 36px rgba(0,0,0,0.14)', padding: 4,
      }}
    >
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '4px 6px 7px 6px', borderBottom: `1px solid ${TG_TOKENS.border}`,
      }}>
        <TagKey name={keyDef.key} size={10} />
        {keyDef.required && <ReqBadge missing />}
        <div style={{ flex: 1 }} />
        <button onClick={onClose} style={iconBtn} aria-label="Close">
          <X size={10} strokeWidth={1.75} color={TG_TOKENS.muted} />
        </button>
      </div>

      {cellState === 'drift' && (
        <div style={{
          padding: '6px 8px', borderBottom: `1px solid ${TG_TOKENS.border}`,
          background: TG_TOKENS.warnBg, fontSize: 10.5,
          color: TG_TOKENS.warn, display: 'flex', alignItems: 'center', gap: 5,
        }}>
          <AlertTriangle size={10} color={TG_TOKENS.warn} strokeWidth={2} />
          drift — canonical is <code style={tgInlineCode}>{canonical}</code>
        </div>
      )}

      <input
        ref={inputRef}
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        placeholder="Filter or type new value…"
        style={{
          width: '100%', height: 26, border: 'none', outline: 'none',
          padding: '0 8px', background: 'transparent',
          fontFamily: tgMonoFont, fontSize: 11,
          borderBottom: `1px solid ${TG_TOKENS.border}`,
        }}
      />

      <div style={{ maxHeight: 180, overflow: 'auto', padding: '3px 0' }}>
        {filtered.length === 0 && filter && (
          <div style={{ padding: '6px 8px', fontSize: 11, color: TG_TOKENS.muted }}>
            No match — press Enter to add <code style={tgInlineCode}>{filter}</code>
          </div>
        )}
        {filtered.map(v => (
          <button
            key={v}
            onClick={() => onPick(v)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              width: '100%', padding: '4px 8px', border: 'none',
              background: v === currentValue ? '#f3f4f6' : 'transparent',
              cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
            }}
          >
            <TagVal k="" v={v} size={11} />
            {v === currentValue && <Check size={10} color={TG_TOKENS.success} style={{ marginLeft: 'auto' }} />}
          </button>
        ))}
      </div>

      <div style={{
        display: 'flex', gap: 4,
        padding: '4px 4px 2px 4px',
        borderTop: `1px solid ${TG_TOKENS.border}`,
      }}>
        <button style={miniBtn}>
          <Plus size={9} color={TG_TOKENS.muted} strokeWidth={2} /> new
        </button>
        {currentValue != null && (
          <button style={miniBtn} onClick={onClear}>clear</button>
        )}
        <button style={{ ...miniBtn, color: TG_TOKENS.ai2 }} onClick={onAskNumio}>
          <Sparkles size={9} color={TG_TOKENS.ai2} strokeWidth={2} /> Ask Numio
        </button>
      </div>
    </div>
  );
}

const iconBtn = {
  background: 'none', border: 'none', cursor: 'pointer',
  padding: 2, display: 'inline-flex',
};
const miniBtn = {
  flex: 1, fontSize: 10, color: TG_TOKENS.muted,
  border: 'none', background: 'transparent',
  padding: '3px 4px', cursor: 'pointer', fontFamily: 'inherit',
  borderRadius: 4,
  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3,
};
