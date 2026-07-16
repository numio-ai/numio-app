import React, { useCallback, useEffect, useState } from "react";
import { Play } from "lucide-react";
import {
  runQuery,
  listSavedQueries,
  createSavedQuery,
  updateSavedQuery,
  deleteSavedQuery,
} from "../../api/dataExplorer";
import ResultTable from "./ResultTable";
import SavedQueriesPanel from "./SavedQueriesPanel";

const HTTP_HINTS = {
  400: "Invalid SQL",
  403: "Permission denied",
  408: "Statement timeout",
  413: "Query too large",
  422: "Validation error",
};

export default function DataExplorerPage() {
  const [sql, setSql] = useState("SELECT slug, name FROM workspaces ORDER BY slug;");
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const [queries, setQueries] = useState([]);
  const [savedLoading, setSavedLoading] = useState(true);
  const [savedError, setSavedError] = useState(null);

  const reloadSaved = useCallback(async () => {
    setSavedLoading(true);
    setSavedError(null);
    try {
      const data = await listSavedQueries();
      setQueries(data.items);
    } catch (err) {
      setSavedError(err.message || "Failed to load saved queries");
    } finally {
      setSavedLoading(false);
    }
  }, []);

  useEffect(() => {
    reloadSaved();
  }, [reloadSaved]);

  const runCurrent = useCallback(
    async (sqlToRun = sql) => {
      if (!sqlToRun.trim()) {
        setError({ message: "Editor is empty", status: null, errorCode: null });
        setResult(null);
        return;
      }
      setRunning(true);
      setError(null);
      setResult(null);
      try {
        const data = await runQuery(sqlToRun);
        setResult(data);
      } catch (err) {
        setError({
          message: err.message,
          status: err.status,
          errorCode: err.errorCode,
        });
      } finally {
        setRunning(false);
      }
    },
    [sql],
  );

  const handleEditorKeyDown = (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      runCurrent();
    }
  };

  const handleRunSaved = useCallback(
    async (q) => {
      setSql(q.sql);
      await runCurrent(q.sql);
    },
    [runCurrent],
  );

  const handleSave = useCallback(
    async ({ name, sql: sqlBody, description }) => {
      await createSavedQuery({ name, sql: sqlBody, description });
      await reloadSaved();
    },
    [reloadSaved],
  );

  const handleRename = useCallback(
    async (id, newName) => {
      await updateSavedQuery(id, { name: newName });
      await reloadSaved();
    },
    [reloadSaved],
  );

  const handleDelete = useCallback(
    async (q) => {
      if (!window.confirm(`Delete saved query "${q.name}"?`)) return;
      await deleteSavedQuery(q.id);
      await reloadSaved();
    },
    [reloadSaved],
  );

  return (
    <div
      className="dx-page"
      style={{ display: "flex", height: "100%", minHeight: 0, background: "#fff" }}
    >
      <div
        className="dx-main"
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          minWidth: 0,
          padding: "16px 20px",
          overflow: "auto",
        }}
      >
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
          <h1 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: "#111827" }}>Data Explorer</h1>
          <span style={{ fontSize: 12, color: "#6b7280" }}>
            Read-only SELECT queries against the Numio database. ⌘/Ctrl+Enter to run.
          </span>
        </div>

        <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
          <textarea
            aria-label="SQL editor"
            value={sql}
            onChange={(e) => setSql(e.target.value)}
            onKeyDown={handleEditorKeyDown}
            spellCheck={false}
            rows={8}
            style={{
              width: "100%",
              padding: 10,
              border: "1px solid #d1d5db",
              borderRadius: 6,
              fontSize: 13,
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
              resize: "vertical",
              minHeight: 140,
            }}
          />
          <div>
            <button
              type="button"
              onClick={() => runCurrent()}
              disabled={running}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "6px 14px",
                background: "#111827",
                color: "#fff",
                border: "none",
                borderRadius: 6,
                fontSize: 13,
                fontWeight: 500,
                cursor: running ? "wait" : "pointer",
              }}
            >
              <Play size={13} strokeWidth={2} />
              {running ? "Running…" : "Run"}
            </button>
          </div>
        </div>

        <div style={{ marginTop: 16, flex: 1, minHeight: 0 }}>
          {error && (
            <div
              role="alert"
              data-testid="dx-error"
              style={{
                background: "#fef2f2",
                border: "1px solid #fecaca",
                color: "#991b1b",
                padding: "10px 12px",
                borderRadius: 6,
                fontSize: 13,
              }}
            >
              <div style={{ fontWeight: 600, marginBottom: 4 }}>
                {error.status ? `${error.status} · ${HTTP_HINTS[error.status] || "Error"}` : "Error"}
                {error.errorCode ? ` (${error.errorCode})` : ""}
              </div>
              <div style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 12 }}>
                {error.message}
              </div>
            </div>
          )}
          {!error && result && <ResultTable result={result} />}
          {!error && !result && !running && (
            <div style={{ color: "#9ca3af", fontSize: 13 }}>
              Run a query to see results here.
            </div>
          )}
        </div>
      </div>

      <SavedQueriesPanel
        queries={queries}
        loading={savedLoading}
        error={savedError}
        currentSql={sql}
        onRun={handleRunSaved}
        onSave={handleSave}
        onRename={handleRename}
        onDelete={handleDelete}
      />
    </div>
  );
}
