// pages/TagGovernance/components/ResourcesTab.jsx
//
// The heatmap surface. Renders the page header (KPIs, legend, toolbar) and a
// dense grid of (resource × tag key) cells. Click any cell to open a value
// popover; click the resource cell to expand the row inline.
//
// State is local-only at the moment — `localOverrides` accumulates pending
// edits in memory. Wire to a real apply endpoint to persist.
import React, { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Sparkles, X, Check, AlertTriangle } from 'lucide-react';
import {
  classifyCell, scoreResource, isRiskyWrite,
} from '../../../mocks/mockTagManagement';
import { TG_TOKENS, tgBtnPrimary, tgBtnGhost, tgBtnAi, tgSectionLabel, tgMonoFont } from '../styles';
import { TagKey, TagVal, TypeChip } from './tagPrimitives';
import CellPopover from './CellPopover';
import ExpandedRow from './ExpandedRow';

export default function ResourcesTab({
  tagKeys, resources,
  overrides, setOverride, clearOverride,
  onConfirmBulk, onAskNumio, readOnly,
}) {
  const [selected, setSelected] = useState(new Set());
  const [expanded, setExpanded] = useState(new Set());
  const [editing, setEditing] = useState(null); // { rid, key }
  const [hover, setHover] = useState(null);
  const [sortBy, setSortBy] = useState('gaps'); // gaps | spend | name
  const [keyFilter, setKeyFilter] = useState('all'); // all | missing-required | drift

  // Resources with effective tags (real tags + overrides)
  const effectiveTagsFor = (r) => ({ ...r.tags, ...(overrides[r.id] || {}) });

  // Pre-compute scores so we can sort and show stats
  const scored = useMemo(
    () => resources.map(r => ({ resource: r, tags: effectiveTagsFor(r), ...scoreResource({ ...r, tags: effectiveTagsFor(r) }, tagKeys) })),
    [resources, tagKeys, overrides]
  );

  const filtered = useMemo(() => {
    let rows = scored;
    if (keyFilter === 'missing-required') rows = rows.filter(s => s.gaps > 0);
    if (keyFilter === 'drift') rows = rows.filter(s => s.drifts > 0);
    return [...rows].sort((a, b) =>
      sortBy === 'gaps'  ? (b.gaps - a.gaps) || (b.resource.spend - a.resource.spend) :
      sortBy === 'spend' ? (b.resource.spend - a.resource.spend) :
                           a.resource.name.localeCompare(b.resource.name)
    );
  }, [scored, sortBy, keyFilter]);

  // Per-column fill stats
  const colStats = useMemo(() => tagKeys.map(k => {
    const filled = scored.filter(s => s.tags[k.key] != null).length;
    return { ...k, filled, total: resources.length };
  }), [tagKeys, resources, scored]);

  // Aggregate KPIs
  const requiredKeys = tagKeys.filter(k => k.required);
  const totalReqCells = resources.length * requiredKeys.length;
  const filledReqCells = scored.reduce(
    (acc, s) => acc + requiredKeys.filter(k => s.tags[k.key] != null).length, 0
  );
  const reqCoverage = totalReqCells > 0 ? Math.round(filledReqCells / totalReqCells * 100) : 100;
  const resourcesWithGaps = scored.filter(s => s.gaps > 0).length;
  const totalDrifts = scored.reduce((a, s) => a + s.drifts, 0);
  const atRiskSpend = scored.filter(s => s.gaps > 0).reduce((a, s) => a + s.resource.spend, 0);

  // ------- handlers -------
  const handleSet = (rid, key, value) => {
    if (readOnly) return;
    if (value === undefined) clearOverride(rid, key);
    else setOverride(rid, key, value);
  };

  const handleAskNumio = (prefill) => onAskNumio?.(prefill);

  const toggleSel = (id) => setSelected(s => {
    const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n;
  });
  const toggleExp = (id) => setExpanded(s => {
    const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n;
  });

  // -------------------------------------------------------------------
  return (
    <div
      onClick={() => setEditing(null)}
      style={{ display: 'flex', flexDirection: 'column', height: '100%', background: TG_TOKENS.bg }}
    >

      {/* PAGE HEADER --------------------------------------------------- */}
      <div style={{
        padding: '20px 24px 14px',
        background: TG_TOKENS.surface,
        borderBottom: `1px solid ${TG_TOKENS.border}`,
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 24, marginBottom: 16, flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ fontSize: 16, fontWeight: 500, color: TG_TOKENS.text, margin: 0 }}>Tag Governance</h1>
            <p style={{ fontSize: 13, color: TG_TOKENS.muted, margin: '4px 0 0' }}>
              Review resources, assign tags, and curate the tag schema.
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 28 }}>
            <Kpi label="Required coverage" value={`${reqCoverage}%`} tone={reqCoverage >= 85 ? 'success' : reqCoverage >= 60 ? 'warn' : 'danger'} />
            <Kpi label="Gaps" value={resourcesWithGaps} sub={`of ${resources.length}`} />
            <Kpi label="Drift" value={totalDrifts} tone={totalDrifts > 0 ? 'warn' : undefined} />
            <Kpi label="At-risk spend" value={'$' + (atRiskSpend / 1000).toFixed(1) + 'k'} sub="/mo" tone={atRiskSpend > 1000 ? 'danger' : undefined} />
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
          <Legend />
          <div style={{ flex: 1 }} />
          <SegBtn options={[['all','All'],['missing-required','Missing required'],['drift','Drift']]} value={keyFilter} onChange={setKeyFilter} />
          <SelectInline label="Sort" value={sortBy} options={[['gaps','Most gaps'],['spend','Spend'],['name','Name']]} onChange={setSortBy} />
          {expanded.size > 0 && (
            <button onClick={() => setExpanded(new Set())} style={ghostText}>
              Collapse all ({expanded.size})
            </button>
          )}
          <div style={{ width: 1, height: 18, background: TG_TOKENS.border, margin: '0 4px' }} />
          {!readOnly && (
            <button
              style={tgBtnAi}
              onClick={() => handleAskNumio('Audit my tag governance and propose fixes for the biggest gaps.')}
            >
              <Sparkles size={13} color="#fff" strokeWidth={2} /> Ask Numio to fix
            </button>
          )}
        </div>
      </div>

      {/* HEATMAP ------------------------------------------------------- */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ flex: 1, overflow: 'auto', padding: '12px 24px 24px', background: TG_TOKENS.surface }}
      >
        <div style={{
          display: 'grid',
          gridTemplateColumns: `300px repeat(${tagKeys.length}, minmax(72px, 84px)) minmax(80px, 1fr)`,
        }}>
          {/* === Head row === */}
          <div style={headCell}><HeadLabel>Resource</HeadLabel></div>
          {colStats.map(c => (
            <div key={c.key} style={headCell}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, paddingLeft: 4 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <TagKey name={c.key} size={10} style={{ fontSize: 10, padding: '1px 5px' }} />
                  {c.required && <span style={{ width: 4, height: 4, borderRadius: 2, background: TG_TOKENS.danger }} />}
                </div>
                <ColCoverage filled={c.filled} total={c.total} />
              </div>
            </div>
          ))}
          <div style={headCell}><HeadLabel>Score</HeadLabel></div>

          {/* === Rows === */}
          {filtered.map(({ resource: r, gaps, drifts, tags }) => {
            const isSel = selected.has(r.id);
            const isExp = expanded.has(r.id);
            return (
              <React.Fragment key={r.id}>
                <div
                  onClick={() => toggleExp(r.id)}
                  style={{
                    ...bodyCell,
                    padding: '6px 8px 6px 10px',
                    background: isExp ? '#fdfcfa' : isSel ? '#f5f8ff' : 'transparent',
                    borderLeft: `2px solid ${gaps > 1 ? TG_TOKENS.danger : gaps === 1 ? TG_TOKENS.warn : 'transparent'}`,
                    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
                  }}
                >
                  <input
                    type="checkbox" checked={isSel}
                    onChange={() => toggleSel(r.id)}
                    onClick={(e) => e.stopPropagation()}
                  />
                  {isExp
                    ? <ChevronDown size={11} color={TG_TOKENS.muted} />
                    : <ChevronRight size={11} color={TG_TOKENS.muted} />}
                  <TypeChip type={r.type} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: 12, fontWeight: 500, color: TG_TOKENS.text,
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    }}>{r.name}</div>
                    <div style={{ fontSize: 10, color: TG_TOKENS.xMuted, fontVariantNumeric: 'tabular-nums' }}>
                      ${r.spend.toLocaleString()}/mo · {r.id}
                    </div>
                  </div>
                </div>

                {tagKeys.map(k => {
                  const cell = classifyCell({ ...r, tags }, k);
                  const isHover = hover && hover.rid === r.id && hover.key === k.key;
                  const isEditing = editing && editing.rid === r.id && editing.key === k.key;
                  return (
                    <div
                      key={k.key}
                      style={{
                        ...bodyCell, padding: 0,
                        background: isExp ? '#fdfcfa' : 'transparent',
                        position: 'relative',
                      }}
                    >
                      <div
                        onMouseEnter={() => setHover({ rid: r.id, key: k.key, ...cell, name: r.name })}
                        onMouseLeave={() => setHover(null)}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (cell.state === 'na' || readOnly) return;
                          setEditing(isEditing ? null : { rid: r.id, key: k.key });
                        }}
                        style={{
                          height: 30, margin: '5px 3px',
                          borderRadius: 4,
                          cursor: cell.state === 'na' || readOnly ? 'default' : 'pointer',
                          ...heatStyle(cell.state, isHover || isEditing),
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontFamily: tgMonoFont, fontSize: 10, fontWeight: 500,
                        }}
                      >
                        {cell.value != null && (
                          <span style={{
                            maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap', padding: '0 4px',
                            color: cell.state === 'drift' ? TG_TOKENS.warn : heatTextColor(cell.state),
                          }}>{cell.value}</span>
                        )}
                        {cell.state === 'missing-req' && <AlertTriangle size={10} color={TG_TOKENS.danger} strokeWidth={2} />}
                        {cell.state === 'missing-opt' && <span style={{ fontSize: 12, color: '#d4d2cd' }}>·</span>}
                        {cell.state === 'na' && <span style={{ fontSize: 9, color: '#cfcdc8' }}>n/a</span>}
                      </div>

                      {isEditing && (
                        <CellPopover
                          keyDef={k}
                          currentValue={cell.value}
                          cellState={cell.state}
                          canonical={cell.canonical}
                          onPick={(picked) => {
                            // Risky-write check on single edits
                            const affected = [{ ...r, tags }];
                            if (isRiskyWrite(affected)) {
                              onConfirmBulk?.({
                                resourceIds: [r.id],
                                change: { key: k.key, value: picked, from: cell.value },
                              });
                            } else {
                              handleSet(r.id, k.key, picked);
                            }
                            setEditing(null);
                          }}
                          onClear={() => { handleSet(r.id, k.key, undefined); setEditing(null); }}
                          onClose={() => setEditing(null)}
                          onAskNumio={() => {
                            setEditing(null);
                            handleAskNumio(`Suggest a value for ${k.key} on ${r.name} (${r.id}).`);
                          }}
                        />
                      )}
                    </div>
                  );
                })}

                <div style={{
                  ...bodyCell, padding: '6px 8px',
                  background: isExp ? '#fdfcfa' : 'transparent',
                  display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'flex-end',
                }}>
                  {gaps > 0 && <Badge fg={TG_TOKENS.danger} bg={TG_TOKENS.dangerBg} bd="#fecaca">{gaps} miss</Badge>}
                  {drifts > 0 && <Badge fg={TG_TOKENS.warn} bg={TG_TOKENS.warnBg} bd="#fde68a">{drifts} drift</Badge>}
                  {gaps === 0 && drifts === 0 && <Check size={11} color={TG_TOKENS.success} />}
                </div>

                {isExp && (
                  <div style={{
                    gridColumn: '1 / -1',
                    padding: '8px 16px 18px 56px',
                    background: '#fdfcfa', borderBottom: `1px solid ${TG_TOKENS.border}`,
                  }}>
                    <ExpandedRow
                      resource={r}
                      tagKeys={tagKeys}
                      allResources={resources}
                      effectiveTags={tags}
                      onSetTag={(key, value) => handleSet(r.id, key, value)}
                      onAskNumio={handleAskNumio}
                    />
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </div>

        {hover && !editing && <HoverPeek hover={hover} />}
      </div>

      {/* BULK BAR ------------------------------------------------------ */}
      {selected.size > 0 && !readOnly && (
        <div style={{
          position: 'absolute', left: '50%', transform: 'translateX(-50%)',
          bottom: 16, display: 'flex', alignItems: 'center', gap: 8,
          background: '#1f2024', color: '#fff', padding: '7px 8px 7px 14px',
          borderRadius: 10, boxShadow: '0 12px 32px rgba(0,0,0,0.22)',
          fontSize: 12, zIndex: 5,
        }}>
          <span style={{ fontWeight: 600 }}>{selected.size} selected</span>
          <div style={{ width: 1, height: 16, background: 'rgba(255,255,255,0.18)', margin: '0 4px' }} />
          <button
            style={bulkBtn}
            onClick={(e) => {
              e.stopPropagation();
              const names = filtered
                .filter(s => selected.has(s.resource.id))
                .map(s => s.resource.name).join(', ');
              handleAskNumio(`Propose tag fixes for these resources: ${names}.`);
            }}
          >
            <Sparkles size={11} color="#c4b5fd" strokeWidth={2} /> Ask Numio to fix
          </button>
          <button
            style={bulkBtn}
            onClick={(e) => {
              e.stopPropagation();
              onConfirmBulk?.({ resourceIds: [...selected] });
            }}
          >
            Bulk apply…
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); setSelected(new Set()); }}
            style={{ ...bulkBtn, background: 'transparent', padding: '4px 6px' }}
            aria-label="Clear selection"
          >
            <X size={11} color="#fff" />
          </button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Small inline components
// ---------------------------------------------------------------------------
function Kpi({ label, value, sub, tone }) {
  const color = tone === 'danger' ? TG_TOKENS.danger
              : tone === 'warn'    ? TG_TOKENS.warn
              : tone === 'success' ? TG_TOKENS.success
              : TG_TOKENS.text;
  return (
    <div style={{ textAlign: 'right' }}>
      <div style={{ fontSize: 11, fontWeight: 500, color: TG_TOKENS.xMuted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, justifyContent: 'flex-end', marginTop: 4 }}>
        <span style={{ fontSize: 24, fontWeight: 600, color, fontVariantNumeric: 'tabular-nums', lineHeight: 1, letterSpacing: '-0.02em' }}>{value}</span>
        {sub && <span style={{ fontSize: 11, color: TG_TOKENS.muted }}>{sub}</span>}
      </div>
    </div>
  );
}

function Legend() {
  const Item = ({ bg, border, label }) => (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, color: TG_TOKENS.muted }}>
      <span style={{ width: 14, height: 10, borderRadius: 2, background: bg, border }} />{label}
    </span>
  );
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
      <Item bg="#ecfdf5" border="1px solid #d1fae5" label="Set" />
      <Item bg={TG_TOKENS.dangerBg} border="1px dashed #fecaca" label="Required missing" />
      <Item bg={TG_TOKENS.warnBg} border="1px solid #fde68a" label="Drift" />
      <Item bg={TG_TOKENS.surfaceMuted} border={`1px solid ${TG_TOKENS.border}`} label="Optional empty" />
    </div>
  );
}

