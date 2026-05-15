import { useState, useRef, useEffect } from "react";
import {
  Send, Phone, Video, MoreVertical, Smile, Paperclip,
  Image, FileText, Mic, Check, CheckCheck, Reply, Trash2,
  Users, X, Download,
} from "lucide-react";

const emojis = ["😀","😂","❤️","👍","🎉","🔥","💯","✨","🙏","😎","🤔","👋","💪","🚀","⭐","🎯"];

const ChatArea = ({ chat, onSendMessage, onDeleteMessage, onOpenGroupInfo }) => {
  const [input, setInput] = useState("");
  const [showAttach, setShowAttach] = useState(false);
  const [replyTo, setReplyTo] = useState(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const fileInputRef = useRef(null);
  const imageInputRef = useRef(null);
  const messagesEndRef = useRef(null);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chat.messages?.length]);

  const handleSend = () => {
    if (!input.trim()) return;
    const msg = {
      id: Date.now().toString(),
      text: input.trim(),
      sent: true,
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      senderId: "me",
      type: "text",
      status: "sent",
      replyTo: replyTo?.id ?? null,
    };
    onSendMessage(chat.id, msg);
    setInput("");
    setReplyTo(null);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileSelect = (e, type) => {
    const file = e.target.files?.[0];
    if (!file) return;
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
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / 1048576).toFixed(1) + " MB";
  };

  const renderStatus = (status) => {
    if (!status) return null;
    if (status === "read") return <CheckCheck className="w-3 h-3 text-primary inline" />;
    if (status === "delivered") return <CheckCheck className="w-3 h-3 text-muted-foreground inline" />;
    return <Check className="w-3 h-3 text-muted-foreground inline" />;
  };

  const getReplyMessage = (replyId) => {
    if (!replyId) return null;
    return chat.messages?.find((m) => String(m.id) === String(replyId)) ?? null;
  };

  const msgList = chat.messages ?? [];

  return (
    <div className="flex-1 flex flex-col h-full min-w-0">
      {/* Header */}
      <div className="p-4 glass-strong border-b border-border/20 flex items-center justify-between shrink-0">
        <div
          className="flex items-center gap-3 cursor-pointer"
          onClick={chat.isGroup ? onOpenGroupInfo : undefined}
        >
          <div className="relative">
            <div className="w-10 h-10 rounded-xl glass flex items-center justify-center text-sm font-bold text-foreground">
              {chat.avatar}
            </div>
            {chat.online && !chat.isGroup && (
              <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-background" />
            )}
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">{chat.name}</p>
            <p className="text-xs text-muted-foreground">
              {chat.isGroup
                ? `${chat.members?.length ?? 0} members`
                : chat.typing
                ? "typing..."
                : chat.online
                ? "Online"
                : "Last seen recently"}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {!chat.isGroup && (
            <>
              <button className="w-9 h-9 rounded-xl glass glass-hover flex items-center justify-center">
                <Phone className="w-4 h-4 text-muted-foreground" />
              </button>
              <button className="w-9 h-9 rounded-xl glass glass-hover flex items-center justify-center">
                <Video className="w-4 h-4 text-muted-foreground" />
              </button>
            </>
          )}
          {chat.isGroup && (
            <button
              onClick={onOpenGroupInfo}
              className="w-9 h-9 rounded-xl glass glass-hover flex items-center justify-center"
            >
              <Users className="w-4 h-4 text-muted-foreground" />
            </button>
          )}
          <button className="w-9 h-9 rounded-xl glass glass-hover flex items-center justify-center">
            <MoreVertical className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto scrollbar-glass p-4 space-y-3">
        {msgList.length === 0 && (
          <div className="flex items-center justify-center h-full">
            <p className="text-muted-foreground text-sm">No messages yet. Say hello! 👋</p>
          </div>
        )}
        {msgList.map((msg) => {
          if (msg.deleted) {
            return (
              <div key={msg.id} className={`flex ${msg.sent ? "justify-end" : "justify-start"}`}>
                <div className="px-4 py-2 rounded-2xl glass opacity-50 italic">
                  <p className="text-xs text-muted-foreground">🚫 This message was deleted</p>
                </div>
              </div>
            );
          }

          const reply = getReplyMessage(msg.replyTo);

          return (
            <div
              key={msg.id}
              className={`flex ${msg.sent ? "justify-end" : "justify-start"} group`}
            >
              <div className="max-w-[75%] relative">
                {/* Action buttons on hover */}
                <div
                  className={`absolute top-0 ${msg.sent ? "left-0 -translate-x-full" : "right-0 translate-x-full"} hidden group-hover:flex items-center gap-1 px-1`}
                >
                  <button
                    onClick={() => setReplyTo(msg)}
                    className="w-6 h-6 rounded-md glass flex items-center justify-center"
                    title="Reply"
                  >
                    <Reply className="w-3 h-3 text-muted-foreground" />
                  </button>
                  {msg.sent && (
                    <button
                      onClick={() => onDeleteMessage(chat.id, msg.id)}
                      className="w-6 h-6 rounded-md glass flex items-center justify-center"
                      title="Delete"
                    >
                      <Trash2 className="w-3 h-3 text-destructive" />
                    </button>
                  )}
                </div>

                {/* Reply preview */}
                {reply && (
                  <div
                    className={`px-3 py-1.5 rounded-t-2xl border-l-2 border-primary ${msg.sent ? "message-bubble-sent" : "message-bubble"} opacity-70`}
                  >
                    <p className="text-[10px] font-medium text-primary">
                      {reply.sent ? "You" : reply.senderName || chat.name}
                    </p>
                    <p className="text-[10px] text-muted-foreground truncate">{reply.text}</p>
                  </div>
                )}

                {/* Bubble */}
                <div
                  className={`px-4 py-2.5 ${reply ? "rounded-b-2xl" : "rounded-2xl"} message-bubble ${msg.sent ? "message-bubble-sent rounded-br-md" : "rounded-bl-md"}`}
                >
                  {/* Group sender name */}
                  {chat.isGroup && !msg.sent && msg.senderName && (
                    <p className="text-[10px] font-semibold text-primary mb-1">{msg.senderName}</p>
                  )}

                  {/* Image */}
                  {msg.type === "image" && msg.file && (
                    <div className="mb-2 rounded-lg overflow-hidden">
                      <img src={msg.file.url} alt={msg.file.name} className="max-w-full rounded-lg" />
                    </div>
                  )}

                  {/* File */}
                  {msg.type === "file" && msg.file && (
                    <div className="flex items-center gap-3 p-2 rounded-lg glass mb-2">
                      <FileText className="w-8 h-8 text-primary shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-foreground truncate">{msg.file.name}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {msg.file.size} • {msg.file.type.split("/")[1]?.toUpperCase()}
                        </p>
                      </div>
                      <a
                        href={msg.file.url}
                        download={msg.file.name}
                        className="w-7 h-7 rounded-md glass flex items-center justify-center shrink-0"
                      >
                        <Download className="w-3.5 h-3.5 text-primary" />
                      </a>
                    </div>
                  )}

                  {/* Text */}
                  <p className="text-sm text-foreground">
                    {msg.type === "image" ? "" : msg.text}
                  </p>

                  {/* Time + Status */}
                  <div className="flex items-center justify-end gap-1 mt-1">
                    <p className={`text-[10px] ${msg.sent ? "text-primary/60" : "text-muted-foreground"}`}>
                      {msg.time}
                    </p>
                    {msg.sent && renderStatus(msg.status)}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Reply banner */}
      {replyTo && (
        <div className="px-4 py-2 glass border-t border-border/20 flex items-center gap-3 animate-fade-in shrink-0">
          <div className="flex-1 border-l-2 border-primary pl-3">
            <p className="text-[10px] font-medium text-primary">
              {replyTo.sent ? "You" : replyTo.senderName || chat.name}
            </p>
            <p className="text-xs text-muted-foreground truncate">{replyTo.text}</p>
          </div>
          <button onClick={() => setReplyTo(null)}>
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>
      )}

      {/* Input area */}
      <div className="p-4 glass-strong border-t border-border/20 shrink-0">
        {/* Attach options */}
        {showAttach && (
          <div className="mb-3 flex gap-2 animate-fade-in">
            <button
              onClick={() => imageInputRef.current?.click()}
              className="flex flex-col items-center gap-1 p-3 rounded-xl glass glass-hover"
            >
              <Image className="w-5 h-5 text-emerald-400" />
              <span className="text-[10px] text-muted-foreground">Photo</span>
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex flex-col items-center gap-1 p-3 rounded-xl glass glass-hover"
            >
              <FileText className="w-5 h-5 text-blue-400" />
              <span className="text-[10px] text-muted-foreground">Document</span>
            </button>
            <button className="flex flex-col items-center gap-1 p-3 rounded-xl glass glass-hover">
              <Mic className="w-5 h-5 text-rose-400" />
              <span className="text-[10px] text-muted-foreground">Audio</span>
            </button>
          </div>
        )}

        {/* Emoji picker */}
        {showEmojiPicker && (
          <div className="mb-3 p-3 rounded-xl glass grid grid-cols-8 gap-2 animate-fade-in">
            {emojis.map((emoji) => (
              <button
                key={emoji}
                onClick={() => { setInput((prev) => prev + emoji); setShowEmojiPicker(false); }}
                className="text-xl hover:scale-125 transition-transform"
              >
                {emoji}
              </button>
            ))}
          </div>
        )}

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            className="w-10 h-10 rounded-xl glass glass-hover flex items-center justify-center shrink-0"
          >
            <Smile className="w-5 h-5 text-muted-foreground" />
          </button>
          <button
            onClick={() => setShowAttach(!showAttach)}
            className="w-10 h-10 rounded-xl glass glass-hover flex items-center justify-center shrink-0"
          >
            <Paperclip className="w-5 h-5 text-muted-foreground" />
          </button>
          <input
            type="text"
            placeholder="Type a message…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1 px-4 py-2.5 rounded-xl input-glass text-sm text-foreground placeholder:text-muted-foreground"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim()}
            className="w-10 h-10 rounded-xl btn-glass flex items-center justify-center shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send className="w-4 h-4 text-primary-foreground" />
          </button>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={(e) => handleFileSelect(e, "file")}
        />
        <input
          ref={imageInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => handleFileSelect(e, "image")}
        />
      </div>
    </div>
  );
};

export default ChatArea;
