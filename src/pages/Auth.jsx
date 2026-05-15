import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { MessageCircle, Lock, Mail, User, ArrowRight, Loader2 } from "lucide-react";
import { api } from "@/lib/api";

// --- 3D floating shape canvas background ---
const AnimatedBackground = () => {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const resize = () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener("resize", resize);

    // Shape types
    const SHAPES = ["cube", "ring", "triangle", "sphere"];

    const randomBetween = (a, b) => a + Math.random() * (b - a);

    const shapes = Array.from({ length: 18 }, (_, i) => ({
      type: SHAPES[i % SHAPES.length],
      x: randomBetween(0, width),
      y: randomBetween(0, height),
      z: randomBetween(0.3, 1.2),         // depth factor
      size: randomBetween(24, 70),
      speedX: randomBetween(-0.25, 0.25),
      speedY: randomBetween(-0.25, 0.25),
      rotSpeed: randomBetween(-0.008, 0.008),
      rot: randomBetween(0, Math.PI * 2),
      hue: randomBetween(170, 270),        // cyan → violet range
      alpha: randomBetween(0.08, 0.22),
      pulseOffset: randomBetween(0, Math.PI * 2),
    }));

    const drawCube = (ctx, x, y, size, rot, hue, alpha) => {
      const s = size * 0.55;
      const off = size * 0.28;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rot);

      // front face
      ctx.beginPath();
      ctx.rect(-s / 2, -s / 2, s, s);
      ctx.strokeStyle = `hsla(${hue}, 90%, 65%, ${alpha * 1.4})`;
      ctx.lineWidth = 1.2;
      ctx.stroke();

      // back face (offset)
      ctx.beginPath();
      ctx.rect(-s / 2 + off, -s / 2 - off, s, s);
      ctx.strokeStyle = `hsla(${hue}, 90%, 65%, ${alpha * 0.7})`;
      ctx.stroke();

      // connecting lines
      const corners = [
        [-s / 2, -s / 2],
        [s / 2, -s / 2],
        [s / 2, s / 2],
        [-s / 2, s / 2],
      ];
      corners.forEach(([cx, cy]) => {
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + off, cy - off);
        ctx.strokeStyle = `hsla(${hue}, 90%, 65%, ${alpha * 0.5})`;
        ctx.stroke();
      });

      ctx.restore();
    };

    const drawRing = (ctx, x, y, size, rot, hue, alpha) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rot);
      ctx.scale(1, 0.38); // perspective squish

      ctx.beginPath();
      ctx.arc(0, 0, size * 0.5, 0, Math.PI * 2);
      ctx.strokeStyle = `hsla(${hue}, 85%, 70%, ${alpha * 1.5})`;
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(0, 0, size * 0.35, 0, Math.PI * 2);
      ctx.strokeStyle = `hsla(${hue}, 85%, 70%, ${alpha * 0.7})`;
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.restore();
    };

    const drawTriangle = (ctx, x, y, size, rot, hue, alpha) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rot);
      const s = size * 0.6;
      ctx.beginPath();
      ctx.moveTo(0, -s);
      ctx.lineTo(s * 0.866, s * 0.5);
      ctx.lineTo(-s * 0.866, s * 0.5);
      ctx.closePath();
      ctx.strokeStyle = `hsla(${hue}, 85%, 70%, ${alpha * 1.3})`;
      ctx.lineWidth = 1.2;
      ctx.stroke();
      // inner triangle
      ctx.beginPath();
      ctx.moveTo(0, -s * 0.5);
      ctx.lineTo(s * 0.43, s * 0.25);
      ctx.lineTo(-s * 0.43, s * 0.25);
      ctx.closePath();
      ctx.strokeStyle = `hsla(${hue}, 85%, 70%, ${alpha * 0.5})`;
      ctx.stroke();
      ctx.restore();
    };

    const drawSphere = (ctx, x, y, size, rot, hue, alpha) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rot);

      // Wireframe-ish sphere using ellipses
      const r = size * 0.45;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.strokeStyle = `hsla(${hue}, 85%, 70%, ${alpha * 1.2})`;
      ctx.lineWidth = 1;
      ctx.stroke();

      // horizontal rings
      [-0.55, 0, 0.55].forEach((yOff) => {
        const ry = r * Math.abs(yOff === 0 ? 1 : Math.sqrt(1 - yOff * yOff));
        ctx.save();
        ctx.scale(1, 0.35);
        ctx.beginPath();
        ctx.arc(0, (yOff * r) / 0.35, ry, 0, Math.PI * 2);
        ctx.strokeStyle = `hsla(${hue}, 85%, 70%, ${alpha * 0.6})`;
        ctx.stroke();
        ctx.restore();
      });

      // vertical ring
      ctx.save();
      ctx.scale(0.35, 1);
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.strokeStyle = `hsla(${hue}, 85%, 70%, ${alpha * 0.6})`;
      ctx.stroke();
      ctx.restore();

      ctx.restore();
    };

    let frame = 0;
    let animId;

    const draw = () => {
      ctx.clearRect(0, 0, width, height);

      shapes.forEach((s) => {
        // Drift movement
        s.x += s.speedX;
        s.y += s.speedY;
        s.rot += s.rotSpeed;

        // Wrap around edges
        if (s.x < -100) s.x = width + 100;
        if (s.x > width + 100) s.x = -100;
        if (s.y < -100) s.y = height + 100;
        if (s.y > height + 100) s.y = -100;

        // Pulsing alpha
        const pulse = 0.5 + 0.5 * Math.sin(frame * 0.018 + s.pulseOffset);
        const a = s.alpha * (0.6 + 0.4 * pulse);
        const scaledSize = s.size * s.z;

        switch (s.type) {
          case "cube":     drawCube(ctx, s.x, s.y, scaledSize, s.rot, s.hue, a); break;
          case "ring":     drawRing(ctx, s.x, s.y, scaledSize, s.rot, s.hue, a); break;
          case "triangle": drawTriangle(ctx, s.x, s.y, scaledSize, s.rot, s.hue, a); break;
          case "sphere":   drawSphere(ctx, s.x, s.y, scaledSize, s.rot, s.hue, a); break;
        }
      });

      frame++;
      animId = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "fixed",
        inset: 0,
        width: "100%",
        height: "100%",
        zIndex: 0,
        pointerEvents: "none",
      }}
    />
  );
};