function ColCoverage({ filled, total }) {
  const pct = total ? Math.round(filled / total * 100) : 100;
  const color = pct >= 85 ? TG_TOKENS.success : pct >= 60 ? TG_TOKENS.warn : TG_TOKENS.danger;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <span style={{ fontSize: 10, fontVariantNumeric: 'tabular-nums', fontWeight: 600, color }}>{pct}%</span>
      <div style={{ flex: 1, height: 2, background: '#eceae6', borderRadius: 9999, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color }} />
      </div>
    </div>
  );
}

function SegBtn({ options, value, onChange }) {
  return (
    <div style={{
      display: 'inline-flex', border: `1px solid ${TG_TOKENS.border}`,
      borderRadius: 6, background: TG_TOKENS.surface, overflow: 'hidden',
    }}>
      {options.map(([v, l], i) => (
        <button
          key={v} onClick={() => onChange(v)}
          style={{
            padding: '4px 10px', fontSize: 12, fontWeight: 500, border: 'none',
            background: value === v ? TG_TOKENS.text : 'transparent',
            color: value === v ? '#fff' : TG_TOKENS.text2,
            cursor: 'pointer', fontFamily: 'inherit',
            borderRight: i < options.length - 1 ? `1px solid ${TG_TOKENS.border}` : 'none',
          }}
        >{l}</button>
      ))}
    </div>
  );
}

