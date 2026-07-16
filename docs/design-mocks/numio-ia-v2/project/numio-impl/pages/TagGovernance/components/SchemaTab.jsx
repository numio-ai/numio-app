// pages/TagGovernance/components/SchemaTab.jsx
//
// Schema editor — list of tag keys (required / optional / discovered)
// plus a detail panel for the selected key. AWS Org banner at top
// surfaces inheritance + conflicts.
import React, { useMemo, useState } from 'react';
import { Plus, AlertTriangle, ExternalLink, Cloud, Edit2 } from 'lucide-react';
import {
  computeTagKeyCoverage, getExistingValues, detectSchemaConflicts,
  detectInconsistencies, AWS_ORG_POLICY,
} from '../../../mocks/mockTagManagement';
import {
  TG_TOKENS, tgBtnPrimary, tgBtnGhost,
  tgSectionLabel, tgInlineCode, tgMonoFont,
} from '../styles';
import { TagKey, TagVal, ReqBadge, SourceChip } from './tagPrimitives';

export default function SchemaTab({ tagKeys, resources, onShowConflict }) {
  const [selectedKeyId, setSelectedKeyId] = useState(tagKeys.find(k => k.source === 'aws-org')?.id ?? tagKeys[0]?.id);

  const required = tagKeys.filter(k => k.required);
  const optional = tagKeys.filter(k => !k.required);
  const conflicts = useMemo(() => detectSchemaConflicts(tagKeys), [tagKeys]);
  const conflictKeys = new Set(conflicts.map(c => c.key));

  const inconsistencies = useMemo(() => detectInconsistencies(resources), [resources]);
  const driftKeys = new Set(inconsistencies.map(i => i.tagKey));

  const selected = tagKeys.find(k => k.id === selectedKeyId) || tagKeys[0];

  // "Discovered" tag keys — those seen on resources but not in canonical schema
  const discovered = useMemo(() => {
    const inSchema = new Set(tagKeys.map(k => k.key));
    const seen = {};
    for (const r of resources) {
      for (const [k, v] of Object.entries(r.tags)) {
        if (!inSchema.has(k)) seen[k] = (seen[k] || 0) + 1;
      }
    }
    return Object.entries(seen).map(([key, count]) => ({ key, count }));
  }, [tagKeys, resources]);

  return (
    <div style={{ flex: 1, display: 'flex', minHeight: 0, overflow: 'hidden' }}>

      {/* LEFT — key list */}
      <div style={{ flex: 1, minWidth: 0, overflow: 'auto', padding: '16px 24px 24px' }}>

        {/* AWS Org banner */}
        <div style={{
          background: TG_TOKENS.awsBg, border: `1px solid ${TG_TOKENS.awsBd}`,
          borderRadius: 10, padding: '10px 14px', marginBottom: 16,
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <div style={{
            width: 32, height: 32, borderRadius: 16, background: TG_TOKENS.surface,
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <Cloud size={16} color={TG_TOKENS.aws} strokeWidth={1.75} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: TG_TOKENS.text }}>
              Linked to AWS Organizations
              <span style={{ color: TG_TOKENS.muted, fontWeight: 400 }}>
                {' '}· {tagKeys.filter(k => k.source === 'aws-org').length} of {tagKeys.length} keys inherited
              </span>
            </div>
            <div style={{ fontSize: 11.5, color: TG_TOKENS.text2, marginTop: 2 }}>
              <code style={{ ...tgInlineCode, background: TG_TOKENS.surface, color: TG_TOKENS.aws, border: `1px solid ${TG_TOKENS.awsBd}` }}>
                {AWS_ORG_POLICY.arn}
              </code>
              <span style={{ color: TG_TOKENS.muted, marginLeft: 6 }}>· synced {timeSince(AWS_ORG_POLICY.syncedAt)} ago</span>
            </div>
          </div>
          <button style={{ ...tgBtnGhost, padding: '5px 10px', fontSize: 11 }}>Re-sync</button>
          {conflicts.length > 0 && (
            <button
              style={{ ...tgBtnGhost, padding: '5px 10px', fontSize: 11 }}
              onClick={onShowConflict}
            >
              Resolve {conflicts.length} conflict{conflicts.length === 1 ? '' : 's'}
            </button>
          )}
        </div>

        {/* Required */}
        <div style={{ ...tgSectionLabel, marginBottom: 8 }}>
          Required keys <span style={{ color: TG_TOKENS.muted, fontWeight: 400 }}>· {required.length}</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 18 }}>
          {required.map(k => (
            <KeyRow
              key={k.id} tagKey={k}
              coverage={computeTagKeyCoverage(k, resources)}
              drift={driftKeys.has(k.key)}
              conflict={conflictKeys.has(k.key)}
              selected={selectedKeyId === k.id}
              onClick={() => setSelectedKeyId(k.id)}
            />
          ))}
        </div>

        {/* Optional */}
        <div style={{ ...tgSectionLabel, marginBottom: 8 }}>
          Optional keys <span style={{ color: TG_TOKENS.muted, fontWeight: 400 }}>· {optional.length}</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 18 }}>
          {optional.map(k => (
            <KeyRow
              key={k.id} tagKey={k}
              coverage={computeTagKeyCoverage(k, resources)}
              drift={driftKeys.has(k.key)}
              conflict={conflictKeys.has(k.key)}
              selected={selectedKeyId === k.id}
              onClick={() => setSelectedKeyId(k.id)}
            />
          ))}
        </div>

        {/* Discovered */}
        {discovered.length > 0 && (
          <>
            <div style={{ ...tgSectionLabel, marginBottom: 8 }}>
              Discovered in cloud · not yet in schema{' '}
              <span style={{ color: TG_TOKENS.muted, fontWeight: 400 }}>· {discovered.length}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {discovered.map(d => (
                <DiscoveredRow key={d.key} keyName={d.key} count={d.count} />
              ))}
            </div>
          </>
        )}
      </div>

      {/* RIGHT — detail panel */}
      {selected && <KeyDetail tagKey={selected} resources={resources} onShowConflict={conflictKeys.has(selected.key) ? onShowConflict : null} />}
    </div>
  );
}

