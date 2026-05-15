import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Zap,
  CheckCircle2,
  Shield,
  Clock,
  ArrowRight,
  Sparkles,
  ChevronRight,
  History,
  RefreshCw,
  AlertCircle,
  CreditCard,
} from "lucide-react";
import { api } from "@/lib/api";

// ── Plan definitions (must match backend PaymentPlanCatalog) ──────────────────
const PLANS = [
  {
    code: "spark",
    name: "Starter Spark",
    tagline: "Try it out",
    credits: 50,
    price: 99,
    badge: null,
    gradient: "from-sky-500/20 to-blue-600/20",
    border: "border-sky-500/30",
    activeBorder: "border-sky-400",
    icon: "⚡",
  },
  {
    code: "boost",
    name: "Daily Boost",
    tagline: "Most popular",
    credits: 150,
    price: 249,
    badge: "🔥 Popular",
    gradient: "from-violet-500/25 to-fuchsia-600/25",
    border: "border-violet-500/30",
    activeBorder: "border-violet-400",
    icon: "🚀",
  },
  {
    code: "power",
    name: "Power Pack",
    tagline: "Best value",
    credits: 400,
    price: 599,
    badge: "💎 Best Value",
    gradient: "from-amber-500/20 to-orange-600/20",
    border: "border-amber-500/30",
    activeBorder: "border-amber-400",
    icon: "💪",
  },
  {
    code: "elite",
    name: "Elite Wallet",
    tagline: "For power users",
    credits: 1000,
    price: 1199,
    badge: null,
    gradient: "from-emerald-500/20 to-teal-600/20",
    border: "border-emerald-500/30",
    activeBorder: "border-emerald-400",
    icon: "👑",
  },
];

