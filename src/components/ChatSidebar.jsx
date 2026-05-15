import { useState } from "react";
import { Search, Plus, LogOut, Users, BellOff } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";

const ChatSidebar = ({ chats, activeChat, onSelectChat, onCreateGroup, onOpenProfile }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");

  const filtered = chats
    .filter((c) => (c.name || "").toLowerCase().includes(search.toLowerCase()))
    .filter((c) =>
      filter === "all" ? true : filter === "groups" ? c.isGroup : !c.isGroup
    );

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  return (
    <div className="w-full md:w-80 lg:w-96 h-full glass-strong flex flex-col border-r border-border/30 shrink-0">
      {/* Top bar */}
      <div className="p-4 flex items-center justify-between border-b border-border/20">
        <button
          onClick={onOpenProfile}
          className="flex items-center gap-3 hover:opacity-80 transition-opacity"
        >
          <div className="w-10 h-10 rounded-xl btn-glass flex items-center justify-center text-sm font-bold text-primary-foreground">
            {user?.name?.charAt(0).toUpperCase() || "?"}
          </div>
          <div className="text-left">
            <p className="text-sm font-semibold text-foreground">{user?.name || "You"}</p>
            <p className="text-xs text-muted-foreground">Online</p>
          </div>
        </button>
        <div className="flex gap-2">
          <button
            onClick={onCreateGroup}
            className="w-9 h-9 rounded-xl glass glass-hover flex items-center justify-center"
            title="New Group"
          >
            <Users className="w-4 h-4 text-muted-foreground" />
          </button>
          <button
            className="w-9 h-9 rounded-xl glass glass-hover flex items-center justify-center"
            title="New Chat"
          >
            <Plus className="w-4 h-4 text-muted-foreground" />
          </button>
          <button
            onClick={handleLogout}
            className="w-9 h-9 rounded-xl glass glass-hover flex items-center justify-center"
            title="Logout"
          >
            <LogOut className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>
      </div>

      {/* Search + filters */}
      <div className="p-3 space-y-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search chats..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl input-glass text-sm text-foreground placeholder:text-muted-foreground"
          />
        </div>
        <div className="flex gap-1">
          {["all", "direct", "groups"].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-all ${
                filter === f
                  ? "btn-glass text-primary-foreground"
                  : "glass text-muted-foreground glass-hover"
              }`}
            >
              {f === "all" ? "All" : f === "direct" ? "Direct" : "Groups"}
            </button>
          ))}
        </div>
      </div>

      {/* Chat list */}
      <div className="flex-1 overflow-y-auto scrollbar-glass px-2 pb-2 space-y-1">
        {filtered.map((chat, i) => (
          <button
            key={chat.id}
            onClick={() => onSelectChat(chat.id)}
            className={`w-full p-3 rounded-xl flex items-center gap-3 transition-all duration-300 glass-hover animate-fade-in ${
              activeChat === chat.id ? "glass border-primary/30" : "hover:bg-muted/20"
            }`}
            style={{ animationDelay: `${i * 0.05}s` }}
          >
            {/* Avatar */}
            <div className="relative">
              <div className="w-12 h-12 rounded-xl glass flex items-center justify-center text-sm font-bold text-foreground shrink-0">
                {chat.isGroup ? <Users className="w-5 h-5" /> : chat.avatar}
              </div>
              {chat.online && !chat.isGroup && (
                <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-background" />
              )}
            </div>

            {/* Info */}
            <div className="flex-1 text-left min-w-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{chat.name}</p>
                  {chat.muted && <BellOff className="w-3 h-3 text-muted-foreground shrink-0" />}
                </div>
                <span className="text-xs text-muted-foreground shrink-0 ml-1">{chat.time}</span>
              </div>
              <div className="flex items-center justify-between mt-0.5">
                <p className="text-xs text-muted-foreground truncate">
                  {chat.typing ? (
                    <span className="text-primary">typing...</span>
                  ) : (
                    chat.lastMessage || "No messages yet"
                  )}
                </p>
                {chat.unread > 0 && (
                  <span className="w-5 h-5 rounded-full btn-glass flex items-center justify-center text-[10px] font-bold text-primary-foreground shrink-0 ml-1">
                    {chat.unread}
                  </span>
                )}
              </div>
            </div>
          </button>
        ))}

        {filtered.length === 0 && (
          <div className="text-center py-8">
            <p className="text-sm text-muted-foreground">
              {search ? "No chats match your search" : "No conversations yet"}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatSidebar;
