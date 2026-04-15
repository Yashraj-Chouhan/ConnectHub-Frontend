import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from "react";
import { X, Edit2, Check, Camera, Phone, Mail, Info } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
const ProfilePanel = ({ open, onClose, profile, onUpdateProfile }) => {
    const { user } = useAuth();
    const [editingField, setEditingField] = useState(null);
    const [editValue, setEditValue] = useState("");
    if (!open)
        return null;
    const startEdit = (field, value) => {
        setEditingField(field);
        setEditValue(value);
    };
    const saveEdit = () => {
        if (editingField) {
            onUpdateProfile({ [editingField]: editValue });
            setEditingField(null);
        }
    };
    const fields = [
        { key: "name", label: "Name", icon: Info, value: profile.name },
        { key: "about", label: "About", icon: Info, value: profile.about },
        { key: "phone", label: "Phone", icon: Phone, value: profile.phone },
        { key: "status", label: "Status", icon: Info, value: profile.status },
    ];
    return (_jsxs("div", { className: "fixed inset-0 z-50 flex items-center justify-center", children: [_jsx("div", { className: "absolute inset-0 bg-background/80 backdrop-blur-sm", onClick: onClose }), _jsxs("div", { className: "relative glass-strong rounded-2xl w-full max-w-sm mx-4 animate-scale-in overflow-hidden", children: [_jsxs("div", { className: "flex items-center justify-between p-4 border-b border-border/20", children: [_jsx("h2", { className: "text-lg font-semibold text-foreground", children: "Profile" }), _jsx("button", { onClick: onClose, className: "w-8 h-8 rounded-lg glass glass-hover flex items-center justify-center", children: _jsx(X, { className: "w-4 h-4 text-muted-foreground" }) })] }), _jsxs("div", { className: "p-6", children: [_jsxs("div", { className: "text-center mb-6", children: [_jsxs("div", { className: "relative inline-block", children: [_jsx("div", { className: "w-24 h-24 rounded-2xl btn-glass flex items-center justify-center text-3xl font-bold text-primary-foreground mx-auto", children: profile.avatar || user?.name?.charAt(0).toUpperCase() }), _jsx("button", { className: "absolute bottom-0 right-0 w-8 h-8 rounded-full btn-glass flex items-center justify-center", children: _jsx(Camera, { className: "w-4 h-4 text-primary-foreground" }) })] }), _jsxs("p", { className: "text-xs text-muted-foreground mt-2", children: [_jsx(Mail, { className: "w-3 h-3 inline mr-1" }), profile.email] })] }), _jsx("div", { className: "space-y-3", children: fields.map((field) => (_jsxs("div", { className: "p-3 rounded-xl glass", children: [_jsxs("div", { className: "flex items-center justify-between mb-1", children: [_jsx("span", { className: "text-[10px] uppercase tracking-wider text-muted-foreground", children: field.label }), editingField === field.key ? (_jsx("button", { onClick: saveEdit, className: "text-primary", children: _jsx(Check, { className: "w-3.5 h-3.5" }) })) : (_jsx("button", { onClick: () => startEdit(field.key, field.value), className: "text-muted-foreground hover:text-primary", children: _jsx(Edit2, { className: "w-3.5 h-3.5" }) }))] }), editingField === field.key ? (_jsx("input", { value: editValue, onChange: (e) => setEditValue(e.target.value), onKeyDown: (e) => e.key === "Enter" && saveEdit(), className: "w-full px-2 py-1 rounded-lg input-glass text-sm text-foreground", autoFocus: true })) : (_jsx("p", { className: "text-sm text-foreground", children: field.value }))] }, field.key))) })] })] })] }));
};
export default ProfilePanel;
