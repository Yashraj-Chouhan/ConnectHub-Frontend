/*
 * Hidden admin sign-in page.
 *
 * It reuses the normal auth-service login but only grants access when the
 * returned user role is ADMIN.
 */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Lock, Mail, Loader2, ShieldAlert } from "lucide-react";
import { api } from "../lib/api";
import { cn } from "@/lib/utils";

export default function AdminLogin() {
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);

  // Signs into the standard backend auth flow, then rejects non-admin users.
  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await api.auth.login(identifier.trim(), password);
      if (res.role !== "ADMIN") {
        setError("Access denied. This portal is reserved for ConnectHub administrators only.");
        setLoading(false);
        return;
      }
      localStorage.setItem("adminToken", res.token);
      localStorage.setItem("adminUser", JSON.stringify(res));
      navigate("/admin/dashboard");
    } catch (err) {
      setError(err.message || "Login failed. Please check your credentials.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#07070f] flex items-center justify-center px-4">
      {/* Background orbs */}
      <motion.div
        className="absolute top-[-15%] left-[-10%] w-[50vw] h-[50vw] rounded-full bg-violet-600/10 blur-[130px] pointer-events-none"
        animate={{ x: [0, 40, 0], y: [0, 30, 0] }}
        transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute bottom-[-15%] right-[-10%] w-[40vw] h-[40vw] rounded-full bg-rose-600/10 blur-[130px] pointer-events-none"
        animate={{ x: [0, -40, 0], y: [0, -30, 0] }}
        transition={{ duration: 22, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* Grid overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 w-full max-w-[420px]"
      >
        {/* Glow behind card */}
        <div className="absolute inset-0 -z-10 rounded-[2rem] bg-gradient-to-br from-violet-500/20 via-transparent to-rose-500/20 blur-2xl" />

        <div className="rounded-[2rem] border border-white/10 bg-white/[0.04] backdrop-blur-3xl shadow-2xl overflow-hidden">
          {/* Top accent line */}
          <div className="h-px w-full bg-gradient-to-r from-transparent via-violet-400/60 to-transparent" />

          <div className="px-8 py-10 space-y-7">
            {/* Brand */}
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-700 flex items-center justify-center shadow-lg shadow-violet-500/30 flex-shrink-0">
                <ShieldAlert className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-[0.2em] text-white/40 font-semibold">ConnectHub</p>
                <h1 className="text-xl font-black text-white tracking-tight leading-tight">Admin Portal</h1>
              </div>
            </div>

            {/* Warning badge */}
            <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-amber-500/8 border border-amber-500/20">
              <span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-amber-400 shadow-[0_0_8px_#fbbf24] animate-pulse" />
              <p className="text-xs text-amber-200/70 font-medium">
                Restricted access — administrators only
              </p>
            </div>

            {/* Error */}
            <AnimatePresence>
              {error && (
                <motion.div
                  key={error}
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="flex items-start gap-3 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300"
                >
                  <Lock className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <p>{error}</p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Form */}
            <form id="admin-login-form" onSubmit={handleSubmit} className="space-y-4">
              {/* Email / Phone */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-widest text-white/40">
                  Email or Phone
                </label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-violet-400/70" />
                  <input
                    id="admin-identifier"
                    type="text"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder="admin@connecthub.com"
                    required
                    autoComplete="username"
                    disabled={loading}
                    className="w-full h-11 pl-10 pr-4 rounded-xl border border-white/10 bg-white/5 text-white text-sm placeholder:text-white/25 outline-none focus:border-violet-500/50 focus:ring-2 focus:ring-violet-500/15 transition-all disabled:opacity-50"
                  />
                </div>
              </div>

              {/* Password */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-widest text-white/40">
                  Password
                </label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-violet-400/70" />
                  <input
                    id="admin-password"
                    type={showPw ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    required
                    autoComplete="current-password"
                    disabled={loading}
                    className="w-full h-11 pl-10 pr-11 rounded-xl border border-white/10 bg-white/5 text-white text-sm placeholder:text-white/25 outline-none focus:border-violet-500/50 focus:ring-2 focus:ring-violet-500/15 transition-all disabled:opacity-50"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/70 transition-colors"
                    tabIndex={-1}
                  >
                    {showPw ? (
                      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24M1 1l22 22" /></svg>
                    ) : (
                      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                    )}
                  </button>
                </div>
              </div>

              {/* Submit */}
              <motion.button
                id="admin-login-btn"
                type="submit"
                disabled={loading}
                whileHover={{ scale: loading ? 1 : 1.01 }}
                whileTap={{ scale: loading ? 1 : 0.99 }}
                className={cn(
                  "w-full h-11 rounded-xl font-semibold text-sm text-white transition-all",
                  "bg-gradient-to-r from-violet-500 via-purple-600 to-fuchsia-600",
                  "shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40",
                  "flex items-center justify-center gap-2",
                  "disabled:opacity-60 disabled:cursor-not-allowed"
                )}
              >
                {loading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <>
                    <ShieldAlert className="h-4 w-4" />
                    Sign In as Administrator
                  </>
                )}
              </motion.button>
            </form>

            {/* Footer */}
            <p className="text-center text-[11px] text-white/18 leading-relaxed">
              ConnectHub Admin Panel · Unauthorized access is prohibited and monitored
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
