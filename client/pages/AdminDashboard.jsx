/*
 * Admin operations screen.
 *
 * This page lets authorized administrators review users, block/unblock
 * accounts, delete accounts, and promote or demote user roles.
 */
import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users, Shield, Lock, Unlock, Trash2, RefreshCw,
  Search, LogOut, ChevronRight, AlertTriangle, X,
  CheckCircle2, XCircle, Star, StarOff, Wifi, WifiOff,
  CreditCard, Clock, Filter,
} from "lucide-react";
import { adminApi } from "../lib/api";
import { cn } from "@/lib/utils";

// ─── Avatar ──────────────────────────────────────────────────────────────────
function Avatar({ user, size = "md" }) {
  const initials = (user.fullName || user.username || "?")
    .split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  const sizes = { sm: "w-8 h-8 text-xs", md: "w-10 h-10 text-sm", lg: "w-14 h-14 text-lg" };
  return (
    <div className={cn("rounded-full bg-gradient-to-br from-violet-500 to-purple-700 flex items-center justify-center font-bold text-white flex-shrink-0 overflow-hidden", sizes[size])}>
      {user.avatarUrl
        ? <img src={user.avatarUrl} alt={user.username} className="w-full h-full object-cover" />
        : <span>{initials}</span>}
    </div>
  );
}

// ─── Badge ────────────────────────────────────────────────────────────────────
const BADGE = {
  green:  "bg-emerald-500/12 text-emerald-400 border-emerald-500/20",
  red:    "bg-rose-500/12 text-rose-400 border-rose-500/20",
  blue:   "bg-sky-500/12 text-sky-400 border-sky-500/20",
  purple: "bg-violet-500/12 text-violet-400 border-violet-500/20",
  amber:  "bg-amber-500/12 text-amber-400 border-amber-500/20",
  gray:   "bg-white/6 text-white/40 border-white/10",
};
function Badge({ label, color = "gray" }) {
  return (
    <span className={cn("inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold border tracking-wide", BADGE[color])}>
      {label}
    </span>
  );
}

// ─── Stat Card ────────────────────────────────────────────────────────────────
function StatCard({ icon: Icon, label, value, color }) {
  const colors = {
    violet: "from-violet-500/20 to-violet-500/5 border-violet-500/20 text-violet-400",
    emerald: "from-emerald-500/20 to-emerald-500/5 border-emerald-500/20 text-emerald-400",
    rose:   "from-rose-500/20 to-rose-500/5 border-rose-500/20 text-rose-400",
    amber:  "from-amber-500/20 to-amber-500/5 border-amber-500/20 text-amber-400",
  };
  return (
    <div className={cn("rounded-2xl border bg-gradient-to-br p-5 flex items-center gap-4 transition-all hover:scale-[1.01]", colors[color])}>
      <div className={cn("w-11 h-11 rounded-xl bg-current/10 flex items-center justify-center flex-shrink-0", `text-${color}-400`)}>
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="text-2xl font-black text-white leading-none">{value}</p>
        <p className="text-xs text-white/40 mt-1 font-medium">{label}</p>
      </div>
    </div>
  );
}

