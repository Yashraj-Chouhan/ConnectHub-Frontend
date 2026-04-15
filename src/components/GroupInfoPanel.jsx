import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState } from "react";
import { X, Shield, UserMinus, UserPlus, Plus, Edit2, Check, Trash2, Crown, Users } from "lucide-react";
import { getContacts } from "@/data/mockChats";
const GroupInfoPanel = ({ chat, open, onClose, onUpdateGroup, onLeaveGroup, onDeleteGroup }) => {
    const [editing, setEditing] = useState(false);
    const [editName, setEditName] = useState(chat.name);
    const [editDesc, setEditDesc] = useState(chat.description || "");
    const [showAddMember, setShowAddMember] = useState(false);
    if (!open)
        return null;
    const isAdmin = chat.members?.some((m) => m.id === "me" && m.role === "admin");
    const contacts = getContacts();
    const memberIds = chat.members?.map((m) => m.id) || [];
    const availableContacts = contacts.filter((c) => !memberIds.includes(c.id));
    const handleSaveEdit = () => {
        onUpdateGroup(chat.id, { name: editName, description: editDesc });
        setEditing(false);
    };
    const handleToggleRole = (memberId) => {
        if (!isAdmin || memberId === "me")
            return;
        const updatedMembers = chat.members?.map((m) => m.id === memberId ? { ...m, role: m.role === "admin" ? "member" : "admin" } : m);
        onUpdateGroup(chat.id, { members: updatedMembers });
    };
    const handleRemoveMember = (memberId) => {
        if (!isAdmin || memberId === "me")
            return;
        const updatedMembers = chat.members?.filter((m) => m.id !== memberId);
        onUpdateGroup(chat.id, { members: updatedMembers });
    };
    const handleAddMember = (contact) => {
        const newMember = { ...contact, role: "member", joinedAt: new Date().toISOString() };
        onUpdateGroup(chat.id, { members: [...(chat.members || []), newMember] });
        setShowAddMember(false);
    };
    return (_jsxs("div", { className: "w-80 h-full glass-strong border-l border-border/20 flex flex-col animate-slide-in-right", children: [_jsxs("div", { className: "p-4 border-b border-border/20 flex items-center justify-between", children: [_jsx("h3", { className: "text-sm font-semibold text-foreground", children: "Group Info" }), _jsx("button", { onClick: onClose, className: "w-8 h-8 rounded-lg glass glass-hover flex items-center justify-center", children: _jsx(X, { className: "w-4 h-4 text-muted-foreground" }) })] }), _jsxs("div", { className: "flex-1 overflow-y-auto scrollbar-glass p-4 space-y-4", children: [_jsxs("div", { className: "text-center", children: [_jsx("div", { className: "w-20 h-20 rounded-2xl glass flex items-center justify-center text-2xl font-bold text-foreground mx-auto mb-3", children: chat.avatar }), editing ? (_jsxs("div", { className: "space-y-2", children: [_jsx("input", { value: editName, onChange: (e) => setEditName(e.target.value), className: "w-full px-3 py-1.5 rounded-lg input-glass text-sm text-foreground text-center" }), _jsx("textarea", { value: editDesc, onChange: (e) => setEditDesc(e.target.value), className: "w-full px-3 py-1.5 rounded-lg input-glass text-xs text-foreground resize-none h-16", placeholder: "Group description" }), _jsxs("div", { className: "flex gap-2 justify-center", children: [_jsx("button", { onClick: () => setEditing(false), className: "px-3 py-1 rounded-lg glass text-xs text-muted-foreground", children: "Cancel" }), _jsxs("button", { onClick: handleSaveEdit, className: "px-3 py-1 rounded-lg btn-glass text-xs text-primary-foreground flex items-center gap-1", children: [_jsx(Check, { className: "w-3 h-3" }), " Save"] })] })] })) : (_jsxs(_Fragment, { children: [_jsxs("div", { className: "flex items-center justify-center gap-2", children: [_jsx("h4", { className: "text-lg font-semibold text-foreground", children: chat.name }), isAdmin && (_jsx("button", { onClick: () => setEditing(true), className: "text-muted-foreground hover:text-primary", children: _jsx(Edit2, { className: "w-3.5 h-3.5" }) }))] }), _jsx("p", { className: "text-xs text-muted-foreground mt-1", children: chat.description || "No description" }), _jsxs("p", { className: "text-xs text-muted-foreground mt-0.5", children: [_jsx(Users, { className: "w-3 h-3 inline mr-1" }), chat.members?.length, " members"] })] }))] }), _jsxs("div", { children: [_jsxs("div", { className: "flex items-center justify-between mb-2", children: [_jsx("span", { className: "text-xs font-semibold text-muted-foreground uppercase tracking-wider", children: "Members" }), isAdmin && (_jsx("button", { onClick: () => setShowAddMember(!showAddMember), className: "w-6 h-6 rounded-md glass glass-hover flex items-center justify-center", children: _jsx(UserPlus, { className: "w-3.5 h-3.5 text-primary" }) }))] }), showAddMember && availableContacts.length > 0 && (_jsxs("div", { className: "mb-2 p-2 rounded-xl glass space-y-1", children: [_jsx("p", { className: "text-[10px] text-muted-foreground mb-1", children: "Add member:" }), availableContacts.map((c) => (_jsxs("button", { onClick: () => handleAddMember(c), className: "w-full flex items-center gap-2 p-1.5 rounded-lg hover:bg-muted/20 transition-colors", children: [_jsx("div", { className: "w-7 h-7 rounded-lg glass flex items-center justify-center text-[10px] font-bold text-foreground", children: c.avatar }), _jsx("span", { className: "text-xs text-foreground", children: c.name }), _jsx(Plus, { className: "w-3 h-3 text-primary ml-auto" })] }, c.id)))] })), _jsx("div", { className: "space-y-1", children: chat.members?.map((member) => (_jsxs("div", { className: "flex items-center gap-2 p-2 rounded-xl hover:bg-muted/10 transition-colors group", children: [_jsxs("div", { className: "relative", children: [_jsx("div", { className: "w-9 h-9 rounded-lg glass flex items-center justify-center text-xs font-bold text-foreground", children: member.avatar }), member.online && (_jsx("div", { className: "absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-background" }))] }), _jsxs("div", { className: "flex-1 min-w-0", children: [_jsxs("div", { className: "flex items-center gap-1", children: [_jsx("span", { className: "text-xs font-medium text-foreground truncate", children: member.name }), member.role === "admin" && _jsx(Crown, { className: "w-3 h-3 text-amber-400" })] }), _jsx("span", { className: "text-[10px] text-muted-foreground", children: member.role })] }), isAdmin && member.id !== "me" && (_jsxs("div", { className: "hidden group-hover:flex items-center gap-1", children: [_jsx("button", { onClick: () => handleToggleRole(member.id), className: "w-6 h-6 rounded-md glass flex items-center justify-center", title: member.role === "admin" ? "Remove admin" : "Make admin", children: _jsx(Shield, { className: "w-3 h-3 text-primary" }) }), _jsx("button", { onClick: () => handleRemoveMember(member.id), className: "w-6 h-6 rounded-md glass flex items-center justify-center", title: "Remove member", children: _jsx(UserMinus, { className: "w-3 h-3 text-destructive" }) })] }))] }, member.id))) })] }), _jsxs("div", { className: "space-y-2 pt-2 border-t border-border/20", children: [_jsxs("button", { onClick: () => onLeaveGroup(chat.id), className: "w-full py-2 rounded-xl glass glass-hover text-sm text-destructive flex items-center justify-center gap-2", children: [_jsx(UserMinus, { className: "w-4 h-4" }), " Leave Group"] }), isAdmin && (_jsxs("button", { onClick: () => onDeleteGroup(chat.id), className: "w-full py-2 rounded-xl glass glass-hover text-sm text-destructive flex items-center justify-center gap-2", children: [_jsx(Trash2, { className: "w-4 h-4" }), " Delete Group"] }))] })] })] }));
};
export default GroupInfoPanel;