// ---------------------------------------------------------------------------
function KeyRow({ tagKey: k, coverage, drift, conflict, selected, onClick }) {
  const cov = coverage.pct;
  const covColor = cov >= 85 ? TG_TOKENS.success : cov >= 60 ? TG_TOKENS.warn : TG_TOKENS.danger;
  return (
    <div onClick={onClick} style={{
      background: TG_TOKENS.surface,
      border: `1px solid ${selected ? TG_TOKENS.text : TG_TOKENS.border}`,
      boxShadow: selected ? '0 0 0 3px rgba(17,24,39,0.04)' : 'none',
      borderRadius: 8, padding: '10px 14px', cursor: 'pointer',
      display: 'flex', alignItems: 'center', gap: 12,
    }}>
      <TagKey name={k.key} size={12} style={{ minWidth: 110, justifyContent: 'flex-start', flexShrink: 0 }} />
      <SourceChip source={k.source} />
      <span style={{
        flex: 1, fontSize: 12, color: TG_TOKENS.muted,
        overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis',
      }}>{k.description}</span>
      <span style={{ fontSize: 11, color: TG_TOKENS.muted }}>{(k.allowedValues || []).length} values</span>
      {drift && (
        <span style={{ fontSize: 10, fontWeight: 700, color: TG_TOKENS.warn, background: TG_TOKENS.warnBg, border: '1px solid #fde68a', padding: '1px 5px', borderRadius: 4 }}>drift</span>
      )}
      {conflict && (
        <span style={{ fontSize: 10, fontWeight: 700, color: TG_TOKENS.aws, background: TG_TOKENS.awsBg, border: `1px solid ${TG_TOKENS.awsBd}`, padding: '1px 5px', borderRadius: 4 }}>conflict</span>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 80, justifyContent: 'flex-end' }}>
        <div style={{ width: 48, height: 3, background: '#eceae6', borderRadius: 9999, overflow: 'hidden' }}>
          <div style={{ width: `${cov}%`, height: '100%', background: covColor, borderRadius: 9999 }} />
        </div>
        <span style={{
          fontSize: 11, fontWeight: 600, color: covColor,
          fontVariantNumeric: 'tabular-nums', minWidth: 26, textAlign: 'right',
        }}>{cov}%</span>
      </div>
    </div>
  );
}

