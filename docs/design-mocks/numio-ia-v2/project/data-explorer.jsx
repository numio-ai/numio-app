// Data Explorer — admin-only SQL workbench. Hi-fi prototype with working mock execution.

const DataExplorer = ({ tweaks = {} }) => {
  const { dark = false, density = "comfortable", accentHue = 275 } = tweaks;

  // ---- THEME (matches main dashboard) ----
  const ink = dark ? "oklch(0.96 0.005 95)" : "oklch(0.18 0.01 260)";
  const inkSoft = dark ? "oklch(0.78 0.005 95)" : "oklch(0.42 0.01 260)";
  const inkMute = dark ? "oklch(0.58 0.005 95)" : "oklch(0.62 0.01 260)";
  const paper = dark ? "oklch(0.16 0.01 260)" : "oklch(0.985 0.003 95)";
  const surface = dark ? "oklch(0.20 0.01 260)" : "oklch(1 0 0)";
  const surfaceAlt = dark ? "oklch(0.22 0.01 260)" : "oklch(0.97 0.003 95)";
  const editorBg = dark ? "oklch(0.13 0.01 260)" : "oklch(0.99 0.004 95)";
  const line = dark ? "oklch(0.30 0.01 260)" : "oklch(0.91 0.005 95)";
  const lineSoft = dark ? "oklch(0.26 0.01 260)" : "oklch(0.94 0.004 95)";
  const accent = `oklch(0.55 0.14 ${accentHue})`;
  const accentSoft = dark ? `oklch(0.30 0.06 ${accentHue})` : `oklch(0.94 0.04 ${accentHue})`;
  const good = "oklch(0.55 0.13 155)";
  const warn = "oklch(0.65 0.14 70)";
  const warnSoft = dark ? "oklch(0.32 0.06 70)" : "oklch(0.95 0.05 70)";
  const danger = "oklch(0.55 0.18 25)";
  const dangerSoft = dark ? "oklch(0.30 0.09 25)" : "oklch(0.96 0.04 25)";

  const rowH = density === "compact" ? 28 : 34;
  const cellPadY = density === "compact" ? 4 : 7;

  // ---- MOCK DATA TABLES ----
  const COST_RECORDS = useMemo(() => [
    { id: 91021, account: "aws://prod",     service: "EC2",        region: "us-east-1", amount_usd:  4218.42, billing_period: "2026-05", status: "confirmed" },
    { id: 91022, account: "aws://prod",     service: "RDS",        region: "us-east-1", amount_usd:  1840.10, billing_period: "2026-05", status: "confirmed" },
    { id: 91023, account: "aws://prod",     service: "S3",         region: "us-east-1", amount_usd:   612.88, billing_period: "2026-05", status: "confirmed" },
    { id: 91024, account: "gcp://prod",     service: "GKE",        region: "us-central1", amount_usd: 2104.30, billing_period: "2026-05", status: "confirmed" },
    { id: 91025, account: "gcp://prod",     service: "BigQuery",   region: "us-central1", amount_usd: 891.04, billing_period: "2026-05", status: "confirmed" },
    { id: 91026, account: "aws://dev",      service: "EC2",        region: "us-east-1", amount_usd:    -2.00, billing_period: "2026-05", status: "pending" },
    { id: 91027, account: "aws://sandbox",  service: "EC2",        region: "us-west-2", amount_usd:    18.40, billing_period: "2026-05", status: "pending" },
    { id: 91028, account: "az://prod",      service: "Functions",  region: "eastus",    amount_usd:   320.18, billing_period: "2026-05", status: "confirmed" },
    { id: 91029, account: "aws://prod",     service: "CloudFront", region: "global",    amount_usd:   188.21, billing_period: "2026-05", status: "confirmed" },
    { id: 91030, account: "gcp://sandbox",  service: "GKE",        region: "us-central1", amount_usd:    9.40, billing_period: "2026-05", status: "pending" },
  ], []);

  // ---- STATE ----
  const DEFAULT_QUERY = "SELECT id, account, service, amount_usd, status\nFROM cost_records\nWHERE billing_period = '2026-05' AND status = 'pending'\nORDER BY amount_usd ASC;";

  const [sql, setSql] = useState(DEFAULT_QUERY);
  const [result, setResult] = useState({
    columns: ["id", "account", "service", "amount_usd", "status"],
    rows: COST_RECORDS.filter(r => r.status === "pending").map(r => [r.id, r.account, r.service, r.amount_usd, r.status]),
    truncated: false,
    durationMs: 142,
    rowCount: 3,
    state: "ok", // ok | error | running
    error: null,
  });

  const [savedQueries, setSavedQueries] = useState([
    { id: "q1", name: "May pending tile breakdown", sql: DEFAULT_QUERY, author: "you", updated: "just now" },
    { id: "q2", name: "Top spend by service (30d)",
      sql: "SELECT service, SUM(amount_usd) AS spend\nFROM cost_records\nWHERE billing_period = '2026-05'\nGROUP BY service\nORDER BY spend DESC;",
      author: "morgan.l", updated: "2d ago" },
    { id: "q3", name: "Idle non-prod resources",
      sql: "SELECT id, account, service, last_active_at\nFROM resources\nWHERE account LIKE 'aws://dev%' AND cpu_pct_14d < 2\nORDER BY last_active_at ASC;",
      author: "sam.k", updated: "5d ago" },
    { id: "q4", name: "PR cost-regression candidates",
      sql: "SELECT pr_number, repo, projected_delta_usd\nFROM cost_signals\nWHERE projected_delta_usd > 1000\nORDER BY projected_delta_usd DESC;",
      author: "morgan.l", updated: "1w ago" },
  ]);
  const [activeSavedId, setActiveSavedId] = useState("q1");
  const [renamingId, setRenamingId] = useState(null);
  const [renameValue, setRenameValue] = useState("");
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [helpOpen, setHelpOpen] = useState(false);

  // ---- MOCK EXECUTION ----
  const runQuery = () => {
    const trimmed = sql.trim().replace(/;+$/g, "");
    const upper = trimmed.toUpperCase();

    setResult(r => ({ ...r, state: "running" }));

    setTimeout(() => {
      // 1) Read-only check (server actually does this via Postgres role; here we simulate the rejection)
      const writeKeywords = ["INSERT ", "UPDATE ", "DELETE ", "DROP ", "ALTER ", "CREATE ", "TRUNCATE ", "GRANT ", "REVOKE "];
      if (writeKeywords.some(k => upper.startsWith(k) || upper.includes(" " + k))) {
        setResult({
          columns: [], rows: [], truncated: false, durationMs: 12, rowCount: 0,
          state: "error",
          error: {
            code: "42501",
            title: "permission denied",
            detail: "ERROR: permission denied for relation — connection role 'numio_readonly' has SELECT-only grants on schema public.",
          },
        });
        return;
      }

      // 2) Bad parse — anything that doesn't start with SELECT or WITH
      if (!upper.startsWith("SELECT") && !upper.startsWith("WITH") && !upper.startsWith("EXPLAIN")) {
        setResult({
          columns: [], rows: [], truncated: false, durationMs: 8, rowCount: 0,
          state: "error",
          error: {
            code: "42601",
            title: "syntax error",
            detail: 'ERROR: syntax error at or near "' + (trimmed.split(/\s+/)[0] || "") + '"',
          },
        });
        return;
      }

      // 3) Simulated timeout if user adds pg_sleep
      if (upper.includes("PG_SLEEP")) {
        setResult({
          columns: [], rows: [], truncated: false, durationMs: 30000, rowCount: 0,
          state: "error",
          error: {
            code: "57014",
            title: "statement timeout",
            detail: "ERROR: canceling statement due to statement timeout — exceeded 30,000ms limit on numio_readonly.",
          },
        });
        return;
      }

      // 4) Otherwise: run a tiny mock interpreter against COST_RECORDS
      let cols, rows, truncated = false;
      const wantsAggregate = /SUM\s*\(|GROUP\s+BY/i.test(trimmed);

      if (wantsAggregate) {
        // Fake group-by service
        const grouped = {};
        COST_RECORDS.forEach(r => {
          grouped[r.service] = (grouped[r.service] || 0) + r.amount_usd;
        });
        cols = ["service", "spend"];
        rows = Object.entries(grouped)
          .sort((a, b) => b[1] - a[1])
          .map(([s, n]) => [s, Number(n.toFixed(2))]);
      } else if (/FROM\s+resources/i.test(trimmed)) {
        cols = ["id", "account", "service", "last_active_at"];
        rows = [
          [70114, "aws://dev",     "EC2",  "2026-04-21T03:42:00Z"],
          [70118, "aws://dev",     "EC2",  "2026-04-22T17:01:00Z"],
          [70133, "aws://sandbox", "RDS",  "2026-04-19T11:08:00Z"],
          [70140, "aws://dev",     "EBS",  "2026-04-20T02:55:00Z"],
        ];
      } else if (/FROM\s+cost_signals/i.test(trimmed)) {
        cols = ["pr_number", "repo", "projected_delta_usd"];
        rows = [
          [4821, "payments/service-ledger", 4310.00],
          [4798, "infra/observability",     2104.50],
          [4774, "ml/training-pipeline",    1820.00],
        ];
      } else {
        // SELECT against cost_records
        cols = ["id", "account", "service", "amount_usd", "status"];
        let filtered = COST_RECORDS;
        if (/status\s*=\s*'pending'/i.test(trimmed)) filtered = filtered.filter(r => r.status === "pending");
        if (/status\s*=\s*'confirmed'/i.test(trimmed)) filtered = filtered.filter(r => r.status === "confirmed");
        rows = filtered.map(r => [r.id, r.account, r.service, r.amount_usd, r.status]);
        if (/ORDER\s+BY\s+amount_usd\s+ASC/i.test(trimmed)) rows.sort((a, b) => a[3] - b[3]);
        if (/ORDER\s+BY\s+amount_usd\s+DESC/i.test(trimmed)) rows.sort((a, b) => b[3] - a[3]);
      }

      // 5) Truncation check (cap at 1000; demonstrate banner via flag for big SELECT * queries)
      if (/SELECT\s+\*/i.test(trimmed)) truncated = true;

      setResult({
        columns: cols, rows,
        truncated,
        durationMs: 80 + Math.floor(Math.random() * 240),
        rowCount: rows.length,
        state: "ok",
        error: null,
      });
    }, 320);
  };

  const loadSaved = (q) => {
    setActiveSavedId(q.id);
    setSql(q.sql);
  };

  const saveCurrent = () => {
    if (!saveName.trim()) return;
    const id = "q" + (savedQueries.length + 1);
    setSavedQueries([{ id, name: saveName, sql, author: "you", updated: "just now" }, ...savedQueries]);
    setActiveSavedId(id);
    setShowSaveDialog(false);
    setSaveName("");
  };

  const deleteSaved = (id) => {
    setSavedQueries(savedQueries.filter(q => q.id !== id));
    if (activeSavedId === id) setActiveSavedId(null);
  };

  const commitRename = () => {
    if (!renameValue.trim()) { setRenamingId(null); return; }
    setSavedQueries(savedQueries.map(q => q.id === renamingId ? { ...q, name: renameValue, updated: "just now" } : q));
    setRenamingId(null);
  };

  // ---- SQL syntax highlighting (cheap tokenizer) ----
  const KEYWORDS = ["SELECT","FROM","WHERE","GROUP","BY","ORDER","ASC","DESC","LIMIT","JOIN","LEFT","RIGHT","INNER","OUTER","ON","AS","AND","OR","NOT","NULL","IS","IN","SUM","COUNT","AVG","MIN","MAX","WITH","CASE","WHEN","THEN","ELSE","END","HAVING","DISTINCT","LIKE"];
  const highlightSQL = (text) => {
    const re = /('[^']*'|--[^\n]*|\b\d+(?:\.\d+)?\b|\b[A-Za-z_][A-Za-z0-9_]*\b|\s+|[^\s\w])/g;
    const out = [];
    let key = 0;
    text.replace(re, (m) => {
      if (m.startsWith("--")) out.push(<span key={key++} style={{ color: inkMute, fontStyle: "italic" }}>{m}</span>);
      else if (m.startsWith("'")) out.push(<span key={key++} style={{ color: good }}>{m}</span>);
      else if (/^\d/.test(m)) out.push(<span key={key++} style={{ color: warn }}>{m}</span>);
      else if (KEYWORDS.includes(m.toUpperCase())) out.push(<span key={key++} style={{ color: accent, fontWeight: 600 }}>{m}</span>);
      else out.push(<span key={key++}>{m}</span>);
      return m;
    });
    return out;
  };

  // ---- STYLES ----
  const S = {
    root: {
      width: 1440, minHeight: 1040,
      background: paper, color: ink,
      fontFamily: "Inter, system-ui, sans-serif",
      fontSize: 13, lineHeight: 1.5,
      letterSpacing: "-0.005em",
      display: "flex", flexDirection: "column",
    },
    topbar: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 28px", borderBottom: `1px solid ${line}`, background: surface },
    brand: { display: "flex", alignItems: "center", gap: 10, fontWeight: 600, fontSize: 15 },
    logo: { width: 22, height: 22, borderRadius: 6, background: ink, color: paper, display: "grid", placeItems: "center", fontFamily: "JetBrains Mono, monospace", fontSize: 11, fontWeight: 700 },
    nav: { display: "flex", gap: 4 },
    navItem: (active) => ({ padding: "6px 12px", borderRadius: 6, fontSize: 13, color: active ? ink : inkSoft, background: active ? surfaceAlt : "transparent", fontWeight: active ? 500 : 400, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }),
    adminBadge: { fontSize: 9, fontFamily: "JetBrains Mono, monospace", textTransform: "uppercase", letterSpacing: "0.06em", color: accent, background: accentSoft, padding: "2px 5px", borderRadius: 3, fontWeight: 600 },

    body: { display: "grid", gridTemplateColumns: "280px 1fr", flex: 1, minHeight: 0 },

    sidebar: { borderRight: `1px solid ${line}`, background: surface, display: "flex", flexDirection: "column", minHeight: 0 },
    sidebarHeader: { padding: "16px 18px 12px", borderBottom: `1px solid ${line}` },
    sidebarTitle: { fontSize: 12, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.06em", color: inkMute, marginBottom: 4 },
    sidebarSub: { fontSize: 11, color: inkMute, fontFamily: "JetBrains Mono, monospace" },

    savedItem: (active) => ({
      padding: "10px 18px", borderBottom: `1px solid ${lineSoft}`,
      borderLeft: `2px solid ${active ? accent : "transparent"}`,
      background: active ? surfaceAlt : "transparent",
      cursor: "pointer",
    }),
    savedName: { fontSize: 13, fontWeight: 500, marginBottom: 3, lineHeight: 1.4 },
    savedMeta: { fontSize: 11, color: inkMute, fontFamily: "JetBrains Mono, monospace", display: "flex", justifyContent: "space-between" },

    main: { display: "flex", flexDirection: "column", minHeight: 0, background: paper },
    mainHeader: { padding: "12px 28px", borderBottom: `1px solid ${line}`, background: surface, display: "flex", justifyContent: "space-between", alignItems: "center" },

    editorWrap: { padding: 28, paddingBottom: 0, display: "flex", flexDirection: "column", gap: 12 },
    editorChrome: { background: editorBg, border: `1px solid ${line}`, borderRadius: 10, overflow: "hidden", boxShadow: dark ? "none" : "0 1px 2px rgba(0,0,0,0.02)" },
    editorTabBar: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", background: surfaceAlt, borderBottom: `1px solid ${line}` },
    editorMeta: { fontSize: 11, color: inkMute, fontFamily: "JetBrains Mono, monospace", display: "flex", gap: 12 },

    editorBody: { position: "relative", display: "grid", gridTemplateColumns: "44px 1fr" },
    gutter: { padding: "12px 0", textAlign: "right", color: inkMute, fontSize: 12, fontFamily: "JetBrains Mono, monospace", borderRight: `1px solid ${lineSoft}`, background: editorBg, userSelect: "none", lineHeight: "20px" },
    codeLayer: { position: "relative", padding: "12px 16px", fontFamily: "JetBrains Mono, monospace", fontSize: 13, lineHeight: "20px", whiteSpace: "pre-wrap", wordBreak: "break-word", color: ink, minHeight: 160, pointerEvents: "none" },
    textarea: { position: "absolute", inset: 0, padding: "12px 16px", border: 0, background: "transparent", color: "transparent", caretColor: ink, font: "inherit", fontFamily: "JetBrains Mono, monospace", fontSize: 13, lineHeight: "20px", resize: "none", outline: "none", whiteSpace: "pre-wrap", wordBreak: "break-word" },

    runRow: { display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 4 },

    btn: (variant = "primary", disabled = false) => ({
      padding: "8px 16px", borderRadius: 6, fontSize: 12, fontWeight: 500,
      cursor: disabled ? "default" : "pointer", border: "1px solid",
      borderColor: variant === "primary" ? ink : line,
      background: variant === "primary" ? ink : surface,
      color: variant === "primary" ? paper : ink,
      opacity: disabled ? 0.5 : 1,
      display: "inline-flex", alignItems: "center", gap: 8,
    }),
    kbd: { fontSize: 10, fontFamily: "JetBrains Mono, monospace", padding: "1px 5px", borderRadius: 3, background: dark ? "oklch(0.30 0.01 260)" : "oklch(0.92 0.005 95)", color: inkSoft, border: `1px solid ${line}`, marginLeft: 6 },

    resultBlock: { padding: "16px 28px 28px", flex: 1, display: "flex", flexDirection: "column", minHeight: 0 },
    resultHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
    resultStat: { fontSize: 12, color: inkSoft, fontFamily: "JetBrains Mono, monospace", display: "flex", gap: 14 },

    tableWrap: { background: surface, border: `1px solid ${line}`, borderRadius: 10, overflow: "hidden", flex: 1, display: "flex", flexDirection: "column", minHeight: 0 },
    tableScroll: { overflow: "auto", flex: 1 },
    tbl: { width: "100%", borderCollapse: "collapse", fontSize: 12 },
    th: { textAlign: "left", padding: `8px 14px`, fontSize: 10, color: inkMute, textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600, borderBottom: `1px solid ${line}`, background: surfaceAlt, fontFamily: "JetBrains Mono, monospace", position: "sticky", top: 0 },
    td: { padding: `${cellPadY}px 14px`, borderBottom: `1px solid ${lineSoft}`, fontFamily: "JetBrains Mono, monospace", fontSize: 12, whiteSpace: "nowrap" },

    truncBanner: { display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", background: warnSoft, borderTop: `1px solid ${line}`, fontSize: 12, color: ink },
    errorPane: { background: dangerSoft, border: `1px solid ${danger}`, borderRadius: 10, padding: 18, display: "flex", flexDirection: "column", gap: 8 },

    rowNum: { color: inkMute, width: 36, fontVariantNumeric: "tabular-nums" },
  };

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
            <div style={S.navItem(false)}>Overview</div>
            <div style={S.navItem(false)}>Policies</div>
            <div style={S.navItem(false)}>Activity</div>
            <div style={S.navItem(false)}>Resources</div>
            <div style={S.navItem(false)}>Budgets</div>
            <div style={S.navItem(true)}>
              Data Explorer
              <span style={S.adminBadge}>admin</span>
            </div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: inkSoft, padding: "5px 10px", border: `1px solid ${line}`, borderRadius: 6 }}>
            <div style={{ width: 6, height: 6, borderRadius: 3, background: good }}></div>
            <span style={{ fontFamily: "JetBrains Mono, monospace" }}>numio_readonly · connected</span>
          </div>
          <div style={{ width: 28, height: 28, borderRadius: 14, background: accentSoft, color: accent, display: "grid", placeItems: "center", fontSize: 11, fontWeight: 600 }}>JM</div>
        </div>
      </div>

      <div style={S.body}>
        {/* ============ SAVED QUERIES SIDEBAR ============ */}
        <div style={S.sidebar}>
          <div style={S.sidebarHeader}>
            <div style={S.sidebarTitle}>Saved queries</div>
            <div style={S.sidebarSub}>{savedQueries.length} · shared with workspace</div>
          </div>
          <div style={{ flex: 1, overflowY: "auto" }}>
            {savedQueries.map(q => {
              const active = q.id === activeSavedId;
              const renaming = q.id === renamingId;
              return (
                <div key={q.id} style={S.savedItem(active)} onClick={() => !renaming && loadSaved(q)}>
                  {renaming ? (
                    <input
                      autoFocus
                      value={renameValue}
                      onChange={e => setRenameValue(e.target.value)}
                      onBlur={commitRename}
                      onKeyDown={e => { if (e.key === "Enter") commitRename(); if (e.key === "Escape") setRenamingId(null); }}
                      onClick={e => e.stopPropagation()}
                      style={{ width: "100%", padding: "4px 6px", border: `1px solid ${accent}`, borderRadius: 4, fontFamily: "Inter, sans-serif", fontSize: 13, fontWeight: 500, background: surface, color: ink, outline: "none", marginBottom: 4 }}
                    />
                  ) : (
                    <div style={S.savedName}>{q.name}</div>
                  )}
                  <div style={S.savedMeta}>
                    <span>{q.author} · {q.updated}</span>
                    {active && !renaming && (
                      <span style={{ display: "flex", gap: 8 }}>
                        <span onClick={e => { e.stopPropagation(); setRenamingId(q.id); setRenameValue(q.name); }} style={{ color: inkSoft, cursor: "pointer" }}>rename</span>
                        <span onClick={e => { e.stopPropagation(); deleteSaved(q.id); }} style={{ color: danger, cursor: "pointer" }}>del</span>
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{ padding: 14, borderTop: `1px solid ${line}` }}>
            <div style={{ fontSize: 11, color: inkMute, fontFamily: "JetBrains Mono, monospace", lineHeight: 1.6 }}>
              <div style={{ color: inkSoft, marginBottom: 4 }}># schema</div>
              <div>cost_records</div>
              <div>resources</div>
              <div>cost_signals</div>
              <div>budgets</div>
              <div>policies</div>
            </div>
          </div>
        </div>

        {/* ============ MAIN ============ */}
        <div style={S.main}>
          <div style={S.mainHeader}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <h1 style={{ fontSize: 18, fontWeight: 500, letterSpacing: "-0.02em", margin: 0 }}>Data Explorer</h1>
              <div
                onMouseEnter={() => setHelpOpen(true)}
                onMouseLeave={() => setHelpOpen(false)}
                style={{ position: "relative", display: "inline-flex" }}
              >
                <button
                  aria-label="About Data Explorer"
                  style={{
                    width: 18, height: 18, borderRadius: 9,
                    border: `1px solid ${line}`, background: surface,
                    color: inkSoft, fontSize: 11, fontWeight: 600,
                    fontFamily: "JetBrains Mono, monospace",
                    cursor: "help", display: "grid", placeItems: "center",
                    padding: 0, lineHeight: 1,
                  }}
                >?</button>
                {helpOpen && (
                  <div style={{
                    position: "absolute", top: "calc(100% + 8px)", left: -8, zIndex: 10,
                    width: 300, padding: 12,
                    background: surface, border: `1px solid ${line}`, borderRadius: 8,
                    boxShadow: dark ? "0 4px 16px rgba(0,0,0,0.4)" : "0 4px 16px rgba(0,0,0,0.08)",
                    fontSize: 12, color: inkSoft, lineHeight: 1.5,
                  }}>
                    SQL workbench against the Numio database. SELECT statements only — enforced by the <span style={{ fontFamily: "JetBrains Mono, monospace", color: ink }}>numio_readonly</span> Postgres role. 30s statement timeout, 1,000 row cap.
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ---- EDITOR ---- */}
          <div style={S.editorWrap}>
            <div style={S.editorChrome}>
              <div style={S.editorTabBar}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 11, fontFamily: "JetBrains Mono, monospace", color: inkSoft }}>query.sql</span>
                  <span style={{ fontSize: 10, fontFamily: "JetBrains Mono, monospace", color: accent, background: accentSoft, padding: "2px 6px", borderRadius: 3, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase" }}>SELECT only</span>
                </div>
                <div style={S.editorMeta}>
                  <span>timeout · 30s</span>
                  <span>row cap · 1,000</span>
                </div>
              </div>
              <div style={S.editorBody}>
                <div style={S.gutter}>
                  {sql.split("\n").map((_, i) => <div key={i} style={{ padding: "0 10px" }}>{i + 1}</div>)}
                </div>
                <div style={{ position: "relative" }}>
                  <div style={S.codeLayer}>{highlightSQL(sql)}{"\n"}</div>
                  <textarea
                    value={sql}
                    onChange={e => setSql(e.target.value)}
                    spellCheck={false}
                    style={S.textarea}
                    onKeyDown={e => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { e.preventDefault(); runQuery(); } }}
                  />
                </div>
              </div>
            </div>

            <div style={S.runRow}>
              <div style={{ display: "flex", gap: 8 }}>
                <button style={S.btn("primary", result.state === "running")} onClick={runQuery} disabled={result.state === "running"}>
                  {result.state === "running" ? (
                    <>
                      <span style={{ width: 10, height: 10, borderRadius: 5, border: `1.5px solid ${paper}`, borderTopColor: "transparent", animation: "spin 0.7s linear infinite", display: "inline-block" }}></span>
                      Running…
                    </>
                  ) : (
                    <>
                      <span style={{ fontFamily: "JetBrains Mono, monospace" }}>▸</span> Run
                      <span style={S.kbd}>⌘↵</span>
                    </>
                  )}
                </button>
                <button style={S.btn("ghost")} onClick={() => setShowSaveDialog(true)}>Save query…</button>
                <button style={S.btn("ghost")} onClick={() => setSql(DEFAULT_QUERY)}>Reset</button>
              </div>
              <div style={{ fontSize: 11, color: inkMute, fontFamily: "JetBrains Mono, monospace" }}>
                {sql.split("\n").length} lines · {sql.length} chars
              </div>
            </div>

            <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>

            {/* Save dialog */}
            {showSaveDialog && (
              <div style={{ background: surface, border: `1px solid ${accent}`, borderRadius: 10, padding: 16, display: "flex", gap: 10, alignItems: "center", marginTop: 4 }}>
                <span style={{ fontSize: 12, color: inkSoft }}>Name</span>
                <input
                  autoFocus
                  value={saveName}
                  onChange={e => setSaveName(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") saveCurrent(); if (e.key === "Escape") setShowSaveDialog(false); }}
                  placeholder="e.g. May pending tile breakdown"
                  style={{ flex: 1, padding: "8px 12px", border: `1px solid ${line}`, borderRadius: 6, fontSize: 13, fontFamily: "Inter, sans-serif", background: surface, color: ink, outline: "none" }}
                />
                <button style={S.btn("primary")} onClick={saveCurrent}>Save</button>
                <button style={S.btn("ghost")} onClick={() => setShowSaveDialog(false)}>Cancel</button>
              </div>
            )}
          </div>

          {/* ---- RESULT ---- */}
          <div style={S.resultBlock}>
            <div style={S.resultHeader}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ fontSize: 13, fontWeight: 500 }}>Results</span>
                {result.state === "ok" && (
                  <span style={S.resultStat}>
                    <span><span style={{ color: ink, fontWeight: 600 }}>{result.rowCount}</span> rows</span>
                    <span><span style={{ color: ink, fontWeight: 600 }}>{result.columns.length}</span> cols</span>
                    <span><span style={{ color: good, fontWeight: 600 }}>{result.durationMs}ms</span></span>
                  </span>
                )}
              </div>
              {result.state === "ok" && result.rows.length > 0 && (
                <div style={{ fontSize: 11, color: inkMute, fontFamily: "JetBrains Mono, monospace" }}>via numio_readonly</div>
              )}
            </div>

            {result.state === "error" ? (
              <div style={S.errorPane}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 10, fontFamily: "JetBrains Mono, monospace", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600, background: danger, color: paper, padding: "2px 6px", borderRadius: 3 }}>error</span>
                  <span style={{ fontSize: 11, color: danger, fontFamily: "JetBrains Mono, monospace" }}>SQLSTATE {result.error.code}</span>
                  <span style={{ fontSize: 13, fontWeight: 500 }}>{result.error.title}</span>
                </div>
                <div style={{ fontSize: 12, color: ink, fontFamily: "JetBrains Mono, monospace", whiteSpace: "pre-wrap", marginTop: 4 }}>{result.error.detail}</div>
              </div>
            ) : (
              <div style={S.tableWrap}>
                <div style={S.tableScroll}>
                  <table style={S.tbl}>
                    <thead>
                      <tr>
                        <th style={{ ...S.th, width: 40, textAlign: "right" }}>#</th>
                        {result.columns.map((c, i) => (
                          <th key={i} style={S.th}>{c}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {result.rows.map((row, i) => (
                        <tr key={i} style={{ background: i % 2 === 1 ? surfaceAlt : surface }}>
                          <td style={{ ...S.td, textAlign: "right", color: inkMute }}>{i + 1}</td>
                          {row.map((v, j) => {
                            const col = result.columns[j];
                            let display = v === null ? <span style={{ color: inkMute, fontStyle: "italic" }}>NULL</span> : String(v);
                            let color = ink;
                            if (col === "amount_usd" || col === "spend" || col === "projected_delta_usd") {
                              const num = Number(v);
                              display = (num < 0 ? "−" : "") + "$" + Math.abs(num).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                              color = num < 0 ? danger : ink;
                            }
                            if (col === "status" && v === "pending") {
                              display = <span style={{ color: warn, background: warnSoft, padding: "1px 6px", borderRadius: 3, fontSize: 11, fontWeight: 600 }}>pending</span>;
                            }
                            if (col === "status" && v === "confirmed") {
                              display = <span style={{ color: inkSoft, fontSize: 11 }}>confirmed</span>;
                            }
                            return <td key={j} style={{ ...S.td, color, textAlign: typeof v === "number" ? "right" : "left" }}>{display}</td>;
                          })}
                        </tr>
                      ))}
                      {result.rows.length === 0 && (
                        <tr><td style={{ ...S.td, padding: 32, textAlign: "center", color: inkMute, fontFamily: "Inter, sans-serif" }} colSpan={result.columns.length + 1}>No rows.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
                {result.truncated && (
                  <div style={S.truncBanner}>
                    <span style={{ width: 6, height: 6, borderRadius: 3, background: warn, flexShrink: 0 }}></span>
                    <span><strong>Result truncated.</strong> Showing first 1,000 rows. Add a <span style={{ fontFamily: "JetBrains Mono, monospace" }}>LIMIT</span> or narrow your <span style={{ fontFamily: "JetBrains Mono, monospace" }}>WHERE</span> to see the full set.</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

window.DataExplorer = DataExplorer;
