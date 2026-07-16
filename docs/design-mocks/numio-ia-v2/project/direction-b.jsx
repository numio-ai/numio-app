// Direction B — Agent-first dashboard. The observe→decide→act loop is the primary UI.
// Wide left rail with live activity stream. Right side: focused proposal + spend context.

const DirectionB = ({ tweaks = {} }) => {
  const { dark = false, density = "comfortable", accentHue = 230 } = tweaks;

  // ---- THEME ---- (slightly different — paper is a touch warmer, more editorial)
  const ink = dark ? "oklch(0.96 0.005 80)" : "oklch(0.16 0.01 80)";
  const inkSoft = dark ? "oklch(0.78 0.005 80)" : "oklch(0.40 0.01 80)";
  const inkMute = dark ? "oklch(0.55 0.005 80)" : "oklch(0.62 0.01 80)";
  const paper = dark ? "oklch(0.14 0.005 80)" : "oklch(0.97 0.008 85)";
  const surface = dark ? "oklch(0.18 0.005 80)" : "oklch(1 0 0)";
  const surfaceAlt = dark ? "oklch(0.20 0.005 80)" : "oklch(0.99 0.005 85)";
  const line = dark ? "oklch(0.28 0.005 80)" : "oklch(0.90 0.008 85)";
  const lineSoft = dark ? "oklch(0.22 0.005 80)" : "oklch(0.94 0.006 85)";
  const accent = `oklch(0.55 0.14 ${accentHue})`;
  const accentSoft = dark ? `oklch(0.30 0.07 ${accentHue})` : `oklch(0.94 0.04 ${accentHue})`;
  const good = "oklch(0.55 0.13 155)";
  const warn = "oklch(0.65 0.14 70)";
  const danger = "oklch(0.55 0.18 25)";

  const [filter, setFilter] = useState("all"); // all | observe | decide | act
  const [pulse, setPulse] = useState(0);
  const [openTrace, setOpenTrace] = useState("p-1041");
  const [approved, setApproved] = useState(new Set());
  const [dismissed, setDismissed] = useState(new Set());

  useEffect(() => {
    const id = setInterval(() => setPulse(p => p + 1), 2000);
    return () => clearInterval(id);
  }, []);

  const series = useMemo(() => generateSeries(30, 9200, 60, 380), []);
  const visibleProposals = MOCK.proposals.filter(p => !dismissed.has(p.id));
  const focused = visibleProposals.find(p => p.id === openTrace) || visibleProposals[0];

  // Combined event stream: proposals + activity, ordered
  const stream = useMemo(() => {
    const proposalEvents = MOCK.proposals.map(p => ({
      kind: "proposal", agent: "decide", t: p.createdAt, data: p,
    }));
    const activityEvents = MOCK.activity.map(a => ({
      kind: "activity", agent: a.agent, t: a.t, data: a,
    }));
    return [...proposalEvents, ...activityEvents].sort((a, b) => {
      const parse = (s) => {
        const m = s.match(/(\d+)([mh])/);
        if (!m) return 999;
        return Number(m[1]) * (m[2] === "h" ? 60 : 1);
      };
      return parse(a.t) - parse(b.t);
    });
  }, []);

  const filteredStream = stream.filter(e => filter === "all" || e.agent === filter);

  const agentColor = (a) => a === "observe" ? accent : a === "decide" ? warn : good;
  const agentBg = (a) => {
    if (a === "observe") return accentSoft;
    if (a === "decide") return dark ? "oklch(0.30 0.07 70)" : "oklch(0.95 0.05 70)";
    return dark ? "oklch(0.30 0.06 155)" : "oklch(0.94 0.04 155)";
  };

  const S = {
    root: {
      width: 1440, minHeight: 1040,
      background: paper, color: ink,
      fontFamily: "Inter, system-ui, sans-serif",
      fontSize: 13, lineHeight: 1.5,
      letterSpacing: "-0.005em",
      display: "flex", flexDirection: "column",
    },
    topbar: {
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "14px 28px", borderBottom: `1px solid ${line}`, background: surface,
    },
    brand: { display: "flex", alignItems: "center", gap: 10, fontWeight: 600, fontSize: 15 },
    logo: { width: 22, height: 22, borderRadius: 6, background: ink, color: paper, display: "grid", placeItems: "center", fontFamily: "JetBrains Mono, monospace", fontSize: 11, fontWeight: 700 },

    body: { display: "grid", gridTemplateColumns: "560px 1fr", flex: 1, minHeight: 0 },

    // LEFT: stream
    left: { borderRight: `1px solid ${line}`, display: "flex", flexDirection: "column", background: surface, minHeight: 0 },
    streamHeader: { padding: "20px 24px 12px", borderBottom: `1px solid ${line}` },
    streamTitle: { fontSize: 20, fontWeight: 500, letterSpacing: "-0.02em", margin: 0, display: "flex", alignItems: "center", gap: 10 },
    pulseDot: {
      width: 8, height: 8, borderRadius: 4, background: good,
      boxShadow: `0 0 0 0 ${good}`,
      animation: "pulse 2s infinite",
    },
    filterRow: { display: "flex", gap: 4, marginTop: 14, padding: 2, background: lineSoft, borderRadius: 6, width: "fit-content" },
    filterBtn: (active, color) => ({
      padding: "5px 12px", borderRadius: 4, fontSize: 11, fontFamily: "JetBrains Mono, monospace",
      cursor: "pointer", textTransform: "uppercase", letterSpacing: "0.06em",
      background: active ? surface : "transparent",
      color: active ? (color || ink) : inkSoft,
      fontWeight: active ? 600 : 500,
      boxShadow: active ? "0 1px 2px rgba(0,0,0,0.04)" : "none",
    }),

    streamList: { flex: 1, overflow: "auto", padding: "8px 0" },

    // RIGHT
    right: { padding: "24px 28px", overflow: "auto", display: "flex", flexDirection: "column", gap: 16 },

    statRow: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 1, background: line, border: `1px solid ${line}`, borderRadius: 10, overflow: "hidden" },
    statCell: { background: surface, padding: 16 },
    statLabel: { fontSize: 10, color: inkMute, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6, fontWeight: 500 },
    statValue: { fontFamily: "JetBrains Mono, monospace", fontSize: 22, fontWeight: 500, letterSpacing: "-0.02em" },

    card: { background: surface, border: `1px solid ${line}`, borderRadius: 10, padding: 20 },
    cardTitle: { fontSize: 13, fontWeight: 500, marginBottom: 4 },
    cardSub: { fontSize: 11, color: inkMute, fontFamily: "JetBrains Mono, monospace" },

    btn: (variant = "primary") => ({
      padding: "7px 14px", borderRadius: 6, fontSize: 12, fontWeight: 500,
      cursor: "pointer", border: "1px solid",
      borderColor: variant === "primary" ? ink : line,
      background: variant === "primary" ? ink : surface,
      color: variant === "primary" ? paper : ink,
    }),
  };

  return (
    <div style={S.root}>
      <style>{`
        @keyframes pulse {
          0% { box-shadow: 0 0 0 0 ${good}aa; }
          70% { box-shadow: 0 0 0 8px ${good}00; }
          100% { box-shadow: 0 0 0 0 ${good}00; }
        }
      `}</style>

      <div style={S.topbar}>
        <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
          <div style={S.brand}>
            <div style={S.logo}>N</div>
            <span>numio</span>
            <span style={{ color: inkMute, fontWeight: 400, fontSize: 12, marginLeft: 4, fontFamily: "JetBrains Mono, monospace" }}>/ acme-corp</span>
          </div>
          <div style={{ display: "flex", gap: 4 }}>
            {["Stream", "Spend", "Policies", "Resources", "Budgets"].map((n, i) => (
              <div key={n} style={{ padding: "6px 12px", borderRadius: 6, fontSize: 13, color: i === 0 ? ink : inkSoft, background: i === 0 ? surfaceAlt : "transparent", fontWeight: i === 0 ? 500 : 400, cursor: "pointer" }}>{n}</div>
            ))}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ fontSize: 12, color: inkSoft, fontFamily: "JetBrains Mono, monospace" }}>
            saved this mo · <span style={{ color: good, fontWeight: 600 }}>{fmtUSD(MOCK.savedThisMonth)}</span>
          </div>
          <div style={{ width: 28, height: 28, borderRadius: 14, background: accentSoft, color: accent, display: "grid", placeItems: "center", fontSize: 11, fontWeight: 600 }}>JM</div>
        </div>
      </div>

      <div style={S.body}>
        {/* ============ LEFT: STREAM ============ */}
        <div style={S.left}>
          <div style={S.streamHeader}>
            <div style={S.streamTitle}>
              <span style={S.pulseDot}></span>
              Agent stream
            </div>
            <div style={{ fontSize: 12, color: inkSoft, marginTop: 6, fontFamily: "JetBrains Mono, monospace" }}>
              observe → decide → act · last sync 4s ago
            </div>
            <div style={S.filterRow}>
              <div style={S.filterBtn(filter === "all")} onClick={() => setFilter("all")}>all</div>
              <div style={S.filterBtn(filter === "observe", accent)} onClick={() => setFilter("observe")}>observe</div>
              <div style={S.filterBtn(filter === "decide", warn)} onClick={() => setFilter("decide")}>decide</div>
              <div style={S.filterBtn(filter === "act", good)} onClick={() => setFilter("act")}>act</div>
            </div>
          </div>

          <div style={S.streamList}>
            {filteredStream.map((e, i) => {
              const isProposal = e.kind === "proposal";
              const open = isProposal && openTrace === e.data.id;
              return (
                <div key={i} style={{ position: "relative", padding: "14px 24px 14px 56px", borderBottom: `1px solid ${lineSoft}`, cursor: isProposal ? "pointer" : "default", background: open ? surfaceAlt : "transparent" }}
                     onClick={() => isProposal && setOpenTrace(open ? null : e.data.id)}>
                  {/* Agent rail */}
                  <div style={{ position: "absolute", left: 24, top: 16, width: 24, display: "flex", flexDirection: "column", alignItems: "center" }}>
                    <div style={{ fontSize: 9, fontFamily: "JetBrains Mono, monospace", textTransform: "uppercase", color: agentColor(e.agent), background: agentBg(e.agent), padding: "2px 0", borderRadius: 3, fontWeight: 600, letterSpacing: "0.04em", textAlign: "center", width: 24 }}>
                      {e.agent[0]}
                    </div>
                  </div>
                  {/* Vertical line */}
                  <div style={{ position: "absolute", left: 35, top: 36, bottom: -1, width: 1, background: lineSoft }}></div>

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
                    <div style={{ fontSize: 10, fontFamily: "JetBrains Mono, monospace", color: agentColor(e.agent), textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600 }}>
                      {e.agent}{isProposal && " · proposal"}
                    </div>
                    <div style={{ fontSize: 11, color: inkMute, fontFamily: "JetBrains Mono, monospace" }}>{e.t}</div>
                  </div>

                  {isProposal ? (
                    <>
                      <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 6, lineHeight: 1.4 }}>{e.data.title}</div>
                      <div style={{ fontSize: 11, color: inkMute, fontFamily: "JetBrains Mono, monospace", marginBottom: 6 }}>
                        {e.data.scope} · save <span style={{ color: good }}>{fmtUSD(e.data.saving)}/mo</span>
                      </div>
                      {open && (
                        <div style={{ marginTop: 10, padding: 12, background: surface, borderRadius: 6, border: `1px solid ${line}` }}>
                          <div style={{ fontSize: 10, color: inkMute, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8, fontWeight: 500 }}>Reasoning trace</div>
                          {e.data.reasoning.map((r, j) => (
                            <div key={j} style={{ fontSize: 12, color: inkSoft, marginBottom: 6, display: "flex", gap: 8, lineHeight: 1.5 }}>
                              <span style={{ color: inkMute, fontFamily: "JetBrains Mono, monospace", flexShrink: 0 }}>{String(j+1).padStart(2,'0')}</span>
                              <span>{r}</span>
                            </div>
                          ))}
                          <div style={{ fontSize: 10, color: inkMute, marginTop: 10, paddingTop: 10, borderTop: `1px solid ${lineSoft}`, fontFamily: "JetBrains Mono, monospace" }}>
                            policy: <span style={{ color: ink }}>{e.data.policy}</span>
                          </div>
                          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                            <button style={{ ...S.btn("ghost"), padding: "6px 12px", fontSize: 11 }} onClick={(ev) => { ev.stopPropagation(); setDismissed(new Set([...dismissed, e.data.id])); }}>Dismiss</button>
                            <button style={{ ...S.btn("primary"), padding: "6px 12px", fontSize: 11, background: approved.has(e.data.id) ? good : ink, borderColor: approved.has(e.data.id) ? good : ink }} onClick={(ev) => { ev.stopPropagation(); setApproved(new Set([...approved, e.data.id])); }}>
                              {approved.has(e.data.id) ? "✓ Approved" : "Approve & run"}
                            </button>
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <div style={{ fontSize: 13, color: ink, lineHeight: 1.5 }}>{e.data.text}</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* ============ RIGHT ============ */}
        <div style={S.right}>
          {/* hero */}
          <div>
            <div style={{ fontSize: 11, color: inkMute, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>May 2026 · MTD</div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 16 }}>
              <h1 style={{ fontSize: 32, fontWeight: 500, letterSpacing: "-0.02em", margin: 0 }}>
                {fmtUSD(MOCK.totalSpend)}
                <span style={{ fontSize: 14, color: good, marginLeft: 12, fontFamily: "JetBrains Mono, monospace", fontWeight: 400 }}>−9.2%</span>
              </h1>
              <button style={S.btn("primary")}>+ New policy</button>
            </div>
            <div style={S.statRow}>
              <div style={S.statCell}>
                <div style={S.statLabel}>Forecast EOM</div>
                <div style={S.statValue}>{fmtUSD(MOCK.forecast)}</div>
              </div>
              <div style={S.statCell}>
                <div style={S.statLabel}>Saved by agent</div>
                <div style={{ ...S.statValue, color: good }}>{fmtUSD(MOCK.savedThisMonth)}</div>
              </div>
              <div style={S.statCell}>
                <div style={S.statLabel}>Pending</div>
                <div style={S.statValue}>{visibleProposals.length}</div>
              </div>
            </div>
          </div>

          {/* spend chart */}
          <div style={S.card}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14 }}>
              <div>
                <div style={S.cardTitle}>Daily spend · 30d</div>
                <div style={S.cardSub}>all providers · usd</div>
              </div>
            </div>
            <AreaChart data={series} w={780} h={140} stroke={accent} fill={accentSoft} gridColor={lineSoft} />
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, fontSize: 11, color: inkMute, fontFamily: "JetBrains Mono, monospace" }}>
              <span>Apr 4</span><span>Apr 18</span><span>May 2</span>
            </div>
          </div>

          {/* focused proposal callout */}
          {focused && (
            <div style={{ ...S.card, borderColor: accent, background: dark ? surface : `oklch(0.99 0.015 ${accentHue})` }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
                <div style={{ fontSize: 10, fontFamily: "JetBrains Mono, monospace", color: accent, textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600 }}>Top proposal · {focused.id}</div>
                <div style={{ fontSize: 11, color: inkMute, fontFamily: "JetBrains Mono, monospace" }}>{focused.createdAt}</div>
              </div>
              <div style={{ fontSize: 16, fontWeight: 500, marginBottom: 8, letterSpacing: "-0.01em" }}>{focused.title}</div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginTop: 12, marginBottom: 14, padding: "12px 0", borderTop: `1px solid ${line}`, borderBottom: `1px solid ${line}` }}>
                <div>
                  <div style={S.statLabel}>Monthly save</div>
                  <div style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 18, fontWeight: 500, color: good }}>{fmtUSD(focused.saving)}</div>
                </div>
                <div>
                  <div style={S.statLabel}>Policy</div>
                  <div style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 13, marginTop: 4 }}>{focused.policy}</div>
                </div>
                <div>
                  <div style={S.statLabel}>Reversible</div>
                  <div style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 13, marginTop: 4, color: good }}>yes · 7d</div>
                </div>
              </div>

              <div style={{ display: "flex", gap: 8 }}>
                <button style={{ ...S.btn("primary"), background: approved.has(focused.id) ? good : ink, borderColor: approved.has(focused.id) ? good : ink }} onClick={() => setApproved(new Set([...approved, focused.id]))}>
                  {approved.has(focused.id) ? "✓ Approved & queued" : "Approve & run"}
                </button>
                <button style={S.btn("ghost")}>Edit policy</button>
                <button style={{ ...S.btn("ghost"), borderColor: "transparent" }} onClick={() => setDismissed(new Set([...dismissed, focused.id]))}>Dismiss</button>
              </div>
            </div>
          )}

          {/* services compact */}
          <div style={S.card}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14 }}>
              <div>
                <div style={S.cardTitle}>Top services</div>
                <div style={S.cardSub}>30d spend</div>
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
              {MOCK.services.slice(0, 5).map((s, i) => (
                <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 60px 100px 90px 60px", alignItems: "center", padding: "10px 0", borderBottom: i < 4 ? `1px solid ${lineSoft}` : "none", gap: 12 }}>
                  <div style={{ fontSize: 13 }}>{s.name}</div>
                  <ProviderGlyph p={s.provider} color={inkMute} />
                  <div style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 13, textAlign: "right" }}>{fmtUSD(s.spend)}</div>
                  <div style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 12, textAlign: "right", color: s.delta < 0 ? good : s.delta > 5 ? warn : inkSoft }}>
                    {s.delta > 0 ? "+" : ""}{s.delta.toFixed(1)}%
                  </div>
                  <Sparkline data={s.trend} w={56} h={18} stroke={s.delta > 5 ? warn : s.delta < 0 ? good : inkMute} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

window.DirectionB = DirectionB;
