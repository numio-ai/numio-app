import React, { useEffect, useState } from "react";
import { listUsers, inviteUser, updateUser } from "../../api/workspace";
import { useAuth } from "../../context/AuthContext";
import { execCardClass, execHeaderClass } from "../../constants/designTokens";

export default function People() {
  const { user: currentUser } = useAuth();
  const isAdmin = currentUser?.role === "admin";

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Invite form
  const [showInvite, setShowInvite] = useState(false);
  const [inviteForm, setInviteForm] = useState({ email: "", name: "", role: "viewer" });
  const [inviting, setInviting] = useState(false);

  const loadUsers = async () => {
    try {
      const data = await listUsers();
      setUsers(data.users);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadUsers(); }, []);

  const handleInvite = async () => {
    setInviting(true);
    setError(null);
    try {
      await inviteUser(inviteForm.email, inviteForm.name, inviteForm.role);
      setShowInvite(false);
      setInviteForm({ email: "", name: "", role: "viewer" });
      await loadUsers();
    } catch (e) {
      setError(e.message);
    } finally {
      setInviting(false);
    }
  };

  const handleRoleChange = async (userId, newRole) => {
    try {
      await updateUser(userId, { role: newRole });
      await loadUsers();
    } catch (e) {
      setError(e.message);
    }
  };

  const handleDeactivate = async (userId, isActive) => {
    try {
      await updateUser(userId, { is_active: !isActive });
      await loadUsers();
    } catch (e) {
      setError(e.message);
    }
  };

  const initials = (name) => name?.split(" ").map((n) => n[0]).join("").substring(0, 2).toUpperCase() || "?";

  if (loading) {
    return <div style={{ padding: 24, color: "var(--text-tertiary)" }}>Loading users...</div>;
  }

  return (
    <div className="pageContent settings-page-content">
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 style={{ fontSize: 16, fontWeight: 500, color: "var(--text-primary)", margin: 0 }}>People</h1>
          <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4 }}>
            Manage workspace members and roles.
          </p>
        </div>
        {isAdmin && (
          <button className="btn btn--primary btn--sm" onClick={() => setShowInvite(!showInvite)}>
            + Invite Member
          </button>
        )}
      </div>

      {error && <p className="text-xs mb-3" style={{ color: "var(--danger)" }}>{error}</p>}

      {/* Invite form */}
      {showInvite && (
        <section
          className={execCardClass}
          style={{ marginBottom: 24, borderColor: "var(--primary)", borderRadius: "var(--radius-lg)", padding: "var(--card-padding)" }}
        >
          <p className={execHeaderClass}>INVITE NEW MEMBER</p>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            <div>
              <label className="text-xs block mb-1" style={{ color: "var(--text-tertiary)" }}>Email</label>
              <input
                className="formInput formInput--small w-full"
                value={inviteForm.email}
                onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
                placeholder="user@company.com"
                style={{ borderColor: "var(--border)" }}
              />
            </div>
            <div>
              <label className="text-xs block mb-1" style={{ color: "var(--text-tertiary)" }}>Name</label>
              <input
                className="formInput formInput--small w-full"
                value={inviteForm.name}
                onChange={(e) => setInviteForm({ ...inviteForm, name: e.target.value })}
                placeholder="Full Name"
                style={{ borderColor: "var(--border)" }}
              />
            </div>
            <div>
              <label className="text-xs block mb-1" style={{ color: "var(--text-tertiary)" }}>Role</label>
              <select
                className="formInput formInput--small w-full"
                value={inviteForm.role}
                onChange={(e) => setInviteForm({ ...inviteForm, role: e.target.value })}
                style={{ borderColor: "var(--border)" }}
              >
                <option value="viewer">Viewer</option>
                <option value="editor">Editor</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <button className="btn btn--primary btn--sm" onClick={handleInvite} disabled={inviting}>
              {inviting ? "Inviting..." : "Send Invite"}
            </button>
          </div>
        </section>
      )}

      {/* Members table */}
      <section
        className={execCardClass}
        style={{ borderColor: "var(--border)", borderRadius: "var(--radius-lg)", padding: "var(--card-padding)" }}
      >
        <p className={execHeaderClass}>ALL MEMBERS ({users.length})</p>
        <div className="rounded-lg border overflow-hidden" style={{ borderColor: "var(--border)" }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: "var(--bg-inset)", borderBottom: "1px solid var(--border)" }}>
                <th className="text-left px-4 py-3 font-semibold" style={{ color: "var(--text-tertiary)", fontSize: 11 }}>MEMBER</th>
                <th className="text-left px-4 py-3 font-semibold" style={{ color: "var(--text-tertiary)", fontSize: 11 }}>ROLE</th>
                <th className="text-left px-4 py-3 font-semibold" style={{ color: "var(--text-tertiary)", fontSize: 11 }}>STATUS</th>
                {isAdmin && (
                  <th className="text-left px-4 py-3 font-semibold" style={{ color: "var(--text-tertiary)", fontSize: 11 }}>ACTIONS</th>
                )}
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} style={{ borderBottom: "1px solid var(--border)" }}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold shrink-0"
                        style={{ background: u.role === "admin" ? "var(--primary)" : "var(--bg-inset)", color: u.role === "admin" ? "#fff" : "var(--text)" }}
                      >
                        {initials(u.name)}
                      </div>
                      <div>
                        <span className="font-medium" style={{ color: "var(--text)" }}>{u.name}</span>
                        <br />
                        <span className="text-xs" style={{ color: "var(--text-tertiary)" }}>{u.email}</span>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {isAdmin && u.id !== currentUser?.id ? (
                      <select
                        className="formInput formInput--small"
                        value={u.role}
                        onChange={(e) => handleRoleChange(u.id, e.target.value)}
                        style={{ borderColor: "var(--border)", fontSize: 12 }}
                      >
                        <option value="viewer">Viewer</option>
                        <option value="editor">Editor</option>
                        <option value="admin">Admin</option>
                      </select>
                    ) : (
                      <span className="badge">{u.role}</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className="text-xs font-medium px-2 py-1 rounded-full"
                      style={{
                        background: u.is_active ? "var(--success-bg, #ecfdf5)" : "var(--bg-inset)",
                        color: u.is_active ? "var(--success, #059669)" : "var(--text-tertiary)",
                      }}
                    >
                      {u.is_active ? "Active" : "Deactivated"}
                    </span>
                  </td>
                  {isAdmin && (
                    <td className="px-4 py-3">
                      {u.id !== currentUser?.id && (
                        <button
                          className="btn btn--ghost btn--sm"
                          onClick={() => handleDeactivate(u.id, u.is_active)}
                        >
                          {u.is_active ? "Deactivate" : "Reactivate"}
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={isAdmin ? 4 : 3} className="px-4 py-8 text-center" style={{ color: "var(--text-tertiary)" }}>
                    No users found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
