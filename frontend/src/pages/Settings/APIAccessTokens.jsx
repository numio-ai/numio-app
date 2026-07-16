import React, { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { listMyApiKeys, createApiKey, revokeMyApiKey, listAllApiKeys, revokeAnyApiKey } from "../../api/workspace";
import { execCardClass, execHeaderClass } from "../../constants/designTokens";

const tabs = [
  { id: "personal", label: "My API Keys" },
  { id: "admin", label: "All Keys (Admin)" },
];

export default function APIAccessTokens() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [activeTab, setActiveTab] = useState("personal");
  const [keys, setKeys] = useState([]);
  const [allKeys, setAllKeys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [createdKey, setCreatedKey] = useState(null);
  const [creating, setCreating] = useState(false);

  const loadKeys = async () => {
    setLoading(true);
    try {
      const data = await listMyApiKeys();
      setKeys(data.keys);
      if (isAdmin) {
        const all = await listAllApiKeys();
        setAllKeys(all.keys);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadKeys(); }, []);

  const handleCreate = async () => {
    setCreating(true);
    setError(null);
    try {
      const result = await createApiKey(newKeyName);
      setCreatedKey(result);
      setNewKeyName("");
      setShowCreate(false);
      await loadKeys();
    } catch (e) {
      setError(e.message);
    } finally {
      setCreating(false);
    }
  };

  const handleRevoke = async (keyId, isAdminAction) => {
    try {
      if (isAdminAction) {
        await revokeAnyApiKey(keyId);
      } else {
        await revokeMyApiKey(keyId);
      }
      setCreatedKey(null);
      await loadKeys();
    } catch (e) {
      setError(e.message);
    }
  };

  const formatDate = (d) => d ? new Date(d).toLocaleDateString() : "Never";

  const currentKeys = activeTab === "personal" ? keys : allKeys;

  return (
    <div className="pageContent settings-page-content">
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 style={{ fontSize: 16, fontWeight: 500, color: "var(--text-primary)", margin: 0 }}>API Access Tokens</h1>
          <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4 }}>
            Generate tokens for programmatic access to the Numio API.
          </p>
        </div>
      </div>

      {error && <p className="text-xs mb-3" style={{ color: "var(--danger)" }}>{error}</p>}

      {/* Created key banner */}
      {createdKey && (
        <section
          className="py-3 px-4 rounded-xl border mb-6"
          style={{ borderColor: "var(--success, #059669)", background: "var(--success-bg, #ecfdf5)" }}
        >
          <p className="text-xs font-semibold mb-1" style={{ color: "var(--success, #059669)" }}>
            API key created! Copy it now — it won't be shown again.
          </p>
          <div className="flex items-center gap-2">
            <code className="text-sm px-2 py-1 rounded flex-1" style={{ background: "#fff", border: "1px solid var(--border)" }}>
              {createdKey.key}
            </code>
            <button
              className="btn btn--outline btn--sm"
              onClick={() => { navigator.clipboard.writeText(createdKey.key); }}
            >
              Copy
            </button>
          </div>
        </section>
      )}

      {/* Tabs */}
      {isAdmin && (
        <div className="flex gap-1 mb-6 border-b" style={{ borderColor: "var(--border)" }}>
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className="px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors"
              style={{
                color: activeTab === tab.id ? "var(--primary)" : "var(--text-tertiary)",
                borderBottom: activeTab === tab.id ? "2px solid var(--primary)" : "2px solid transparent",
                marginBottom: -1,
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}

      <section
        className={execCardClass}
        style={{ borderColor: "var(--border)", borderRadius: "var(--radius-lg)", padding: "var(--card-padding)" }}
      >
        <div className="flex justify-between items-center mb-4">
          <p className={execHeaderClass} style={{ marginBottom: 0 }}>
            {activeTab === "personal" ? "MY API KEYS" : "ALL WORKSPACE KEYS"}
          </p>
          {activeTab === "personal" && (
            <button className="btn btn--primary btn--sm" onClick={() => setShowCreate(!showCreate)}>
              + Create Key
            </button>
          )}
        </div>

        {showCreate && (
          <div className="flex gap-3 items-end mb-4 p-3 rounded-lg border" style={{ borderColor: "var(--border)" }}>
            <div className="flex-1">
              <label className="text-xs block mb-1" style={{ color: "var(--text-tertiary)" }}>Key Name</label>
              <input
                className="formInput formInput--small w-full"
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
                placeholder="e.g. CI/CD Pipeline"
                style={{ borderColor: "var(--border)" }}
              />
            </div>
            <button className="btn btn--primary btn--sm" onClick={handleCreate} disabled={creating || !newKeyName}>
              {creating ? "Creating..." : "Create"}
            </button>
          </div>
        )}

        {loading ? (
          <p className="text-sm py-4" style={{ color: "var(--text-tertiary)" }}>Loading...</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: "var(--bg-inset)", borderBottom: "1px solid var(--border)" }}>
                  <th className="text-left px-4 py-3 font-semibold" style={{ color: "var(--text-tertiary)", fontSize: 11 }}>NAME</th>
                  <th className="text-left px-4 py-3 font-semibold" style={{ color: "var(--text-tertiary)", fontSize: 11 }}>PREFIX</th>
                  {activeTab === "admin" && (
                    <th className="text-left px-4 py-3 font-semibold" style={{ color: "var(--text-tertiary)", fontSize: 11 }}>OWNER</th>
                  )}
                  <th className="text-left px-4 py-3 font-semibold" style={{ color: "var(--text-tertiary)", fontSize: 11 }}>CREATED</th>
                  <th className="text-left px-4 py-3 font-semibold" style={{ color: "var(--text-tertiary)", fontSize: 11 }}>LAST USED</th>
                  <th className="text-left px-4 py-3 font-semibold" style={{ color: "var(--text-tertiary)", fontSize: 11 }}>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {currentKeys.length === 0 && (
                  <tr>
                    <td colSpan={activeTab === "admin" ? 6 : 5} className="px-4 py-8 text-center" style={{ color: "var(--text-tertiary)" }}>
                      No API keys found.
                    </td>
                  </tr>
                )}
                {currentKeys.map((k) => (
                  <tr key={k.id} style={{ borderBottom: "1px solid var(--border)" }}>
                    <td className="px-4 py-3" style={{ color: "var(--text)" }}>{k.name}</td>
                    <td className="px-4 py-3">
                      <code className="text-xs" style={{ color: "var(--text-secondary)" }}>{k.key_prefix}...</code>
                    </td>
                    {activeTab === "admin" && (
                      <td className="px-4 py-3" style={{ color: "var(--text-secondary)" }}>{k.user_email || "—"}</td>
                    )}
                    <td className="px-4 py-3" style={{ color: "var(--text-secondary)" }}>{formatDate(k.created_at)}</td>
                    <td className="px-4 py-3" style={{ color: "var(--text-secondary)" }}>{formatDate(k.last_used_at)}</td>
                    <td className="px-4 py-3">
                      <button
                        className="btn btn--ghost btn--sm"
                        style={{ color: "var(--danger)" }}
                        onClick={() => handleRevoke(k.id, activeTab === "admin")}
                      >
                        Revoke
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
