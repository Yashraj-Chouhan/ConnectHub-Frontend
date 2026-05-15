import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { adminApi } from "@/lib/api";

// ─── Small helper components ──────────────────────────────────────────────────

function Avatar({ user }) {
  const initials = (user.fullName || user.username || "?")
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="adm-avatar">
      {user.avatarUrl ? (
        <img src={user.avatarUrl} alt={user.username} />
      ) : (
        <span>{initials}</span>
      )}
    </div>
  );
}

function Badge({ label, color }) {
  return (
    <span className={`adm-badge adm-badge-${color}`}>{label}</span>
  );
}

function StatCard({ icon, label, value, accent }) {
  return (
    <div className="adm-stat" style={{ "--accent": accent }}>
      <div className="adm-stat-icon">{icon}</div>
      <div>
        <div className="adm-stat-value">{value}</div>
        <div className="adm-stat-label">{label}</div>
      </div>
    </div>
  );
}

// ─── Confirm dialog ───────────────────────────────────────────────────────────
function ConfirmDialog({ message, onConfirm, onCancel }) {
  return (
    <div className="adm-overlay" onClick={onCancel}>
      <div className="adm-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="adm-dialog-icon">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <line x1="12" y1="9" x2="12" y2="13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <line x1="12" y1="17" x2="12.01" y2="17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </div>
        <p className="adm-dialog-msg">{message}</p>
        <div className="adm-dialog-btns">
          <button className="adm-btn adm-btn-ghost" onClick={onCancel}>Cancel</button>
          <button className="adm-btn adm-btn-danger" onClick={onConfirm}>Confirm</button>
        </div>
      </div>
    </div>
  );
}

