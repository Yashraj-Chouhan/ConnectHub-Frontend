/*
 * Public authentication page.
 *
 * It combines sign-in, OTP-based registration, and password recovery into one
 * branded entry experience for the platform.
 */
import { useState, useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useAuth } from "@/context/AuthContext";
import { Navigate, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Canvas } from "@react-three/fiber";
import { Float, Html } from "@react-three/drei";
import {
  ArrowRight,
  BadgeCheck,
  CheckCircle2,
  ChevronDown,
  Eye,
  EyeOff,
  Globe,
  KeyRound,
  Loader2,
  Lock,
  Mail,
  Phone,
  RotateCcw,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const GOOGLE_CLIENT_ID = (import.meta.env.VITE_GOOGLE_CLIENT_ID || "").trim();
const GOOGLE_IDENTITY_SCRIPT_SRC = "https://accounts.google.com/gsi/client";
const GOOGLE_IDENTITY_SCRIPT_SELECTOR = 'script[data-google-identity="true"]';

// ─── Country data (dial codes + phone length rules) ──────────────────────────
const COUNTRIES = [
  { code: "IN", name: "India",          dial: "+91",  flag: "🇮🇳", min: 10, max: 10, pattern: /^\d{10}$/ },
  { code: "US", name: "United States",  dial: "+1",   flag: "🇺🇸", min: 10, max: 10, pattern: /^\d{10}$/ },
  { code: "GB", name: "United Kingdom", dial: "+44",  flag: "🇬🇧", min: 10, max: 10, pattern: /^\d{10}$/ },
  { code: "AU", name: "Australia",      dial: "+61",  flag: "🇦🇺", min: 9,  max: 9,  pattern: /^\d{9}$/  },
  { code: "CA", name: "Canada",         dial: "+1",   flag: "🇨🇦", min: 10, max: 10, pattern: /^\d{10}$/ },
  { code: "DE", name: "Germany",        dial: "+49",  flag: "🇩🇪", min: 10, max: 11, pattern: /^\d{10,11}$/ },
  { code: "FR", name: "France",         dial: "+33",  flag: "🇫🇷", min: 9,  max: 9,  pattern: /^\d{9}$/  },
  { code: "JP", name: "Japan",          dial: "+81",  flag: "🇯🇵", min: 10, max: 10, pattern: /^\d{10}$/ },
  { code: "CN", name: "China",          dial: "+86",  flag: "🇨🇳", min: 11, max: 11, pattern: /^\d{11}$/ },
  { code: "BR", name: "Brazil",         dial: "+55",  flag: "🇧🇷", min: 10, max: 11, pattern: /^\d{10,11}$/ },
  { code: "MX", name: "Mexico",         dial: "+52",  flag: "🇲🇽", min: 10, max: 10, pattern: /^\d{10}$/ },
  { code: "ZA", name: "South Africa",   dial: "+27",  flag: "🇿🇦", min: 9,  max: 9,  pattern: /^\d{9}$/  },
  { code: "NG", name: "Nigeria",        dial: "+234", flag: "🇳🇬", min: 10, max: 10, pattern: /^\d{10}$/ },
  { code: "SG", name: "Singapore",      dial: "+65",  flag: "🇸🇬", min: 8,  max: 8,  pattern: /^\d{8}$/  },
  { code: "AE", name: "UAE",            dial: "+971", flag: "🇦🇪", min: 9,  max: 9,  pattern: /^\d{9}$/  },
  { code: "PK", name: "Pakistan",       dial: "+92",  flag: "🇵🇰", min: 10, max: 10, pattern: /^\d{10}$/ },
  { code: "BD", name: "Bangladesh",     dial: "+880", flag: "🇧🇩", min: 10, max: 10, pattern: /^\d{10}$/ },
  { code: "RU", name: "Russia",         dial: "+7",   flag: "🇷🇺", min: 10, max: 10, pattern: /^\d{10}$/ },
  { code: "IT", name: "Italy",          dial: "+39",  flag: "🇮🇹", min: 9,  max: 10, pattern: /^\d{9,10}$/ },
  { code: "ES", name: "Spain",          dial: "+34",  flag: "🇪🇸", min: 9,  max: 9,  pattern: /^\d{9}$/  },
  { code: "KR", name: "South Korea",    dial: "+82",  flag: "🇰🇷", min: 10, max: 10, pattern: /^\d{10}$/ },
  { code: "ID", name: "Indonesia",      dial: "+62",  flag: "🇮🇩", min: 9,  max: 12, pattern: /^\d{9,12}$/ },
];

// ─── Phone Selector Component ─────────────────────────────────────────────────
function CountryPhoneInput({ country, setCountry, phone, setPhone, error }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const dropdownRef = useRef(null);
  const searchRef = useRef(null);
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (open && searchRef.current) searchRef.current.focus();
  }, [open]);

  useEffect(() => {
    const handleClick = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpen(false);
        setSearch("");
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const filtered = useMemo(
    () => COUNTRIES.filter((c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.dial.includes(search) ||
      c.code.toLowerCase().includes(search.toLowerCase())
    ),
    [search]
  );

  const hint = `${country.min === country.max ? country.min : `${country.min}–${country.max}`} digits after dial code`;

  return (
    <div className="space-y-2">
      <Label className="text-sm text-white/80">
        Phone number
        <span className="ml-2 text-xs text-white/45">{hint}</span>
      </Label>
      <div className="flex gap-2">
        {/* Country selector */}
        <div ref={dropdownRef} className="relative flex-shrink-0">
          <button
            type="button"
            onClick={() => { setOpen((prev) => !prev); setSearch(""); }}
            className="flex items-center gap-1.5 h-11 px-3 rounded-xl border border-white/10 bg-white/5 text-white text-sm hover:bg-white/10 transition-colors focus:outline-none focus:ring-1 focus:ring-cyan-400/50"
          >
            <span className="text-base">{country.flag}</span>
            <span className="font-mono text-cyan-300">{country.dial}</span>
            <ChevronDown className={cn("h-3.5 w-3.5 text-white/50 transition-transform", open && "rotate-180")} />
          </button>

          <AnimatePresence>
            {open && (
              <motion.div
                initial={{ opacity: 0, y: 4, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 4, scale: 0.97 }}
                transition={{ duration: 0.15 }}
                className="absolute left-0 top-12 z-50 w-60 rounded-2xl border border-white/10 bg-[#0f1218]/95 backdrop-blur-xl shadow-2xl overflow-hidden"
              >
                <div className="p-2 border-b border-white/10">
                  <input
                    ref={searchRef}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search country…"
                    className="w-full bg-white/5 text-white text-sm placeholder:text-white/35 px-3 py-1.5 rounded-lg focus:outline-none focus:ring-1 focus:ring-cyan-400/50"
                  />
                </div>
                <div className="max-h-52 overflow-y-auto divide-y divide-white/5">
                  {filtered.map((c) => (
                    <button
                      key={c.code}
                      type="button"
                      onClick={() => { setCountry(c); setOpen(false); setSearch(""); setPhone(""); }}
                      className={cn(
                        "w-full flex items-center gap-3 px-3 py-2.5 text-sm hover:bg-white/8 transition-colors",
                        c.code === country.code ? "bg-cyan-500/10 text-cyan-300" : "text-white/80"
                      )}
                    >
                      <span className="text-base">{c.flag}</span>
                      <span className="flex-1 text-left">{c.name}</span>
                      <span className="font-mono text-white/45 text-xs">{c.dial}</span>
                    </button>
                  ))}
                  {filtered.length === 0 && (
                    <div className="px-3 py-4 text-center text-sm text-white/40">No countries found</div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Phone number input */}
        <div className="relative flex-1">
          <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-cyan-300/70" />
          <input
            type="tel"
            inputMode="numeric"
            placeholder={`${"0".repeat(country.min)} (${country.min} digits)`}
            value={phone}
            maxLength={country.max + 2}
            onChange={(e) => {
              const digits = e.target.value.replace(/\D/g, "");
              setPhone(digits);
            }}
            onBlur={() => setTouched(true)}
            className={cn(
              "w-full h-11 pl-10 pr-4 rounded-xl border bg-white/5 text-white placeholder:text-white/35 text-sm focus:outline-none focus:ring-1 transition-colors",
              touched && error
                ? "border-rose-500/50 focus:ring-rose-500/50"
                : "border-white/10 focus:ring-cyan-400/50"
            )}
          />
        </div>
      </div>
      {touched && error && <p className="text-xs text-rose-400">{error}</p>}
    </div>
  );
}

// ─── OTP Input ─────────────────────────────────────────────────────────────────
function OtpInput({ value, onChange }) {
  const refs = [useRef(), useRef(), useRef(), useRef(), useRef(), useRef()];
  const digits = value.split("").concat(Array(6).fill("")).slice(0, 6);

  const handleKey = (index, e) => {
    if (e.key === "Backspace") {
      const next = digits.map((d, i) => (i === index ? "" : d)).join("");
      onChange(next);
      if (index > 0) refs[index - 1].current?.focus();
    }
  };

  const handleChange = (index, e) => {
    const char = e.target.value.replace(/\D/g, "").slice(-1);
    const next = digits.map((d, i) => (i === index ? char : d)).join("");
    onChange(next);
    if (char && index < 5) refs[index + 1].current?.focus();
  };

  const handlePaste = (e) => {
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    onChange(pasted.padEnd(6, "").slice(0, 6));
    e.preventDefault();
  };

  return (
    <div className="flex gap-2 justify-center">
      {refs.map((ref, i) => (
        <input
          key={i}
          ref={ref}
          value={digits[i]}
          onChange={(e) => handleChange(i, e)}
          onKeyDown={(e) => handleKey(i, e)}
          onPaste={i === 0 ? handlePaste : undefined}
          maxLength={1}
          inputMode="numeric"
          className={cn(
            "w-11 h-12 rounded-xl border text-center text-lg font-bold text-white bg-white/5 transition-all focus:outline-none focus:ring-2",
            digits[i]
              ? "border-cyan-400/60 focus:ring-cyan-400/50 scale-105"
              : "border-white/10 focus:ring-violet-500/50"
          )}
        />
      ))}
    </div>
  );
}

// ─── Generic Field ─────────────────────────────────────────────────────────────
function Field({ label, helper, icon: Icon, rightSlot, className, error, ...props }) {
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
            "h-11 border-white/10 bg-white/5 pl-10 text-white placeholder:text-white/35 rounded-xl focus-visible:ring-cyan-400/50",
            error && "border-rose-500/40",
            rightSlot && "pr-11",
            className
          )}
        />
        {rightSlot && <div className="absolute inset-y-0 right-2 flex items-center">{rightSlot}</div>}
      </div>
      {error && <p className="text-xs text-rose-400">{error}</p>}
    </div>
  );
}

// ─── Friendly Error mapper ─────────────────────────────────────────────────────
function FriendlyError(error, mode) {
  const raw = error instanceof Error ? error.message : String(error || "");
  const msg = raw.toLowerCase();
  if (!raw) return "Something went wrong. Please try again.";
  if (msg.includes("could not connect") || msg.includes("failed to fetch") || msg.includes("networkerror"))
    return "We can't reach ConnectHub right now. Please check that the backend services are running.";
  if (msg.includes("google sign-in is not configured"))
    return "Google sign-in isn't configured yet. Add the Google client ID and try again.";
  if (msg.includes("google") && msg.includes("verified"))
    return "Please use a Google account with a verified email address.";
  if (msg.includes("google") && (msg.includes("token") || msg.includes("credential") || msg.includes("verify")))
    return "We couldn't verify your Google sign-in. Please try again.";
  if (msg.includes("email address already exists")) return "This email is already registered. Try signing in instead.";
  if (msg.includes("mobile number already exists")) return "This mobile number is already registered. Try signing in instead.";
  if (msg.includes("username is already taken")) return "That username is taken. Please choose another one.";
  if (msg.includes("invalid email or password") || msg.includes("bad credentials")) return "That email/phone and password don't match.";
  if (msg.includes("verification code is incorrect")) return "That OTP is incorrect. Please check and try again.";
  if (msg.includes("verification code has expired")) return "Your OTP has expired. Please go back and try again.";
  if (msg.includes("not found") || msg.includes("404")) {
    if (mode === "signup") return "We couldn't reach the registration service. Please verify the backend is running.";
    return "We couldn't find that account. Please check the details and try again.";
  }
  return raw;
}

// ─── 3-D Floating speech bubbles ─────────────────────────────────────────────
const SpeechBubble = ({ position, scale, color, rotationIntensity, floatIntensity, speed, flipped, text }) => {
  const shape = useMemo(() => {
    const s = new THREE.Shape();
    const w = 2.4, h = 1.4, r = 0.3;
    s.moveTo(-w / 2 + r, h / 2);
    s.lineTo(w / 2 - r, h / 2);
    s.quadraticCurveTo(w / 2, h / 2, w / 2, h / 2 - r);
    s.lineTo(w / 2, -h / 2 + r);
    s.quadraticCurveTo(w / 2, -h / 2, w / 2 - r, -h / 2);
    if (flipped) {
      s.lineTo(-w / 2 + 0.8, -h / 2);
      s.lineTo(-w / 2 + 0.4, -h / 2 - 0.6);
      s.lineTo(-w / 2 + 0.4, -h / 2);
      s.lineTo(-w / 2 + r, -h / 2);
    } else {
      s.lineTo(w / 2 - 0.4, -h / 2);
      s.lineTo(w / 2 - 0.4, -h / 2 - 0.6);
      s.lineTo(w / 2 - 0.8, -h / 2);
      s.lineTo(-w / 2 + r, -h / 2);
    }
    s.quadraticCurveTo(-w / 2, -h / 2, -w / 2, -h / 2 + r);
    s.lineTo(-w / 2, h / 2 - r);
    s.quadraticCurveTo(-w / 2, h / 2, -w / 2 + r, h / 2);
    return s;
  }, [flipped]);

  return (
    <Float speed={speed} rotationIntensity={rotationIntensity} floatIntensity={floatIntensity} position={position}>
      <mesh scale={scale}>
        <extrudeGeometry args={[shape, { depth: 0.3, bevelEnabled: true, bevelSegments: 4, steps: 2, bevelSize: 0.04, bevelThickness: 0.04 }]} />
        <meshPhysicalMaterial color={color} roughness={0.15} metalness={0.3} transmission={0.9} thickness={0.8} ior={1.4} />
        <Html transform center position={[flipped ? -0.1 : 0.1, 0, 0.35]} scale={0.4}>
          <div className="select-none text-white font-extrabold whitespace-nowrap" style={{ textShadow: "0px 2px 10px rgba(0,0,0,0.4)", fontSize: "2rem" }}>
            {text}
          </div>
        </Html>
      </mesh>
    </Float>
  );
};

function shouldUseRichBackground() {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return false;
  }

  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
    return false;
  }

  if (window.matchMedia?.("(max-width: 768px)").matches) {
    return false;
  }

  if (navigator.connection?.saveData) {
    return false;
  }

  try {
    const canvas = document.createElement("canvas");
    const gl =
      canvas.getContext("webgl", { failIfMajorPerformanceCaveat: true }) ||
      canvas.getContext("experimental-webgl", { failIfMajorPerformanceCaveat: true });

    return Boolean(window.WebGLRenderingContext && gl);
  } catch {
    return false;
  }
}

