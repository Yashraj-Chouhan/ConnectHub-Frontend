import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useRef } from "react";
import { Send, Phone, Video, MoreVertical, Smile, Paperclip, Image, FileText, Mic, Check, CheckCheck, Reply, Trash2, Users, X, Download } from "lucide-react";
const ChatArea = ({ chat, onSendMessage, onDeleteMessage, onOpenGroupInfo }) => {
    const [input, setInput] = useState("");
    const [showAttach, setShowAttach] = useState(false);
    const [replyTo, setReplyTo] = useState(null);
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const fileInputRef = useRef(null);
    const imageInputRef = useRef(null);
    const messagesEndRef = useRef(null);
    const emojis = ["😀", "😂", "❤️", "👍", "🎉", "🔥", "💯", "✨", "🙏", "😎", "🤔", "👋", "💪", "🚀", "⭐", "🎯"];
    const handleSend = () => {
        if (!input.trim())
            return;
        const msg = {
            id: Date.now().toString(),
            text: input,
            sent: true,
            time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            senderId: "me",
            type: "text",
            status: "sent",
            replyTo: replyTo?.id,
        };
        onSendMessage(chat.id, msg);
        setInput("");
        setReplyTo(null);
        setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    };
    const handleFileSelect = (e, type) => {
        const file = e.target.files?.[0];
        if (!file)
            return;
        const attachment = {
            name: file.name,
            size: formatFileSize(file.size),
            type: file.type,
            url: URL.createObjectURL(file),
            thumbnail: type === "image" ? URL.createObjectURL(file) : undefined,
        };
        const msg = {
            id: Date.now().toString(),
            text: type === "image" ? "📷 Photo" : `📎 ${file.name}`,
            sent: true,
            time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            senderId: "me",
            type: type === "image" ? "image" : "file",
            file: attachment,
            status: "sent",
        };
        onSendMessage(chat.id, msg);
        setShowAttach(false);
        e.target.value = "";
    };
    const formatFileSize = (bytes) => {
        if (bytes < 1024)
            return bytes + " B";
        if (bytes < 1048576)
            return (bytes / 1024).toFixed(1) + " KB";
        return (bytes / 1048576).toFixed(1) + " MB";
    };
    const renderStatus = (status) => {
        if (!status)
            return null;
        if (status === "read")
            return _jsx(CheckCheck, { className: "w-3 h-3 text-primary inline" });
        if (status === "delivered")
            return _jsx(CheckCheck, { className: "w-3 h-3 text-muted-foreground inline" });
        return _jsx(Check, { className: "w-3 h-3 text-muted-foreground inline" });
    };
    const getReplyMessage = (replyId) => {
        if (!replyId)
            return null;
        return chat.messages.find((m) => m.id === replyId);
    };
    return (_jsxs("div", { className: "flex-1 flex flex-col h-full", children: [_jsxs("div", { className: "p-4 glass-strong border-b border-border/20 flex items-center justify-between", children: [_jsxs("div", { className: "flex items-center gap-3 cursor-pointer", onClick: chat.isGroup ? onOpenGroupInfo : undefined, children: [_jsxs("div", { className: "relative", children: [_jsx("div", { className: "w-10 h-10 rounded-xl glass flex items-center justify-center text-sm font-bold text-foreground", children: chat.avatar }), chat.online && !chat.isGroup && (_jsx("div", { className: "absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-background" }))] }), _jsxs("div", { children: [_jsx("p", { className: "text-sm font-semibold text-foreground", children: chat.name }), _jsx("p", { className: "text-xs text-muted-foreground", children: chat.isGroup
                                            ? `${chat.members?.length} members`
                                            : chat.typing
                                                ? "typing..."
                                                : chat.online
                                                    ? "Online"
                                                    : "Last seen recently" })] })] }), _jsxs("div", { className: "flex gap-2", children: [!chat.isGroup && (_jsxs(_Fragment, { children: [_jsx("button", { className: "w-9 h-9 rounded-xl glass glass-hover flex items-center justify-center", children: _jsx(Phone, { className: "w-4 h-4 text-muted-foreground" }) }), _jsx("button", { className: "w-9 h-9 rounded-xl glass glass-hover flex items-center justify-center", children: _jsx(Video, { className: "w-4 h-4 text-muted-foreground" }) })] })), chat.isGroup && (_jsx("button", { onClick: onOpenGroupInfo, className: "w-9 h-9 rounded-xl glass glass-hover flex items-center justify-center", children: _jsx(Users, { className: "w-4 h-4 text-muted-foreground" }) })), _jsx("button", { className: "w-9 h-9 rounded-xl glass glass-hover flex items-center justify-center", children: _jsx(MoreVertical, { className: "w-4 h-4 text-muted-foreground" }) })] })] }), _jsxs("div", { className: "flex-1 overflow-y-auto scrollbar-glass p-4 space-y-3", children: [chat.messages.map((msg) => {
                        if (msg.deleted) {
                            return (_jsx("div", { className: `flex ${msg.sent ? "justify-end" : "justify-start"}`, children: _jsx("div", { className: "px-4 py-2 rounded-2xl glass opacity-50 italic", children: _jsx("p", { className: "text-xs text-muted-foreground", children: "\uD83D\uDEAB This message was deleted" }) }) }, msg.id));
                        }
                        const reply = getReplyMessage(msg.replyTo);
                        return (_jsx("div", { className: `flex ${msg.sent ? "justify-end" : "justify-start"} group`, children: _jsxs("div", { className: "max-w-[75%] relative", children: [_jsxs("div", { className: `absolute top-0 ${msg.sent ? "left-0 -translate-x-full" : "right-0 translate-x-full"} hidden group-hover:flex items-center gap-1 px-1`, children: [_jsx("button", { onClick: () => setReplyTo(msg), className: "w-6 h-6 rounded-md glass flex items-center justify-center", children: _jsx(Reply, { className: "w-3 h-3 text-muted-foreground" }) }), msg.sent && (_jsx("button", { onClick: () => onDeleteMessage(chat.id, msg.id), className: "w-6 h-6 rounded-md glass flex items-center justify-center", children: _jsx(Trash2, { className: "w-3 h-3 text-destructive" }) }))] }), reply && (_jsxs("div", { className: `px-3 py-1.5 rounded-t-2xl border-l-2 border-primary ${msg.sent ? "message-bubble-sent" : "message-bubble"} opacity-70`, children: [_jsx("p", { className: "text-[10px] font-medium text-primary", children: reply.sent ? "You" : reply.senderName || chat.name }), _jsx("p", { className: "text-[10px] text-muted-foreground truncate", children: reply.text })] })), _jsxs("div", { className: `px-4 py-2.5 ${reply ? "rounded-b-2xl" : "rounded-2xl"} message-bubble ${msg.sent ? "message-bubble-sent rounded-br-md" : "rounded-bl-md"}`, children: [chat.isGroup && !msg.sent && msg.senderName && (_jsx("p", { className: "text-[10px] font-semibold text-primary mb-1", children: msg.senderName })), msg.type === "image" && msg.file && (_jsx("div", { className: "mb-2 rounded-lg overflow-hidden", children: _jsx("img", { src: msg.file.url, alt: msg.file.name, className: "max-w-full rounded-lg" }) })), msg.type === "file" && msg.file && (_jsxs("div", { className: "flex items-center gap-3 p-2 rounded-lg glass mb-2", children: [_jsx(FileText, { className: "w-8 h-8 text-primary shrink-0" }), _jsxs("div", { className: "flex-1 min-w-0", children: [_jsx("p", { className: "text-xs font-medium text-foreground truncate", children: msg.file.name }), _jsxs("p", { className: "text-[10px] text-muted-foreground", children: [msg.file.size, " \u2022 ", msg.file.type.split("/")[1]?.toUpperCase()] })] }), _jsx("a", { href: msg.file.url, download: msg.file.name, className: "w-7 h-7 rounded-md glass flex items-center justify-center shrink-0", children: _jsx(Download, { className: "w-3.5 h-3.5 text-primary" }) })] })), _jsx("p", { className: "text-sm text-foreground", children: msg.type === "image" ? "" : msg.text }), _jsxs("div", { className: "flex items-center justify-end gap-1 mt-1", children: [_jsx("p", { className: `text-[10px] ${msg.sent ? "text-primary/60" : "text-muted-foreground"}`, children: msg.time }), msg.sent && renderStatus(msg.status)] })] })] }) }, msg.id));
                    }), _jsx("div", { ref: messagesEndRef })] }), replyTo && (_jsxs("div", { className: "px-4 py-2 glass border-t border-border/20 flex items-center gap-3 animate-fade-in", children: [_jsxs("div", { className: "flex-1 border-l-2 border-primary pl-3", children: [_jsx("p", { className: "text-[10px] font-medium text-primary", children: replyTo.sent ? "You" : replyTo.senderName || chat.name }), _jsx("p", { className: "text-xs text-muted-foreground truncate", children: replyTo.text })] }), _jsx("button", { onClick: () => setReplyTo(null), children: _jsx(X, { className: "w-4 h-4 text-muted-foreground" }) })] })), _jsxs("div", { className: "p-4 glass-strong border-t border-border/20", children: [showAttach && (_jsxs("div", { className: "mb-3 flex gap-2 animate-fade-in", children: [_jsxs("button", { onClick: () => imageInputRef.current?.click(), className: "flex flex-col items-center gap-1 p-3 rounded-xl glass glass-hover", children: [_jsx(Image, { className: "w-5 h-5 text-emerald-400" }), _jsx("span", { className: "text-[10px] text-muted-foreground", children: "Photo" })] }), _jsxs("button", { onClick: () => fileInputRef.current?.click(), className: "flex flex-col items-center gap-1 p-3 rounded-xl glass glass-hover", children: [_jsx(FileText, { className: "w-5 h-5 text-blue-400" }), _jsx("span", { className: "text-[10px] text-muted-foreground", children: "Document" })] }), _jsxs("button", { className: "flex flex-col items-center gap-1 p-3 rounded-xl glass glass-hover", children: [_jsx(Mic, { className: "w-5 h-5 text-rose-400" }), _jsx("span", { className: "text-[10px] text-muted-foreground", children: "Audio" })] })] })), showEmojiPicker && (_jsx("div", { className: "mb-3 p-3 rounded-xl glass grid grid-cols-8 gap-2 animate-fade-in", children: emojis.map((emoji) => (_jsx("button", { onClick: () => { setInput((prev) => prev + emoji); setShowEmojiPicker(false); }, className: "text-xl hover:scale-125 transition-transform", children: emoji }, emoji))) })), _jsxs("div", { className: "flex items-center gap-3", children: [_jsx("button", { onClick: () => setShowEmojiPicker(!showEmojiPicker), className: "w-10 h-10 rounded-xl glass glass-hover flex items-center justify-center shrink-0", children: _jsx(Smile, { className: "w-5 h-5 text-muted-foreground" }) }), _jsx("button", { onClick: () => setShowAttach(!showAttach), className: "w-10 h-10 rounded-xl glass glass-hover flex items-center justify-center shrink-0", children: _jsx(Paperclip, { className: "w-5 h-5 text-muted-foreground" }) }), _jsx("input", { type: "text", placeholder: "Type a message...", value: input, onChange: (e) => setInput(e.target.value), onKeyDown: (e) => e.key === "Enter" && handleSend(), className: "flex-1 px-4 py-2.5 rounded-xl input-glass text-sm text-foreground placeholder:text-muted-foreground" }), _jsx("button", { onClick: handleSend, className: "w-10 h-10 rounded-xl btn-glass flex items-center justify-center shrink-0", children: _jsx(Send, { className: "w-4 h-4 text-primary-foreground" }) })] }), _jsx("input", { ref: fileInputRef, type: "file", className: "hidden", onChange: (e) => handleFileSelect(e, "file") }), _jsx("input", { ref: imageInputRef, type: "file", accept: "image/*", className: "hidden", onChange: (e) => handleFileSelect(e, "image") })] })] }));
};
export default ChatArea;
