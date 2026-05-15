import { useState, useEffect, useCallback } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import ChatSidebar from "@/components/ChatSidebar";
import ChatArea from "@/components/ChatArea";
import GroupInfoPanel from "@/components/GroupInfoPanel";
import CreateGroupDialog from "@/components/CreateGroupDialog";
import ProfilePanel from "@/components/ProfilePanel";
import { MessageCircle, Loader2 } from "lucide-react";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

const ChatDashboard = () => {
  const { user } = useAuth();
  const { toast } = useToast();

  const [rooms, setRooms] = useState([]);
  const [messages, setMessages] = useState({}); // roomId -> Message[]
  const [activeRoomId, setActiveRoomId] = useState(null);
  const [loadingRooms, setLoadingRooms] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [showGroupInfo, setShowGroupInfo] = useState(false);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [profile, setProfile] = useState({
    id: user?.id || "me",
    name: user?.name || "You",
    email: user?.email || "",
    avatar: user?.name?.charAt(0).toUpperCase() || "Y",
    status: "Available",
    about: "Hey there! I am using ConnectHub",
    online: true,
  });

  if (!user) return <Navigate to="/" replace />;

  // ─── Load rooms on mount ───────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        setLoadingRooms(true);
        const data = await api.get(`/rooms/users/${user.id}`);
        if (!cancelled) {
          const normalised = Array.isArray(data) ? data : data.content ?? [];
          setRooms(normalised);
        }
      } catch (err) {
        if (!cancelled) {
          toast({
            title: "Could not load conversations",
            description: err.message,
            variant: "destructive",
          });
        }
      } finally {
        if (!cancelled) setLoadingRooms(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, []);

  // ─── Load messages when a room is selected ─────────────────────────────────
  useEffect(() => {
    if (!activeRoomId) return;
    if (messages[activeRoomId]) return; // already loaded

    let cancelled = false;
    const load = async () => {
      try {
        setLoadingMessages(true);
        const data = await api.get(`/messages/${activeRoomId}`);
        if (!cancelled) {
          const msgs = Array.isArray(data) ? data : data.content ?? [];
          setMessages((prev) => ({ ...prev, [activeRoomId]: msgs }));
        }
      } catch (err) {
        if (!cancelled) {
          toast({
            title: "Could not load messages",
            description: err.message,
            variant: "destructive",
          });
        }
      } finally {
        if (!cancelled) setLoadingMessages(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [activeRoomId]);

  // ─── Send message ──────────────────────────────────────────────────────────
  const handleSendMessage = useCallback(
    async (roomId, localMsg) => {
      // Optimistically add to UI
      setMessages((prev) => ({
        ...prev,
        [roomId]: [...(prev[roomId] ?? []), localMsg],
      }));
      // Update sidebar last message
      setRooms((prev) =>
        prev.map((r) =>
          r.id === roomId || r.roomId === roomId
            ? { ...r, lastMessage: localMsg.text, lastMessageAt: new Date().toISOString() }
            : r
        )
      );

      try {
        const saved = await api.post("/messages", {
          sender: user?.name || user?.email || "me",
          content: localMsg.text,
          roomId: String(roomId),
          messageType: localMsg.type === "text" ? "TEXT" : localMsg.type?.toUpperCase() ?? "TEXT",
          replyToMessageId: localMsg.replyTo ?? null,
        });

        // Replace the optimistic message with the real saved one
        setMessages((prev) => {
          const roomMsgs = prev[roomId] ?? [];
          return {
            ...prev,
            [roomId]: roomMsgs.map((m) =>
              m.id === localMsg.id ? normMsg(saved, user) : m
            ),
          };
        });
      } catch (err) {
        // Remove the optimistic message on failure
        setMessages((prev) => ({
          ...prev,
          [roomId]: (prev[roomId] ?? []).filter((m) => m.id !== localMsg.id),
        }));
        toast({ title: "Message not sent", description: err.message, variant: "destructive" });
      }
    },
    [user]
  );

  // ─── Delete message ────────────────────────────────────────────────────────
  const handleDeleteMessage = useCallback(async (roomId, messageId) => {
    setMessages((prev) => ({
      ...prev,
      [roomId]: (prev[roomId] ?? []).map((m) =>
        (m.id === messageId || String(m.id) === String(messageId))
          ? { ...m, deleted: true, text: "" }
          : m
      ),
    }));
    try {
      await api.delete(`/messages/${roomId}/${messageId}`);
    } catch {
      // Reverting on failure is complex; just keep UI state
    }
  }, []);

  // ─── Create group room ─────────────────────────────────────────────────────
  const handleCreateGroup = useCallback(
    async (name, description, members) => {
      try {
        const newRoom = await api.post("/rooms", {
          name,
          description,
          roomType: "GROUP",
          memberUserIds: members.map((m) => m.id),
          createdBy: user.id || "me"
        });
        const normalised = {
          ...newRoom,
          isGroup: true,
          avatar: name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase(),
        };
        setRooms((prev) => [normalised, ...prev]);
        setActiveRoomId(normalised.id ?? normalised.roomId);
        setMessages((prev) => ({
          ...prev,
          [normalised.id ?? normalised.roomId]: [],
        }));
      } catch (err) {
        toast({ title: "Could not create group", description: err.message, variant: "destructive" });
      }
    },
    []
  );

  // ─── Group management helpers (local only for now) ─────────────────────────
  const handleUpdateGroup = useCallback((roomId, updates) => {
    setRooms((prev) => prev.map((r) => (r.id === roomId ? { ...r, ...updates } : r)));
  }, []);

  const handleLeaveGroup = useCallback((roomId) => {
    setRooms((prev) =>
      prev.map((r) =>
        r.id === roomId
          ? { ...r, members: r.members?.filter((m) => m.id !== "me") }
          : r
      )
    );
    setActiveRoomId(null);
    setShowGroupInfo(false);
  }, []);

  const handleDeleteGroup = useCallback((roomId) => {
    setRooms((prev) => prev.filter((r) => r.id !== roomId));
    setActiveRoomId(null);
    setShowGroupInfo(false);
  }, []);

  const handleUpdateProfile = useCallback((updates) => {
    setProfile((prev) => ({ ...prev, ...updates }));
  }, []);

  // ─── Normalise a room into the shape the sidebar expects ───────────────────
  const toChat = (room) => {
    const roomId = room.id ?? room.roomId;
    const roomMessages = messages[roomId] ?? [];
    const lastMsg = roomMessages[roomMessages.length - 1];
    return {
      id: roomId,
      name: room.name || room.roomName || "Unknown",
      avatar: room.avatar || (room.name || "?").charAt(0).toUpperCase(),
      isGroup: room.type === "GROUP" || room.isGroup || false,
      online: room.online || false,
      lastMessage: room.lastMessage || (lastMsg ? lastMsg.content || lastMsg.text : "No messages yet"),
      time: formatTime(room.lastMessageAt || room.updatedAt || room.createdAt),
      unread: room.unread ?? 0,
      members: room.members || [],
      description: room.description || "",
      createdBy: room.createdBy || "",
      messages: roomMessages.map((m) => normMsg(m, user)),
      typing: false,
    };
  };

  const currentChat = activeRoomId ? toChat(rooms.find((r) => (r.id ?? r.roomId) === activeRoomId) ?? {}) : null;
  const chats = rooms.map(toChat);

  return (
    <div className="relative h-screen flex overflow-hidden bg-background">
      <div className="relative z-10 flex w-full h-full">
        {loadingRooms ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center space-y-4">
              <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto" />
              <p className="text-muted-foreground text-sm">Loading conversations…</p>
            </div>
          </div>
        ) : (
          <>
            <ChatSidebar
              chats={chats}
              activeChat={activeRoomId}
              onSelectChat={(id) => { setActiveRoomId(id); setShowGroupInfo(false); }}
              onCreateGroup={() => setShowCreateGroup(true)}
              onOpenProfile={() => setShowProfile(true)}
            />

            {currentChat ? (
              <>
                {loadingMessages ? (
                  <div className="flex-1 flex items-center justify-center">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                  </div>
                ) : (
                  <ChatArea
                    chat={currentChat}
                    onSendMessage={handleSendMessage}
                    onDeleteMessage={handleDeleteMessage}
                    onOpenGroupInfo={() => setShowGroupInfo(true)}
                  />
                )}
                {currentChat.isGroup && showGroupInfo && (
                  <GroupInfoPanel
                    chat={currentChat}
                    open={showGroupInfo}
                    onClose={() => setShowGroupInfo(false)}
                    onUpdateGroup={handleUpdateGroup}
                    onLeaveGroup={handleLeaveGroup}
                    onDeleteGroup={handleDeleteGroup}
                  />
                )}
              </>
            ) : (
              <div className="flex-1 hidden md:flex items-center justify-center">
                <div className="text-center animate-fade-in">
                  <div className="w-20 h-20 rounded-2xl glass flex items-center justify-center mx-auto mb-4 float-animation">
                    <MessageCircle className="w-10 h-10 text-primary" />
                  </div>
                  <h2 className="text-xl font-semibold text-foreground mb-2">ConnectHub</h2>
                  <p className="text-sm text-muted-foreground">Select a conversation to start messaging</p>
                  {chats.length === 0 && (
                    <p className="text-xs text-muted-foreground mt-2">
                      No conversations yet. Start by creating a group or waiting for someone to message you.
                    </p>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <CreateGroupDialog
        open={showCreateGroup}
        onClose={() => setShowCreateGroup(false)}
        onCreate={handleCreateGroup}
      />
      <ProfilePanel
        open={showProfile}
        onClose={() => setShowProfile(false)}
        profile={profile}
        onUpdateProfile={handleUpdateProfile}
      />
    </div>
  );
};

// ─── Helpers ───────────────────────────────────────────────────────────────
function normMsg(m, currentUser) {
  const senderId = m.sender || m.senderId || "";
  const isMine =
    senderId === (currentUser?.name || currentUser?.email || "me") ||
    senderId === "me" ||
    m.sent === true;
  return {
    id: String(m.id ?? m.messageId ?? Date.now()),
    text: m.content ?? m.text ?? "",
    sent: isMine,
    time: formatTime(m.timestamp ?? m.createdAt ?? m.time),
    senderId,
    senderName: m.senderName || (!isMine ? senderId : undefined),
    type: (m.messageType ?? m.type ?? "TEXT").toLowerCase(),
    status: m.status ?? "sent",
    deleted: m.deleted ?? false,
    replyTo: m.replyToMessageId ?? m.replyTo ?? null,
    file: m.attachmentName
      ? {
          name: m.attachmentName,
          size: m.attachmentSize ? formatFileSize(m.attachmentSize) : "",
          type: m.attachmentContentType ?? "",
          url: `/api/messages/${m.roomId}/${m.id}/attachments/${m.id}`,
        }
      : undefined,
  };
}

function formatTime(ts) {
  if (!ts) return "";
  try {
    const d = new Date(ts);
    if (isNaN(d.getTime())) return String(ts);
    const now = new Date();
    const diffMs = now - d;
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return "just now";
    if (diffMins < 60) return `${diffMins}m`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h`;
    return d.toLocaleDateString([], { month: "short", day: "numeric" });
  } catch {
    return "";
  }
}

function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / 1048576).toFixed(1) + " MB";
}

export default ChatDashboard;