// ─── User detail slide-over ───────────────────────────────────────────────────
function UserDetail({ user, onClose, onBlock, onDelete, onChangeRole, loading }) {
  return (
    <div className="adm-overlay" onClick={onClose}>
      <div className="adm-slideover" onClick={(e) => e.stopPropagation()}>
        <button className="adm-slideover-close" onClick={onClose}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <line x1="18" y1="6" x2="6" y2="18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <line x1="6" y1="6" x2="18" y2="18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>

        <div className="adm-slideover-header">
          <div className="adm-slideover-avatar">
            <Avatar user={user} />
          </div>
          <div>
            <h2>{user.fullName || user.username}</h2>
            <p className="adm-slideover-un">@{user.username}</p>
          </div>
        </div>

        <div className="adm-detail-grid">
          <div className="adm-detail-row"><span>User ID</span><code>{user.userId}</code></div>
          <div className="adm-detail-row"><span>Email</span><b>{user.email}</b></div>
          <div className="adm-detail-row"><span>Phone</span><b>{user.phoneNumber || "—"}</b></div>
          <div className="adm-detail-row"><span>Role</span>
            <Badge label={user.role} color={user.role === "ADMIN" ? "purple" : "blue"} />
          </div>
          <div className="adm-detail-row"><span>Status</span>
            <Badge
              label={user.isBlocked ? "Blocked" : user.onlineStatus || "OFFLINE"}
              color={user.isBlocked ? "red" : user.onlineStatus === "ONLINE" ? "green" : "gray"}
            />
          </div>
          <div className="adm-detail-row"><span>Credits</span><b>{user.translationCreditsRemaining ?? 0}</b></div>
          <div className="adm-detail-row"><span>Language</span><b>{user.preferredLanguage || "en"}</b></div>
          {user.bio && <div className="adm-detail-row adm-detail-bio"><span>Bio</span><em>{user.bio}</em></div>}
          {user.lastSeenAt && <div className="adm-detail-row"><span>Last Seen</span><b>{new Date(user.lastSeenAt).toLocaleString()}</b></div>}
        </div>

        <div className="adm-slideover-actions">
          <button
            id={`detail-block-${user.userId}`}
            className={`adm-btn ${user.isBlocked ? "adm-btn-success" : "adm-btn-warning"}`}
            onClick={onBlock}
            disabled={loading}
          >
            {user.isBlocked ? "Unblock User" : "Block User"}
          </button>

          <button
            id={`detail-role-${user.userId}`}
            className="adm-btn adm-btn-purple"
            onClick={onChangeRole}
            disabled={loading}
          >
            {user.role === "ADMIN" ? "Demote to User" : "Promote to Admin"}
          </button>

          <button
            id={`detail-delete-${user.userId}`}
            className="adm-btn adm-btn-danger"
            onClick={onDelete}
            disabled={loading}
          >
            Delete User
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────
export default function AdminDashboard() {
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all"); // all | blocked | admin
  const [toast, setToast] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);
  const [confirm, setConfirm] = useState(null); // { message, action }

  // Auth guard
  const adminUser = JSON.parse(localStorage.getItem("adminUser") || "null");
  useEffect(() => {
    if (!adminUser || adminUser.role !== "ADMIN") {
      navigate("/admin");
    }
  }, []); // eslint-disable-line

  const showToast = useCallback((message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  }, []);

  const fetchUsers = useCallback(async () => {
    try {
      setError("");
      const data = await adminApi.getAllUsers();
      setUsers(data);
    } catch (err) {
      if (err.message?.includes("403") || err.message?.toLowerCase().includes("administrator")) {
        navigate("/admin");
        return;
      }
      setError("Could not load users: " + err.message);
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  // ── Actions
  async function handleToggleBlock(user) {
    setActionLoading(true);
    try {
      const updated = await adminApi.toggleBlock(user.userId);
      setUsers((prev) => prev.map((u) => u.userId === updated.userId ? updated : u));
      if (selectedUser?.userId === updated.userId) setSelectedUser(updated);
      showToast(`${updated.username} has been ${updated.isBlocked ? "blocked" : "unblocked"}.`);
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleDelete(user) {
    setConfirm({
      message: `Permanently delete "${user.username}"? This action cannot be undone.`,
      action: async () => {
        setConfirm(null);
        setActionLoading(true);
        try {
          await adminApi.deleteUser(user.userId);
          setUsers((prev) => prev.filter((u) => u.userId !== user.userId));
          if (selectedUser?.userId === user.userId) setSelectedUser(null);
          showToast(`${user.username} was deleted.`);
        } catch (err) {
          showToast(err.message, "error");
        } finally {
          setActionLoading(false);
        }
      },
    });
  }

  async function handleChangeRole(user) {
    const newRole = user.role === "ADMIN" ? "USER" : "ADMIN";
    const verb = newRole === "ADMIN" ? "promote" : "demote";
    setConfirm({
      message: `${verb.charAt(0).toUpperCase() + verb.slice(1)} "${user.username}" to ${newRole}?`,
      action: async () => {
        setConfirm(null);
        setActionLoading(true);
        try {
          const updated = await adminApi.changeRole(user.userId, newRole);
          setUsers((prev) => prev.map((u) => u.userId === updated.userId ? updated : u));
          if (selectedUser?.userId === updated.userId) setSelectedUser(updated);
          showToast(`${updated.username} is now ${updated.role}.`);
        } catch (err) {
          showToast(err.message, "error");
        } finally {
          setActionLoading(false);
        }
      },
    });
  }

  function handleLogout() {
    localStorage.removeItem("token");
    localStorage.removeItem("adminUser");
    navigate("/admin");
  }

  // ── Filter + search
  const filtered = users.filter((u) => {
    const query = search.toLowerCase();
    const matchesSearch =
      !query ||
      u.username?.toLowerCase().includes(query) ||
      u.email?.toLowerCase().includes(query) ||
      u.fullName?.toLowerCase().includes(query) ||
      u.phoneNumber?.includes(query);
    const matchesFilter =
      filter === "all" ||
      (filter === "blocked" && u.isBlocked) ||
      (filter === "admin" && u.role === "ADMIN");
    return matchesSearch && matchesFilter;
  });

  const totalUsers = users.length;
  const blockedCount = users.filter((u) => u.isBlocked).length;
  const adminCount = users.filter((u) => u.role === "ADMIN").length;
  const onlineCount = users.filter((u) => u.onlineStatus === "ONLINE" && !u.isBlocked).length;

  return (
    <div className="adm-root">
      {/* ── Sidebar */}
      <aside className="adm-sidebar">
        <div className="adm-sidebar-brand">
          <div className="adm-sidebar-logo">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <span>ConnectHub</span>
        </div>

        <nav className="adm-sidebar-nav">
          <a className="adm-nav-item adm-nav-active" href="#users">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <circle cx="9" cy="7" r="4" stroke="currentColor" strokeWidth="2" />
              <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            User Management
          </a>
        </nav>

        <div className="adm-sidebar-footer">
          <div className="adm-admin-info">
            <div className="adm-admin-dot" />
            <div>
              <p className="adm-admin-name">{adminUser?.username || "Admin"}</p>
              <p className="adm-admin-role">Super Administrator</p>
            </div>
          </div>
          <button id="admin-logout-btn" className="adm-logout-btn" onClick={handleLogout}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Logout
          </button>
        </div>
      </aside>

      {/* ── Main content */}
      <main className="adm-main">
        {/* Header */}
        <header className="adm-topbar">
          <div>
            <h1 className="adm-page-title">User Management</h1>
            <p className="adm-page-sub">Manage, monitor, and moderate all platform users</p>
          </div>
          <button id="admin-refresh-btn" className="adm-btn adm-btn-ghost adm-refresh-btn" onClick={fetchUsers} disabled={loading}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ animation: loading ? "spin 1s linear infinite" : "none" }}>
              <polyline points="23 4 23 10 17 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Refresh
          </button>
        </header>

        {/* Stats */}
        <section className="adm-stats">
          <StatCard
            icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /><circle cx="9" cy="7" r="4" stroke="currentColor" strokeWidth="2" /></svg>}
            label="Total Users" value={totalUsers} accent="#6366f1"
          />
          <StatCard
            icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" /><polyline points="12 6 12 12 16 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>}
            label="Online Now" value={onlineCount} accent="#10b981"
          />
          <StatCard
            icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none"><rect x="3" y="11" width="18" height="11" rx="2" ry="2" stroke="currentColor" strokeWidth="2" /><path d="M7 11V7a5 5 0 0110 0v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>}
            label="Blocked" value={blockedCount} accent="#ef4444"
          />
          <StatCard
            icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>}
            label="Admins" value={adminCount} accent="#a855f7"
          />
        </section>

        {/* Toolbar */}
        <div className="adm-toolbar">
          <div className="adm-search-wrap">
            <svg className="adm-search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none">
              <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="2" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            <input
              id="admin-user-search"
              className="adm-search"
              type="text"
              placeholder="Search by name, email, or phone…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="adm-filter-tabs">
            {["all", "blocked", "admin"].map((f) => (
              <button
                key={f}
                id={`admin-filter-${f}`}
                className={`adm-filter-tab ${filter === f ? "adm-filter-active" : ""}`}
                onClick={() => setFilter(f)}
              >
                {f === "all" ? `All (${totalUsers})` : f === "blocked" ? `Blocked (${blockedCount})` : `Admins (${adminCount})`}
              </button>
            ))}
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="adm-error-banner">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
              <line x1="12" y1="8" x2="12" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              <line x1="12" y1="16" x2="12.01" y2="16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            {error}
          </div>
        )}

        {/* Table */}
        <div className="adm-table-wrap">
          {loading ? (
            <div className="adm-loading">
              <div className="adm-loading-spinner" />
              <p>Loading users…</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="adm-empty">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" opacity="0.3">
                <circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="1.5" />
                <line x1="21" y1="21" x2="15" y2="15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              <p>No users match your search.</p>
            </div>
          ) : (
            <table className="adm-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Contact</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Credits</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((user) => (
                  <tr
                    key={user.userId}
                    className={`adm-row ${user.isBlocked ? "adm-row-blocked" : ""}`}
                    onClick={() => setSelectedUser(user)}
                  >
                    <td>
                      <div className="adm-user-cell">
                        <Avatar user={user} />
                        <div>
                          <div className="adm-user-name">{user.fullName || user.username}</div>
                          <div className="adm-user-un">@{user.username}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="adm-contact">{user.email}</div>
                      <div className="adm-contact-sub">{user.phoneNumber || "—"}</div>
                    </td>
                    <td>
                      <Badge
                        label={user.role}
                        color={user.role === "ADMIN" ? "purple" : "blue"}
                      />
                    </td>
                    <td>
                      <Badge
                        label={user.isBlocked ? "Blocked" : user.onlineStatus || "OFFLINE"}
                        color={user.isBlocked ? "red" : user.onlineStatus === "ONLINE" ? "green" : "gray"}
                      />
                    </td>
                    <td>
                      <span className="adm-credits">{user.translationCreditsRemaining ?? 0}</span>
                    </td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <div className="adm-row-actions">
                        <button
                          id={`block-btn-${user.userId}`}
                          className={`adm-icon-btn ${user.isBlocked ? "adm-icon-btn-success" : "adm-icon-btn-warning"}`}
                          title={user.isBlocked ? "Unblock" : "Block"}
                          onClick={() => handleToggleBlock(user)}
                          disabled={actionLoading}
                        >
                          {user.isBlocked ? (
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" stroke="currentColor" strokeWidth="2" />
                              <path d="M7 11V7a5 5 0 0110 0v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                            </svg>
                          ) : (
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" stroke="currentColor" strokeWidth="2" />
                              <path d="M7 11V7a5 5 0 0110 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                            </svg>
                          )}
                        </button>
                        <button
                          id={`delete-btn-${user.userId}`}
                          className="adm-icon-btn adm-icon-btn-danger"
                          title="Delete user"
                          onClick={() => handleDelete(user)}
                          disabled={actionLoading}
                        >
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                            <polyline points="3 6 5 6 21 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6M10 11v6M14 11v6"
                              stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            <path d="M9 6V4h6v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <p className="adm-table-count">
          Showing {filtered.length} of {totalUsers} users
        </p>
      </main>

      {/* ── Overlays */}
      {selectedUser && (
        <UserDetail
          user={selectedUser}
          onClose={() => setSelectedUser(null)}
          onBlock={() => handleToggleBlock(selectedUser)}
          onDelete={() => handleDelete(selectedUser)}
          onChangeRole={() => handleChangeRole(selectedUser)}
          loading={actionLoading}
        />
      )}

      {confirm && (
        <ConfirmDialog
          message={confirm.message}
          onConfirm={confirm.action}
          onCancel={() => setConfirm(null)}
        />
      )}

      {/* ── Toast */}
      {toast && (
        <div className={`adm-toast adm-toast-${toast.type}`}>
          {toast.type === "success" ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
              <line x1="12" y1="8" x2="12" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              <line x1="12" y1="16" x2="12.01" y2="16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          )}
          {toast.message}
        </div>
      )}

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

        .adm-root {
          display: flex;
          min-height: 100vh;
          background: #08080f;
          font-family: 'Inter', sans-serif;
          color: #e2e2f0;
        }

        /* ── Sidebar */
        .adm-sidebar {
          width: 240px;
          flex-shrink: 0;
          background: rgba(13, 13, 26, 0.95);
          border-right: 1px solid rgba(255,255,255,0.06);
          display: flex;
          flex-direction: column;
          padding: 24px 16px;
          gap: 8px;
        }
        .adm-sidebar-brand {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 8px 12px 20px;
          font-size: 16px;
          font-weight: 700;
          color: white;
          letter-spacing: -0.02em;
        }
        .adm-sidebar-logo {
          width: 36px; height: 36px;
          background: linear-gradient(135deg, #6366f1, #8b5cf6);
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          box-shadow: 0 6px 16px rgba(99,102,241,0.4);
        }
        .adm-sidebar-nav { flex: 1; display: flex; flex-direction: column; gap: 4px; }
        .adm-nav-item {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 14px;
          border-radius: 10px;
          font-size: 13.5px;
          font-weight: 500;
          color: rgba(255,255,255,0.5);
          text-decoration: none;
          transition: background 0.15s, color 0.15s;
          cursor: pointer;
        }
        .adm-nav-item:hover { background: rgba(255,255,255,0.05); color: rgba(255,255,255,0.8); }
        .adm-nav-active {
          background: rgba(99,102,241,0.15) !important;
          color: #a5b4fc !important;
          border: 1px solid rgba(99,102,241,0.2);
        }
        .adm-sidebar-footer { padding-top: 16px; border-top: 1px solid rgba(255,255,255,0.06); }
        .adm-admin-info {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 12px;
          margin-bottom: 8px;
        }
        .adm-admin-dot {
          width: 8px; height: 8px;
          background: #10b981;
          border-radius: 50%;
          box-shadow: 0 0 8px #10b981;
          flex-shrink: 0;
        }
        .adm-admin-name { font-size: 13px; font-weight: 600; color: white; }
        .adm-admin-role { font-size: 11px; color: rgba(255,255,255,0.35); margin-top: 1px; }
        .adm-logout-btn {
          display: flex;
          align-items: center;
          gap: 8px;
          width: 100%;
          padding: 10px 14px;
          background: rgba(239,68,68,0.08);
          border: 1px solid rgba(239,68,68,0.2);
          border-radius: 10px;
          color: #f87171;
          font-size: 13px;
          font-weight: 500;
          font-family: 'Inter', sans-serif;
          cursor: pointer;
          transition: background 0.15s;
        }
        .adm-logout-btn:hover { background: rgba(239,68,68,0.15); }

        /* ── Main */
        .adm-main {
          flex: 1;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }
        .adm-topbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 28px 32px 0;
        }
        .adm-page-title {
          font-size: 22px;
          font-weight: 700;
          color: white;
          letter-spacing: -0.03em;
          margin: 0;
        }
        .adm-page-sub {
          font-size: 13px;
          color: rgba(255,255,255,0.35);
          margin: 4px 0 0 0;
        }
        .adm-refresh-btn { gap: 6px; }

        /* ── Stats */
        .adm-stats {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 16px;
          padding: 24px 32px 0;
        }
        .adm-stat {
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 16px;
          padding: 20px;
          display: flex;
          align-items: center;
          gap: 16px;
          transition: border-color 0.2s;
        }
        .adm-stat:hover { border-color: rgba(255,255,255,0.14); }
        .adm-stat-icon {
          width: 44px; height: 44px;
          background: color-mix(in srgb, var(--accent) 12%, transparent);
          border: 1px solid color-mix(in srgb, var(--accent) 25%, transparent);
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--accent);
          flex-shrink: 0;
        }
        .adm-stat-value {
          font-size: 24px;
          font-weight: 700;
          color: white;
          line-height: 1;
        }
        .adm-stat-label {
          font-size: 12px;
          color: rgba(255,255,255,0.4);
          margin-top: 4px;
        }

        /* ── Toolbar */
        .adm-toolbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          padding: 20px 32px 0;
          flex-wrap: wrap;
        }
        .adm-search-wrap {
          position: relative;
          flex: 1;
          max-width: 380px;
        }
        .adm-search-icon {
          position: absolute;
          left: 14px;
          top: 50%;
          transform: translateY(-50%);
          color: rgba(255,255,255,0.3);
          pointer-events: none;
        }
        .adm-search {
          width: 100%;
          padding: 11px 14px 11px 40px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.09);
          border-radius: 12px;
          color: white;
          font-size: 13.5px;
          font-family: 'Inter', sans-serif;
          outline: none;
          transition: border-color 0.2s, box-shadow 0.2s;
          box-sizing: border-box;
        }
        .adm-search::placeholder { color: rgba(255,255,255,0.25); }
        .adm-search:focus {
          border-color: rgba(99,102,241,0.5);
          box-shadow: 0 0 0 3px rgba(99,102,241,0.12);
        }
        .adm-filter-tabs {
          display: flex;
          gap: 6px;
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.07);
          padding: 4px;
          border-radius: 12px;
        }
        .adm-filter-tab {
          padding: 7px 14px;
          border: none;
          border-radius: 8px;
          background: none;
          color: rgba(255,255,255,0.45);
          font-size: 12.5px;
          font-weight: 500;
          font-family: 'Inter', sans-serif;
          cursor: pointer;
          transition: background 0.15s, color 0.15s;
          white-space: nowrap;
        }
        .adm-filter-tab:hover { color: rgba(255,255,255,0.8); }
        .adm-filter-active {
          background: rgba(99,102,241,0.2) !important;
          color: #a5b4fc !important;
        }

        /* ── Table */
        .adm-table-wrap {
          margin: 16px 32px 0;
          background: rgba(255,255,255,0.02);
          border: 1px solid rgba(255,255,255,0.06);
          border-radius: 16px;
          overflow: hidden;
          flex: 1;
          overflow-y: auto;
        }
        .adm-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 13.5px;
        }
        .adm-table thead th {
          text-align: left;
          padding: 14px 20px;
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: rgba(255,255,255,0.35);
          background: rgba(255,255,255,0.03);
          border-bottom: 1px solid rgba(255,255,255,0.06);
        }
        .adm-row {
          border-bottom: 1px solid rgba(255,255,255,0.04);
          cursor: pointer;
          transition: background 0.12s;
        }
        .adm-row:last-child { border-bottom: none; }
        .adm-row:hover { background: rgba(255,255,255,0.035); }
        .adm-row-blocked { background: rgba(239,68,68,0.04); }
        .adm-row-blocked:hover { background: rgba(239,68,68,0.07); }
        .adm-table td { padding: 14px 20px; vertical-align: middle; }

        .adm-user-cell { display: flex; align-items: center; gap: 12px; }
        .adm-avatar {
          width: 38px; height: 38px;
          border-radius: 50%;
          background: linear-gradient(135deg, #6366f1, #8b5cf6);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 13px;
          font-weight: 700;
          color: white;
          flex-shrink: 0;
          overflow: hidden;
        }
        .adm-avatar img { width: 100%; height: 100%; object-fit: cover; }
        .adm-user-name { font-weight: 600; color: white; font-size: 13.5px; }
        .adm-user-un { font-size: 12px; color: rgba(255,255,255,0.35); }
        .adm-contact { color: rgba(255,255,255,0.75); font-size: 13px; }
        .adm-contact-sub { color: rgba(255,255,255,0.3); font-size: 11.5px; margin-top: 2px; }
        .adm-credits { font-size: 13px; font-weight: 600; color: #fbbf24; }

        /* Badges */
        .adm-badge {
          display: inline-flex;
          align-items: center;
          padding: 3px 10px;
          border-radius: 20px;
          font-size: 11.5px;
          font-weight: 600;
          letter-spacing: 0.02em;
        }
        .adm-badge-green  { background: rgba(16,185,129,0.12); color: #34d399; border: 1px solid rgba(16,185,129,0.2); }
        .adm-badge-red    { background: rgba(239,68,68,0.12); color: #f87171; border: 1px solid rgba(239,68,68,0.2); }
        .adm-badge-blue   { background: rgba(59,130,246,0.12); color: #60a5fa; border: 1px solid rgba(59,130,246,0.2); }
        .adm-badge-purple { background: rgba(168,85,247,0.12); color: #c084fc; border: 1px solid rgba(168,85,247,0.2); }
        .adm-badge-gray   { background: rgba(255,255,255,0.06); color: rgba(255,255,255,0.45); border: 1px solid rgba(255,255,255,0.1); }

        /* Row action buttons */
        .adm-row-actions { display: flex; gap: 6px; align-items: center; }
        .adm-icon-btn {
          width: 32px; height: 32px;
          border-radius: 8px;
          border: none;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: transform 0.12s, box-shadow 0.12s, opacity 0.12s;
        }
        .adm-icon-btn:hover:not(:disabled) { transform: translateY(-1px); }
        .adm-icon-btn:disabled { opacity: 0.4; cursor: not-allowed; }
        .adm-icon-btn-warning { background: rgba(245,158,11,0.12); color: #fbbf24; }
        .adm-icon-btn-warning:hover:not(:disabled) { background: rgba(245,158,11,0.2); box-shadow: 0 4px 12px rgba(245,158,11,0.2); }
        .adm-icon-btn-success { background: rgba(16,185,129,0.12); color: #34d399; }
        .adm-icon-btn-success:hover:not(:disabled) { background: rgba(16,185,129,0.2); box-shadow: 0 4px 12px rgba(16,185,129,0.2); }
        .adm-icon-btn-danger  { background: rgba(239,68,68,0.1); color: #f87171; }
        .adm-icon-btn-danger:hover:not(:disabled)  { background: rgba(239,68,68,0.2); box-shadow: 0 4px 12px rgba(239,68,68,0.2); }

        /* Shared buttons */
        .adm-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          padding: 9px 18px;
          border-radius: 10px;
          font-size: 13px;
          font-weight: 600;
          font-family: 'Inter', sans-serif;
          border: none;
          cursor: pointer;
          transition: opacity 0.2s, transform 0.12s;
        }
        .adm-btn:hover:not(:disabled) { transform: translateY(-1px); opacity: 0.9; }
        .adm-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .adm-btn-ghost  { background: rgba(255,255,255,0.06); color: rgba(255,255,255,0.7); border: 1px solid rgba(255,255,255,0.1); }
        .adm-btn-danger { background: linear-gradient(135deg, #ef4444, #dc2626); color: white; box-shadow: 0 4px 14px rgba(239,68,68,0.35); }
        .adm-btn-warning { background: linear-gradient(135deg, #f59e0b, #d97706); color: white; box-shadow: 0 4px 14px rgba(245,158,11,0.35); }
        .adm-btn-success { background: linear-gradient(135deg, #10b981, #059669); color: white; box-shadow: 0 4px 14px rgba(16,185,129,0.35); }
        .adm-btn-purple  { background: linear-gradient(135deg, #8b5cf6, #7c3aed); color: white; box-shadow: 0 4px 14px rgba(139,92,246,0.35); }

        /* Loading & empty */
        .adm-loading {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 60px;
          gap: 16px;
          color: rgba(255,255,255,0.35);
          font-size: 14px;
        }
        .adm-loading-spinner {
          width: 36px; height: 36px;
          border: 3px solid rgba(99,102,241,0.2);
          border-top-color: #6366f1;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }
        .adm-empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 60px;
          gap: 14px;
          color: rgba(255,255,255,0.35);
          font-size: 14px;
        }
        @keyframes spin { to { transform: rotate(360deg); } }

        /* Error banner */
        .adm-error-banner {
          display: flex;
          align-items: center;
          gap: 10px;
          margin: 16px 32px 0;
          padding: 14px 18px;
          background: rgba(239,68,68,0.1);
          border: 1px solid rgba(239,68,68,0.25);
          border-radius: 12px;
          color: #f87171;
          font-size: 13.5px;
        }

        .adm-table-count {
          padding: 10px 32px;
          font-size: 12px;
          color: rgba(255,255,255,0.25);
        }

        /* ── Overlay + Dialog */
        .adm-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.65);
          backdrop-filter: blur(4px);
          z-index: 100;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .adm-dialog {
          background: #131326;
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 20px;
          padding: 32px;
          max-width: 380px;
          width: 90%;
          text-align: center;
          animation: card-in 0.25s cubic-bezier(0.16,1,0.3,1) both;
        }
        @keyframes card-in {
          from { opacity: 0; transform: scale(0.95) translateY(10px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
        .adm-dialog-icon {
          width: 52px; height: 52px;
          background: rgba(245,158,11,0.1);
          border: 1px solid rgba(245,158,11,0.2);
          border-radius: 14px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #fbbf24;
          margin: 0 auto 16px;
        }
        .adm-dialog-msg { color: rgba(255,255,255,0.75); font-size: 14px; margin: 0 0 24px; line-height: 1.6; }
        .adm-dialog-btns { display: flex; gap: 10px; justify-content: center; }

        /* ── Slide-Over */
        .adm-overlay:has(.adm-slideover) { justify-content: flex-end; }
        .adm-slideover {
          background: #0f0f20;
          border-left: 1px solid rgba(255,255,255,0.08);
          width: 420px;
          max-width: 95vw;
          height: 100%;
          padding: 32px;
          overflow-y: auto;
          position: relative;
          animation: slide-in 0.3s cubic-bezier(0.16,1,0.3,1) both;
          box-sizing: border-box;
        }
        @keyframes slide-in {
          from { transform: translateX(100%); }
          to   { transform: translateX(0); }
        }
        .adm-slideover-close {
          position: absolute;
          top: 20px; right: 20px;
          width: 36px; height: 36px;
          border-radius: 10px;
          background: rgba(255,255,255,0.06);
          border: none;
          display: flex;
          align-items: center;
          justify-content: center;
          color: rgba(255,255,255,0.5);
          cursor: pointer;
          transition: background 0.15s;
        }
        .adm-slideover-close:hover { background: rgba(255,255,255,0.1); color: white; }
        .adm-slideover-header {
          display: flex;
          align-items: center;
          gap: 16px;
          margin-bottom: 28px;
          padding-top: 4px;
        }
        .adm-slideover-avatar .adm-avatar { width: 56px; height: 56px; font-size: 18px; }
        .adm-slideover-header h2 { font-size: 18px; font-weight: 700; color: white; margin: 0; }
        .adm-slideover-un { font-size: 13px; color: rgba(255,255,255,0.35); margin: 3px 0 0; }

        .adm-detail-grid { display: flex; flex-direction: column; gap: 1px; margin-bottom: 28px; }
        .adm-detail-row {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          padding: 12px 0;
          border-bottom: 1px solid rgba(255,255,255,0.05);
          font-size: 13.5px;
        }
        .adm-detail-row span {
          width: 100px;
          flex-shrink: 0;
          color: rgba(255,255,255,0.35);
          font-size: 12px;
          font-weight: 500;
          padding-top: 2px;
        }
        .adm-detail-row b { color: white; font-weight: 500; word-break: break-all; }
        .adm-detail-row code {
          color: #a5b4fc;
          font-size: 11px;
          background: rgba(99,102,241,0.1);
          padding: 2px 8px;
          border-radius: 6px;
          word-break: break-all;
        }
        .adm-detail-bio em { color: rgba(255,255,255,0.55); font-style: normal; font-size: 13px; line-height: 1.5; }

        .adm-slideover-actions { display: flex; flex-direction: column; gap: 10px; }
        .adm-slideover-actions .adm-btn { width: 100%; }

        /* Toast */
        .adm-toast {
          position: fixed;
          bottom: 28px;
          right: 28px;
          z-index: 200;
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 14px 20px;
          border-radius: 14px;
          font-size: 13.5px;
          font-weight: 500;
          box-shadow: 0 16px 40px rgba(0,0,0,0.5);
          animation: toast-in 0.35s cubic-bezier(0.16,1,0.3,1) both;
        }
        @keyframes toast-in {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .adm-toast-success {
          background: #0d2e1e;
          border: 1px solid rgba(16,185,129,0.3);
          color: #34d399;
        }
        .adm-toast-error {
          background: #2e0d0d;
          border: 1px solid rgba(239,68,68,0.3);
          color: #f87171;
        }
      `}</style>
    </div>
  );
}
