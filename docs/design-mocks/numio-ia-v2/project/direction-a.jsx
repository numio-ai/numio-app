// Direction A — Cost-first dashboard. Numbers and structure dominate.
// Agent presence: collapsible co-pilot drawer on the right. Calm, finance-grade.

const DirectionA = ({ tweaks = {} }) => {
  const { dark = false, density = "comfortable", accentHue = 230, agentPresence = "drawer" } = tweaks;

  // ---- THEME ----
  const ink = dark ? "oklch(0.96 0.005 95)" : "oklch(0.18 0.01 260)";
  const inkSoft = dark ? "oklch(0.78 0.005 95)" : "oklch(0.42 0.01 260)";
  const inkMute = dark ? "oklch(0.58 0.005 95)" : "oklch(0.62 0.01 260)";
  const paper = dark ? "oklch(0.16 0.01 260)" : "oklch(0.985 0.003 95)";
  const surface = dark ? "oklch(0.20 0.01 260)" : "oklch(1 0 0)";
  const surfaceAlt = dark ? "oklch(0.22 0.01 260)" : "oklch(0.97 0.003 95)";
  const line = dark ? "oklch(0.30 0.01 260)" : "oklch(0.91 0.005 95)";
  const lineSoft = dark ? "oklch(0.26 0.01 260)" : "oklch(0.94 0.004 95)";
  const accent = `oklch(0.55 0.14 ${accentHue})`;
  const accentSoft = `oklch(0.94 0.04 ${accentHue})`;
  const accentSoftDark = `oklch(0.30 0.06 ${accentHue})`;
  const good = "oklch(0.55 0.13 155)";
  const goodSoft = dark ? "oklch(0.30 0.06 155)" : "oklch(0.94 0.04 155)";
  const warn = "oklch(0.65 0.14 70)";
  const warnSoft = dark ? "oklch(0.32 0.06 70)" : "oklch(0.95 0.05 70)";
  const danger = "oklch(0.55 0.18 25)";

  const pad = density === "compact" ? 12 : 16;
  const rowH = density === "compact" ? 36 : 44;

  const [range, setRange] = useState("30d");
  const [drawerOpen, setDrawerOpen] = useState(agentPresence !== "hidden");
  const [selectedProposal, setSelectedProposal] = useState("p-1041");
  const [expanded, setExpanded] = useState(true);
  const [dismissed, setDismissed] = useState(new Set());
  const [approved, setApproved] = useState(new Set());

  useEffect(() => {
    setDrawerOpen(agentPresence !== "hidden");
  }, [agentPresence]);

  const series = useMemo(() => generateSeries(30, 9200, 60, 380), []);

  const visibleProposals = MOCK.proposals.filter(p => !dismissed.has(p.id));
  const current = visibleProposals.find(p => p.id === selectedProposal) || visibleProposals[0];

  // ---- STYLES ----
  const S = {
    root: {
      width: 1440, minHeight: 1040,
      background: paper, color: ink,
      fontFamily: "Inter, system-ui, sans-serif",
      fontSize: 13, lineHeight: 1.5,
      display: "flex", flexDirection: "column",
      letterSpacing: "-0.005em",
    },
    topbar: {
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "14px 28px", borderBottom: `1px solid ${line}`,
      background: surface,
    },
    brand: { display: "flex", alignItems: "center", gap: 10, fontWeight: 600, fontSize: 15 },
    logo: {
      width: 22, height: 22, borderRadius: 6, background: ink,
      display: "grid", placeItems: "center", color: paper,
      fontFamily: "JetBrains Mono, monospace", fontSize: 11, fontWeight: 700,
    },
    nav: { display: "flex", gap: 4 },
    navItem: (active) => ({
      padding: "6px 12px", borderRadius: 6, fontSize: 13, color: active ? ink : inkSoft,
      background: active ? surfaceAlt : "transparent", fontWeight: active ? 500 : 400, cursor: "pointer",
    }),
    body: { display: "grid", gridTemplateColumns: drawerOpen ? "1fr 380px" : "1fr 0px", flex: 1, transition: "grid-template-columns .25s ease" },
    main: { padding: "24px 28px", overflow: "hidden" },

    // hero strip
    heroRow: { display: "grid", gridTemplateColumns: "1.6fr 1fr 1fr 1fr", gap: 1, background: line, border: `1px solid ${line}`, borderRadius: 10, overflow: "hidden", marginBottom: 24 },
    heroCell: { background: surface, padding: 18 },
    heroLabel: { fontSize: 11, color: inkMute, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8, fontWeight: 500 },
    heroValue: { fontFamily: "JetBrains Mono, monospace", fontSize: 28, fontWeight: 500, letterSpacing: "-0.02em" },
    heroSub: { fontSize: 12, color: inkSoft, marginTop: 6 },

    // chart card
    card: { background: surface, border: `1px solid ${line}`, borderRadius: 10, padding: 20, marginBottom: 16 },
    cardHeader: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 },
    cardTitle: { fontSize: 14, fontWeight: 500, marginBottom: 4 },
    cardSub: { fontSize: 12, color: inkSoft },
    rangeRow: { display: "flex", gap: 1, background: lineSoft, padding: 2, borderRadius: 6, fontSize: 12 },
    rangeBtn: (active) => ({
      padding: "4px 10px", borderRadius: 4, cursor: "pointer",
      background: active ? surface : "transparent",
      color: active ? ink : inkSoft, fontWeight: active ? 500 : 400,
      fontFamily: "JetBrains Mono, monospace",
      boxShadow: active ? `0 1px 2px rgba(0,0,0,0.04)` : "none",
    }),

    // services table
    tbl: { width: "100%", borderCollapse: "collapse", fontSize: 13 },
    th: { textAlign: "left", padding: `8px ${pad}px`, fontSize: 11, color: inkMute, textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 500, borderBottom: `1px solid ${line}` },
    td: { padding: `${(rowH-20)/2}px ${pad}px`, borderBottom: `1px solid ${lineSoft}`, fontSize: 13 },

    // drawer
    drawer: { borderLeft: `1px solid ${line}`, background: surface, display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" },
    drawerHeader: { padding: "16px 20px", borderBottom: `1px solid ${line}`, display: "flex", justifyContent: "space-between", alignItems: "center" },
    proposalCard: (active) => ({
      padding: 16,
      borderBottom: `1px solid ${lineSoft}`,
      background: active ? surfaceAlt : "transparent",
      borderLeft: `2px solid ${active ? accent : "transparent"}`,
      cursor: "pointer",
    }),
    btn: (variant = "primary") => ({
      padding: "7px 14px", borderRadius: 6, fontSize: 12, fontWeight: 500,
      cursor: "pointer", border: "1px solid",
      borderColor: variant === "primary" ? ink : line,
      background: variant === "primary" ? ink : surface,
      color: variant === "primary" ? paper : ink,
      fontFamily: "Inter, sans-serif",
    }),
  };

  // helpers
  const sevColor = (s) => s === "high" ? danger : s === "med" ? warn : inkMute;
  const sevBg = (s) => s === "high" ? (dark ? "oklch(0.30 0.08 25)" : "oklch(0.96 0.04 25)") : s === "med" ? warnSoft : surfaceAlt;

  return (
    <div style={S.root}>
      {/* ============ TOPBAR ============ */}
      <div style={S.topbar}>
        <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
          <div style={S.brand}>
            <div style={S.logo}>N</div>
            <span>numio</span>
            <span style={{ color: inkMute, fontWeight: 400, fontSize: 12, marginLeft: 4, fontFamily: "JetBrains Mono, monospace" }}>/ acme-corp</span>
          </div>
          <div style={S.nav}>
            <div style={S.navItem(true)}>Overview</div>
            <div style={S.navItem(false)}>Policies</div>
            <div style={S.navItem(false)}>Activity</div>
            <div style={S.navItem(false)}>Resources</div>
            <div style={S.navItem(false)}>Budgets</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: inkSoft, padding: "5px 10px", border: `1px solid ${line}`, borderRadius: 6 }}>
            <div style={{ width: 6, height: 6, borderRadius: 3, background: good }}></div>
            <span style={{ fontFamily: "JetBrains Mono, monospace" }}>agent · live</span>
          </div>
          <div style={{ width: 28, height: 28, borderRadius: 14, background: accentSoft, color: accent, display: "grid", placeItems: "center", fontSize: 11, fontWeight: 600 }}>JM</div>
        </div>
      </div>

      <div style={S.body}>
        {/* ============ MAIN ============ */}
        <div style={S.main}>
          {/* Title row */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 20 }}>
            <div>
              <div style={{ fontSize: 11, color: inkMute, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>May 2026 · month-to-date</div>
              <h1 style={{ fontSize: 26, fontWeight: 500, letterSpacing: "-0.02em", margin: 0 }}>Cloud spend overview</h1>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button style={S.btn("ghost")}>Export</button>
              <button style={S.btn("primary")}>+ New policy</button>
            </div>
          </div>

          {/* Hero strip */}
          <div style={S.heroRow}>
            <div style={S.heroCell}>
              <div style={S.heroLabel}>Spend month-to-date</div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
                <div style={S.heroValue}>{fmtUSD(MOCK.totalSpend)}</div>
                <div style={{ fontSize: 12, color: good, fontFamily: "JetBrains Mono, monospace" }}>−9.2% vs last mo</div>
              </div>
              <div style={{ marginTop: 12 }}>
                <Sparkline data={series} w={260} h={36} stroke={accent} fill={accentSoft} />
              </div>
            </div>
            <div style={S.heroCell}>
              <div style={S.heroLabel}>Forecast EOM</div>
              <div style={S.heroValue}>{fmtUSD(MOCK.forecast)}</div>
              <div style={S.heroSub}>{fmtUSD(MOCK.budget - MOCK.forecast)} under budget</div>
            </div>
            <div style={S.heroCell}>
              <div style={S.heroLabel}>Saved by agent</div>
              <div style={{ ...S.heroValue, color: good }}>{fmtUSD(MOCK.savedThisMonth)}</div>
              <div style={S.heroSub}>across 38 actions</div>
            </div>
            <div style={S.heroCell}>
              <div style={S.heroLabel}>Pending approvals</div>
              <div style={S.heroValue}>{MOCK.pendingActions}</div>
              <div style={S.heroSub}>oldest: 14m ago</div>
            </div>
          </div>

          {/* Alert banner */}
          {MOCK.alerts[0] && (
            <div style={{ display: "flex", gap: 12, padding: "12px 16px", background: warnSoft, border: `1px solid oklch(${dark ? 0.45 : 0.86} 0.07 70)`, borderRadius: 8, marginBottom: 16, alignItems: "center" }}>
              <div style={{ width: 6, height: 6, borderRadius: 3, background: warn, flexShrink: 0 }}></div>
              <div style={{ fontSize: 13, color: ink, flex: 1 }}>
                <span style={{ fontWeight: 500 }}>GKE prod-east-1</span> trending +12.4% — forecast breaches Q2 budget on{" "}
                <span style={{ fontFamily: "JetBrains Mono, monospace" }}>May 19</span>.
              </div>
              <button style={{ ...S.btn("ghost"), borderColor: "transparent", background: "transparent", color: ink, fontSize: 12 }}>Investigate →</button>
            </div>
          )}

          {/* Big chart */}
          <div style={S.card}>
            <div style={S.cardHeader}>
              <div>
                <div style={S.cardTitle}>Daily spend</div>
                <div style={S.cardSub}>All providers · USD</div>
              </div>
              <div style={S.rangeRow}>
                {["7d", "30d", "90d", "MTD", "QTD"].map(r => (
                  <div key={r} style={S.rangeBtn(range === r)} onClick={() => setRange(r)}>{r}</div>
                ))}
              </div>
            </div>
            <AreaChart data={series} w={920} h={200} stroke={accent} fill={accentSoft} gridColor={lineSoft} />
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, fontSize: 11, color: inkMute, fontFamily: "JetBrains Mono, monospace" }}>
              <span>Apr 4</span><span>Apr 11</span><span>Apr 18</span><span>Apr 25</span><span>May 2</span>
            </div>
          </div>

          {/* Services table */}
          <div style={S.card}>
            <div style={S.cardHeader}>
              <div>
                <div style={S.cardTitle}>Top services</div>
                <div style={S.cardSub}>Sorted by 30-day spend</div>
              </div>
              <div style={{ fontSize: 12, color: inkSoft }}>6 of 47</div>
            </div>
            <table style={S.tbl}>
              <thead>
                <tr>
                  <th style={S.th}>Service</th>
                  <th style={{ ...S.th, width: 70 }}>Cloud</th>
                  <th style={{ ...S.th, textAlign: "right" }}>30d spend</th>
                  <th style={{ ...S.th, textAlign: "right", width: 90 }}>Δ wk/wk</th>
                  <th style={{ ...S.th, width: 120 }}>Trend</th>
                  <th style={{ ...S.th, width: 80 }}></th>
                </tr>
              </thead>
              <tbody>
                {MOCK.services.map((s, i) => (
                  <tr key={i} style={{ cursor: "pointer" }}>
                    <td style={S.td}>{s.name}</td>
                    <td style={S.td}><ProviderGlyph p={s.provider} color={inkSoft} /></td>
                    <td style={{ ...S.td, textAlign: "right", fontFamily: "JetBrains Mono, monospace" }}>{fmtUSD(s.spend)}</td>
                    <td style={{ ...S.td, textAlign: "right", fontFamily: "JetBrains Mono, monospace", color: s.delta < 0 ? good : s.delta > 5 ? warn : inkSoft }}>
                      {s.delta > 0 ? "+" : ""}{s.delta.toFixed(1)}%
                    </td>
                    <td style={S.td}><Sparkline data={s.trend} w={104} h={22} stroke={s.delta > 5 ? warn : s.delta < 0 ? good : inkMute} /></td>
                    <td style={{ ...S.td, color: inkMute, fontSize: 12 }}>Inspect →</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* ============ DRAWER ============ */}
        {drawerOpen && (
          <div style={S.drawer}>
            <div style={S.drawerHeader}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 500, display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ width: 6, height: 6, borderRadius: 3, background: good }}></span>
                  Co-pilot
                </div>
                <div style={{ fontSize: 11, color: inkMute, marginTop: 3, fontFamily: "JetBrains Mono, monospace" }}>{visibleProposals.length} proposals · {MOCK.policiesActive} policies</div>
              </div>
              <div onClick={() => setDrawerOpen(false)} style={{ fontSize: 18, color: inkMute, cursor: "pointer", lineHeight: 1, padding: 4 }}>×</div>
            </div>

            {/* Proposals list */}
            <div style={{ flex: 1, overflowY: "auto" }}>
              {visibleProposals.map(p => {
                const active = p.id === current?.id;
                return (
                  <div key={p.id} style={S.proposalCard(active)} onClick={() => { setSelectedProposal(p.id); setExpanded(active ? !expanded : true); }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ fontSize: 10, fontFamily: "JetBrains Mono, monospace", textTransform: "uppercase", color: sevColor(p.severity), background: sevBg(p.severity), padding: "2px 6px", borderRadius: 3, fontWeight: 600, letterSpacing: "0.04em" }}>{p.severity}</span>
                        <span style={{ fontSize: 11, color: inkMute, fontFamily: "JetBrains Mono, monospace" }}>{p.id}</span>
                      </div>
                      <span style={{ fontSize: 11, color: inkMute }}>{p.createdAt}</span>
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 6, lineHeight: 1.4 }}>{p.title}</div>
                    <div style={{ fontSize: 11, color: inkMute, fontFamily: "JetBrains Mono, monospace", marginBottom: 8 }}>{p.scope}</div>

                    {/* expanded reasoning */}
                    {active && expanded && (
                      <div style={{ background: surfaceAlt, padding: 12, borderRadius: 6, marginTop: 10, marginBottom: 10, border: `1px solid ${lineSoft}` }}>
                        <div style={{ fontSize: 10, color: inkMute, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8, fontWeight: 500 }}>Agent reasoning</div>
                        {p.reasoning.map((r, i) => (
                          <div key={i} style={{ fontSize: 12, color: inkSoft, marginBottom: 8, display: "flex", gap: 8, lineHeight: 1.5 }}>
                            <span style={{ color: inkMute, fontFamily: "JetBrains Mono, monospace", flexShrink: 0 }}>{String(i+1).padStart(2,'0')}</span>
                            <span>{r}</span>
                          </div>
                        ))}
                        <div style={{ display: "flex", gap: 12, marginTop: 12, paddingTop: 10, borderTop: `1px solid ${line}`, fontSize: 11, color: inkMute, fontFamily: "JetBrains Mono, monospace" }}>
                          <span>policy: <span style={{ color: ink }}>{p.policy}</span></span>
                          <span>•</span>
                          <span>save: <span style={{ color: good }}>{fmtUSD(p.saving)}/mo</span></span>
                        </div>
                      </div>
                    )}

                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div style={{ fontSize: 12, color: good, fontFamily: "JetBrains Mono, monospace", fontWeight: 500 }}>
                        save {fmtUSD(p.saving)}/mo
                      </div>
                      {active && (
                        <div style={{ display: "flex", gap: 6 }}>
                          <button style={{ ...S.btn("ghost"), padding: "5px 10px", fontSize: 11 }} onClick={(e) => { e.stopPropagation(); setDismissed(new Set([...dismissed, p.id])); }}>Dismiss</button>
                          <button style={{ ...S.btn("primary"), padding: "5px 10px", fontSize: 11, background: approved.has(p.id) ? good : ink, borderColor: approved.has(p.id) ? good : ink }} onClick={(e) => { e.stopPropagation(); setApproved(new Set([...approved, p.id])); }}>
                            {approved.has(p.id) ? "✓ Approved" : "Approve"}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
              {visibleProposals.length === 0 && (
                <div style={{ padding: 40, textAlign: "center", color: inkMute, fontSize: 12 }}>All caught up.</div>
              )}
            </div>

            {/* footer chat input */}
            <div style={{ borderTop: `1px solid ${line}`, padding: 12, background: surfaceAlt }}>
              <div style={{ display: "flex", gap: 8, padding: "8px 12px", background: surface, border: `1px solid ${line}`, borderRadius: 6, fontSize: 12, color: inkMute, fontFamily: "JetBrains Mono, monospace" }}>
                <span style={{ color: accent }}>{">"}</span>
                <span>ask numio about a service, region, or policy…</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* floating button when drawer closed */}
      {!drawerOpen && (
        <div onClick={() => setDrawerOpen(true)} style={{ position: "absolute", bottom: 24, right: 24, padding: "10px 14px", background: ink, color: paper, borderRadius: 999, fontSize: 12, fontWeight: 500, cursor: "pointer", display: "flex", alignItems: "center", gap: 8, boxShadow: "0 4px 12px rgba(0,0,0,0.15)" }}>
          <span style={{ width: 6, height: 6, borderRadius: 3, background: good }}></span>
          Co-pilot · {visibleProposals.length}
        </div>
      )}
    </div>
  );
};

window.DirectionA = DirectionA;