// ─── Confirm modal ────────────────────────────────────────────────────────────
function ConfirmModal({ message, onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={onCancel}>
      <motion.div
        initial={{ scale: 0.92, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.92, opacity: 0 }}
        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#11111e] shadow-2xl p-6 space-y-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center flex-shrink-0">
            <AlertTriangle className="h-5 w-5 text-amber-400" />
          </div>
          <p className="text-sm text-white/75 leading-relaxed">{message}</p>
        </div>
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 h-10 rounded-xl border border-white/10 bg-white/5 text-white/70 text-sm font-semibold hover:bg-white/10 transition-colors">
            Cancel
          </button>
          <button onClick={onConfirm} className="flex-1 h-10 rounded-xl bg-gradient-to-r from-rose-500 to-rose-600 text-white text-sm font-semibold hover:opacity-90 transition-opacity shadow-lg shadow-rose-500/25">
            Confirm
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ─── User Detail Slideover ────────────────────────────────────────────────────
function UserSlideover({ user, onClose, onBlock, onDelete, onChangeRole, onSetCredits, loading }) {
  const [creditInput, setCreditInput] = useState(String(user.translationCreditsRemaining ?? 0));
  const badgeColor = (u) => {
    if (u.isBlocked) return "red";
    if (u.onlineStatus === "ONLINE") return "emerald";
    return "gray";
  };
  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <motion.div
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-sm h-full bg-[#0e0e1c] border-l border-white/8 overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b border-white/8 bg-[#0e0e1c]/95 backdrop-blur-xl">
          <p className="text-sm font-bold text-white">User Details</p>
          <button onClick={onClose} className="w-8 h-8 rounded-lg bg-white/6 flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Profile summary */}
          <div className="flex items-center gap-4">
            <Avatar user={user} size="lg" />
            <div className="min-w-0">
              <p className="font-bold text-white truncate">{user.fullName || user.username}</p>
              <p className="text-sm text-white/40">@{user.username}</p>
              <div className="flex gap-2 mt-1.5 flex-wrap">
                <Badge label={user.role} color={user.role === "ADMIN" ? "purple" : "blue"} />
                <Badge
                  label={user.isBlocked ? "Blocked" : user.onlineStatus || "OFFLINE"}
                  color={badgeColor(user)}
                />
              </div>
            </div>
          </div>

          {/* Detail rows */}
          <div className="space-y-0 divide-y divide-white/6 rounded-2xl border border-white/8 overflow-hidden">
            {[
              { label: "User ID", value: user.userId, mono: true },
              { label: "Email", value: user.email },
              { label: "Phone", value: user.phoneNumber || "—" },
              { label: "Credits", value: `${user.translationCreditsRemaining ?? 0} remaining` },
              { label: "Language", value: user.preferredLanguage || "en" },
              ...(user.lastSeenAt ? [{ label: "Last Seen", value: new Date(user.lastSeenAt).toLocaleString() }] : []),
              ...(user.bio ? [{ label: "Bio", value: user.bio }] : []),
            ].map(({ label, value, mono }) => (
              <div key={label} className="flex gap-3 px-4 py-3 bg-white/[0.02]">
                <span className="w-24 flex-shrink-0 text-xs text-white/35 font-semibold uppercase tracking-wider pt-0.5">{label}</span>
                <span className={cn("text-sm text-white/75 break-all", mono && "font-mono text-[11px] text-violet-300")}>{value}</span>
              </div>
            ))}
          </div>

          {/* Actions */}
          <div className="space-y-3">
            {/* Set Credits */}
            <div className="rounded-xl border border-white/8 bg-white/[0.02] p-3 space-y-2">
              <p className="text-[11px] font-semibold text-white/35 uppercase tracking-wider flex items-center gap-1.5">
                <CreditCard className="h-3 w-3" /> Translation Credits
              </p>
              <div className="flex gap-2">
                <input
                  type="number"
                  min="0"
                  value={creditInput}
                  onChange={(e) => setCreditInput(e.target.value)}
                  className="flex-1 h-9 px-3 rounded-lg border border-white/10 bg-white/5 text-white text-sm outline-none focus:border-violet-500/50 transition-all"
                />
                <button
                  onClick={() => {
                    const n = parseInt(creditInput, 10);
                    if (!isNaN(n) && n >= 0) onSetCredits(n);
                  }}
                  disabled={loading || isNaN(parseInt(creditInput, 10)) || parseInt(creditInput, 10) < 0}
                  className="px-4 h-9 rounded-lg text-sm font-semibold bg-amber-500/15 border border-amber-500/25 text-amber-300 hover:bg-amber-500/25 transition-all disabled:opacity-50"
                >
                  Set
                </button>
              </div>
            </div>
            <button
              id={`detail-block-${user.userId}`}
              onClick={onBlock}
              disabled={loading}
              className={cn(
                "w-full h-11 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all disabled:opacity-50",
                user.isBlocked
                  ? "bg-gradient-to-r from-emerald-500 to-emerald-600 text-white shadow-lg shadow-emerald-500/25 hover:opacity-90"
                  : "bg-gradient-to-r from-amber-500 to-amber-600 text-white shadow-lg shadow-amber-500/25 hover:opacity-90"
              )}
            >
              {user.isBlocked ? <><Unlock className="h-4 w-4" /> Unblock User</> : <><Lock className="h-4 w-4" /> Block User</>}
            </button>

            <button
              id={`detail-role-${user.userId}`}
              onClick={onChangeRole}
              disabled={loading}
              className="w-full h-11 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all disabled:opacity-50 bg-gradient-to-r from-violet-500 to-purple-600 text-white shadow-lg shadow-violet-500/25 hover:opacity-90"
            >
              {user.role === "ADMIN"
                ? <><StarOff className="h-4 w-4" /> Demote to User</>
                : <><Star className="h-4 w-4" /> Promote to Admin</>}
            </button>

            <button
              id={`detail-delete-${user.userId}`}
              onClick={onDelete}
              disabled={loading}
              className="w-full h-11 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all disabled:opacity-50 bg-rose-500/10 border border-rose-500/25 text-rose-400 hover:bg-rose-500/20"
            >
              <Trash2 className="h-4 w-4" /> Delete User
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

// ─── Toast ────────────────────────────────────────────────────────────────────
function Toast({ toast }) {
  return (
    <AnimatePresence>
      {toast && (
        <motion.div
          key={toast.message}
          initial={{ opacity: 0, y: 12, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 12, scale: 0.97 }}
          transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          className={cn(
            "fixed bottom-6 right-6 z-[100] flex items-center gap-3 px-5 py-3.5 rounded-2xl border shadow-2xl text-sm font-semibold",
            toast.type === "success"
              ? "bg-emerald-950 border-emerald-500/30 text-emerald-300"
              : "bg-rose-950 border-rose-500/30 text-rose-300"
          )}
        >
          {toast.type === "success"
            ? <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
            : <XCircle className="h-4 w-4 flex-shrink-0" />}
          {toast.message}
        </motion.div>
      )}
    </AnimatePresence>
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
  const [filter, setFilter] = useState("all");
  const [toast, setToast] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);
  const [confirm, setConfirm] = useState(null);

  const adminUser = JSON.parse(localStorage.getItem("adminUser") || "null");

  useEffect(() => {
    if (!adminUser || adminUser.role !== "ADMIN") navigate("/admin", { replace: true });
  }, []); // eslint-disable-line

  const showToast = useCallback((message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  }, []);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await adminApi.getAllUsers();
      setUsers(data);
    } catch (err) {
      if (err.message?.toLowerCase().includes("administrator") || err.message?.includes("403")) {
        navigate("/admin", { replace: true });
        return;
      }
      setError(err.message || "Failed to load users.");
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  // Actions
  async function handleToggleBlock(user) {
    setActionLoading(true);
    try {
      const updated = await adminApi.toggleBlock(user.userId);
      setUsers((prev) => prev.map((u) => u.userId === updated.userId ? updated : u));
      if (selectedUser?.userId === updated.userId) setSelectedUser(updated);
      showToast(`${updated.username} ${updated.isBlocked ? "blocked" : "unblocked"} successfully.`);
    } catch (err) { showToast(err.message, "error"); }
    finally { setActionLoading(false); }
  }

  function handleDeletePrompt(user) {
    setConfirm({
      message: `Permanently delete "${user.username}"? This cannot be undone.`,
      action: async () => {
        setConfirm(null);
        setActionLoading(true);
        try {
          await adminApi.deleteUser(user.userId);
          setUsers((prev) => prev.filter((u) => u.userId !== user.userId));
          if (selectedUser?.userId === user.userId) setSelectedUser(null);
          showToast(`${user.username} deleted.`);
        } catch (err) { showToast(err.message, "error"); }
        finally { setActionLoading(false); }
      },
    });
  }

  function handleRolePrompt(user) {
    const newRole = user.role === "ADMIN" ? "USER" : "ADMIN";
    setConfirm({
      message: `${newRole === "ADMIN" ? "Promote" : "Demote"} "${user.username}" to ${newRole}?`,
      action: async () => {
        setConfirm(null);
        setActionLoading(true);
        try {
          const updated = await adminApi.changeRole(user.userId, newRole);
          setUsers((prev) => prev.map((u) => u.userId === updated.userId ? updated : u));
          if (selectedUser?.userId === updated.userId) setSelectedUser(updated);
          showToast(`${updated.username} is now ${updated.role}.`);
        } catch (err) { showToast(err.message, "error"); }
        finally { setActionLoading(false); }
      },
    });
  }

  async function handleSetCredits(user, credits) {
    setActionLoading(true);
    try {
      const updated = await adminApi.setCredits(user.userId, credits);
      setUsers((prev) => prev.map((u) => u.userId === updated.userId ? updated : u));
      if (selectedUser?.userId === updated.userId) setSelectedUser(updated);
      showToast(`${updated.username}'s credits set to ${credits}.`);
    } catch (err) { showToast(err.message, "error"); }
    finally { setActionLoading(false); }
  }

  function handleLogout() {
    localStorage.removeItem("adminToken");
    localStorage.removeItem("adminUser");
    navigate("/admin", { replace: true });
  }

  // Derived
  const total = users.length;
  const blocked = users.filter((u) => u.isBlocked).length;
  const admins = users.filter((u) => u.role === "ADMIN").length;
  const online = users.filter((u) => u.onlineStatus === "ONLINE" && !u.isBlocked).length;

  const filtered = users.filter((u) => {
    const q = search.toLowerCase();
    const match = !q ||
      u.username?.toLowerCase().includes(q) ||
      u.email?.toLowerCase().includes(q) ||
      u.fullName?.toLowerCase().includes(q) ||
      u.phoneNumber?.includes(q);
    const tab =
      filter === "all" ||
      (filter === "blocked" && u.isBlocked) ||
      (filter === "admins" && u.role === "ADMIN");
    return match && tab;
  });

  return (
    <div className="flex h-screen bg-[#08080f] font-sans overflow-hidden">

      {/* ── Sidebar ──────────────────────────────────────────────────────────── */}
      <aside className="w-56 flex-shrink-0 flex flex-col border-r border-white/6 bg-[#0c0c1a] px-4 py-6 gap-2">
        {/* Brand */}
        <div className="flex items-center gap-2.5 px-2 mb-6">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500 to-purple-700 flex items-center justify-center shadow-lg shadow-violet-500/30 flex-shrink-0">
            <Shield className="h-4 w-4 text-white" />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-white/35 font-semibold uppercase tracking-widest leading-none">ConnectHub</p>
            <p className="text-sm font-black text-white tracking-tight">Admin</p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 space-y-1">
          <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-violet-500/12 border border-violet-500/20 text-violet-300 text-sm font-semibold cursor-default">
            <Users className="h-4 w-4 flex-shrink-0" />
            Users
          </div>
        </nav>

        {/* Admin info + logout */}
        <div className="space-y-2 pt-4 border-t border-white/6">
          <div className="flex items-center gap-2.5 px-2 py-1">
            <div className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399] flex-shrink-0 animate-pulse" />
            <div className="min-w-0">
              <p className="text-xs font-semibold text-white truncate">{adminUser?.username || "Admin"}</p>
              <p className="text-[10px] text-white/30">Super Admin</p>
            </div>
          </div>
          <button
            id="admin-logout-btn"
            onClick={handleLogout}
            className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-rose-400 text-sm font-semibold bg-rose-500/6 border border-rose-500/15 hover:bg-rose-500/12 transition-colors"
          >
            <LogOut className="h-4 w-4 flex-shrink-0" />
            Logout
          </button>
        </div>
      </aside>

      {/* ── Main ─────────────────────────────────────────────────────────────── */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Topbar */}
        <header className="flex-shrink-0 flex items-center justify-between px-8 pt-7 pb-0">
          <div>
            <h1 className="text-xl font-black text-white tracking-tight">User Management</h1>
            <p className="text-xs text-white/35 mt-0.5">Monitor and moderate all platform accounts</p>
          </div>
          <button
            id="admin-refresh-btn"
            onClick={fetchUsers}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-white/10 bg-white/4 text-white/60 text-sm font-medium hover:bg-white/8 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
            Refresh
          </button>
        </header>

        {/* Stats */}
        <div className="flex-shrink-0 grid grid-cols-4 gap-4 px-8 pt-6">
          <StatCard icon={Users}  label="Total Users"  value={total}   color="violet"  />
          <StatCard icon={Wifi}   label="Online Now"   value={online}  color="emerald" />
          <StatCard icon={Lock}   label="Blocked"      value={blocked} color="rose"    />
          <StatCard icon={Shield} label="Admins"       value={admins}  color="amber"   />
        </div>

        {/* Toolbar */}
        <div className="flex-shrink-0 flex items-center gap-3 px-8 pt-5 flex-wrap">
          {/* Search */}
          <div className="relative flex-1 min-w-[220px] max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
            <input
              id="admin-user-search"
              type="text"
              placeholder="Search name, email, phone…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-10 pl-9 pr-4 rounded-xl border border-white/10 bg-white/4 text-white text-sm placeholder:text-white/25 outline-none focus:border-violet-500/50 focus:ring-2 focus:ring-violet-500/12 transition-all"
            />
          </div>

          {/* Filter tabs */}
          <div className="flex items-center gap-1 p-1 rounded-xl border border-white/8 bg-white/3">
            {[
              { key: "all",     label: `All (${total})` },
              { key: "blocked", label: `Blocked (${blocked})` },
              { key: "admins",  label: `Admins (${admins})` },
            ].map(({ key, label }) => (
              <button
                key={key}
                id={`admin-filter-${key}`}
                onClick={() => setFilter(key)}
                className={cn(
                  "px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap",
                  filter === key
                    ? "bg-violet-500/20 text-violet-300 border border-violet-500/25"
                    : "text-white/40 hover:text-white/70"
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mx-8 mt-4 flex items-center gap-3 px-4 py-3 rounded-xl border border-rose-500/25 bg-rose-500/8 text-rose-300 text-sm">
            <XCircle className="h-4 w-4 flex-shrink-0" />
            {error}
          </div>
        )}

        {/* Table */}
        <div className="flex-1 overflow-auto px-8 pt-4 pb-4">
          <div className="rounded-2xl border border-white/8 bg-white/[0.02] overflow-hidden">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-20 gap-4">
                <RefreshCw className="h-8 w-8 text-violet-400 animate-spin" />
                <p className="text-sm text-white/35">Loading users…</p>
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3">
                <Search className="h-10 w-10 text-white/15" />
                <p className="text-sm text-white/30">No users match your search.</p>
              </div>
            ) : (
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b border-white/8 bg-white/[0.03]">
                    {["User", "Contact", "Role", "Status", "Credits", "Actions"].map((h) => (
                      <th key={h} className="text-left px-5 py-3.5 text-[11px] font-semibold uppercase tracking-widest text-white/30">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((user) => (
                    <tr
                      key={user.userId}
                      onClick={() => setSelectedUser(user)}
                      className={cn(
                        "border-b border-white/5 last:border-0 cursor-pointer transition-colors hover:bg-white/[0.035] group",
                        user.isBlocked && "bg-rose-500/[0.03]"
                      )}
                    >
                      {/* User */}
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <Avatar user={user} />
                          <div className="min-w-0">
                            <p className="font-semibold text-white truncate max-w-[140px]">{user.fullName || user.username}</p>
                            <p className="text-xs text-white/35">@{user.username}</p>
                          </div>
                          <ChevronRight className="h-3.5 w-3.5 text-white/20 opacity-0 group-hover:opacity-100 transition-opacity ml-1 flex-shrink-0" />
                        </div>
                      </td>

                      {/* Contact */}
                      <td className="px-5 py-3.5">
                        <p className="text-white/70 text-xs truncate max-w-[180px]">{user.email}</p>
                        <p className="text-white/30 text-[11px] mt-0.5">{user.phoneNumber || "—"}</p>
                      </td>

                      {/* Role */}
                      <td className="px-5 py-3.5">
                        <Badge label={user.role} color={user.role === "ADMIN" ? "purple" : "blue"} />
                      </td>

                      {/* Status */}
                      <td className="px-5 py-3.5">
                        <Badge
                          label={user.isBlocked ? "Blocked" : user.onlineStatus || "OFFLINE"}
                          color={user.isBlocked ? "red" : user.onlineStatus === "ONLINE" ? "green" : "gray"}
                        />
                      </td>

                      {/* Credits */}
                      <td className="px-5 py-3.5">
                        <span className="text-amber-400 font-semibold text-sm">{user.translationCreditsRemaining ?? 0}</span>
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-3.5" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-2">
                          <button
                            id={`block-btn-${user.userId}`}
                            title={user.isBlocked ? "Unblock" : "Block"}
                            onClick={() => handleToggleBlock(user)}
                            disabled={actionLoading}
                            className={cn(
                              "w-8 h-8 rounded-lg flex items-center justify-center transition-all disabled:opacity-40",
                              user.isBlocked
                                ? "bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20"
                                : "bg-amber-500/10 text-amber-400 hover:bg-amber-500/20"
                            )}
                          >
                            {user.isBlocked ? <Unlock className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
                          </button>
                          <button
                            id={`delete-btn-${user.userId}`}
                            title="Delete user"
                            onClick={() => handleDeletePrompt(user)}
                            disabled={actionLoading}
                            className="w-8 h-8 rounded-lg flex items-center justify-center bg-rose-500/8 text-rose-400 hover:bg-rose-500/18 transition-all disabled:opacity-40"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          <p className="text-xs text-white/20 mt-3">
            Showing {filtered.length} of {total} users
          </p>
        </div>
      </main>

      {/* ── Overlays ──────────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {selectedUser && (
          <UserSlideover
            user={selectedUser}
            onClose={() => setSelectedUser(null)}
            onBlock={() => handleToggleBlock(selectedUser)}
            onDelete={() => handleDeletePrompt(selectedUser)}
            onChangeRole={() => handleRolePrompt(selectedUser)}
            onSetCredits={(credits) => handleSetCredits(selectedUser, credits)}
            loading={actionLoading}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {confirm && (
          <ConfirmModal
            message={confirm.message}
            onConfirm={confirm.action}
            onCancel={() => setConfirm(null)}
          />
        )}
      </AnimatePresence>

      <Toast toast={toast} />
    </div>
  );
}