const BackgroundOrbs = () => {
  const [showRichBackground, setShowRichBackground] = useState(false);

  useEffect(() => {
    setShowRichBackground(shouldUseRichBackground());
  }, []);

  return (
  <div className="absolute inset-0 max-w-full h-full overflow-hidden opacity-60">
    <motion.div className="absolute top-[-10%] left-[-10%] h-[50vw] w-[50vw] rounded-full bg-cyan-500/15 blur-[120px]"
      animate={{ x: [0, 50, 0], y: [0, 50, 0] }} transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }} />
    <motion.div className="absolute bottom-[-10%] right-[-10%] h-[40vw] w-[40vw] rounded-full bg-fuchsia-600/15 blur-[120px]"
      animate={{ x: [0, -50, 0], y: [0, -50, 0] }} transition={{ duration: 25, repeat: Infinity, ease: "easeInOut" }} />
    {showRichBackground && (
    <Canvas camera={{ position: [0, 0, 10], fov: 45 }} className="w-full h-full pointer-events-none">
      <ambientLight intensity={1.5} />
      <directionalLight position={[10, 10, 5]} intensity={2} color="#22d3ee" />
      <directionalLight position={[-10, -10, -5]} intensity={2} color="#d946ef" />
      <directionalLight position={[0, -10, 10]} intensity={1} color="#8b5cf6" />
      <SpeechBubble text="Hello"    position={[-5, 3, -3]}  scale={1.2} color="#22d3ee" rotationIntensity={1.2} floatIntensity={2}   speed={1.5} flipped={false} />
      <SpeechBubble text="こんにちは" position={[6, -1, -5]} scale={1.3} color="#d946ef" rotationIntensity={1.5} floatIntensity={1.5} speed={2}   flipped={true}  />
      <SpeechBubble text="안녕하세요" position={[-4,-4, -4]} scale={1.2} color="#8b5cf6" rotationIntensity={1.8} floatIntensity={2.5} speed={1.2} flipped={false} />
    </Canvas>
    )}
  </div>
  );
};

