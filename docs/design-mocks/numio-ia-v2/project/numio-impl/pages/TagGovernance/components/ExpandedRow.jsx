// pages/TagGovernance/components/ExpandedRow.jsx
//
// The inline editor that appears below a heatmap row when expanded.
// Shows all tag keys for the resource as editable chips + a side panel with
// AI suggestions for missing-required tags and resource context.
import React, { useState } from 'react';
import { ArrowRight, Check, Sparkles, ExternalLink } from 'lucide-react';
import { TagKey, TagVal, ReqBadge } from './tagPrimitives';
import { TG_TOKENS, tgMonoFont, tgBtnAi, tgBtnGhost, tgSectionLabel } from '../styles';
import { classifyCell, suggestPeerValue } from '../../../mocks/mockTagManagement';

export default function ExpandedRow({ resource, tagKeys, allResources, effectiveTags, onSetTag, onAskNumio }) {
  const missingReq = tagKeys.filter(k => k.required && classifyCell({ ...resource, tags: effectiveTags }, k).state === 'missing-req');
  const driftCells = tagKeys.filter(k => classifyCell({ ...resource, tags: effectiveTags }, k).state === 'drift');

  // Generate peer-inferred suggestions for missing required tags
  const suggestions = missingReq
    .map(k => ({ keyDef: k, suggestion: suggestPeerValue({ ...resource, tags: effectiveTags }, k.key, allResources, tagKeys) }))
    .filter(s => s.suggestion?.value);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 18 }}>
      {/* LEFT — tag editor list */}
      <div>
        <div style={{ ...tgSectionLabel, marginBottom: 8 }}>
          Edit tags · {Object.keys(effectiveTags).filter(k => effectiveTags[k] != null).length}/{tagKeys.length} set
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {tagKeys.map(k => {
            const cell = classifyCell({ ...resource, tags: effectiveTags }, k);
            return (
              <TagEditChip
                key={k.key}
                keyDef={k}
                value={effectiveTags[k.key]}
                state={cell.state}
                canonical={cell.canonical}
                onPick={(v) => onSetTag(k.key, v)}
                onClear={() => onSetTag(k.key, undefined)}
              />
            );
          })}
        </div>
      </div>

      {/* RIGHT — context + AI */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {(suggestions.length > 0 || driftCells.length > 0) && (
          <div style={{
            background: TG_TOKENS.aiBg, border: '1px solid #e0e7ff',
            borderRadius: 8, padding: '10px 12px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
              <Sparkles size={11} color={TG_TOKENS.ai2} strokeWidth={2} />
              <span style={{ fontSize: 11, fontWeight: 600, color: TG_TOKENS.ai2 }}>Numio suggests</span>
              <div style={{ flex: 1 }} />
              <button
                onClick={() => onAskNumio?.(
                  `For resource ${resource.name} (${resource.id}), suggest values for missing required tags and explain any drift.`
                )}
                style={{
                  background: 'transparent', border: 'none', color: TG_TOKENS.ai2,
                  fontSize: 10, cursor: 'pointer', padding: 0, fontFamily: 'inherit',
                  display: 'inline-flex', alignItems: 'center', gap: 2,
                }}
              >
                Open in chat <ExternalLink size={9} />
              </button>
            </div>
            <div style={{ fontSize: 11.5, color: TG_TOKENS.text2, lineHeight: 1.5, marginBottom: 8 }}>
              Inferred from peer resources in this project:
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {suggestions.map(({ keyDef, suggestion }) => (
                <SuggestRow
                  key={keyDef.key}
                  keyDef={keyDef}
                  value={suggestion.value}
                  confidence={suggestion.confidence}
                  onAccept={() => onSetTag(keyDef.key, suggestion.value)}
                />
              ))}
              {driftCells.map(k => (
                <SuggestRow
                  key={k.key + '-drift'}
                  keyDef={k}
                  value={classifyCell({ ...resource, tags: effectiveTags }, k).canonical}
                  oldValue={effectiveTags[k.key]}
                  drift
                  onAccept={() => onSetTag(k.key, classifyCell({ ...resource, tags: effectiveTags }, k).canonical)}
                />
              ))}
            </div>
            {(suggestions.length + driftCells.length) > 1 && (
              <button
                style={{ ...tgBtnAi, marginTop: 10, padding: '4px 9px', fontSize: 11 }}
                onClick={() => {
                  for (const { keyDef, suggestion } of suggestions) onSetTag(keyDef.key, suggestion.value);
                  for (const k of driftCells) {
                    const c = classifyCell({ ...resource, tags: effectiveTags }, k);
                    if (c.canonical) onSetTag(k.key, c.canonical);
                  }
                }}
              >Accept all</button>
            )}
          </div>
        )}

        <div style={{ border: `1px solid ${TG_TOKENS.border}`, borderRadius: 8, padding: '10px 12px', background: TG_TOKENS.surface }}>
          <div style={{ ...tgSectionLabel, marginBottom: 6 }}>Resource</div>
          <KV label="Type">{resource.type}</KV>
          <KV label="Spend">${(resource.spend ?? 0).toLocaleString()}/mo</KV>
          <KV label="ID"><span style={{ fontFamily: tgMonoFont }}>{resource.id}</span></KV>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// TagEditChip — a single row in the tag editor list
// ---------------------------------------------------------------------------
function TagEditChip({ keyDef, value, state, canonical, onPick, onClear }) {
  const [open, setOpen] = useState(false);
  const missing = value == null;
  const isReqMiss = state === 'missing-req';
  const isDrift = state === 'drift';

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8, padding: '5px 10px',
      borderRadius: 6, background: TG_TOKENS.surface,
      border: `1px solid ${isReqMiss ? '#fecaca' : isDrift ? '#fde68a' : TG_TOKENS.border}`,
    }}>
      <TagKey name={keyDef.key} size={11} style={{ minWidth: 96, justifyContent: 'flex-start', flexShrink: 0 }} />
      {keyDef.required && <ReqBadge missing={missing} />}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
        {value != null ? <TagVal k="" v={value} drift={isDrift} size={11} />
          : isReqMiss ? <span style={{ fontSize: 11, color: TG_TOKENS.danger, fontStyle: 'italic' }}>required</span>
          : <span style={{ fontSize: 11, color: TG_TOKENS.xMuted, fontStyle: 'italic' }}>not set</span>}
        {isDrift && canonical && (
          <span style={{ fontSize: 10, color: TG_TOKENS.warn, marginLeft: 4 }}>
            drift · canonical <span style={{ fontFamily: tgMonoFont, background: '#fff', padding: '0 3px', borderRadius: 2 }}>{canonical}</span>
          </span>
        )}
      </div>
      {open ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, justifyContent: 'flex-end', maxWidth: 320 }}>
          {(keyDef.allowedValues || []).map(v => (
            <button key={v} onClick={() => { onPick(v); setOpen(false); }} style={{
              fontFamily: tgMonoFont, fontSize: 10.5,
              padding: '2px 6px', borderRadius: 4,
              background: v === value ? TG_TOKENS.text : TG_TOKENS.surface,
              color: v === value ? '#fff' : TG_TOKENS.text2,
              border: `1px solid ${v === value ? TG_TOKENS.text : TG_TOKENS.border}`,
              cursor: 'pointer',
            }}>{v}</button>
          ))}
          {value != null && (
            <button onClick={() => { onClear(); setOpen(false); }} style={{
              fontSize: 10, color: TG_TOKENS.muted, background: TG_TOKENS.surface,
              border: `1px solid ${TG_TOKENS.border}`, borderRadius: 4,
              padding: '2px 6px', cursor: 'pointer', fontFamily: 'inherit',
            }}>clear</button>
          )}
        </div>
      ) : (
        <button onClick={() => setOpen(true)} style={{
          fontSize: 10.5, color: isReqMiss ? TG_TOKENS.danger : TG_TOKENS.muted,
          background: 'transparent', border: 'none',
          padding: '2px 6px', cursor: 'pointer', fontFamily: 'inherit',
        }}>{missing ? 'set' : 'edit'}</button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// SuggestRow — single Numio suggestion in the right panel
// ---------------------------------------------------------------------------
function SuggestRow({ keyDef, value, oldValue, drift, confidence, onAccept }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
      <TagKey name={keyDef.key} size={10} style={{ minWidth: 76, justifyContent: 'flex-start', flexShrink: 0 }} />
      {drift ? (
        <>
          <TagVal k="" v={oldValue} size={10} style={{ opacity: 0.6, textDecoration: 'line-through' }} />
          <ArrowRight size={9} color={TG_TOKENS.muted} />
          <TagVal k="" v={value} size={10} />
        </>
      ) : (
        <>
          <ArrowRight size={9} color={TG_TOKENS.muted} />
          <TagVal k="" v={value} size={10} />
          {confidence != null && (
            <span style={{ fontSize: 9, color: TG_TOKENS.muted }}>{Math.round(confidence * 100)}%</span>
          )}
        </>
      )}
      <div style={{ flex: 1 }} />
      <button onClick={onAccept} style={{
        display: 'inline-flex', alignItems: 'center', gap: 3,
        fontSize: 10, color: TG_TOKENS.ai2, background: TG_TOKENS.surface,
        border: '1px solid #e0e7ff', borderRadius: 4,
        padding: '1px 6px', cursor: 'pointer', fontFamily: 'inherit',
      }}>
        <Check size={9} color={TG_TOKENS.ai2} strokeWidth={2} /> accept
      </button>
    </div>
  );
}

function KV({ label, children }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '2px 0', fontSize: 11.5,
    }}>
      <span style={{ width: 56, color: TG_TOKENS.muted, flexShrink: 0 }}>{label}</span>
      <span style={{ color: TG_TOKENS.text2 }}>{children}</span>
    </div>
  );
}
