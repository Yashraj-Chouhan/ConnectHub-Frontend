import { jsx as _jsx } from "react/jsx-runtime";
import { createContext, useContext, useState } from "react";
import { api } from "@/lib/api";
const AuthContext = createContext(null);
export const useAuth = () => {
    const ctx = useContext(AuthContext);
    if (!ctx)
        throw new Error("useAuth must be inside AuthProvider");
    return ctx;
};
export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(() => {
        const saved = localStorage.getItem("chatUser");
        return saved ? JSON.parse(saved) : null;
    });
    const [token, setToken] = useState(() => localStorage.getItem("token"));
    const login = async (email, password) => {
        // Will throw with a user-friendly message if it fails (caught in Auth.jsx)
        const data = await api.post("/auth/login", { email, password });
        const u = { name: data.username, email: data.email };
        setUser(u);
        setToken(data.token);
        localStorage.setItem("chatUser", JSON.stringify(u));
        localStorage.setItem("token", data.token);
    };
    const signup = async (name, email, password) => {
        // Register first, then auto-login
        await api.post("/auth/register", {
            username: name,
            email,
            password,
        });
        // Auto-login after successful registration
        await login(email, password);
    };
    const logout = () => {
        setUser(null);
        setToken(null);
        localStorage.removeItem("chatUser");
        localStorage.removeItem("token");
    };
    return (_jsx(AuthContext.Provider, { value: { user, token, login, signup, logout }, children: children }));
};