// ─── Password-strength meter ───────────────────────────────────────────────────
function PasswordStrength({ password }) {
  const checks = [
    { label: "8+ characters", ok: password.length >= 8 },
    { label: "Letter", ok: /[a-zA-Z]/.test(password) },
    { label: "Number", ok: /\d/.test(password) },
    { label: "Special char", ok: /[^a-zA-Z0-9]/.test(password) },
  ];
  const score = checks.filter((c) => c.ok).length;
  const colors = ["bg-red-500", "bg-orange-500", "bg-yellow-400", "bg-emerald-400", "bg-emerald-500"];

  if (!password) return null;
  return (
    <div className="space-y-1.5">
      <div className="flex gap-1">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className={cn("h-1 flex-1 rounded-full transition-all duration-300", score >= i ? colors[score] : "bg-white/10")} />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1">
        {checks.map((c) => (
          <span key={c.label} className={cn("text-xs flex items-center gap-1", c.ok ? "text-emerald-400" : "text-white/30")}>
            <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ background: c.ok ? "currentColor" : "rgba(255,255,255,0.15)" }} />
            {c.label}
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── Step indicator ────────────────────────────────────────────────────────────
function StepIndicator({ step }) {
  const steps = ["Your Details", "Verify Email", "Done!"];
  return (
    <div className="flex items-center justify-center gap-2 mb-1">
      {steps.map((label, i) => (
        <div key={label} className="flex items-center gap-2">
          <div className={cn(
            "flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold transition-all",
            i + 1 < step ? "bg-emerald-500 text-white" :
            i + 1 === step ? "bg-gradient-to-br from-cyan-400 to-violet-500 text-white shadow-lg shadow-cyan-500/30" :
            "bg-white/8 text-white/30 border border-white/10"
          )}>
            {i + 1 < step ? <CheckCircle2 className="h-3.5 w-3.5" /> : i + 1}
          </div>
          <span className={cn("text-xs hidden sm:block", i + 1 === step ? "text-white/80 font-medium" : "text-white/30")}>
            {label}
          </span>
          {i < steps.length - 1 && (
            <div className={cn("h-px w-6 rounded-full transition-all", i + 1 < step ? "bg-emerald-500/60" : "bg-white/10")} />
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────
export default function Login() {
  const { login, loginWithGoogle, initiateSignup, completeSignup, forgotPassword, resetPassword, isAuthenticated } = useAuth();
  const [searchParams] = useSearchParams();
  const resetToken = searchParams.get("token") || searchParams.get("resetToken") || "";

  const [mode, setMode]             = useState("signin");
  const [busy, setBusy]             = useState("");
  const [alert, setAlert]           = useState(null);
  const [recoveryOpen, setRecoveryOpen] = useState(Boolean(resetToken));

  // Sign-in
  const [signIn, setSignIn]         = useState({ identifier: "", password: "" });
  const [showSignInPw, setShowSignInPw] = useState(false);
  const [googleReady, setGoogleReady] = useState(
    () => Boolean(GOOGLE_CLIENT_ID && typeof window !== "undefined" && window.google?.accounts?.id)
  );
  const [googleLoadError, setGoogleLoadError] = useState("");
  const googleButtonRef = useRef(null);
  const googleCredentialHandlerRef = useRef(null);

  // Sign-up – step 1
  const [country, setCountry]       = useState(COUNTRIES[0]); // India default
  const [signUp, setSignUp]         = useState({ username: "", email: "", phone: "", password: "", confirmPassword: "" });
  const [phoneError, setPhoneError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [showSignUpPw, setShowSignUpPw] = useState(false);
  const [signupStep, setSignupStep] = useState(1); // 1 = details, 2 = OTP, 3 = done
  const [pendingEmail, setPendingEmail] = useState("");

  // OTP
  const [otp, setOtp]               = useState("");
  const [resendTimer, setResendTimer] = useState(0);

  // Recovery
  const [recover, setRecover]       = useState({ identifier: "", token: resetToken, newPassword: "", confirmPassword: "" });
  const [showResetPw, setShowResetPw] = useState(false);

  useEffect(() => {
    if (resetToken) { setRecoveryOpen(true); setRecover((r) => ({ ...r, token: resetToken })); }
  }, [resetToken]);

  // Resend OTP countdown
  useEffect(() => {
    if (resendTimer <= 0) return;
    const t = setTimeout(() => setResendTimer((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendTimer]);

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID || typeof document === "undefined") {
      return undefined;
    }
    if (window.google?.accounts?.id) {
      setGoogleLoadError("");
      setGoogleReady(true);
      return undefined;
    }

    let cancelled = false;
    const handleLoad = () => {
      if (cancelled) {
        return;
      }
      setGoogleLoadError("");
      setGoogleReady(true);
    };
    const handleError = () => {
      if (cancelled) {
        return;
      }
      setGoogleReady(false);
      setGoogleLoadError("Google sign-in couldn't load. Refresh and try again.");
    };

    const existingScript = document.querySelector(GOOGLE_IDENTITY_SCRIPT_SELECTOR);
    if (existingScript) {
      existingScript.addEventListener("load", handleLoad);
      existingScript.addEventListener("error", handleError);
      return () => {
        cancelled = true;
        existingScript.removeEventListener("load", handleLoad);
        existingScript.removeEventListener("error", handleError);
      };
    }

    const script = document.createElement("script");
    script.src = GOOGLE_IDENTITY_SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.dataset.googleIdentity = "true";
    script.addEventListener("load", handleLoad);
    script.addEventListener("error", handleError);
    document.head.appendChild(script);

    return () => {
      cancelled = true;
      script.removeEventListener("load", handleLoad);
      script.removeEventListener("error", handleError);
    };
  }, []);

  googleCredentialHandlerRef.current = async (credential) => {
    setBusy("google");
    setAlert(null);
    try {
      await loginWithGoogle(credential);
    } catch (err) {
      setAlert({ type: "error", text: FriendlyError(err, "signin") });
    } finally {
      setBusy("");
    }
  };

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID || !googleReady || mode !== "signin" || recoveryOpen || !googleButtonRef.current) {
      return undefined;
    }

    const googleIdentity = window.google?.accounts?.id;
    if (!googleIdentity) {
      setGoogleLoadError("Google sign-in is unavailable right now.");
      return undefined;
    }

    try {
      googleIdentity.initialize({
        client_id: GOOGLE_CLIENT_ID,
        auto_select: false,
        cancel_on_tap_outside: true,
        context: "signin",
        ux_mode: "popup",
        callback: (response) => {
          const credential = typeof response?.credential === "string" ? response.credential.trim() : "";
          if (!credential) {
            setAlert({ type: "error", text: "Google sign-in did not return a credential. Please try again." });
            return;
          }
          void googleCredentialHandlerRef.current?.(credential);
        },
      });

      googleButtonRef.current.innerHTML = "";
      const buttonWidth = Math.max(
        240,
        Math.min(
          400,
          googleButtonRef.current.parentElement?.clientWidth ||
            googleButtonRef.current.clientWidth ||
            320
        )
      );

      googleIdentity.renderButton(googleButtonRef.current, {
        type: "standard",
        theme: "outline",
        text: "signin_with",
        size: "large",
        shape: "pill",
        logo_alignment: "left",
        width: String(buttonWidth),
      });
      setGoogleLoadError("");
    } catch {
      setGoogleLoadError("Google sign-in couldn't initialize. Check the client ID and allowed origins.");
    }

    return () => {
      googleIdentity.cancel();
    };
  }, [googleReady, mode, recoveryOpen]);

  const resetSignupState = () => {
    setSignUp({ username: "", email: "", phone: "", password: "", confirmPassword: "" });
    setSignupStep(1);
    setOtp("");
    setPhoneError("");
    setFieldErrors({});
    setPendingEmail("");
    setAlert(null);
  };

  // ── Validate phone ────────────────────────────────────────────────────────────
  const validatePhone = (digits) => {
    if (!digits) return "Phone number is required.";
    if (!country.pattern.test(digits)) {
      return `${country.name} numbers must be exactly ${country.min === country.max ? country.min : `${country.min}–${country.max}`} digits.`;
    }
    return "";
  };

  // ── Sign-in submit ────────────────────────────────────────────────────────────
  const onSignIn = async (e) => {
    e.preventDefault();
    if (!signIn.identifier.trim() || !signIn.password) {
      setAlert({ type: "error", text: "Please enter your email or phone number and password." });
      return;
    }
    setBusy("signin"); setAlert(null);
    try { await login(signIn.identifier.trim(), signIn.password); }
    catch (err) { setAlert({ type: "error", text: FriendlyError(err, "signin") }); }
    finally { setBusy(""); }
  };

  // ── Signup step 1: send OTP ───────────────────────────────────────────────────
  const onSignUpInitiate = async (e) => {
    e.preventDefault();
    const errs = {};
    if (!signUp.username.trim()) errs.username = "Username is required.";
    if (!signUp.email.trim() || !signUp.email.includes("@")) errs.email = "A valid email is required.";
    const pErr = validatePhone(signUp.phone);
    if (pErr) errs.phone = pErr;
    if (!signUp.password) errs.password = "Password is required.";
    else if (signUp.password.length < 8 || !/[a-zA-Z]/.test(signUp.password) || !/\d/.test(signUp.password))
      errs.password = "Password must be at least 8 characters with a letter and a number.";
    if (signUp.password !== signUp.confirmPassword) errs.confirmPassword = "Passwords do not match.";

    setFieldErrors(errs);
    if (Object.keys(errs).length) return;

    const fullPhone = `${country.dial}${signUp.phone}`;
    setBusy("signup"); setAlert(null);
    try {
      const res = await initiateSignup({
        username: signUp.username.trim(),
        email: signUp.email.trim(),
        phoneNumber: fullPhone,
        password: signUp.password,
      });
      setPendingEmail(signUp.email.trim());
      setSignupStep(2);
      setResendTimer(60);
      setOtp("");
      setAlert({ type: "success", text: res?.message || `Verification code sent to ${signUp.email.trim()}.` });
    } catch (err) {
      setAlert({ type: "error", text: FriendlyError(err, "signup") });
    } finally { setBusy(""); }
  };

  // ── Signup step 2: verify OTP ─────────────────────────────────────────────────
  const onSignUpComplete = async (e) => {
    e.preventDefault();
    if (otp.length !== 6) {
      setAlert({ type: "error", text: "Please enter the complete 6-digit code." });
      return;
    }
    setBusy("verify"); setAlert(null);
    try {
      const res = await completeSignup(pendingEmail, otp);
      setSignupStep(3);
      setAlert({ type: "success", text: res?.message || "Account created! Please sign in." });
    } catch (err) {
      setAlert({ type: "error", text: FriendlyError(err, "signup") });
    } finally { setBusy(""); }
  };

  // ── OTP resend ────────────────────────────────────────────────────────────────
  const onResendOtp = async () => {
    if (resendTimer > 0) return;
    setBusy("resend"); setAlert(null);
    try {
      const fullPhone = `${country.dial}${signUp.phone}`;
      const res = await initiateSignup({
        username: signUp.username.trim(),
        email: pendingEmail,
        phoneNumber: fullPhone,
        password: signUp.password,
      });
      setResendTimer(60);
      setOtp("");
      setAlert({ type: "success", text: res?.message || "A new code has been sent to your email." });
    } catch (err) {
      setAlert({ type: "error", text: FriendlyError(err, "signup") });
    } finally { setBusy(""); }
  };

  // ── Forgot password ───────────────────────────────────────────────────────────
  const onForgot = async (e) => {
    e.preventDefault();
    if (!recover.identifier.trim()) {
      setAlert({ type: "error", text: "Enter your email or phone to look up your account." });
      return;
    }
    setBusy("forgot"); setAlert(null);
    try {
      const result = await forgotPassword(recover.identifier.trim());
      const nextToken = result?.token || result?.resetToken || result?.data?.token || "";
      if (nextToken) setRecover((r) => ({ ...r, token: nextToken }));
      setAlert({ type: "success", text: nextToken ? "Token is ready below." : "If the account exists, a reset code has been sent." });
    } catch (err) {
      setAlert({ type: "error", text: FriendlyError(err, "recover") });
    } finally { setBusy(""); }
  };

  const onReset = async (e) => {
    e.preventDefault();
    if (!recover.token.trim() || !recover.newPassword) {
      setAlert({ type: "error", text: "Add your reset token and a new password first." });
      return;
    }
    if (recover.newPassword.length < 8) {
      setAlert({ type: "error", text: "Use at least 8 characters for your new password." });
      return;
    }
    if (recover.newPassword !== recover.confirmPassword) {
      setAlert({ type: "error", text: "Your new password and confirmation don't match." });
      return;
    }
    setBusy("reset"); setAlert(null);
    try {
      await resetPassword(recover.token.trim(), recover.newPassword);
      setRecoveryOpen(false); setMode("signin");
      setAlert({ type: "success", text: "Password updated. You can sign in now." });
    } catch (err) {
      setAlert({ type: "error", text: FriendlyError(err, "recover") });
    } finally { setBusy(""); }
  };

  if (isAuthenticated) return <Navigate to="/chat" replace />;

  const primaryBtnClass = "glass-button-primary group w-full rounded-2xl bg-gradient-to-r from-cyan-400 via-violet-500 to-fuchsia-500 px-5 py-3 text-base font-semibold text-white shadow-lg shadow-fuchsia-500/20 hover:scale-[1.01] hover:shadow-fuchsia-500/40 active:scale-[0.99]";

  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground flex justify-center items-center px-4 py-8">
      <BackgroundOrbs />
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[size:36px_36px] opacity-20 pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="w-full max-w-[480px] relative z-10"
        style={{ perspective: "1000px" }}
      >
        <motion.div whileHover={{ rotateX: 1, rotateY: -1 }} transition={{ type: "spring", stiffness: 300, damping: 20 }}>
          <div className="absolute inset-0 -z-10 rounded-[2.25rem] bg-gradient-to-br from-primary/30 via-transparent to-secondary/30 blur-2xl" />

          <Card className="glass-dark relative overflow-hidden rounded-[2.25rem] border-white/10 bg-card/60 backdrop-blur-3xl shadow-2xl">
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/80 to-transparent" />

            <CardHeader className="space-y-3 pb-4">
              <div className="flex items-center justify-between">
                <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.2em] text-white/60">
                  <Globe className="h-3.5 w-3.5 text-cyan-400" />
                  ConnectHub
                </div>
                <div className="flex items-center gap-1 text-xs text-white/30">
                  <ShieldCheck className="h-3.5 w-3.5 text-cyan-400/70" />
                  Secure
                </div>
              </div>

              <div className="space-y-1 mt-4">
                <CardTitle className="text-3xl mt-2 font-black tracking-tight text-white">
                  {mode === "signin" ? "Welcome back" : "Join ConnectHub"}
                </CardTitle>
                <CardDescription className="text-sm text-white/50">
                  {mode === "signin"
                    ? "Sign in to connect with the world."
                    : "Create your global profile — it only takes a minute."}
                </CardDescription>
              </div>
            </CardHeader>

            <CardContent className="space-y-5">
              {/* Alert */}
              <AnimatePresence mode="wait">
                {alert && (
                  <motion.div
                    key={alert.text}
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className={cn(
                      "rounded-xl border px-4 py-3 text-sm leading-5",
                      alert.type === "error"
                        ? "border-rose-500/30 bg-rose-500/10 text-rose-200"
                        : "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      {alert.type === "error" ? <Lock className="h-4 w-4 flex-shrink-0" /> : <BadgeCheck className="h-4 w-4 flex-shrink-0" />}
                      <p>{alert.text}</p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Mode switcher */}
              <div className="grid grid-cols-2 gap-1 rounded-xl bg-white/5 p-1 border border-white/10">
                {["signin", "signup"].map((m) => (
                  <Button
                    key={m}
                    type="button"
                    variant="ghost"
                    className={cn(
                      "rounded-lg px-3 py-2 text-sm font-medium transition-all",
                      mode === m ? "bg-white/10 text-white shadow-sm" : "text-white/50 hover:text-white"
                    )}
                    onClick={() => { setMode(m); setAlert(null); setRecoveryOpen(false); if (m === "signup") resetSignupState(); }}
                  >
                    {m === "signin" ? "Sign in" : "Create account"}
                  </Button>
                ))}
              </div>

              {/* ── SIGN IN ── */}
              {mode === "signin" && !recoveryOpen && (
                <motion.form key="signin" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4" onSubmit={onSignIn} autoComplete="on">
                  <Field
                    label="Email or phone"
                    icon={Mail}
                    placeholder="name@example.com or +91 99999 99999"
                    name="signin-identifier"
                    autoComplete="username"
                    value={signIn.identifier}
                    onChange={(e) => setSignIn({ ...signIn, identifier: e.target.value })}
                  />
                  <Field
                    label="Password"
                    icon={Lock}
                    type={showSignInPw ? "text" : "password"}
                    placeholder="••••••••"
                    name="signin-password"
                    autoComplete="current-password"
                    value={signIn.password}
                    onChange={(e) => setSignIn({ ...signIn, password: e.target.value })}
                    rightSlot={
                      <button type="button" className="text-white/50 hover:text-white" onClick={() => setShowSignInPw(!showSignInPw)}>
                        {showSignInPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    }
                  />
                  <div className="flex justify-end">
                    <button type="button" onClick={() => setRecoveryOpen(true)} className="text-xs text-cyan-400 hover:text-cyan-300 font-medium">
                      Forgot password?
                    </button>
                  </div>
                  <Button type="submit" className={primaryBtnClass} disabled={busy === "signin" || busy === "google"}>
                    {busy === "signin" ? <Loader2 className="h-5 w-5 animate-spin" /> : <span className="flex items-center gap-2">Sign in <ArrowRight className="h-4 w-4" /></span>}
                  </Button>

                  {GOOGLE_CLIENT_ID && (
                    <div className="space-y-3 pt-1">
                      <div className="flex items-center gap-3 text-[11px] uppercase tracking-[0.24em] text-white/30">
                        <div className="h-px flex-1 bg-white/10" />
                        <span>Or continue with</span>
                        <div className="h-px flex-1 bg-white/10" />
                      </div>

                      <div
                        className={cn(
                          "relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 px-3 py-2 transition",
                          (busy === "signin" || busy === "google") && "pointer-events-none opacity-70"
                        )}
                      >
                        {googleLoadError ? (
                          <p className="flex min-h-[42px] items-center justify-center px-2 text-center text-sm text-rose-200">
                            {googleLoadError}
                          </p>
                        ) : !googleReady ? (
                          <div className="flex min-h-[42px] items-center justify-center gap-2 text-sm text-white/55">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Preparing Google sign-in...
                          </div>
                        ) : (
                          <div ref={googleButtonRef} className="flex min-h-[42px] items-center justify-center" />
                        )}

                        {busy === "google" && (
                          <div className="absolute inset-0 flex items-center justify-center bg-slate-950/55 backdrop-blur-[2px]">
                            <Loader2 className="h-5 w-5 animate-spin text-white" />
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </motion.form>
              )}

              {/* ── SIGN UP ── */}
              {mode === "signup" && !recoveryOpen && (
                <AnimatePresence mode="wait">
                  {/* Step 1 – Details */}
                  {signupStep === 1 && (
                    <motion.form
                      key="step1"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      className="space-y-4"
                      onSubmit={onSignUpInitiate}
                    >
                      <StepIndicator step={1} />

                      <Field
                        label="Username"
                        icon={UserRound}
                        placeholder="johndoe"
                        name="signup-username"
                        autoComplete="username"
                        value={signUp.username}
                        error={fieldErrors.username}
                        onChange={(e) => { setSignUp({ ...signUp, username: e.target.value }); setFieldErrors((p) => ({ ...p, username: "" })); }}
                      />
                      <Field
                        label="Email"
                        icon={Mail}
                        type="email"
                        placeholder="name@example.com"
                        name="signup-email"
                        autoComplete="email"
                        value={signUp.email}
                        error={fieldErrors.email}
                        onChange={(e) => { setSignUp({ ...signUp, email: e.target.value }); setFieldErrors((p) => ({ ...p, email: "" })); }}
                      />

                      {/* Country phone picker */}
                      <CountryPhoneInput
                        country={country}
                        setCountry={(c) => { setCountry(c); setSignUp((s) => ({ ...s, phone: "" })); setPhoneError(""); }}
                        phone={signUp.phone}
                        setPhone={(v) => { setSignUp((s) => ({ ...s, phone: v })); setPhoneError(validatePhone(v)); setFieldErrors((p) => ({ ...p, phone: "" })); }}
                        error={fieldErrors.phone || phoneError}
                      />

                      <div className="space-y-1.5">
                        <Field
                          label="Password"
                          icon={Lock}
                          type={showSignUpPw ? "text" : "password"}
                          placeholder="Min 8 chars, letter + number"
                          name="signup-password"
                          autoComplete="new-password"
                          value={signUp.password}
                          error={fieldErrors.password}
                          onChange={(e) => { setSignUp({ ...signUp, password: e.target.value }); setFieldErrors((p) => ({ ...p, password: "" })); }}
                          rightSlot={
                            <button type="button" className="text-white/50 hover:text-white" onClick={() => setShowSignUpPw(!showSignUpPw)}>
                              {showSignUpPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </button>
                          }
                        />
                        <PasswordStrength password={signUp.password} />
                      </div>

                      <Field
                        label="Confirm password"
                        icon={KeyRound}
                        type="password"
                        name="signup-confirm-password"
                        autoComplete="new-password"
                        placeholder="••••••••"
                        value={signUp.confirmPassword}
                        error={fieldErrors.confirmPassword}
                        onChange={(e) => { setSignUp({ ...signUp, confirmPassword: e.target.value }); setFieldErrors((p) => ({ ...p, confirmPassword: "" })); }}
                      />

                      <Button type="submit" className={primaryBtnClass} disabled={busy === "signup"}>
                        {busy === "signup"
                          ? <Loader2 className="h-5 w-5 animate-spin" />
                          : <span className="flex items-center gap-2">Send Verification Code <ArrowRight className="h-4 w-4" /></span>}
                      </Button>
                    </motion.form>
                  )}

                  {/* Step 2 – OTP */}
                  {signupStep === 2 && (
                    <motion.form
                      key="step2"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      className="space-y-5"
                      onSubmit={onSignUpComplete}
                    >
                      <StepIndicator step={2} />

                      <div className="text-center space-y-1">
                        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-violet-500/20 border border-white/10 mb-2">
                          <Mail className="h-6 w-6 text-cyan-400" />
                        </div>
                        <p className="text-white font-semibold">Check your inbox</p>
                        <p className="text-white/50 text-sm">
                          We sent a 6-digit code to<br />
                          <span className="text-cyan-300 font-medium">{pendingEmail}</span>
                        </p>
                      </div>

                      <OtpInput value={otp} onChange={setOtp} />

                      <Button
                        type="submit"
                        className={primaryBtnClass}
                        disabled={busy === "verify" || otp.length < 6}
                      >
                        {busy === "verify"
                          ? <Loader2 className="h-5 w-5 animate-spin" />
                          : <span className="flex items-center gap-2"><ShieldCheck className="h-4 w-4" /> Verify & Create Account</span>}
                      </Button>

                      <div className="flex items-center justify-between text-xs text-white/40 pt-1">
                        <button type="button" onClick={() => { setSignupStep(1); setOtp(""); setAlert(null); }} className="hover:text-white/70 flex items-center gap-1 transition-colors">
                          <RotateCcw className="h-3 w-3" /> Back to details
                        </button>
                        <button
                          type="button"
                          disabled={resendTimer > 0 || busy === "resend"}
                          onClick={onResendOtp}
                          className={cn("transition-colors", resendTimer > 0 || busy === "resend" ? "opacity-40 cursor-not-allowed" : "hover:text-cyan-400")}
                        >
                          {busy === "resend" ? "Sending…" : resendTimer > 0 ? `Resend in ${resendTimer}s` : "Resend code"}
                        </button>
                      </div>
                    </motion.form>
                  )}

                  {/* Step 3 – Success */}
                  {signupStep === 3 && (
                    <motion.div
                      key="step3"
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="space-y-5 py-4"
                    >
                      <StepIndicator step={3} />
                      <div className="text-center space-y-3">
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ type: "spring", stiffness: 200, delay: 0.2 }}
                          className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500/30 to-cyan-500/20 border border-emerald-500/30 mb-2"
                        >
                          <CheckCircle2 className="h-8 w-8 text-emerald-400" />
                        </motion.div>
                        <p className="text-white text-xl font-bold">Welcome to ConnectHub! 🎉</p>
                        <p className="text-white/50 text-sm">Your account has been created. Sign in to start connecting globally.</p>
                      </div>
                      <Button
                        type="button"
                        className={primaryBtnClass}
                        onClick={() => { setMode("signin"); resetSignupState(); }}
                      >
                        <span className="flex items-center gap-2">Sign in now <ArrowRight className="h-4 w-4" /></span>
                      </Button>
                    </motion.div>
                  )}
                </AnimatePresence>
              )}

              {/* ── RECOVERY ── */}
              {recoveryOpen && (
                <motion.div key="recovery" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="space-y-5">
                  <div className="flex items-center justify-between pb-2 border-b border-white/10">
                    <h3 className="text-sm font-semibold text-white">Reset Password</h3>
                    <button type="button" onClick={() => setRecoveryOpen(false)} className="text-xs text-white/50 hover:text-white">Cancel</button>
                  </div>

                  <form onSubmit={onForgot} className="space-y-3" autoComplete="off">
                    <Field
                      label="Email or phone"
                      icon={Mail}
                      placeholder="Enter your email or phone"
                      name="recovery-identifier"
                      autoComplete="off"
                      data-lpignore="true"
                      data-1p-ignore="true"
                      value={recover.identifier}
                      onChange={(e) => setRecover({ ...recover, identifier: e.target.value })}
                    />
                    <Button type="submit" className="w-full bg-white/10 hover:bg-white/15 text-white h-11 rounded-xl" disabled={busy === "forgot"}>
                      {busy === "forgot" ? <Loader2 className="h-5 w-5 animate-spin" /> : "Send token"}
                    </Button>
                  </form>

                  <form onSubmit={onReset} className="space-y-3 pt-4 border-t border-white/10" autoComplete="off">
                    <Field
                      label="Token"
                      icon={KeyRound}
                      placeholder="Paste reset token"
                      name="reset-token"
                      autoComplete="one-time-code"
                      data-lpignore="true"
                      data-1p-ignore="true"
                      value={recover.token}
                      onChange={(e) => setRecover({ ...recover, token: e.target.value })}
                    />
                    <Field
                      label="New password"
                      icon={Lock}
                      type={showResetPw ? "text" : "password"}
                      placeholder="Min 8 characters"
                      name="reset-new-password"
                      autoComplete="new-password"
                      value={recover.newPassword}
                      onChange={(e) => setRecover({ ...recover, newPassword: e.target.value })}
                      rightSlot={
                        <button type="button" className="text-white/50 hover:text-white" onClick={() => setShowResetPw(!showResetPw)}>
                          {showResetPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      }
                    />
                    <Field
                      label="Confirm new password"
                      icon={Lock}
                      type="password"
                      name="reset-confirm-password"
                      autoComplete="new-password"
                      value={recover.confirmPassword}
                      onChange={(e) => setRecover({ ...recover, confirmPassword: e.target.value })}
                    />
                    <Button type="submit" className={primaryBtnClass} disabled={busy === "reset"}>
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
