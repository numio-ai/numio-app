import React, { useState } from "react";
import { Play, Pencil, Trash2, Save } from "lucide-react";

/**
 * Side panel listing saved queries with Run / Rename / Delete, and a
 * "Save current" button at the top that opens an inline name+description form.
 */
export default function SavedQueriesPanel({
  queries,
  loading,
  error,
  currentSql,
  onRun,
  onSave,
  onRename,
  onDelete,
}) {
  const [saveOpen, setSaveOpen] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [saveDescription, setSaveDescription] = useState("");
  const [saveError, setSaveError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [renamingId, setRenamingId] = useState(null);
  const [renameValue, setRenameValue] = useState("");
  const [renameError, setRenameError] = useState(null);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaveError(null);
    if (!saveName.trim()) {
      setSaveError("Name is required");
      return;
    }
    if (!currentSql.trim()) {
      setSaveError("Editor is empty — write a query first");
      return;
    }
    setSaving(true);
    try {
      await onSave({
        name: saveName.trim(),
        sql: currentSql,
        description: saveDescription.trim() || null,
      });
      setSaveOpen(false);
      setSaveName("");
      setSaveDescription("");
    } catch (err) {
      setSaveError(err.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const startRename = (q) => {
    setRenamingId(q.id);
    setRenameValue(q.name);
    setRenameError(null);
  };

  const submitRename = async (q) => {
    setRenameError(null);
    const newName = renameValue.trim();
    if (!newName || newName === q.name) {
      setRenamingId(null);
      return;
    }
    try {
      await onRename(q.id, newName);
      setRenamingId(null);
    } catch (err) {
      setRenameError(err.message || "Rename failed");
    }
  };

  return (
    <aside
      className="dx-saved-panel"
      style={{
        width: 300,
        flexShrink: 0,
        borderLeft: "1px solid #e5e7eb",
        padding: "12px 14px",
        overflowY: "auto",
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <h3 style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "#374151" }}>Saved queries</h3>
        <button
          type="button"
          onClick={() => setSaveOpen((v) => !v)}
          aria-label="Save current query"
          title="Save current query"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            padding: "4px 8px",
            background: "#111827",
            color: "#fff",
            border: "none",
            borderRadius: 4,
            fontSize: 12,
            cursor: "pointer",
          }}
        >
          <Save size={12} strokeWidth={2} />
          Save current
        </button>
      </div>

      {saveOpen && (
        <form
          onSubmit={handleSave}
          style={{
            background: "#f9fafb",
            border: "1px solid #e5e7eb",
            borderRadius: 6,
            padding: 10,
            display: "flex",
            flexDirection: "column",
            gap: 6,
          }}
        >
          <input
            type="text"
            placeholder="Name"
            value={saveName}
            onChange={(e) => setSaveName(e.target.value)}
            maxLength={120}
            autoFocus
            aria-label="Saved query name"
            style={{
              padding: "6px 8px",
              border: "1px solid #d1d5db",
              borderRadius: 4,
              fontSize: 13,
            }}
          />
          <textarea
            placeholder="Description (optional)"
            value={saveDescription}
            onChange={(e) => setSaveDescription(e.target.value)}
            rows={2}
            aria-label="Saved query description"
            style={{
              padding: "6px 8px",
              border: "1px solid #d1d5db",
              borderRadius: 4,
              fontSize: 12,
              fontFamily: "inherit",
              resize: "vertical",
            }}
          />
          {saveError && (
            <div role="alert" style={{ color: "#b91c1c", fontSize: 12 }}>
              {saveError}
            </div>
          )}
          <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
            <button
              type="button"
              onClick={() => setSaveOpen(false)}
              style={{
                padding: "4px 10px",
                background: "transparent",
                border: "1px solid #d1d5db",
                borderRadius: 4,
                fontSize: 12,
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              style={{
                padding: "4px 10px",
                background: "#111827",
                color: "#fff",
                border: "none",
                borderRadius: 4,
                fontSize: 12,
                cursor: saving ? "wait" : "pointer",
              }}
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      )}

      {loading && <div style={{ fontSize: 12, color: "#6b7280" }}>Loading…</div>}
      {error && (
        <div role="alert" style={{ fontSize: 12, color: "#b91c1c" }}>
          {error}
        </div>
      )}

      {!loading && queries.length === 0 && !error && (
        <div style={{ fontSize: 12, color: "#9ca3af", padding: "12px 0" }}>
          No saved queries yet.
        </div>
      )}

      <ul
        style={{
          listStyle: "none",
          padding: 0,
          margin: 0,
          display: "flex",
          flexDirection: "column",
          gap: 4,
        }}
      >
        {queries.map((q) => {
          const isRenaming = renamingId === q.id;
          return (
            <li
              key={q.id}
              data-testid={`saved-query-${q.id}`}
              style={{
                border: "1px solid #e5e7eb",
                borderRadius: 6,
                padding: 8,
                display: "flex",
                flexDirection: "column",
                gap: 4,
              }}
            >
              {isRenaming ? (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    submitRename(q);
                  }}
                  style={{ display: "flex", flexDirection: "column", gap: 4 }}
                >
                  <input
                    type="text"
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    maxLength={120}
                    autoFocus
                    aria-label={`Rename ${q.name}`}
                    style={{
                      padding: "4px 6px",
                      border: "1px solid #d1d5db",
                      borderRadius: 4,
                      fontSize: 13,
                    }}
                  />
                  {renameError && (
                    <div role="alert" style={{ color: "#b91c1c", fontSize: 11 }}>
                      {renameError}
                    </div>
                  )}
                  <div style={{ display: "flex", gap: 4, justifyContent: "flex-end" }}>
                    <button
                      type="button"
                      onClick={() => setRenamingId(null)}
                      style={{
                        padding: "2px 8px",
                        background: "transparent",
                        border: "1px solid #d1d5db",
                        borderRadius: 4,
                        fontSize: 11,
                        cursor: "pointer",
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      style={{
                        padding: "2px 8px",
                        background: "#111827",
                        color: "#fff",
                        border: "none",
                        borderRadius: 4,
                        fontSize: 11,
                        cursor: "pointer",
                      }}
                    >
                      Save
                    </button>
                  </div>
                </form>
              ) : (
                <>
                  <div style={{ fontSize: 13, fontWeight: 500, color: "#111827", wordBreak: "break-word" }}>
                    {q.name}
                  </div>
                  {q.description && (
                    <div style={{ fontSize: 11, color: "#6b7280", wordBreak: "break-word" }}>
                      {q.description}
                    </div>
                  )}
                  <div style={{ display: "flex", gap: 4, marginTop: 2 }}>
                    <button
                      type="button"
                      onClick={() => onRun(q)}
                      title="Run"
                      aria-label={`Run ${q.name}`}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 3,
                        padding: "3px 8px",
                        background: "#f3f4f6",
                        border: "1px solid #d1d5db",
                        borderRadius: 4,
                        fontSize: 11,
                        cursor: "pointer",
                      }}
                    >
                      <Play size={11} /> Run
                    </button>
                    <button
                      type="button"
                      onClick={() => startRename(q)}
                      title="Rename"
                      aria-label={`Rename ${q.name}`}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 3,
                        padding: "3px 8px",
                        background: "#f3f4f6",
                        border: "1px solid #d1d5db",
                        borderRadius: 4,
                        fontSize: 11,
                        cursor: "pointer",
                      }}
                    >
                      <Pencil size={11} /> Rename
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(q)}
                      title="Delete"
                      aria-label={`Delete ${q.name}`}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 3,
                        padding: "3px 8px",
                        background: "#fef2f2",
                        border: "1px solid #fecaca",
                        color: "#b91c1c",
                        borderRadius: 4,
                        fontSize: 11,
                        cursor: "pointer",
                      }}
                    >
                      <Trash2 size={11} /> Delete
                    </button>
                  </div>
                </>
              )}
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