function SelectInline({ label, value, options, onChange }) {
  return (
    <label style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, color: TG_TOKENS.muted }}>
      <span>{label}</span>
      <select
        value={value} onChange={(e) => onChange(e.target.value)}
        style={{
          border: `1px solid ${TG_TOKENS.border}`, borderRadius: 6,
          padding: '3px 6px', fontSize: 12, color: TG_TOKENS.text2,
          background: TG_TOKENS.surface, fontFamily: 'inherit',
        }}
      >
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </label>
  );
}

function HoverPeek({ hover }) {
  const { state, key, value, name, canonical } = hover;
  let label, color;
  if (state === 'ok')          { label = `${key}:${value}`; color = TG_TOKENS.success; }
  else if (state === 'drift')  { label = `drift · canonical is "${canonical}"`; color = TG_TOKENS.warn; }
  else if (state === 'missing-req') { label = `${key} required — click to pick a value`; color = TG_TOKENS.danger; }
  else if (state === 'missing-opt') { label = `${key} not set`; color = TG_TOKENS.muted; }
  else if (state === 'na')          { label = `${key} not applicable`; color = TG_TOKENS.muted; }
  return (
    <div style={{
      position: 'fixed', bottom: 18, left: '50%', transform: 'translateX(-50%)',
      background: 'rgba(31,32,36,0.96)', color: '#fff',
      padding: '8px 12px', borderRadius: 8, fontSize: 11.5,
      boxShadow: '0 10px 30px rgba(0,0,0,0.25)',
      display: 'flex', alignItems: 'center', gap: 8,
      fontFamily: tgMonoFont,
      pointerEvents: 'none', zIndex: 20,
    }}>
      <span style={{ width: 8, height: 8, borderRadius: 4, background: color }} />
      <span>{name}</span>
      <span style={{ opacity: 0.5 }}>·</span>
      <span>{label}</span>
    </div>
  );
}

