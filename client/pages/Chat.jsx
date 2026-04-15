import { useEffect, useMemo, useRef, useState } from "react";
import { Navigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { MessageCircle } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import { Toaster } from "@/components/ui/toaster";
import { useChatSocket } from "@/hooks/useChatSocket";
import {
  buildConversation,
  buildUiMessages,
  defaultAvatar,
  formatRoomBadgeTime,
  messagePreview,
  normalizeRawMessage,
  normalizeRoom,
  normalizeUserSummary,
} from "@/lib/chat";
import { ChatSidebar } from "@/components/chat/ChatSidebar";
import { ChatHeader } from "@/components/chat/ChatHeader";
import { MessageDisplay } from "@/components/chat/MessageDisplay";
import { MessageInput } from "@/components/chat/MessageInput";
import { CreateRoomModal } from "@/components/chat/CreateRoomModal";
import { GroupManagementModal } from "@/components/chat/GroupManagementModal";
import { ProfileEditModal } from "@/components/chat/ProfileEditModal";

const Chat = () => {
  const { user, logout, updateProfile } = useAuth();
  const { toast } = useToast();
  const { clientRef, connected, publish } = useChatSocket(user?.userId);

  const [rooms, setRooms] = useState([]);
  const [membersByRoom, setMembersByRoom] = useState({});
  const [messagesByRoom, setMessagesByRoom] = useState({});
  const [usersById, setUsersById] = useState({});
  const [selectedRoomId, setSelectedRoomId] = useState(null);
  const [showCreateRoomModal, setShowCreateRoomModal] = useState(false);
  const [showProfileEditModal, setShowProfileEditModal] = useState(false);
  const [showGroupManagementModal, setShowGroupManagementModal] = useState(false);
  const [loadingRooms, setLoadingRooms] = useState(false);
  const [replyingToMessage, setReplyingToMessage] = useState(null);
  const [typingByRoom, setTypingByRoom] = useState({});
  const typingTimersRef = useRef({});
  const roomSocketHandlerRef = useRef(null);
  const personalSocketHandlerRef = useRef(null);

  useEffect(() => {
    if (user) {
      setUsersById((prev) => ({
        ...prev,
        [user.userId]: normalizeUserSummary(user),
      }));
    }
  }, [user]);

  const mergeUsersIntoCache = (profiles) => {
    setUsersById((prev) => {
      const next = { ...prev };
      profiles.forEach((profile) => {
        const normalized = normalizeUserSummary(profile);
        if (normalized?.userId) {
          next[normalized.userId] = normalized;
        }
      });
      return next;
    });
  };

  const loadRoomMembers = async (roomId) => {
    const records = await api.rooms.members(roomId);
    const enrichedMembers = await Promise.all(
      (Array.isArray(records) ? records : []).map(async (record) => {
        if (!record?.userId) return null;
        if (record.userId === user?.userId) {
          return {
            ...normalizeUserSummary(user),
            role: String(record.role || "MEMBER").toLowerCase(),
          };
        }

        try {
          const profile = await api.auth.getUser(record.userId);
          return {
            ...normalizeUserSummary(profile),
            role: String(record.role || "MEMBER").toLowerCase(),
          };
        } catch {
          return {
            id: record.userId,
            userId: record.userId,
            username: record.userId,
            fullName: record.userId,
            name: record.userId,
            email: "",
            phoneNumber: "",
            avatarUrl: "",
            avatar: defaultAvatar(record.userId),
            bio: "",
            preferredLanguage: null,
            onlineStatus: "OFFLINE",
            lastSeenAt: null,
            role: String(record.role || "MEMBER").toLowerCase(),
            online: false,
          };
        }
      })
    );

    const filtered = enrichedMembers.filter(Boolean);
    setMembersByRoom((prev) => ({ ...prev, [String(roomId)]: filtered }));
    mergeUsersIntoCache(filtered);
    return filtered;
  };

  const applyIncomingMessage = (roomId, payload, { incrementUnread = false, updatePreview = true } = {}) => {
    const incoming = normalizeRawMessage(payload, roomId);
    const roomKey = String(roomId);

    setMessagesByRoom((prev) => {
      const current = prev[roomKey] || [];
      const index = current.findIndex((message) => String(message.id) === String(incoming.id));
      const next = [...current];
      if (index >= 0) {
        next[index] = { ...next[index], ...incoming };
        next[index] = {
          ...next[index],
          originalContent: incoming.originalContent || next[index].originalContent || next[index].content || incoming.content || "",
          translatedContent: incoming.translatedContent || next[index].translatedContent || "",
        };
        next[index].content = next[index].translatedContent || incoming.content || next[index].content || "";
      } else {
        next.push(incoming);
      }
      return { ...prev, [roomKey]: next };
    });

    if (!updatePreview || incoming.eventType === "TYPING_INDICATOR") {
      return;
    }

    setRooms((prev) =>
      prev.map((room) => {
        if (String(room.id) !== roomKey) {
          return room;
        }

        const isSelected = String(selectedRoomId) === roomKey;
        const shouldResetUnread =
          isSelected ||
          incoming.sender === user?.userId ||
          incoming.eventType === "MESSAGE_TRANSLATED" ||
          incoming.eventType === "REACTION";

        return {
          ...room,
          lastMessage: messagePreview(incoming),
          time: formatRoomBadgeTime(incoming.timestamp),
          lastMessageAt: incoming.timestamp || room.lastMessageAt,
          unread: shouldResetUnread ? 0 : incrementUnread ? (room.unread || 0) + 1 : room.unread || 0,
        };
      })
    );
  };

  const markTyping = (roomId) => {
    const roomKey = String(roomId);
    setTypingByRoom((prev) => ({ ...prev, [roomKey]: true }));
    if (typingTimersRef.current[roomKey]) {
      clearTimeout(typingTimersRef.current[roomKey]);
    }
    typingTimersRef.current[roomKey] = setTimeout(() => {
      setTypingByRoom((prev) => ({ ...prev, [roomKey]: false }));
      delete typingTimersRef.current[roomKey];
    }, 1800);
  };

  const handleRoomSocketPayload = (payload) => {
    if (!payload?.roomId) return;
    const roomId = String(payload.roomId);
    if (payload.eventType === "TYPING_INDICATOR") {
      if (payload.sender === user?.userId) {
        return;
      }
      markTyping(roomId);
      return;
    }
    if (payload.eventType === "REACTION") {
      const messageId = String(payload.messageId || "");
      if (!messageId) return;
      setMessagesByRoom((prev) => {
        const roomMessages = prev[roomId] || [];
        const next = roomMessages.map((message) =>
          String(message.id) === messageId
            ? { ...message, reactions: Array.from(new Set([...(message.reactions || []), payload.emoji].filter(Boolean))) }
            : message
        );
        return { ...prev, [roomId]: next };
      });
      return;
    }
    if (payload.eventType === "READ_RECEIPT") {
      return;
    }
    applyIncomingMessage(roomId, payload, { incrementUnread: payload.sender !== user?.userId, updatePreview: true });
  };

  const handlePersonalSocketPayload = (payload) => {
    if (!payload?.roomId) return;
    applyIncomingMessage(String(payload.roomId), payload, { incrementUnread: false, updatePreview: true });
  };

  roomSocketHandlerRef.current = handleRoomSocketPayload;
  personalSocketHandlerRef.current = handlePersonalSocketPayload;

  const loadRoomMessages = async (roomId) => {
    const records = await api.messages.list(roomId);
    const normalized = (Array.isArray(records) ? records : []).map((record) => normalizeRawMessage(record, roomId));
    setMessagesByRoom((prev) => ({ ...prev, [String(roomId)]: normalized }));
    if (normalized.length > 0) {
      setRooms((prev) =>
        prev.map((room) =>
          String(room.id) === String(roomId)
            ? {
                ...room,
                lastMessage: messagePreview(normalized[normalized.length - 1]),
                time: formatRoomBadgeTime(normalized[normalized.length - 1].timestamp),
                lastMessageAt: normalized[normalized.length - 1].timestamp || room.lastMessageAt,
                unread: String(room.id) === String(selectedRoomId) ? 0 : room.unread || 0,
              }
            : room
        )
      );
    }
    return normalized;
  };

  const refreshRooms = async (preferredRoomId = null) => {
    if (!user?.userId) return;
    setLoadingRooms(true);
    try {
      const records = await api.rooms.listForUser(user.userId);
      const normalizedRooms = (Array.isArray(records) ? records : []).map(normalizeRoom);
      setRooms(normalizedRooms);
      if (normalizedRooms.length > 0) {
        const memberLists = await Promise.all(normalizedRooms.map((room) => loadRoomMembers(room.id).catch(() => [])));
        setMembersByRoom((prev) => {
          const next = { ...prev };
          normalizedRooms.forEach((room, index) => {
            next[room.id] = memberLists[index] || [];
          });
          return next;
        });
      } else {
        setMembersByRoom({});
      }

      const nextSelected =
        preferredRoomId && normalizedRooms.some((room) => String(room.id) === String(preferredRoomId))
          ? String(preferredRoomId)
          : normalizedRooms.some((room) => String(room.id) === String(selectedRoomId))
            ? String(selectedRoomId)
            : normalizedRooms[0]?.id || null;
      setSelectedRoomId(nextSelected);
    } catch (error) {
      toast({
        title: "Failed to load conversations",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoadingRooms(false);
    }
  };

  useEffect(() => {
    if (user?.userId) {
      void refreshRooms();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.userId]);

  useEffect(() => {
    if (!selectedRoomId) {
      setReplyingToMessage(null);
      return;
    }

    if (!messagesByRoom[selectedRoomId]) {
      void loadRoomMessages(selectedRoomId).catch(() => {});
    }

    if (!membersByRoom[selectedRoomId]) {
      void loadRoomMembers(selectedRoomId).catch(() => {});
    }

    setReplyingToMessage(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRoomId]);

  useEffect(() => {
    const client = clientRef.current;
    if (!client || !connected || !user?.userId || !client.connected) {
      return undefined;
    }

    const subscriptions = [
      client.subscribe(`/topic/user/${user.userId}`, (frame) => {
        try {
          personalSocketHandlerRef.current?.(JSON.parse(frame.body));
        } catch {
          // Ignore malformed messages.
        }
      }),
    ];

    rooms.forEach((room) => {
      subscriptions.push(
        client.subscribe(`/topic/room/${room.id}`, (frame) => {
          try {
            roomSocketHandlerRef.current?.(JSON.parse(frame.body));
          } catch {
            // Ignore malformed messages.
          }
        })
      );
    });

    return () => subscriptions.forEach((subscription) => subscription.unsubscribe());
  }, [connected, rooms, user?.userId, clientRef]);

  const conversations = useMemo(
    () => rooms.map((room) => buildConversation(room, membersByRoom[room.id] || [], messagesByRoom[room.id] || [], user?.userId, usersById)),
    [rooms, membersByRoom, messagesByRoom, usersById, user?.userId]
  );

  const selectedConversation = conversations.find((conversation) => conversation.id === selectedRoomId) || null;
  const selectedMessages = useMemo(
    () => buildUiMessages(messagesByRoom[String(selectedRoomId)] || [], selectedRoomId, user?.userId, usersById),
    [messagesByRoom, selectedRoomId, user?.userId, usersById]
  );
  const selectedMembers = membersByRoom[String(selectedRoomId)] || [];
  const selectedRoom = rooms.find((room) => String(room.id) === String(selectedRoomId)) || null;

  const handleSelectRoom = async (roomId) => {
    setSelectedRoomId(String(roomId));
    setRooms((prev) => prev.map((room) => (String(room.id) === String(roomId) ? { ...room, unread: 0 } : room)));
    if (!messagesByRoom[String(roomId)]) {
      await loadRoomMessages(roomId).catch(() => {});
    }
    if (!membersByRoom[String(roomId)]) {
      await loadRoomMembers(roomId).catch(() => {});
    }
  };

  const handleLogout = async () => {
    await logout();
    setRooms([]);
    setMembersByRoom({});
    setMessagesByRoom({});
    setUsersById({});
    setSelectedRoomId(null);
  };

  const sendSocketMessage = (payload) => {
    publish("/app/chat.send", payload);
  };

  const handleSendMessage = async (roomId, text, files = []) => {
    if (!user?.userId || !roomId) return;
    const trimmed = text.trim();
    const replyToMessageId = replyingToMessage?.id ? Number(replyingToMessage.id) : null;
    setReplyingToMessage(null);

    try {
      if (trimmed) {
        const payload = {
          sender: user.userId,
          content: trimmed,
          roomId: String(roomId),
          messageType: "TEXT",
          replyToMessageId,
        };

        if (connected && clientRef.current?.connected) {
          sendSocketMessage(payload);
        } else {
          const saved = await api.messages.save(payload);
          applyIncomingMessage(String(roomId), saved, { incrementUnread: false, updatePreview: true });
        }
      }

      for (const file of files) {
        const saved = await api.messages.uploadAttachment(user.userId, roomId, file, "");
        applyIncomingMessage(String(roomId), saved, { incrementUnread: false, updatePreview: true });

        if (connected && clientRef.current?.connected) {
          sendSocketMessage({
            messageId: saved.id,
            sender: saved.sender,
            content: saved.content || "",
            originalContent: saved.content || "",
            roomId: String(roomId),
            messageType: saved.messageType || "FILE",
            attachmentName: saved.attachmentName,
            attachmentPath: saved.attachmentPath,
            attachmentContentType: saved.attachmentContentType,
            attachmentSize: saved.attachmentSize,
            replyToMessageId,
            timestamp: saved.timestamp,
          });
        }
      }
    } catch (error) {
      toast({
        title: "Message not sent",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleEditMessage = async (messageId, newText) => {
    if (!selectedRoomId) return;
    try {
      const updated = await api.messages.edit(selectedRoomId, messageId, newText);
      applyIncomingMessage(String(selectedRoomId), updated, { incrementUnread: false, updatePreview: true });
    } catch (error) {
      toast({
        title: "Could not edit message",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleDeleteMessage = async (messageId) => {
    if (!selectedRoomId) return;
    try {
      const deleted = await api.messages.delete(selectedRoomId, messageId);
      applyIncomingMessage(String(selectedRoomId), deleted, { incrementUnread: false, updatePreview: true });
    } catch (error) {
      toast({
        title: "Could not delete message",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleReactMessage = async (messageId, emoji) => {
    if (!selectedRoomId || !user?.userId) return;
    try {
      await api.messages.react(selectedRoomId, messageId, user.userId, emoji);
      if (connected && clientRef.current?.connected) {
        sendSocketMessage({
          messageId: Number(messageId),
          sender: user.userId,
          roomId: String(selectedRoomId),
          emoji,
          eventType: "REACTION",
        });
      }
      setMessagesByRoom((prev) => {
        const roomMessages = prev[String(selectedRoomId)] || [];
        return {
          ...prev,
          [String(selectedRoomId)]: roomMessages.map((message) =>
            String(message.id) === String(messageId)
              ? { ...message, reactions: Array.from(new Set([...(message.reactions || []), emoji].filter(Boolean))) }
              : message
          ),
        };
      });
    } catch (error) {
      toast({
        title: "Could not add reaction",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleCreateRoom = async ({ name, isGroup, memberUserIds }) => {
    if (!user?.userId) return;
    try {
      const payload = {
        name,
        createdBy: user.userId,
        roomType: isGroup ? "GROUP" : "DIRECT",
        memberUserIds,
        description: "",
        avatarUrl: defaultAvatar(name),
        maxMembers: isGroup ? memberUserIds.length + 1 : 2,
      };
      const room = isGroup ? await api.rooms.create(payload) : await api.rooms.createDirect(payload);
      toast({
        title: isGroup ? "Group created" : "Conversation created",
        description: "Loading the new room now.",
      });
      await refreshRooms(String(room.id));
      setSelectedRoomId(String(room.id));
    } catch (error) {
      toast({
        title: "Could not create conversation",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleSaveProfile = async (updates) => {
    try {
      await updateProfile(updates);
      toast({
        title: "Profile updated",
        description: "Your profile changes were saved.",
      });
    } catch (error) {
      toast({
        title: "Profile update failed",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleUpdateGroup = async (updates) => {
    if (!selectedRoom) return;
    try {
      const previousMembers = selectedMembers;
      const previousIds = new Set(previousMembers.map((member) => member.userId || member.id));
      const nextIds = new Set((updates.members || []).map((member) => member.userId || member.id));

      await api.rooms.update(selectedRoom.id, user.userId, {
        name: updates.name,
        description: selectedRoom.description,
        avatarUrl: selectedRoom.avatarUrl || defaultAvatar(updates.name),
      });

      const added = [...nextIds].filter((memberId) => !previousIds.has(memberId) && memberId !== user.userId);
      const removed = [...previousIds].filter((memberId) => !nextIds.has(memberId) && memberId !== user.userId);

      if (added.length > 0) {
        await api.rooms.addMembers(selectedRoom.id, user.userId, added);
      }
      for (const memberId of removed) {
        await api.rooms.removeMember(selectedRoom.id, user.userId, memberId);
      }

      for (const member of updates.members || []) {
        const memberId = member.userId || member.id;
        if (memberId === user.userId) continue;
        const currentRole = String((previousMembers.find((m) => (m.userId || m.id) === memberId)?.role || "member")).toLowerCase();
        const nextRole = String(member.role || "member").toLowerCase();
        if (currentRole !== "admin" && nextRole === "admin") {
          await api.rooms.promoteAdmin(selectedRoom.id, user.userId, memberId);
        }
        if (currentRole === "admin" && nextRole !== "admin") {
          await api.rooms.demoteAdmin(selectedRoom.id, user.userId, memberId);
        }
      }

      await refreshRooms(selectedRoom.id);
      await loadRoomMembers(selectedRoom.id);
      toast({
        title: "Group updated",
        description: "The group settings were saved.",
      });
    } catch (error) {
      toast({
        title: "Group update failed",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleLeaveGroup = async (roomId) => {
    try {
      await api.rooms.leave(roomId, user.userId);
      await refreshRooms();
      toast({
        title: "You left the room",
        description: "Your conversation list was refreshed.",
      });
    } catch (error) {
      toast({
        title: "Could not leave room",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleDeleteRoom = async (roomId) => {
    try {
      await api.rooms.delete(roomId, user.userId);
      await refreshRooms();
      toast({
        title: "Room deleted",
        description: "Your conversation list was refreshed.",
      });
    } catch (error) {
      toast({
        title: "Could not delete room",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleClearChat = () => {
    if (!selectedRoomId) return;
    setMessagesByRoom((prev) => ({ ...prev, [String(selectedRoomId)]: [] }));
  };

  const handleTyping = () => {
    if (!selectedRoomId || !connected || !clientRef.current?.connected || !user?.userId) return;
    try {
      publish("/app/chat.typing", {
        sender: user.userId,
        roomId: String(selectedRoomId),
        eventType: "TYPING_INDICATOR",
      });
    } catch {
      // Ignore transport hiccups for typing.
    }
  };

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="relative w-full min-h-screen flex overflow-hidden bg-gradient-to-br from-[#0a0e27] via-[#1a1a3e] to-[#2d1b4e]">
      <Toaster />
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <motion.div
          animate={{ x: [0, 60, 0], y: [0, -40, 0], scale: [1, 1.1, 1] }}
          transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
          className="absolute w-96 h-96 bg-primary/20 rounded-full blur-[80px] top-0 -left-20 opacity-30"
        />
        <motion.div
          animate={{ x: [0, -50, 0], y: [0, 60, 0], scale: [1, 1.2, 1] }}
          transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
          className="absolute w-96 h-96 bg-secondary/20 rounded-full blur-[80px] bottom-0 -right-20 opacity-30"
        />
      </div>

      <div className="hidden sm:flex relative z-10 flex-shrink-0">
        <ChatSidebar
          conversations={conversations}
          selectedId={selectedRoomId}
          onSelectConversation={handleSelectRoom}
          onLogout={handleLogout}
          onCreateRoom={() => setShowCreateRoomModal(true)}
          onEditProfile={() => setShowProfileEditModal(true)}
        />
      </div>

      <div className="flex-1 relative z-10 flex flex-col min-w-0">
        <AnimatePresence mode="wait">
          {selectedConversation ? (
            <motion.div
              key={selectedRoomId}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.25 }}
              className="flex-1 flex flex-col min-w-0 h-full"
            >
              <ChatHeader
                name={selectedConversation.name}
                avatar={selectedConversation.avatar}
                isOnline={selectedConversation.online}
                isGroup={selectedConversation.isGroup}
                onGroupSettings={() => selectedConversation.isGroup && setShowGroupManagementModal(true)}
                onDeleteChat={() => handleDeleteRoom(selectedRoomId)}
                onClearChat={handleClearChat}
              />
              <MessageDisplay
                messages={selectedMessages}
                currentUserId={user.userId}
                isTyping={Boolean(typingByRoom[String(selectedRoomId)])}
                onEditMessage={handleEditMessage}
                onDeleteMessage={handleDeleteMessage}
                onReactMessage={handleReactMessage}
                onReplyMessage={setReplyingToMessage}
              />
              <MessageInput
                onSendMessage={(text, files) => handleSendMessage(selectedRoomId, text, files)}
                replyingToMessage={replyingToMessage}
                onCancelReply={() => setReplyingToMessage(null)}
                onTyping={handleTyping}
              />
            </motion.div>
          ) : (
            <motion.div
              key="empty"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="flex-1 flex items-center justify-center h-full"
            >
              <div className="text-center space-y-4">
                <motion.div
                  animate={{ y: [0, -10, 0] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="text-6xl"
                >
                  💬
                </motion.div>
                <h2 className="text-2xl font-bold text-white">
                  {loadingRooms ? "Loading conversations..." : "Select a conversation"}
                </h2>
                <p className="text-gray-400">
                  {loadingRooms ? "Connecting to your rooms and messages" : "Choose a chat from the sidebar to start messaging"}
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="sm:hidden fixed bottom-6 right-6 z-20">
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setShowCreateRoomModal(true)}
          className="w-14 h-14 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white shadow-lg hover:shadow-primary/50 transition-all"
        >
          <MessageCircle className="w-6 h-6" />
        </motion.button>
      </div>

      <CreateRoomModal
        isOpen={showCreateRoomModal}
        onClose={() => setShowCreateRoomModal(false)}
        onCreateRoom={handleCreateRoom}
      />
      <ProfileEditModal
        isOpen={showProfileEditModal}
        onClose={() => setShowProfileEditModal(false)}
        user={user}
        onSaveProfile={handleSaveProfile}
      />
      <GroupManagementModal
        isOpen={showGroupManagementModal}
        onClose={() => setShowGroupManagementModal(false)}
        roomId={selectedRoomId}
        groupName={selectedConversation?.name || ""}
        members={selectedMembers}
        currentUserId={user.userId}
        onUpdateGroup={handleUpdateGroup}
        onLeaveGroup={handleLeaveGroup}
        onDeleteGroup={handleDeleteRoom}
      />
    </div>
  );
};

export default Chat;