function DiscoveredRow({ keyName, count }) {
  return (
    <div style={{
      border: `1px dashed ${TG_TOKENS.borderStrong}`, borderRadius: 8,
      padding: '9px 14px', display: 'flex', alignItems: 'center', gap: 10,
      background: 'transparent',
    }}>
      <span style={{
        fontFamily: tgMonoFont, fontSize: 12, fontWeight: 500,
        color: TG_TOKENS.muted, background: TG_TOKENS.surfaceMuted,
        border: `1px solid ${TG_TOKENS.border}`,
        padding: '1px 7px', borderRadius: 4, minWidth: 130,
      }}>{keyName}</span>
      <span style={{ flex: 1, fontSize: 12, color: TG_TOKENS.muted }}>
        Seen on {count} resource{count === 1 ? '' : 's'}
      </span>
      <button style={{ ...tgBtnGhost, padding: '3px 9px', fontSize: 11 }}>Promote to schema</button>
      <button style={{ background: 'transparent', border: 'none', color: TG_TOKENS.muted, fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>Ignore</button>
    </div>
  );
}

// ---------------------------------------------------------------------------
function KeyDetail({ tagKey: k, resources, onShowConflict }) {
  const coverage = computeTagKeyCoverage(k, resources);
  const existingVals = getExistingValues(k.key, resources);
  const valueCounts = (k.allowedValues || []).map(v => ({
    v,
    n: resources.filter(r => r.tags[k.key] === v).length,
  }));
  // Also surface drift values present on resources but not in the allowed list
  const driftVals = existingVals.filter(v => !(k.allowedValues || []).includes(v));

  return (
    <aside style={{
      width: 380, flexShrink: 0, borderLeft: `1px solid ${TG_TOKENS.border}`,
      background: TG_TOKENS.surface, display: 'flex', flexDirection: 'column',
    }}>
      {/* head */}
      <div style={{ padding: '16px 20px 12px', borderBottom: `1px solid ${TG_TOKENS.border}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
          <TagKey name={k.key} size={14} style={{ fontSize: 14, fontWeight: 600, padding: '2px 8px', borderRadius: 5 }} />
          {k.required && <ReqBadge missing />}
          <SourceChip source={k.source} />
          <div style={{ flex: 1 }} />
          <button style={{ background: 'transparent', border: 'none', color: TG_TOKENS.muted, fontSize: 11, cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <Edit2 size={11} /> Edit
          </button>
        </div>
        <p style={{ fontSize: 12, color: TG_TOKENS.text2, margin: '0 0 12px', lineHeight: 1.5 }}>{k.description}</p>

        {onShowConflict && (
          <div onClick={onShowConflict} style={{
            background: TG_TOKENS.awsBg, border: `1px solid ${TG_TOKENS.awsBd}`,
            borderRadius: 6, padding: '7px 10px',
            display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer',
          }}>
            <AlertTriangle size={11} color={TG_TOKENS.aws} strokeWidth={2} />
            <span style={{ fontSize: 11.5, color: TG_TOKENS.aws, flex: 1 }}>
              AWS Org allowed values don't match yours
            </span>
            <span style={{ fontSize: 10, color: TG_TOKENS.aws }}>Resolve →</span>
          </div>
        )}
      </div>

      {/* body */}
      <div style={{ flex: 1, overflow: 'auto', padding: '14px 20px 20px' }}>
        <div style={{ ...tgSectionLabel, marginBottom: 8 }}>Allowed values</div>
        <div style={{ background: TG_TOKENS.surface, border: `1px solid ${TG_TOKENS.border}`, borderRadius: 8, overflow: 'hidden' }}>
          {[...valueCounts, ...driftVals.map(v => ({ v, n: resources.filter(r => r.tags[k.key] === v).length, drift: true }))].map((vc, i) => (
            <div key={vc.v} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '8px 12px', borderTop: i ? `1px solid ${TG_TOKENS.border}` : 'none',
              background: vc.drift ? TG_TOKENS.warnBg : 'transparent',
            }}>
              <span style={{
                fontFamily: tgMonoFont, fontSize: 11,
                color: TG_TOKENS.text2, background: TG_TOKENS.surfaceMuted,
                border: `1px solid ${TG_TOKENS.border}`, padding: '1px 6px', borderRadius: 4,
              }}>{vc.v}</span>
              {vc.drift && <span style={{ fontSize: 10, color: TG_TOKENS.warn, fontWeight: 500 }}>drift</span>}
              <div style={{ flex: 1, height: 3, background: '#f3f4f6', borderRadius: 9999, overflow: 'hidden' }}>
                <div style={{
                  width: `${resources.length ? (vc.n / resources.length * 100) : 0}%`,
                  height: '100%', background: TG_TOKENS.text,
                }} />
              </div>
              <span style={{
                fontSize: 11, color: TG_TOKENS.muted, minWidth: 20, textAlign: 'right',
                fontVariantNumeric: 'tabular-nums',
              }}>{vc.n}</span>
            </div>
          ))}
          <button style={{
            display: 'flex', alignItems: 'center', gap: 5,
            padding: '7px 12px', borderTop: `1px solid ${TG_TOKENS.border}`,
            background: 'transparent', border: 'none', color: TG_TOKENS.muted,
            fontSize: 11.5, cursor: 'pointer', fontFamily: 'inherit', width: '100%',
          }}>
            <Plus size={11} /> Add allowed value
          </button>
        </div>

        <div style={{ ...tgSectionLabel, marginTop: 18, marginBottom: 8 }}>Validation</div>
        <KV label="Type">enum</KV>
        {k.validation?.pattern && <KV label="Pattern"><code style={tgInlineCode}>{k.validation.pattern}</code></KV>}
        <KV label="Applies to">
          <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
            {k.applicableTypes.map(t => (
              <span key={t} style={{
                fontFamily: tgMonoFont, fontSize: 10, fontWeight: 600,
                background: '#f3f4f6', color: TG_TOKENS.text2,
                padding: '1px 5px', borderRadius: 3,
              }}>{t.replace(' Instance', '').replace(' Function', '').replace(' Bucket', '').replace(' Namespace', '')}</span>
            ))}
          </div>
        </KV>
        <KV label="Coverage">
          <span style={{ fontVariantNumeric: 'tabular-nums', color: coverage.pct >= 85 ? TG_TOKENS.success : coverage.pct >= 60 ? TG_TOKENS.warn : TG_TOKENS.danger, fontWeight: 600 }}>
            {coverage.pct}%
          </span>
          <span style={{ color: TG_TOKENS.muted, marginLeft: 6 }}>{coverage.covered}/{coverage.total}</span>
        </KV>

        {k.source === 'aws-org' && (
          <>
            <div style={{ ...tgSectionLabel, marginTop: 18, marginBottom: 8 }}>Inherited from</div>
            <div style={{ background: TG_TOKENS.surface, border: `1px solid ${TG_TOKENS.border}`, borderRadius: 8, padding: '10px 12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <Cloud size={12} color={TG_TOKENS.aws} strokeWidth={1.75} />
                <span style={{ fontSize: 12, fontWeight: 500 }}>AWS Organizations tag policy</span>
              </div>
              <code style={{
                fontFamily: tgMonoFont, fontSize: 10.5, color: TG_TOKENS.muted,
                display: 'block', wordBreak: 'break-all', marginTop: 4,
              }}>{AWS_ORG_POLICY.arn}</code>
              <div style={{ display: 'flex', gap: 6, marginTop: 8, fontSize: 10.5, color: TG_TOKENS.xMuted, alignItems: 'center' }}>
                <button style={{ ...tgBtnGhost, padding: '3px 8px', fontSize: 11 }}>
                  View source <ExternalLink size={10} />
                </button>
                <span>read-only · sync'd {timeSince(AWS_ORG_POLICY.syncedAt)} ago</span>
              </div>
            </div>
          </>
        )}
      </div>
    </aside>
  );
}

function KV({ label, children }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '6px 0', borderBottom: `1px solid ${TG_TOKENS.border}`, fontSize: 12,
    }}>
      <span style={{ width: 80, color: TG_TOKENS.muted, flexShrink: 0 }}>{label}</span>
      <span style={{ color: TG_TOKENS.text2, flex: 1, display: 'flex', justifyContent: 'flex-end' }}>{children}</span>
    </div>
  );
}

function timeSince(iso) {
  const diff = (Date.now() - new Date(iso).getTime()) / 60000;
  if (diff < 60) return `${Math.round(diff)}m`;
  if (diff < 1440) return `${Math.round(diff / 60)}h`;
  return `${Math.round(diff / 1440)}d`;
}
