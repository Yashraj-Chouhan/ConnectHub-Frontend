/*
 * Frontend application shell.
 *
 * This file wires global providers and routes for the login flow, chat
 * experience, hidden admin portal, and fallback error/loading states.
 */
import "./global.css";
import { Component, Suspense, lazy } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Login from "./pages/Login";
import { AuthProvider } from "./context/AuthContext";
import { ThemeProvider } from "./context/ThemeContext";

const Chat = lazy(() => import("./pages/Chat"));
const NotFound = lazy(() => import("./pages/NotFound"));
const AdminLogin = lazy(() => import("./pages/AdminLogin"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));


const rootElement =
  document.getElementById("root") ||
  (() => {
    const fallback = document.createElement("div");
    fallback.id = "root";
    document.body.appendChild(fallback);
    return fallback;
  })();

const Spinner = () => (
  <div className="min-h-screen bg-gradient-to-br from-[var(--bg-gradient-start)] via-[var(--bg-gradient-mid)] to-[var(--bg-gradient-end)] flex items-center justify-center">
    <div className="w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
  </div>
);

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gradient-to-br from-[var(--bg-gradient-start)] via-[var(--bg-gradient-mid)] to-[var(--bg-gradient-end)] flex items-center justify-center">
          <div className="text-center space-y-4 p-8">
            <div className="text-5xl">💬</div>
            <h2 className="text-2xl font-bold text-white">Something went wrong</h2>
            <p className="text-gray-400 text-sm max-w-md">
              {this.state.error?.message || "An unexpected error occurred."}
            </p>
            <button
              onClick={() => { this.setState({ hasError: false, error: null }); window.location.reload(); }}
              className="px-6 py-2 bg-cyan-500 hover:bg-cyan-400 text-white rounded-lg text-sm font-medium transition-colors"
            >
              Reload App
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// Keeps the router and global providers in one place so every page shares the
// same auth, theme, and error-boundary behavior.
const App = () => (
  <ErrorBoundary>
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <Suspense fallback={<Spinner />}>
            <Routes>
              <Route path="/" element={<Login />} />
              <Route path="/login" element={<Login />} />
              <Route
                path="/chat"
                element={
                  <ErrorBoundary>
                    <Chat />
                  </ErrorBoundary>
                }
              />

              {/* ── Admin portal (unlisted — not linked from any public UI) */}
              <Route path="/admin" element={<AdminLogin />} />
              <Route path="/admin/dashboard" element={<AdminDashboard />} />

              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  </ErrorBoundary>
);

createRoot(rootElement).render(<App />);