// ── Load Razorpay script once ─────────────────────────────────────────────────
function loadRazorpayScript() {
  return new Promise((resolve) => {
    if (window.Razorpay) return resolve(true);
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

// ── Animated price helper ─────────────────────────────────────────────────────
function AnimatedPrice({ value }) {
  return (
    <motion.span
      key={value}
      initial={{ y: -12, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 12, opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="inline-block"
    >
      {value}
    </motion.span>
  );
}

// ── History row ───────────────────────────────────────────────────────────────
function HistoryRow({ item }) {
  const statusColors = {
    CREDITED: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
    PAID: "text-cyan-400 bg-cyan-500/10 border-cyan-500/20",
    CREATED: "text-amber-400 bg-amber-500/10 border-amber-500/20",
    FAILED: "text-rose-400 bg-rose-500/10 border-rose-500/20",
  };
  const colorClass = statusColors[item.status] || "text-white/40 bg-white/5 border-white/10";
  const date = item.createdAt
    ? new Date(item.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
    : "—";

  return (
    <div className="flex items-center justify-between py-2.5 border-b border-white/5 last:border-0">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center text-sm">
          {item.credits >= 1000 ? "👑" : item.credits >= 400 ? "💪" : item.credits >= 150 ? "🚀" : "⚡"}
        </div>
        <div>
          <p className="text-sm font-medium text-white">{item.planName || "Credit Top-up"}</p>
          <p className="text-xs text-white/40">{date}</p>
        </div>
      </div>
      <div className="text-right">
        <p className="text-sm font-bold text-white">
          +{item.credits} <span className="text-cyan-400 text-xs">credits</span>
        </p>
        <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${colorClass}`}>
          {item.status}
        </span>
      </div>
    </div>
  );
}

// ── Main modal ────────────────────────────────────────────────────────────────
export const BuyCreditsModal = ({ isOpen, onClose, user, onPaymentSuccess }) => {
  const [selectedPlan, setSelectedPlan] = useState(PLANS[1]);
  const [uiState, setUiState] = useState("idle"); // idle | creating | verifying | success | error
  const [errorMsg, setErrorMsg] = useState("");
  const [successData, setSuccessData] = useState(null);
  const [tab, setTab] = useState("plans");
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Reset when modal opens
  useEffect(() => {
    if (isOpen) {
      setSelectedPlan(PLANS[1]);
      setUiState("idle");
      setErrorMsg("");
      setSuccessData(null);
      setTab("plans");
    }
  }, [isOpen]);

  // Load history when tab switches
  useEffect(() => {
    if (tab === "history" && user?.userId && history.length === 0) {
      loadHistory();
    }
  }, [tab]);

  const loadHistory = async () => {
    if (!user?.userId) return;
    setHistoryLoading(true);
    try {
      const data = await api.payments.history(user.userId);
      setHistory(Array.isArray(data) ? data : []);
    } catch {
      setHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleVerify = useCallback(
    async (orderId, paymentId, signature) => {
      setUiState("verifying");
      try {
        const result = await api.payments.verify({ orderId, paymentId, signature });
        setSuccessData(result);
        setUiState("success");
        onPaymentSuccess?.();
      } catch (err) {
        setUiState("error");
        setErrorMsg(err.message || "Payment verification failed. Contact support if credits are missing.");
      }
    },
    [onPaymentSuccess]
  );

  const handlePay = async () => {
    if (!user?.userId) return;
    setUiState("creating");
    setErrorMsg("");

    try {
      // 1. Load Razorpay SDK
      const loaded = await loadRazorpayScript();
      if (!loaded) {
        throw new Error("Could not load Razorpay. Check your internet connection.");
      }

      // 2. Create order on backend
      const order = await api.payments.createOrder(
        user.userId, 
        selectedPlan.code,
        user.fullName || user.username || "ConnectHub User",
        user.email
      );

      if (!order?.orderId || !order?.keyId) {
        throw new Error("Invalid order response from server. Missing orderId or keyId.");
      }

      setUiState("idle"); // Let Razorpay overlay take over UI

      // 3. Open Razorpay checkout
      const rzp = new window.Razorpay({
        key: order.keyId,
        amount: order.amountInPaise,          // in paise
        currency: order.currency || "INR",
        name: "ConnectHub",
        description: `${selectedPlan.credits} Translation Credits — ${selectedPlan.name}`,
        order_id: order.orderId,
        prefill: {
          name: user.fullName || user.username || "",
          email: user.email || "",
        },
        theme: {
          color: "#7c3aed",                    // violet-600
        },
        modal: {
          ondismiss: () => {
            setUiState("idle");
            setErrorMsg("Payment cancelled. You can try again anytime.");
          },
        },
        handler: (response) => {
          // Called by Razorpay after successful payment
          handleVerify(
            response.razorpay_order_id,
            response.razorpay_payment_id,
            response.razorpay_signature
          );
        },
      });

      rzp.on("payment.failed", (response) => {
        setUiState("error");
        setErrorMsg(
          response?.error?.description ||
          response?.error?.reason ||
          "Payment failed. Please try again."
        );
      });

      rzp.open();
    } catch (err) {
      setUiState("error");
      setErrorMsg(err.message || "Failed to initiate payment. Please try again.");
    }
  };

  if (typeof document === "undefined") return null;

  const isProcessing = ["creating", "verifying"].includes(uiState);

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[80] flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(12px)" }}
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 24 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 24 }}
            transition={{ type: "spring", stiffness: 300, damping: 28 }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-lg rounded-[2rem] overflow-hidden border border-white/10 shadow-2xl shadow-black/60"
            style={{
              background: "linear-gradient(135deg, rgba(15,20,30,0.98) 0%, rgba(10,14,22,0.98) 100%)",
            }}
          >
            {/* Top gradient accent */}
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-violet-500/80 to-transparent" />
            <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-violet-500/8 to-transparent pointer-events-none" />

            {/* Success overlay */}
            <AnimatePresence>
              {uiState === "success" && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-[#090d14]/95 rounded-[2rem] p-8 text-center"
                >
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 200, delay: 0.1 }}
                    className="w-20 h-20 rounded-3xl bg-gradient-to-br from-emerald-400/30 to-teal-500/20 border border-emerald-400/30 flex items-center justify-center mb-5"
                  >
                    <CheckCircle2 className="w-10 h-10 text-emerald-400" />
                  </motion.div>
                  <h3 className="text-2xl font-black text-white mb-2">Payment Successful! 🎉</h3>
                  <p className="text-white/60 text-sm mb-1">
                    <span className="text-cyan-300 font-bold text-lg">
                      {successData?.creditsAdded || selectedPlan.credits}
                    </span>{" "}
                    credits added to your account
                  </p>
                  <p className="text-white/40 text-xs mb-6">A PDF receipt has been sent to your email.</p>
                  <button
                    onClick={onClose}
                    className="px-8 py-3 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-semibold text-sm hover:opacity-90 transition-opacity"
                  >
                    Start translating!
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Processing overlay */}
            <AnimatePresence>
              {isProcessing && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-[#090d14]/80 backdrop-blur-sm rounded-[2rem]"
                >
                  <div className="w-16 h-16 rounded-2xl bg-violet-500/20 border border-violet-500/30 flex items-center justify-center mb-4">
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1.2, repeat: Infinity, ease: "linear" }}
                    >
                      <RefreshCw className="w-7 h-7 text-violet-400" />
                    </motion.div>
                  </div>
                  <p className="text-white font-semibold text-sm">
                    {uiState === "creating" && "Creating your order…"}
                    {uiState === "verifying" && "Verifying payment…"}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Header */}
            <div className="flex items-center justify-between px-6 pt-6 pb-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-violet-500/40 to-fuchsia-500/30 flex items-center justify-center">
                    <Zap className="w-4 h-4 text-violet-300" />
                  </div>
                  <span className="text-xs font-semibold text-white/50 uppercase tracking-widest">
                    ConnectHub Credits
                  </span>
                </div>
                <h2 className="text-xl font-black text-white">Top Up Your Credits</h2>
              </div>
              <button
                onClick={onClose}
                className="w-9 h-9 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center transition-colors"
              >
                <X className="w-4 h-4 text-white/60" />
              </button>
            </div>

            {/* Current credits badge */}
            {user?.translationCreditsRemaining !== undefined && (
              <div className="mx-6 mb-4 flex items-center gap-2 px-4 py-2 rounded-2xl bg-white/4 border border-white/8">
                <Zap className="w-3.5 h-3.5 text-cyan-400" />
                <span className="text-xs text-white/60">Current balance:</span>
                <span className="text-xs font-bold text-cyan-300">
                  {user.translationCreditsRemaining} credits
                </span>
              </div>
            )}

            {/* Error banner */}
            <AnimatePresence>
              {(uiState === "error" || errorMsg) && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="mx-6 mb-4 flex items-start gap-3 p-3 rounded-2xl bg-rose-500/10 border border-rose-500/20"
                >
                  <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-rose-300">{errorMsg}</p>
                  <button
                    onClick={() => { setUiState("idle"); setErrorMsg(""); }}
                    className="ml-auto text-rose-400/60 hover:text-rose-300"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Tab switcher */}
            <div className="flex mx-6 mb-5 bg-white/4 rounded-2xl p-1 border border-white/8">
              {[
                { id: "plans", label: "Choose Plan", icon: CreditCard },
                { id: "history", label: "History", icon: History },
              ].map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => setTab(id)}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
                    tab === id ? "bg-white/10 text-white shadow-sm" : "text-white/40 hover:text-white/70"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {label}
                </button>
              ))}
            </div>

            {/* Plans tab */}
            {tab === "plans" && (
              <div className="px-6 pb-6">
                <div className="grid grid-cols-2 gap-3 mb-5">
                  {PLANS.map((plan) => {
                    const isSelected = selectedPlan.code === plan.code;
                    return (
                      <motion.button
                        key={plan.code}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => setSelectedPlan(plan)}
                        className={`relative rounded-2xl p-4 text-left border transition-all duration-200 bg-gradient-to-br ${plan.gradient} ${
                          isSelected ? plan.activeBorder : plan.border + " hover:border-white/20"
                        }`}
                      >
                        {plan.badge && (
                          <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 px-2.5 py-0.5 bg-gradient-to-r from-violet-500 to-fuchsia-500 rounded-full text-[9px] font-bold text-white whitespace-nowrap shadow-lg shadow-fuchsia-500/30">
                            {plan.badge}
                          </div>
                        )}
                        <div className="flex items-start justify-between mb-3">
                          <span className="text-xl">{plan.icon}</span>
                          {isSelected && (
                            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}>
                              <CheckCircle2 className="w-4 h-4 text-white" />
                            </motion.div>
                          )}
                        </div>
                        <p className="text-xs text-white/50 mb-0.5">{plan.tagline}</p>
                        <p className="text-sm font-bold text-white mb-2">{plan.name}</p>
                        <div className="flex items-baseline gap-1">
                          <span className="text-lg font-black text-white">₹{plan.price}</span>
                        </div>
                        <div className="flex items-center gap-1 mt-1">
                          <Zap className="w-3 h-3 text-cyan-400" />
                          <span className="text-xs text-cyan-300 font-semibold">{plan.credits} credits</span>
                        </div>
                        <p className="text-[10px] text-white/30 mt-1">
                          ₹{(plan.price / plan.credits).toFixed(2)} per credit
                        </p>
                      </motion.button>
                    );
                  })}
                </div>

                {/* Summary row */}
                <div className="flex items-center justify-between px-4 py-3 rounded-2xl bg-white/4 border border-white/8 mb-4">
                  <div className="flex items-center gap-2">
                    <AnimatePresence mode="wait">
                      <AnimatedPrice key={selectedPlan.code + "-icon"} value={selectedPlan.icon} />
                    </AnimatePresence>
                    <div>
                      <p className="text-xs text-white/50">{selectedPlan.name}</p>
                      <div className="flex items-center gap-1.5">
                        <Zap className="w-3 h-3 text-cyan-400" />
                        <AnimatePresence mode="wait">
                          <AnimatedPrice key={selectedPlan.code + "-cred"} value={`${selectedPlan.credits} credits`} />
                        </AnimatePresence>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <AnimatePresence mode="wait">
                      <motion.p
                        key={selectedPlan.price}
                        initial={{ y: -8, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: 8, opacity: 0 }}
                        className="text-xl font-black text-white"
                      >
                        ₹{selectedPlan.price}
                      </motion.p>
                    </AnimatePresence>
                    <p className="text-[10px] text-white/30">INR incl. taxes</p>
                  </div>
                </div>

                {/* Razorpay pay button */}
                <motion.button
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  onClick={handlePay}
                  disabled={isProcessing}
                  className="w-full relative overflow-hidden rounded-2xl py-3.5 font-bold text-white text-sm disabled:opacity-60 disabled:cursor-not-allowed"
                  style={{
                    background: "linear-gradient(135deg, #528FF0 0%, #2563eb 50%, #1d4ed8 100%)",
                  }}
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/10 to-white/0 opacity-0 hover:opacity-100 transition-opacity" />
                  <div className="flex items-center justify-center gap-2.5">
                    {/* Razorpay logo */}
                    <svg className="h-5" viewBox="0 0 80 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M14.4 0L7.2 14.4H12L4.8 24l16.8-12H16.8L24 0H14.4Z" fill="#fff"/>
                    </svg>
                    <span>Pay ₹{selectedPlan.price} with Razorpay</span>
                    <ArrowRight className="w-4 h-4" />
                  </div>
                </motion.button>

                {/* Trust badges */}
                <div className="flex items-center justify-center gap-4 mt-4">
                  <div className="flex items-center gap-1 text-white/30 text-[10px]">
                    <Shield className="w-3 h-3" />
                    Secure checkout
                  </div>
                  <div className="flex items-center gap-1 text-white/30 text-[10px]">
                    <Clock className="w-3 h-3" />
                    Instant delivery
                  </div>
                  <div className="flex items-center gap-1 text-white/30 text-[10px]">
                    <Sparkles className="w-3 h-3" />
                    PDF receipt
                  </div>
                </div>

                {/* Razorpay branding note */}
                <p className="text-center text-[10px] text-white/20 mt-3">
                  Secured by Razorpay · UPI · Cards · Net Banking · Wallets accepted
                </p>
              </div>
            )}

            {/* History tab */}
            {tab === "history" && (
              <div className="px-6 pb-6">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-white/70">Purchase History</h3>
                  <button
                    onClick={loadHistory}
                    disabled={historyLoading}
                    className="flex items-center gap-1 text-xs text-white/40 hover:text-white/70 transition-colors disabled:opacity-40"
                  >
                    <RefreshCw className={`w-3 h-3 ${historyLoading ? "animate-spin" : ""}`} />
                    Refresh
                  </button>
                </div>

                {historyLoading ? (
                  <div className="flex items-center justify-center py-10">
                    <div className="w-6 h-6 border-2 border-white/20 border-t-white/70 rounded-full animate-spin" />
                  </div>
                ) : history.length === 0 ? (
                  <div className="text-center py-10">
                    <div className="w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center mx-auto mb-3">
                      <History className="w-6 h-6 text-white/20" />
                    </div>
                    <p className="text-white/40 text-sm">No purchases yet.</p>
                    <button
                      onClick={() => setTab("plans")}
                      className="mt-3 flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300 mx-auto transition-colors"
                    >
                      Buy your first pack <ChevronRight className="w-3 h-3" />
                    </button>
                  </div>
                ) : (
                  <div className="space-y-0 max-h-64 overflow-y-auto pr-1">
                    {history.map((item, i) => (
                      <HistoryRow key={item.orderId || i} item={item} />
                    ))}
                  </div>
                )}
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
};