// --- Auth page ---
const Auth = () => {
  const [authMode, setAuthMode] = useState("login"); // 'login', 'signup', 'forgot', 'otp', 'reset'
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [loading, setLoading] = useState(false);
  const { login, signup } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (authMode === "login") {
        await login(email, password);
        navigate("/chat");
      } else if (authMode === "signup") {
        await signup(name, email, password);
        navigate("/chat");
      } else if (authMode === "forgot") {
        await api.post("/auth/forgot-password", { identifier: email });
        toast({ title: "OTP Sent", description: "Please check your email for the OTP." });
        setAuthMode("otp");
      } else if (authMode === "otp") {
        const resp = await api.post("/auth/verify-otp", { identifier: email, otp });
        setResetToken(resp.resetToken);
        toast({ title: "OTP Verified", description: "Please create a new password." });
        setAuthMode("reset");
        setPassword("");
      } else if (authMode === "reset") {
        await api.post("/auth/reset-password", { token: resetToken, newPassword: password });
        toast({ title: "Password Reset Successful", description: "You can now sign in." });
        setAuthMode("login");
        setPassword("");
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Something went wrong. Please try again.";
      toast({
        title: "Action Failed",
        description: message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const switchMode = (mode) => {
    setAuthMode(mode);
    setName("");
    setPassword("");
    setOtp("");
    // We intentionally keep email filled for convenience between modes
  };

  return (
    <div className="auth-page-root">
      {/* Deep gradient background */}
      <div className="auth-bg-gradient" />

      {/* Animated 3D canvas shapes */}
      <AnimatedBackground />

      {/* Soft ambient glow blobs */}
      <div className="auth-blob auth-blob-1" />
      <div className="auth-blob auth-blob-2" />
      <div className="auth-blob auth-blob-3" />

      {/* Centered card */}
      <div className="auth-card-wrapper">
        <div className="auth-card glass-strong">
          {/* Logo / header */}
          <div className="auth-header">
            <div className="auth-logo-ring">
              <MessageCircle className="auth-logo-icon" />
            </div>
            <h1 className="auth-title">ConnectHub</h1>
            <p className="auth-subtitle">
              {authMode === "login" && "Welcome back"}
              {authMode === "signup" && "Create your account"}
              {authMode === "forgot" && "Reset your password"}
              {authMode === "otp" && "Verify OTP"}
              {authMode === "reset" && "Create new password"}
            </p>
          </div>

          {/* Toggle tabs (only show during login/signup) */}
          {(authMode === "login" || authMode === "signup") && (
            <div className="auth-tabs">
              <button
                type="button"
                className={`auth-tab ${authMode === "login" ? "auth-tab-active" : ""}`}
                onClick={() => authMode !== "login" && switchMode("login")}
                disabled={loading}
              >
                Sign In
              </button>
              <button
                type="button"
                className={`auth-tab ${authMode === "signup" ? "auth-tab-active" : ""}`}
                onClick={() => authMode !== "signup" && switchMode("signup")}
                disabled={loading}
              >
                Sign Up
              </button>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="auth-form">
            {authMode === "signup" && (
              <div className="auth-field" style={{ animationDelay: "0.05s" }}>
                <User className="auth-field-icon" />
                <input
                  type="text"
                  id="auth-name"
                  placeholder="Full Name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="auth-input input-glass"
                  required
                  disabled={loading}
                  autoComplete="name"
                />
              </div>
            )}

            {(authMode === "login" || authMode === "signup" || authMode === "forgot") && (
              <div className="auth-field" style={{ animationDelay: "0.1s" }}>
                <Mail className="auth-field-icon" />
                <input
                  type="email"
                  id="auth-email"
                  placeholder="Email address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="auth-input input-glass"
                  required
                  disabled={loading || authMode === "otp" || authMode === "reset"}
                  autoComplete="email"
                />
              </div>
            )}

            {authMode === "otp" && (
              <div className="auth-field" style={{ animationDelay: "0.1s" }}>
                <Lock className="auth-field-icon" />
                <input
                  type="text"
                  id="auth-otp"
                  placeholder="Enter 6-digit OTP"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  className="auth-input input-glass"
                  required
                  disabled={loading}
                  maxLength={6}
                />
              </div>
            )}

            {(authMode === "login" || authMode === "signup" || authMode === "reset") && (
              <div className="auth-field" style={{ animationDelay: "0.15s" }}>
                <Lock className="auth-field-icon" />
                <input
                  type="password"
                  id="auth-password"
                  placeholder={authMode === "reset" ? "New Password" : "Password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="auth-input input-glass"
                  required
                  disabled={loading}
                  autoComplete={authMode === "login" ? "current-password" : "new-password"}
                />
              </div>
            )}

            {authMode === "login" && (
              <div className="flex justify-end" style={{ animationDelay: "0.17s", marginTop: "-10px" }}>
                <button
                  type="button"
                  onClick={() => switchMode("forgot")}
                  className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                  disabled={loading}
                >
                  Forgot Password?
                </button>
              </div>
            )}

            <button
              type="submit"
              id="auth-submit"
              disabled={loading}
              className="auth-submit btn-glass"
              style={{ animationDelay: "0.2s" }}
            >
              {loading ? (
                <>
                  <Loader2 className="auth-btn-icon animate-spin" />
                  {authMode === "login" ? "Signing In…" : authMode === "signup" ? "Creating Account…" : "Please wait…"}
                </>
              ) : (
                <>
                  {authMode === "login" && "Sign In"}
                  {authMode === "signup" && "Create Account"}
                  {authMode === "forgot" && "Send OTP"}
                  {authMode === "otp" && "Verify OTP"}
                  {authMode === "reset" && "Update Password"}
                  <ArrowRight className="auth-btn-icon" />
                </>
              )}
            </button>
          </form>

          {(authMode === "login" || authMode === "signup") && (
            <p className="auth-switch-text">
              {authMode === "login" ? "Don't have an account?" : "Already have an account?"}{" "}
              <button
                type="button"
                onClick={() => switchMode(authMode === "login" ? "signup" : "login")}
                disabled={loading}
                className="auth-switch-link"
              >
                {authMode === "login" ? "Sign Up" : "Sign In"}
              </button>
            </p>
          )}

          {(authMode === "forgot" || authMode === "otp" || authMode === "reset") && (
            <p className="auth-switch-text">
              Remember your password?{" "}
              <button
                type="button"
                onClick={() => switchMode("login")}
                disabled={loading}
                className="auth-switch-link"
              >
                Sign In
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default Auth;