function Badge({ children, fg, bg, bd }) {
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, color: fg, background: bg,
      border: `1px solid ${bd}`, borderRadius: 4, padding: '1px 5px',
    }}>{children}</span>
  );
}

function HeadLabel({ children }) {
  return (
    <span style={{
      fontSize: 10, fontWeight: 500, color: TG_TOKENS.xMuted,
      textTransform: 'uppercase', letterSpacing: '0.08em',
    }}>{children}</span>
  );
}

// ---------------------------------------------------------------------------
// Style helpers
// ---------------------------------------------------------------------------
const headCell = {
  padding: '8px 0 10px 0',
  borderBottom: `1px solid ${TG_TOKENS.border}`,
  position: 'sticky', top: 0,
  background: TG_TOKENS.surface, zIndex: 2,
};
const bodyCell = {
  borderBottom: '1px solid #f4f3ef',
  minHeight: 40, display: 'flex', alignItems: 'center',
};
const bulkBtn = {
  display: 'inline-flex', alignItems: 'center', gap: 5,
  background: 'rgba(255,255,255,0.08)', color: '#fff',
  border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6,
  fontSize: 11.5, fontWeight: 500, padding: '4px 9px',
  cursor: 'pointer', fontFamily: 'inherit',
};
const ghostText = {
  background: 'transparent', border: 'none', color: TG_TOKENS.muted,
  fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', padding: 0,
};

function heatStyle(state, hover) {
  const ring = hover ? `0 0 0 1.5px ${TG_TOKENS.text}` : 'none';
  if (state === 'ok')          return { background: '#ecfdf5', border: '1px solid #d1fae5', boxShadow: ring };
  if (state === 'drift')       return { background: TG_TOKENS.warnBg, border: '1px solid #fde68a', boxShadow: ring };
  if (state === 'missing-req') return { background: TG_TOKENS.dangerBg, border: '1px dashed #fecaca', boxShadow: ring };
  if (state === 'missing-opt') return { background: TG_TOKENS.surfaceMuted, border: `1px solid ${TG_TOKENS.border}`, boxShadow: ring };
  if (state === 'na')          return { background: 'transparent', border: `1px solid ${TG_TOKENS.border}`, opacity: 0.5 };
  return {};
}
function heatTextColor(state) {
  if (state === 'ok') return '#047857';
  if (state === 'drift') return TG_TOKENS.warn;
  return TG_TOKENS.muted;
}
