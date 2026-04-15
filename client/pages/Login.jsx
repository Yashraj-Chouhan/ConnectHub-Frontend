import { useState, useEffect, useMemo } from "react";
import * as THREE from "three";
import { useAuth } from "@/context/AuthContext";
import { Navigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Canvas } from "@react-three/fiber";
import { Float, Environment, Html } from "@react-three/drei";
import {
  ArrowRight,
  BadgeCheck,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Lock,
  Mail,
  Phone,
  UserRound,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

function Field({ label, helper, icon: Icon, rightSlot, className, ...props }) {
  return (
    <div className="space-y-2">
      <Label className="text-sm text-white/80">
        {label}
        {helper && <span className="ml-2 text-xs text-white/45">{helper}</span>}
      </Label>
      <div className="relative">
        {Icon && <Icon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-cyan-300/70" />}
        <Input
          {...props}
          className={cn(
            "glass-input h-11 border-white/10 bg-white/5 pl-10 text-white placeholder:text-white/35",
            rightSlot && "pr-11",
            className
          )}
        />
        {rightSlot && <div className="absolute inset-y-0 right-2 flex items-center">{rightSlot}</div>}
      </div>
    </div>
  );
}

function FriendlyError(error, mode) {
  const raw = error instanceof Error ? error.message : String(error || "");
  const msg = raw.toLowerCase();
  
  if (!raw) return "Something went wrong. Please try again.";
  if (msg.includes("could not connect to the backend") || msg.includes("failed to fetch") || msg.includes("networkerror")) {
    return "We can't reach ConnectHub right now. Please check that the backend services are running.";
  }
  if (msg.includes("email already registered")) return "This email is already registered. Try signing in instead.";
  if (msg.includes("phone number already registered")) return "This phone number is already registered. Try signing in instead.";
  if (msg.includes("username already registered")) return "That username is already taken. Please choose another one.";
  if (msg.includes("invalid email or password") || msg.includes("bad credentials")) return "That email/phone and password do not match.";
  if (msg.includes("email/phone number and password are required")) return "Please enter your email or phone number and password.";
  if (msg.includes("email, phone number, username and password are required")) return "Please fill in your email, phone number, username, and password.";
  if (msg.includes("account not found") || msg.includes("user not found")) {
    return mode === "recover"
      ? "We couldn't find an account with that email or phone number."
      : "We couldn't find an account with that email or phone number. Please check it and try again.";
  }
  if (msg.includes("token") && msg.includes("invalid")) return "That reset token is invalid or has expired. Please request a new one.";
  if (msg.includes("token") && msg.includes("expired")) return "That reset token has expired. Please request a new one.";
  if (msg.includes("we couldn't find that account") || msg.includes("not found") || msg.includes("404")) {
    if (mode === "signup") return "We couldn't connect to the registration service. Please verify the backend API is running properly.";
    if (mode === "recover") return "We couldn't find that account or reset service. Please check the details and try again.";
    return "We couldn't find that account or service. Please check the details and try again.";
  }
  return raw;
}

const SpeechBubble = ({ position, scale, color, rotationIntensity, floatIntensity, speed, flipped, text }) => {
  const shape = useMemo(() => {
    const s = new THREE.Shape();
    const width = 2.4;
    const height = 1.4;
    const radius = 0.3;
    
    // Draw an aesthetic speech bubble
    s.moveTo(-width/2 + radius, height/2);
    s.lineTo(width/2 - radius, height/2);
    s.quadraticCurveTo(width/2, height/2, width/2, height/2 - radius);
    s.lineTo(width/2, -height/2 + radius);
    s.quadraticCurveTo(width/2, -height/2, width/2 - radius, -height/2);
    
    if (flipped) {
      s.lineTo(-width/2 + 0.8, -height/2);
      s.lineTo(-width/2 + 0.4, -height/2 - 0.6); // left tail
      s.lineTo(-width/2 + 0.4, -height/2);
      s.lineTo(-width/2 + radius, -height/2);
    } else {
      s.lineTo(width/2 - 0.4, -height/2);
      s.lineTo(width/2 - 0.4, -height/2 - 0.6); // right tail
      s.lineTo(width/2 - 0.8, -height/2);
      s.lineTo(-width/2 + radius, -height/2);
    }
    
    s.quadraticCurveTo(-width/2, -height/2, -width/2, -height/2 + radius);
    s.lineTo(-width/2, height/2 - radius);
    s.quadraticCurveTo(-width/2, height/2, -width/2 + radius, height/2);
    return s;
  }, [flipped]);

  const extrudeSettings = { depth: 0.3, bevelEnabled: true, bevelSegments: 4, steps: 2, bevelSize: 0.04, bevelThickness: 0.04 };

  return (
    <Float speed={speed} rotationIntensity={rotationIntensity} floatIntensity={floatIntensity} position={position}>
      <mesh scale={scale}>
        <extrudeGeometry args={[shape, extrudeSettings]} />
        <meshPhysicalMaterial 
          color={color} 
          roughness={0.15}
          metalness={0.3}
          transmission={0.9}
          thickness={0.8}
          ior={1.4}
        />
        <Html transform center position={[flipped ? -0.1 : 0.1, 0, 0.35]} scale={0.4}>
          <div className="select-none text-white font-extrabold whitespace-nowrap" style={{ textShadow: "0px 2px 10px rgba(0,0,0,0.4)", fontSize: "2rem" }}>
            {text}
          </div>
        </Html>
      </mesh>
    </Float>
  );
};

const BackgroundOrbs = () => {
  return (
    <div className="absolute inset-0 max-w-full max-h-screen overflow-hidden opacity-60">
      {/* Underlying glow */}
      <motion.div
        className="absolute top-[-10%] left-[-10%] h-[50vw] w-[50vw] rounded-full bg-cyan-500/15 blur-[120px]"
        animate={{ x: [0, 50, 0], y: [0, 50, 0] }}
        transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute bottom-[-10%] right-[-10%] h-[40vw] w-[40vw] rounded-full bg-fuchsia-600/15 blur-[120px]"
        animate={{ x: [0, -50, 0], y: [0, -50, 0] }}
        transition={{ duration: 25, repeat: Infinity, ease: "easeInOut" }}
      />

      <Canvas camera={{ position: [0, 0, 10], fov: 45 }} className="w-full h-full pointer-events-none">
        <ambientLight intensity={1.5} />
        <directionalLight position={[10, 10, 5]} intensity={2} color="#22d3ee" />
        <directionalLight position={[-10, -10, -5]} intensity={2} color="#d946ef" />
        <directionalLight position={[0, -10, 10]} intensity={1} color="#8b5cf6" />
        
        {/* Exactly 3 Chat Elements using Greetings */}
        
        {/* 1. English */}
        <SpeechBubble text="Hello" position={[-5, 3, -3]} scale={1.2} color="#22d3ee" rotationIntensity={1.2} floatIntensity={2} speed={1.5} flipped={false} />
        
        {/* 2. Japanese */}
        <SpeechBubble text="こんにちは" position={[6, -1, -5]} scale={1.3} color="#d946ef" rotationIntensity={1.5} floatIntensity={1.5} speed={2} flipped={true} />
        
        {/* 3. Korean */}
        <SpeechBubble text="안녕하세요" position={[-4, -4, -4]} scale={1.2} color="#8b5cf6" rotationIntensity={1.8} floatIntensity={2.5} speed={1.2} flipped={false} />
      </Canvas>
    </div>
  );
};

export default function Login() {
  const { login, signup, forgotPassword, resetPassword, isAuthenticated } = useAuth();
  const [searchParams] = useSearchParams();
  const resetToken = searchParams.get("token") || searchParams.get("resetToken") || "";

  const [mode, setMode] = useState("signin");
  const [busy, setBusy] = useState("");
  const [alert, setAlert] = useState(null);
  const [recoveryOpen, setRecoveryOpen] = useState(Boolean(resetToken));
  
  const [showSignInPassword, setShowSignInPassword] = useState(false);
  const [showSignUpPassword, setShowSignUpPassword] = useState(false);
  const [showResetPassword, setShowResetPassword] = useState(false);
  
  const [signIn, setSignIn] = useState({ identifier: "", password: "" });
  const [signUp, setSignUp] = useState({ username: "", email: "", phoneNumber: "", password: "", confirmPassword: "" });
  const [recover, setRecover] = useState({ identifier: "", token: resetToken, newPassword: "", confirmPassword: "" });

  useEffect(() => {
    if (resetToken) {
      setRecoveryOpen(true);
      setRecover((current) => ({ ...current, token: resetToken }));
    }
  }, [resetToken]);

  const onSignIn = async (event) => {
    event.preventDefault();
    if (!signIn.identifier.trim() || !signIn.password) {
      setAlert({ type: "error", text: "Please enter your email or phone number and password." });
      return;
    }
    setBusy("signin");
    setAlert(null);
    try {
      await login(signIn.identifier.trim(), signIn.password);
    } catch (error) {
      setAlert({ type: "error", text: FriendlyError(error, "signin") });
    } finally {
      setBusy("");
    }
  };

  const onSignUp = async (event) => {
    event.preventDefault();
    const payload = {
      username: signUp.username.trim(),
      email: signUp.email.trim(),
      phoneNumber: signUp.phoneNumber.trim(),
      password: signUp.password,
    };
    if (!payload.username || !payload.email || !payload.phoneNumber || !payload.password) {
      setAlert({ type: "error", text: "Please fill in your email, phone number, username, and password." });
      return;
    }
    if (!payload.email.includes("@")) {
      setAlert({ type: "error", text: "Please enter a valid email address." });
      return;
    }
    if (payload.password.length < 8) {
      setAlert({ type: "error", text: "Use at least 8 characters for your password." });
      return;
    }
    if (payload.password !== signUp.confirmPassword) {
      setAlert({ type: "error", text: "Your passwords do not match." });
      return;
    }
    setBusy("signup");
    setAlert(null);
    try {
      const response = await signup(payload);
      setAlert({ type: "success", text: response?.message || "Account created successfully! Please sign in." });
      setSignUp({ username: "", email: "", phoneNumber: "", password: "", confirmPassword: "" });
      setMode("signin");
    } catch (error) {
      setAlert({ type: "error", text: FriendlyError(error, "signup") });
    } finally {
      setBusy("");
    }
  };

  const onForgot = async (event) => {
    event.preventDefault();
    if (!recover.identifier.trim()) {
      setAlert({ type: "error", text: "Enter your email or phone number so we can look up your account." });
      return;
    }
    setBusy("forgot");
    setAlert(null);
    try {
      const result = await forgotPassword(recover.identifier.trim());
      const nextToken = result?.token || result?.resetToken || result?.data?.token || "";
      if (nextToken) setRecover((current) => ({ ...current, token: nextToken }));
      setAlert({ type: "success", text: nextToken ? "A reset token is ready below." : "If the account exists, the reset step has been generated." });
    } catch (error) {
      setAlert({ type: "error", text: FriendlyError(error, "recover") });
    } finally {
      setBusy("");
    }
  };

  const onReset = async (event) => {
    event.preventDefault();
    if (!recover.token.trim() || !recover.newPassword) {
      setAlert({ type: "error", text: "Add your reset token and a new password first." });
      return;
    }
    if (recover.newPassword.length < 8) {
      setAlert({ type: "error", text: "Use at least 8 characters for your new password." });
      return;
    }
    if (recover.newPassword !== recover.confirmPassword) {
      setAlert({ type: "error", text: "Your new password and confirmation do not match." });
      return;
    }
    setBusy("reset");
    setAlert(null);
    try {
      await resetPassword(recover.token.trim(), recover.newPassword);
      setRecoveryOpen(false);
      setMode("signin");
      setAlert({ type: "success", text: "Your password has been updated. You can sign in now." });
    } catch (error) {
      setAlert({ type: "error", text: FriendlyError(error, "recover") });
    } finally {
      setBusy("");
    }
  };

  if (isAuthenticated) {
    return <Navigate to="/chat" replace />;
  }

  const submitButtonClasses = "glass-button-primary group w-full rounded-2xl bg-gradient-to-r from-cyan-400 via-violet-500 to-fuchsia-500 px-5 py-3 text-base font-semibold text-white shadow-lg shadow-fuchsia-500/20 hover:scale-[1.01] hover:shadow-fuchsia-500/40 active:scale-[0.99]";

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#050816] text-white flex justify-center items-center px-4 py-8">
      {/* Dynamic 3D Orbs Background */}
      <BackgroundOrbs />
      
      {/* Grid Pattern Overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[size:36px_36px] opacity-20 pointer-events-none" />

      {/* Main Authentication Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="w-full max-w-[480px] relative z-10"
        style={{ perspective: "1000px" }}
      >
        <motion.div
          whileHover={{ rotateX: 1, rotateY: -1 }}
          transition={{ type: "spring", stiffness: 300, damping: 20 }}
        >
          <div className="absolute inset-0 -z-10 rounded-[2.25rem] bg-gradient-to-br from-cyan-400/30 via-transparent to-fuchsia-500/30 blur-2xl" />
          
          <Card className="glass-dark relative overflow-hidden rounded-[2.25rem] border-white/10 bg-slate-950/60 backdrop-blur-3xl shadow-2xl">
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/80 to-transparent" />
            
            <CardHeader className="space-y-3 pb-4">
              <div className="flex items-center justify-between">
                <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.2em] text-white/60">
                  <ShieldCheck className="h-4 w-4 text-cyan-400" />
                  ConnectHub
                </div>
              </div>
              <div className="space-y-1 mt-4">
                <CardTitle className="text-3xl mt-2 font-black tracking-tight text-white">
                  Welcome back
                </CardTitle>
                <CardDescription className="text-sm text-white/50">
                  Sign in or create an account to get started.
                </CardDescription>
              </div>
            </CardHeader>
            
            <CardContent className="space-y-5">
              {/* Alert Message */}
              {alert && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={cn(
                    "rounded-xl border px-4 py-3 text-sm leading-5",
                    alert.type === "error" ? "border-rose-500/30 bg-rose-500/10 text-rose-200" : "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
                  )}
                >
                  <div className="flex items-center gap-3">
                    {alert.type === "error" ? <Lock className="h-4 w-4" /> : <BadgeCheck className="h-4 w-4" />}
                    <p>{alert.text}</p>
                  </div>
                </motion.div>
              )}

              {/* Mode Switcher */}
              <div className="grid grid-cols-2 gap-1 rounded-xl bg-white/5 p-1 border border-white/10">
                <Button
                  type="button"
                  variant="ghost"
                  className={cn(
                    "rounded-lg px-3 py-2 text-sm font-medium transition-all",
                    mode === "signin" ? "bg-white/10 text-white shadow-sm" : "text-white/50 hover:text-white"
                  )}
                  onClick={() => { setMode("signin"); setAlert(null); setRecoveryOpen(false); }}
                >
                  Sign in
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className={cn(
                    "rounded-lg px-3 py-2 text-sm font-medium transition-all",
                    mode === "signup" ? "bg-white/10 text-white shadow-sm" : "text-white/50 hover:text-white"
                  )}
                  onClick={() => { setMode("signup"); setAlert(null); setRecoveryOpen(false); }}
                >
                  Create account
                </Button>
              </div>

              {/* Sign In Form */}
              {mode === "signin" && !recoveryOpen && (
                <motion.form key="signin" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4" onSubmit={onSignIn}>
                  <Field
                    label="Email or phone"
                    icon={Mail}
                    placeholder="name@example.com"
                    value={signIn.identifier}
                    onChange={(e) => setSignIn({ ...signIn, identifier: e.target.value })}
                  />
                  <Field
                    label="Password"
                    icon={Lock}
                    type={showSignInPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={signIn.password}
                    onChange={(e) => setSignIn({ ...signIn, password: e.target.value })}
                    rightSlot={
                      <button type="button" className="text-white/50 hover:text-white" onClick={() => setShowSignInPassword(!showSignInPassword)}>
                        {showSignInPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    }
                  />
                  <div className="flex justify-end pt-1">
                    <button type="button" onClick={() => setRecoveryOpen(true)} className="text-xs text-cyan-400 hover:text-cyan-300 font-medium">
                      Forgot password?
                    </button>
                  </div>
                  <Button type="submit" className={submitButtonClasses} disabled={busy === "signin"}>
                    {busy === "signin" ? <Loader2 className="h-5 w-5 animate-spin" /> : "Sign in"}
                  </Button>
                </motion.form>
              )}

              {/* Sign Up Form */}
              {mode === "signup" && !recoveryOpen && (
                <motion.form key="signup" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4" onSubmit={onSignUp}>
                  <Field
                    label="Username"
                    icon={UserRound}
                    placeholder="johndoe"
                    value={signUp.username}
                    onChange={(e) => setSignUp({ ...signUp, username: e.target.value })}
                  />
                  <Field
                    label="Email"
                    icon={Mail}
                    type="email"
                    placeholder="name@example.com"
                    value={signUp.email}
                    onChange={(e) => setSignUp({ ...signUp, email: e.target.value })}
                  />
                  <Field
                    label="Phone"
                    icon={Phone}
                    placeholder="+1 234 567 890"
                    value={signUp.phoneNumber}
                    onChange={(e) => setSignUp({ ...signUp, phoneNumber: e.target.value })}
                  />
                  <Field
                    label="Password"
                    icon={Lock}
                    type={showSignUpPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={signUp.password}
                    onChange={(e) => setSignUp({ ...signUp, password: e.target.value })}
                    rightSlot={
                      <button type="button" className="text-white/50 hover:text-white" onClick={() => setShowSignUpPassword(!showSignUpPassword)}>
                        {showSignUpPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    }
                  />
                  <Field
                    label="Confirm password"
                    icon={KeyRound}
                    type="password"
                    placeholder="••••••••"
                    value={signUp.confirmPassword}
                    onChange={(e) => setSignUp({ ...signUp, confirmPassword: e.target.value })}
                  />
                  <Button type="submit" className={submitButtonClasses} disabled={busy === "signup"}>
                    {busy === "signup" ? <Loader2 className="h-5 w-5 animate-spin" /> : "Create account"}
                  </Button>
                </motion.form>
              )}

              {/* Recovery Form */}
              {recoveryOpen && (
                <motion.div key="recovery" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="space-y-5">
                  <div className="flex items-center justify-between pb-2 border-b border-white/10">
                    <h3 className="text-sm font-semibold text-white">Reset Password</h3>
                    <button type="button" onClick={() => setRecoveryOpen(false)} className="text-xs text-white/50 hover:text-white">
                      Cancel
                    </button>
                  </div>
                  <form onSubmit={onForgot} className="space-y-3">
                    <Field
                      label="Email or phone"
                      icon={Mail}
                      placeholder="Enter identity"
                      value={recover.identifier}
                      onChange={(e) => setRecover({ ...recover, identifier: e.target.value })}
                    />
                    <Button type="submit" className="w-full bg-white/10 hover:bg-white/15 text-white h-11 rounded-xl" disabled={busy === "forgot"}>
                      {busy === "forgot" ? <Loader2 className="h-5 w-5 animate-spin" /> : "Send token"}
                    </Button>
                  </form>
                  <form onSubmit={onReset} className="space-y-3 pt-4 border-t border-white/10">
                    <Field
                      label="Token"
                      icon={KeyRound}
                      placeholder="Paste reset token here"
                      value={recover.token}
                      onChange={(e) => setRecover({ ...recover, token: e.target.value })}
                    />
                    <Field
                      label="New password"
                      icon={Lock}
                      type={showResetPassword ? "text" : "password"}
                      value={recover.newPassword}
                      onChange={(e) => setRecover({ ...recover, newPassword: e.target.value })}
                      rightSlot={
                        <button type="button" className="text-white/50 hover:text-white" onClick={() => setShowResetPassword(!showResetPassword)}>
                          {showResetPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      }
                    />
                    <Field
                      label="Confirm new password"
                      icon={Lock}
                      type="password"
                      value={recover.confirmPassword}
                      onChange={(e) => setRecover({ ...recover, confirmPassword: e.target.value })}
                    />
                    <Button type="submit" className={submitButtonClasses} disabled={busy === "reset"}>
                      {busy === "reset" ? <Loader2 className="h-5 w-5 animate-spin" /> : "Reset password"}
                    </Button>
                  </form>
                </motion.div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>
    </div>
  );
}
