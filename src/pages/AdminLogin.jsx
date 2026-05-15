import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/lib/api";

export default function AdminLogin() {
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await api.post("/auth/login", { identifier, password });
      if (res.role !== "ADMIN") {
        setError("Access denied. This portal is for administrators only.");
        setLoading(false);
        return;
      }
      localStorage.setItem("token", res.token);
      localStorage.setItem("adminUser", JSON.stringify(res));
      navigate("/admin/dashboard");
    } catch (err) {
      setError(err.message || "Login failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="admin-login-root">
      {/* Animated background particles */}
      <div className="admin-bg-particles">
        {Array.from({ length: 20 }).map((_, i) => (
          <span key={i} className="particle" style={{ "--i": i }} />
        ))}
      </div>

      <div className="admin-login-card">
        {/* Logo / brand */}
        <div className="admin-login-brand">
          <div className="admin-login-icon">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
              <path
                d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <span className="admin-login-brand-name">ConnectHub</span>
        </div>

        <h1 className="admin-login-title">Admin Portal</h1>
        <p className="admin-login-subtitle">
          Restricted access — administrators only
        </p>

        {error && (
          <div className="admin-login-error" role="alert">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
              <line x1="12" y1="8" x2="12" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              <line x1="12" y1="16" x2="12.01" y2="16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="admin-login-form" id="admin-login-form">
          <div className="admin-field">
            <label htmlFor="admin-identifier">Email or Phone</label>
            <input
              id="admin-identifier"
              type="text"
              placeholder="admin@connecthub.com"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              required
              autoComplete="username"
              disabled={loading}
            />
          </div>

          <div className="admin-field">
            <label htmlFor="admin-password">Password</label>
            <input
              id="admin-password"
              type="password"
              placeholder="••••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              disabled={loading}
            />
          </div>

          <button
            id="admin-login-btn"
            type="submit"
            className="admin-login-btn"
            disabled={loading}
          >
            {loading ? (
              <span className="admin-spinner" />
            ) : (
              <>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" stroke="currentColor" strokeWidth="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
                Sign In as Admin
              </>
            )}
          </button>
        </form>

        <p className="admin-login-footer">
          ConnectHub Admin Panel &mdash; Unauthorized access is prohibited
        </p>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

        .admin-login-root {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #0a0a1a;
          font-family: 'Inter', sans-serif;
          position: relative;
          overflow: hidden;
        }

        /* Animated gradient orbs */
        .admin-login-root::before,
        .admin-login-root::after {
          content: '';
          position: absolute;
          border-radius: 50%;
          filter: blur(80px);
          opacity: 0.15;
          animation: orb-drift 8s ease-in-out infinite alternate;
        }
        .admin-login-root::before {
          width: 500px; height: 500px;
          background: radial-gradient(circle, #6366f1, #8b5cf6);
          top: -100px; left: -100px;
        }
        .admin-login-root::after {
          width: 400px; height: 400px;
          background: radial-gradient(circle, #ec4899, #f43f5e);
          bottom: -80px; right: -80px;
          animation-delay: -4s;
        }
        @keyframes orb-drift {
          from { transform: translate(0, 0) scale(1); }
          to   { transform: translate(40px, 30px) scale(1.1); }
        }

        /* Particles */
        .admin-bg-particles { position: absolute; inset: 0; pointer-events: none; }
        .particle {
          position: absolute;
          width: 3px; height: 3px;
          background: rgba(139, 92, 246, 0.6);
          border-radius: 50%;
          animation: particle-float calc(6s + var(--i, 0) * 0.4s) ease-in-out infinite;
          left: calc(var(--i, 0) * 5.2%);
          top: 100%;
          opacity: 0;
        }
        @keyframes particle-float {
          0%   { top: 100%; opacity: 0; transform: translateX(0); }
          10%  { opacity: 0.8; }
          90%  { opacity: 0.4; }
          100% { top: -10%; opacity: 0; transform: translateX(calc(20px * sin(var(--i, 0)))); }
        }

        /* Card */
        .admin-login-card {
          position: relative;
          z-index: 10;
          width: 100%;
          max-width: 420px;
          background: rgba(15, 15, 30, 0.85);
          backdrop-filter: blur(20px);
          border: 1px solid rgba(139, 92, 246, 0.25);
          border-radius: 24px;
          padding: 40px;
          box-shadow:
            0 0 0 1px rgba(139, 92, 246, 0.08),
            0 25px 50px -12px rgba(0, 0, 0, 0.8),
            inset 0 1px 0 rgba(255,255,255,0.06);
          animation: card-in 0.5s cubic-bezier(0.16, 1, 0.3, 1) both;
        }
        @keyframes card-in {
          from { opacity: 0; transform: translateY(30px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }

        /* Brand */
        .admin-login-brand {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 28px;
        }
        .admin-login-icon {
          width: 44px; height: 44px;
          background: linear-gradient(135deg, #6366f1, #8b5cf6);
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          box-shadow: 0 8px 24px rgba(99, 102, 241, 0.4);
        }
        .admin-login-brand-name {
          font-size: 18px;
          font-weight: 700;
          color: white;
          letter-spacing: -0.02em;
        }

        .admin-login-title {
          font-size: 26px;
          font-weight: 700;
          color: white;
          margin: 0 0 6px 0;
          letter-spacing: -0.03em;
        }
        .admin-login-subtitle {
          font-size: 13px;
          color: rgba(255,255,255,0.45);
          margin: 0 0 28px 0;
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .admin-login-subtitle::before {
          content: '';
          display: inline-block;
          width: 6px; height: 6px;
          background: #f59e0b;
          border-radius: 50%;
          box-shadow: 0 0 8px #f59e0b;
          animation: pulse-dot 2s ease-in-out infinite;
        }
        @keyframes pulse-dot {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(0.8); }
        }

        /* Error banner */
        .admin-login-error {
          display: flex;
          align-items: center;
          gap: 8px;
          background: rgba(239, 68, 68, 0.12);
          border: 1px solid rgba(239, 68, 68, 0.3);
          color: #f87171;
          padding: 12px 16px;
          border-radius: 12px;
          font-size: 13px;
          margin-bottom: 20px;
          animation: shake 0.4s cubic-bezier(0.36,0.07,0.19,0.97);
        }
        @keyframes shake {
          10%, 90% { transform: translateX(-2px); }
          20%, 80% { transform: translateX(4px); }
          30%, 50%, 70% { transform: translateX(-4px); }
          40%, 60% { transform: translateX(4px); }
        }

        /* Form fields */
        .admin-login-form { display: flex; flex-direction: column; gap: 16px; }
        .admin-field { display: flex; flex-direction: column; gap: 6px; }
        .admin-field label {
          font-size: 12px;
          font-weight: 600;
          color: rgba(255,255,255,0.55);
          text-transform: uppercase;
          letter-spacing: 0.06em;
        }
        .admin-field input {
          width: 100%;
          padding: 13px 16px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 12px;
          color: white;
          font-size: 14px;
          font-family: 'Inter', sans-serif;
          outline: none;
          transition: border-color 0.2s, box-shadow 0.2s, background 0.2s;
          box-sizing: border-box;
        }
        .admin-field input::placeholder { color: rgba(255,255,255,0.2); }
        .admin-field input:focus {
          border-color: rgba(99, 102, 241, 0.6);
          background: rgba(99, 102, 241, 0.06);
          box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.15);
        }
        .admin-field input:disabled { opacity: 0.5; cursor: not-allowed; }

        /* Submit button */
        .admin-login-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          margin-top: 8px;
          padding: 14px;
          background: linear-gradient(135deg, #6366f1, #8b5cf6);
          color: white;
          border: none;
          border-radius: 12px;
          font-size: 15px;
          font-weight: 600;
          font-family: 'Inter', sans-serif;
          cursor: pointer;
          transition: opacity 0.2s, transform 0.15s, box-shadow 0.2s;
          box-shadow: 0 8px 24px rgba(99, 102, 241, 0.35);
          position: relative;
          overflow: hidden;
        }
        .admin-login-btn::before {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(135deg, rgba(255,255,255,0.15), transparent);
          opacity: 0;
          transition: opacity 0.2s;
        }
        .admin-login-btn:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 12px 32px rgba(99, 102, 241, 0.45);
        }
        .admin-login-btn:hover:not(:disabled)::before { opacity: 1; }
        .admin-login-btn:active:not(:disabled) { transform: translateY(0); }
        .admin-login-btn:disabled { opacity: 0.6; cursor: not-allowed; }

        /* Spinner */
        .admin-spinner {
          width: 18px; height: 18px;
          border: 2px solid rgba(255,255,255,0.3);
          border-top-color: white;
          border-radius: 50%;
          animation: spin 0.7s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }

        .admin-login-footer {
          text-align: center;
          margin-top: 24px;
          font-size: 11px;
          color: rgba(255,255,255,0.2);
        }
      `}</style>
    </div>
  );
}
