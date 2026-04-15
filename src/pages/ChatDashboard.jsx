import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import ChatSidebar from "@/components/ChatSidebar";
import ChatArea from "@/components/ChatArea";
import GroupInfoPanel from "@/components/GroupInfoPanel";
import CreateGroupDialog from "@/components/CreateGroupDialog";
import ProfilePanel from "@/components/ProfilePanel";
import { mockChats, currentUser } from "@/data/mockChats";
import { MessageCircle } from "lucide-react";
import bgImage from "@/assets/bg-gradient.jpg";
const ChatDashboard = () => {
    const { user } = useAuth();
    const [activeChat, setActiveChat] = useState(null);
    const [chats, setChats] = useState(mockChats);
    const [showGroupInfo, setShowGroupInfo] = useState(false);
    const [showCreateGroup, setShowCreateGroup] = useState(false);
    const [showProfile, setShowProfile] = useState(false);
    const [profile, setProfile] = useState({
        ...currentUser,
        name: user?.name || currentUser.name,
        email: user?.email || currentUser.email,
        avatar: user?.name?.charAt(0).toUpperCase() || "Y",
    });
    if (!user)
        return _jsx(Navigate, { to: "/", replace: true });
    const currentChat = chats.find((c) => c.id === activeChat);
    const handleSendMessage = (chatId, message) => {
        setChats((prev) => prev.map((c) => c.id === chatId
            ? { ...c, messages: [...c.messages, message], lastMessage: message.text, time: "now", unread: 0 }
            : c));
        // Simulate reply after 2s for direct chats
        const chat = chats.find((c) => c.id === chatId);
        if (chat && !chat.isGroup) {
            // Show typing indicator
            setTimeout(() => {
                setChats((prev) => prev.map((c) => c.id === chatId ? { ...c, typing: true } : c));
            }, 500);
            setTimeout(() => {
                const replies = ["Got it! 👍", "Interesting, tell me more", "Sure thing!", "That's awesome! 🎉", "Let me think about it...", "Absolutely! 💯"];
                const reply = {
                    id: (Date.now() + 1).toString(),
                    text: replies[Math.floor(Math.random() * replies.length)],
                    sent: false,
                    time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
                    senderId: chat.id,
                    type: "text",
                    status: "read",
                };
                setChats((prev) => prev.map((c) => c.id === chatId
                    ? { ...c, messages: [...c.messages, reply], lastMessage: reply.text, time: "now", typing: false }
                    : c));
            }, 2500);
        }
    };
    const handleDeleteMessage = (chatId, messageId) => {
        setChats((prev) => prev.map((c) => c.id === chatId
            ? { ...c, messages: c.messages.map((m) => m.id === messageId ? { ...m, deleted: true, text: "" } : m) }
            : c));
    };
    const handleCreateGroup = (name, description, members) => {
        const newGroup = {
            id: Date.now().toString(),
            name,
            avatar: name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase(),
            lastMessage: "Group created",
            time: "now",
            unread: 0,
            online: true,
            isGroup: true,
            description,
            createdBy: "me",
            members,
            messages: [{
                    id: "sys1",
                    text: `${user.name} created the group "${name}"`,
                    sent: false,
                    time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
                    senderId: "system",
                    type: "system",
                }],
        };
        setChats((prev) => [newGroup, ...prev]);
        setActiveChat(newGroup.id);
    };
    const handleUpdateGroup = (chatId, updates) => {
        setChats((prev) => prev.map((c) => c.id === chatId ? { ...c, ...updates } : c));
    };
    const handleLeaveGroup = (chatId) => {
        setChats((prev) => prev.map((c) => c.id === chatId
            ? { ...c, members: c.members?.filter((m) => m.id !== "me") }
            : c));
        setActiveChat(null);
        setShowGroupInfo(false);
    };
    const handleDeleteGroup = (chatId) => {
        setChats((prev) => prev.filter((c) => c.id !== chatId));
        setActiveChat(null);
        setShowGroupInfo(false);
    };
    const handleUpdateProfile = (updates) => {
        setProfile((prev) => ({ ...prev, ...updates }));
    };
    return (_jsxs("div", { className: "relative h-screen flex overflow-hidden", children: [_jsx("img", { src: bgImage, alt: "", className: "absolute inset-0 w-full h-full object-cover opacity-30", width: 1920, height: 1080 }), _jsx("div", { className: "absolute inset-0 bg-background/70" }), _jsxs("div", { className: "relative z-10 flex w-full h-full", children: [_jsx(ChatSidebar, { chats: chats, activeChat: activeChat, onSelectChat: (id) => { setActiveChat(id); setShowGroupInfo(false); }, onCreateGroup: () => setShowCreateGroup(true), onOpenProfile: () => setShowProfile(true) }), currentChat ? (_jsxs(_Fragment, { children: [_jsx(ChatArea, { chat: currentChat, onSendMessage: handleSendMessage, onDeleteMessage: handleDeleteMessage, onOpenGroupInfo: () => setShowGroupInfo(true) }), currentChat.isGroup && showGroupInfo && (_jsx(GroupInfoPanel, { chat: currentChat, open: showGroupInfo, onClose: () => setShowGroupInfo(false), onUpdateGroup: handleUpdateGroup, onLeaveGroup: handleLeaveGroup, onDeleteGroup: handleDeleteGroup }))] })) : (_jsx("div", { className: "flex-1 hidden md:flex items-center justify-center", children: _jsxs("div", { className: "text-center animate-fade-in", children: [_jsx("div", { className: "w-20 h-20 rounded-2xl glass flex items-center justify-center mx-auto mb-4 float-animation", children: _jsx(MessageCircle, { className: "w-10 h-10 text-primary" }) }), _jsx("h2", { className: "text-xl font-semibold text-foreground mb-2", children: "ConnectHub" }), _jsx("p", { className: "text-sm text-muted-foreground", children: "Select a conversation to start messaging" })] }) }))] }), _jsx(CreateGroupDialog, { open: showCreateGroup, onClose: () => setShowCreateGroup(false), onCreate: handleCreateGroup }), _jsx(ProfilePanel, { open: showProfile, onClose: () => setShowProfile(false), profile: profile, onUpdateProfile: handleUpdateProfile })] }));
};
export default ChatDashboard;
