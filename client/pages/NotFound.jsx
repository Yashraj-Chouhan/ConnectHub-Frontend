import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useLocation } from "react-router-dom";
import { useEffect } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Home, ArrowRight } from "lucide-react";
const NotFound = () => {
    const location = useLocation();
    useEffect(() => {
        console.error("404 Error: User attempted to access non-existent route:", location.pathname);
    }, [location.pathname]);
    return (_jsxs("div", { className: "relative w-full min-h-screen flex items-center justify-center px-6 py-20 overflow-hidden bg-gradient-to-br from-[#0a0e27] via-[#1a1a3e] to-[#2d1b4e]", children: [_jsxs("div", { className: "fixed inset-0 z-0", children: [_jsx("div", { className: "absolute w-96 h-96 bg-primary/20 rounded-full blur-3xl -top-48 -left-48 opacity-20" }), _jsx("div", { className: "absolute w-96 h-96 bg-secondary/20 rounded-full blur-3xl -bottom-48 -right-48 opacity-20" })] }), _jsxs(motion.div, { initial: { opacity: 0, scale: 0.9 }, animate: { opacity: 1, scale: 1 }, transition: { duration: 0.6 }, className: "relative z-10 text-center space-y-8 max-w-2xl mx-auto", children: [_jsx(motion.h1, { initial: { opacity: 0, y: -20 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.6, delay: 0.1 }, className: "text-8xl sm:text-9xl font-bold gradient-text", children: "404" }), _jsxs(motion.div, { initial: { opacity: 0, y: 20 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.6, delay: 0.2 }, className: "space-y-3", children: [_jsx("h2", { className: "text-3xl sm:text-4xl font-bold text-white", children: "Page Not Found" }), _jsx("p", { className: "text-lg text-gray-300", children: "Oops! The page you're looking for doesn't exist. It might have been moved or deleted." })] }), _jsxs(motion.div, { initial: { opacity: 0, y: 20 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.6, delay: 0.3 }, className: "flex flex-col sm:flex-row items-center justify-center gap-4", children: [_jsxs(Link, { to: "/", className: "glass-button-primary flex items-center justify-center gap-2 w-full sm:w-auto", children: [_jsx(Home, { className: "w-5 h-5" }), "Return Home"] }), _jsxs("button", { onClick: () => window.history.back(), className: "glass-button-secondary w-full sm:w-auto flex items-center justify-center gap-2", children: ["Go Back ", _jsx(ArrowRight, { className: "w-5 h-5" })] })] }), _jsx(motion.div, { animate: { y: [0, -20, 0] }, transition: { duration: 4, repeat: Infinity }, className: "mt-16", children: _jsx("div", { className: "text-6xl", children: "\uD83D\uDD0D" }) })] })] }));
};
export default NotFound;
