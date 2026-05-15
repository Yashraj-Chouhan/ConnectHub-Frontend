/*
 * Main chat workspace.
 *
 * This page loads rooms, members, messages, notifications, and profile data,
 * then coordinates the live chat experience on top of the socket hook.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Navigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { MessageCircle } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { api, normalizeTranslationLanguage } from "@/lib/api";
import { Toaster } from "@/components/ui/toaster";
import { useChatSocket } from "@/hooks/useChatSocket";
import { useVideoCall } from "@/hooks/useVideoCall";
import {
  buildConversation,
  buildUiMessages,
  defaultAvatar,
  getDisplayName,
  formatRoomBadgeTime,
  messagePreview,
  normalizeRawMessage,
  normalizeRoom,
  normalizeUserSummary,
} from "@/lib/chat";
import { getDirectCallRecipientId } from "@/services/videoCallService";
import { ChatSidebar } from "@/components/chat/ChatSidebar";
import { ChatHeader } from "@/components/chat/ChatHeader";
import { MessageDisplay } from "@/components/chat/MessageDisplay";
import { MessageInput } from "@/components/chat/MessageInput";
import { VideoCallOverlay } from "@/components/call/VideoCallOverlay";
import { CreateRoomModal } from "@/components/chat/CreateRoomModal";
import { GroupManagementModal } from "@/components/chat/GroupManagementModal";
import { ProfileEditModal } from "@/components/chat/ProfileEditModal";
import { UserProfileModal } from "@/components/chat/UserProfileModal";

import { SaveContactModal } from "@/components/chat/SaveContactModal";

// Coordinates the full chat experience: room list, selected conversation,
// optimistic UI updates, profile editing, and real-time socket events.
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
  const [viewingProfileUserId, setViewingProfileUserId] = useState(null);
  const [contactToSave, setContactToSave] = useState(null);
  const [contacts, setContacts] = useState([]);
  const [loadingRooms, setLoadingRooms] = useState(false);
  const [replyingToMessage, setReplyingToMessage] = useState(null);
  const [typingByRoom, setTypingByRoom] = useState({});
  const typingTimersRef = useRef({});
  const roomSocketHandlerRef = useRef(null);
  const personalSocketHandlerRef = useRef(null);
  const activeSubscriptionsRef = useRef({});
  const pollingIntervalRef = useRef(null);
  const lastPollTimestampRef = useRef({});

  // Cleanup all subscriptions on full component unmount
  useEffect(() => {
    return () => {
      Object.values(activeSubscriptionsRef.current).forEach((sub) => sub.unsubscribe());
      activeSubscriptionsRef.current = {};
    };
  }, []);

  useEffect(() => {
    if (user) {
      setUsersById((prev) => ({
        ...prev,
        [user.userId]: normalizeUserSummary(user),
      }));
    }
  }, [user]);

  const contactsByUserId = useMemo(() => {
    return contacts.reduce((accumulator, contact) => {
      if (contact.contactUserId) {
        accumulator[contact.contactUserId] = contact;
      }
      return accumulator;
    }, {});
  }, [contacts]);

  const sendRealtimeSignal = useCallback(
    (payload) => {
      if (!connected || !clientRef.current?.connected) {
        throw new Error("Real-time chat connection is not ready yet.");
      }

      publish("/app/chat.send", payload);
    },
    [connected, publish]
  );

  const resolveRoomName = useCallback(
    (roomId) =>
      rooms.find((room) => String(room.id) === String(roomId))?.name || "ConnectHub",
    [rooms]
  );

  const resolvePeerName = useCallback(
    (peerUserId, roomId) => {
      const cachedUser = usersById[peerUserId];
      if (cachedUser) {
        return getDisplayName(cachedUser, contactsByUserId);
      }

      const roomMembers = membersByRoom[String(roomId)] || [];
      const roomMember = roomMembers.find(
        (member) => String(member.userId || member.id) === String(peerUserId)
      );

      return getDisplayName(roomMember, contactsByUserId) || "Contact";
    },
    [contactsByUserId, membersByRoom, usersById]
  );

  const videoCall = useVideoCall({
    userId: user?.userId,
    sendSignal: sendRealtimeSignal,
    resolveRoomName,
    resolvePeerName,
    onNotify: ({ title, description, variant }) => {
      toast({ title, description, variant });
    },
    preferredCaptionLanguage: normalizeTranslationLanguage(
      user?.preferredLanguage,
      "en"
    ),
  });

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
            username: "Deleted User",
            fullName: "Deleted User",
            name: "Deleted User",
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
    if (videoCall.isVideoCallEvent(payload.eventType)) {
      void videoCall.handleSignal(payload);
      return;
    }
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
      // Mark all messages sent by us in this room as read
      if (payload.sender && payload.sender !== user?.userId) {
        setMessagesByRoom((prev) => {
          const roomMessages = prev[roomId] || [];
          const updated = roomMessages.map((msg) =>
            msg.sender === user?.userId ? { ...msg, read: true } : msg
          );
          return { ...prev, [roomId]: updated };
        });
      }
      return;
    }
    applyIncomingMessage(roomId, payload, { incrementUnread: payload.sender !== user?.userId, updatePreview: true });
  };

  const handlePersonalSocketPayload = (payload) => {
    if (!payload?.roomId) return;
    if (videoCall.isVideoCallEvent(payload.eventType)) {
      void videoCall.handleSignal(payload);
      return;
    }
    if (payload.eventType === "NOTIFICATION") {
      if (String(selectedRoomId) === String(payload.roomId)) {
        loadRoomMessages(payload.roomId).catch(() => {});
        return;
      }
      const senderProfile = payload.sender ? usersById[payload.sender] : null;
      toast({
        title: senderProfile ? `${getDisplayName(senderProfile)} sent a message` : "New message notification",
        description: payload.content || "You have a new notification.",
      });
      
      setRooms((prevRooms) => {
        const roomExists = prevRooms.some((r) => String(r.id) === String(payload.roomId));
        if (!roomExists) {
          setTimeout(() => refreshRooms(selectedRoomId), 0);
        } else {
          setTimeout(() => loadRoomMessages(payload.roomId), 0);
        }
        return prevRooms;
      });

      return;
    }
    applyIncomingMessage(String(payload.roomId), payload, { incrementUnread: false, updatePreview: true });
  };

  roomSocketHandlerRef.current = handleRoomSocketPayload;
  personalSocketHandlerRef.current = handlePersonalSocketPayload;

  const loadRoomMessages = useCallback(async (roomId) => {
    const records = await api.messages.list(roomId);
    const normalized = (Array.isArray(records) ? records : []).map((record) => normalizeRawMessage(record, roomId));
    setMessagesByRoom((prev) => {
      // Preserve local read status for messages we already know about
      const existing = prev[String(roomId)] || [];
      const existingById = new Map(existing.map((m) => [String(m.id), m]));
      const merged = normalized.map((msg) => {
        const prev = existingById.get(String(msg.id));
        return prev?.read ? { ...msg, read: true } : msg;
      });
      return { ...prev, [String(roomId)]: merged };
    });
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
  }, [selectedRoomId]);

  const refreshRooms = async (preferredRoomId = null) => {
    if (!user?.userId) return;
    setLoadingRooms(true);
    try {
      const [records, contactsLog] = await Promise.all([
        api.rooms.listForUser(user.userId),
        api.contacts.list(user.userId).catch(() => [])
      ]);
      setContacts(contactsLog);
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
      if (!connected) {
        Object.values(activeSubscriptionsRef.current).forEach((sub) => sub.unsubscribe());
        activeSubscriptionsRef.current = {};
      }
      return;
    }

    if (!activeSubscriptionsRef.current['personal']) {
      activeSubscriptionsRef.current['personal'] = client.subscribe(
        `/topic/user/${user.userId}`,
        (frame) => {
          try {
            personalSocketHandlerRef.current?.(JSON.parse(frame.body));
          } catch {
            // Ignore malformed messages.
          }
        }
      );
    }

    rooms.forEach((room) => {
      const topic = `/topic/room/${room.id}`;
      if (!activeSubscriptionsRef.current[topic]) {
        activeSubscriptionsRef.current[topic] = client.subscribe(
          topic,
          (frame) => {
            try {
              roomSocketHandlerRef.current?.(JSON.parse(frame.body));
            } catch {
              // Ignore malformed messages.
            }
          }
        );
      }
    });

  }, [connected, rooms, user?.userId, clientRef]);

  const conversations = useMemo(
    () => rooms.map((room) => buildConversation(room, membersByRoom[room.id] || [], messagesByRoom[room.id] || [], user?.userId, usersById, contactsByUserId)),
    [rooms, membersByRoom, messagesByRoom, usersById, user?.userId, contactsByUserId]
  );

  const selectedConversation = conversations.find((conversation) => conversation.id === selectedRoomId) || null;
  const selectedMessages = useMemo(
    () => buildUiMessages(messagesByRoom[String(selectedRoomId)] || [], selectedRoomId, user?.userId, usersById, contactsByUserId),
    [messagesByRoom, selectedRoomId, user?.userId, usersById, contactsByUserId]
  );
  const selectedMembers = membersByRoom[String(selectedRoomId)] || [];
  const selectedRoom = rooms.find((room) => String(room.id) === String(selectedRoomId)) || null;
  const selectedDirectPeerUserId = getDirectCallRecipientId(
    selectedMembers,
    user?.userId
  );

  // Is the current user an admin or creator of the selected room?
  const currentUserIsAdminOfSelected = useMemo(() => {
    if (!selectedRoom || !user?.userId) return false;
    if (selectedRoom.createdBy === user.userId) return true;
    const me = selectedMembers.find((m) => (m.userId || m.id) === user.userId);
    return String(me?.role || '').toLowerCase() === 'admin';
  }, [selectedRoom, selectedMembers, user?.userId]);

  const sendReadReceipt = useCallback((roomId) => {
    if (!connected || !clientRef.current?.connected || !user?.userId || !roomId) return;
    try {
      publish("/app/chat.read", {
        sender: user.userId,
        roomId: String(roomId),
        eventType: "READ_RECEIPT",
      });
    } catch {
      // Ignore transport errors for read receipts
    }
  }, [connected, user?.userId, publish]);

  const handleSelectRoom = async (roomId) => {
    setSelectedRoomId(String(roomId));
    setRooms((prev) => prev.map((room) => (String(room.id) === String(roomId) ? { ...room, unread: 0 } : room)));
    if (!messagesByRoom[String(roomId)]) {
      await loadRoomMessages(roomId).catch(() => {});
    }
    if (!membersByRoom[String(roomId)]) {
      await loadRoomMembers(roomId).catch(() => {});
    }
    // Send read receipt so other users see their messages as "seen"
    sendReadReceipt(roomId);
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

  const handleStartVideoCall = async () => {
    if (!selectedRoomId || !selectedDirectPeerUserId || !selectedConversation) {
      toast({
        title: "Video call unavailable",
        description: "Open a direct conversation to start a video call.",
        variant: "destructive",
      });
      return;
    }

    setSelectedRoomId(String(selectedRoomId));
    await videoCall.startVideoCall({
      roomId: selectedRoomId,
      recipientId: selectedDirectPeerUserId,
      peerName: selectedConversation.name,
      roomName: selectedConversation.name,
    });
  };

  const handleAcceptVideoCall = async () => {
    const incomingCall = videoCall.incomingCall;
    if (!incomingCall) {
      return;
    }

    setSelectedRoomId(String(incomingCall.roomId));

    if (!messagesByRoom[String(incomingCall.roomId)]) {
      await loadRoomMessages(incomingCall.roomId).catch(() => {});
    }

    if (!membersByRoom[String(incomingCall.roomId)]) {
      await loadRoomMembers(incomingCall.roomId).catch(() => {});
    }

    await videoCall.acceptIncomingCall();
  };

  const handleSendMessage = async (roomId, text, files = [], targetLanguage = "none") => {
    if (!user?.userId || !roomId) return;
    const trimmed = text.trim();
    const replyToMessageId = replyingToMessage?.id ? Number(replyingToMessage.id) : null;

    try {
      const normalizedTargetLanguage = normalizeTranslationLanguage(targetLanguage, "none");
      let outgoingText = trimmed;
      let translatedContent = null;

      if (trimmed && normalizedTargetLanguage !== "none") {
        const translation = await api.translation.translateText(trimmed, "auto", normalizedTargetLanguage);
        const translatedText = String(translation?.translatedText || "").trim();
        const translationProvider = String(translation?.provider || "");

        if (!translation?.success || !translatedText) {
          throw new Error(translation?.error || "Could not translate the message. Please try again.");
        }

        if (
          normalizedTargetLanguage !== "en" &&
          translationProvider === "offline-fallback" &&
          translatedText === trimmed
        ) {
          throw new Error(`Translation to ${normalizedTargetLanguage.toUpperCase()} returned the original text. Please try again.`);
        }

        outgoingText = translatedText;
        translatedContent = translatedText !== trimmed ? translatedText : null;
      }

      if (trimmed) {
        const payload = {
          sender: user.userId,
          content: outgoingText,
          originalContent: trimmed,
          translatedContent,
          roomId: String(roomId),
          messageType: "TEXT",
          replyToMessageId,
        };

        // Always save via REST for persistence and immediate local display
        const saved = await api.messages.save(payload);
        applyIncomingMessage(String(roomId), { ...saved, originalContent: trimmed, translatedContent }, { incrementUnread: false, updatePreview: true });

        // Also broadcast via WebSocket so other users get it in real-time (best effort)
        if (connected && clientRef.current?.connected) {
          try {
            sendSocketMessage({
              ...payload,
              messageId: saved.id,
              timestamp: saved.timestamp,
            });
          } catch {
            // WS broadcast failed — polling will pick it up for other users
          }
        }
      }

      for (const fileObj of files) {
        const actualFile = fileObj.file;
        let transcript = fileObj.transcript || "";
        let transcriptSourceLanguage = fileObj.transcriptSourceLanguage || "auto";
        let translatedContent = null;
        
        const normalizedTargetLanguage = normalizeTranslationLanguage(targetLanguage, "none");

        if (actualFile.type?.startsWith("audio/")) {
          try {
            const transcribeRes = await api.translation.transcribeAudio(actualFile, "auto");
            if (transcribeRes?.success && transcribeRes.transcript) {
              transcript = transcribeRes.transcript;
              transcriptSourceLanguage = transcribeRes.sourceLanguage || "auto";
            }
          } catch (e) {
            // Ignore transcription errors and proceed without a transcript
          }
        }
        
        if (transcript && normalizedTargetLanguage !== "none") {
          try {
            const translation = await api.translation.translateText(transcript, transcriptSourceLanguage, normalizedTargetLanguage);
            if (translation?.success && translation.translatedText) {
              translatedContent = translation.translatedText;
            }
          } catch (e) {
            // Fallback if translation fails
          }
        }

        const saved = await api.messages.uploadAttachment(user.userId, roomId, actualFile, translatedContent || "", {
          messageType: actualFile.type?.startsWith("audio/") ? "VOICE_NOTE" : undefined,
          transcript: transcript,
          transcriptSourceLanguage: transcriptSourceLanguage,
        });
        applyIncomingMessage(String(roomId), saved, { incrementUnread: false, updatePreview: true });

        if (connected && clientRef.current?.connected) {
          sendSocketMessage({
            messageId: saved.id,
            sender: saved.sender,
            content: saved.content || "",
            originalContent: saved.transcript || saved.content || "",
            translatedContent: translatedContent,
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

      setReplyingToMessage(null);
      return true;
    } catch (error) {
      toast({
        title: "Message not sent",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
      return false;
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
        // Use a generous cap for groups so admins can always add members later.
        // Direct rooms are always capped at 2.
        maxMembers: isGroup ? 500 : 2,
      };
      const room = isGroup ? await api.rooms.create(payload) : await api.rooms.createDirect(payload);
      const createdRoomId = String(room?.id || room?.roomId || "").trim();
      if (!createdRoomId) {
        throw new Error("Room creation returned no room id.");
      }
      toast({
        title: isGroup ? "Group created" : "Conversation created",
        description: "Loading the new room now.",
      });
      await refreshRooms(createdRoomId);
      setSelectedRoomId(createdRoomId);
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

      const added = [...nextIds].filter((memberId) => !previousIds.has(memberId) && memberId !== user.userId);
      const removed = [...previousIds].filter((memberId) => !nextIds.has(memberId) && memberId !== user.userId);

      // If we're adding members, raise the cap first so the backend doesn't reject.
      const newSize = nextIds.size;
      const currentCap = selectedRoom.maxMembers ?? 0;
      const needsCap = added.length > 0 && newSize >= currentCap;

      await api.rooms.update(selectedRoom.id, user.userId, {
        name: updates.name,
        description: selectedRoom.description,
        avatarUrl: selectedRoom.avatarUrl || defaultAvatar(updates.name),
        ...(needsCap ? { maxMembers: Math.max(500, newSize + 10) } : {}),
      });

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
    const targetRoom = rooms.find((r) => String(r.id) === String(roomId));
    const isDirect = targetRoom?.roomType === 'DIRECT';
    try {
      if (isDirect) {
        // Any member of a direct chat may leave/remove it.
        await api.rooms.leave(roomId, user.userId);
      } else {
        // Group rooms require the caller to be admin/creator (enforced by backend).
        await api.rooms.delete(roomId, user.userId);
      }
      // Immediately clear the view if the deleted room was selected.
      if (String(selectedRoomId) === String(roomId)) {
        setSelectedRoomId(null);
      }
      await refreshRooms();
      toast({
        title: isDirect ? 'Chat removed' : 'Room deleted',
        description: 'Your conversation list was refreshed.',
      });
    } catch (error) {
      toast({
        title: 'Could not remove chat',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
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

  // ─── Polling: refresh active room messages when WebSocket is disconnected ────
  useEffect(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }

    // Always poll: 5s when WS disconnected, 30s when connected (safety net only)
    const interval = connected ? 30000 : 5000;

    pollingIntervalRef.current = setInterval(async () => {
      if (!selectedRoomId) return;
      try {
        await loadRoomMessages(selectedRoomId);
      } catch {
        // Silently ignore polling errors
      }
    }, interval);

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
  }, [connected, selectedRoomId, loadRoomMessages]);

  // ─── Send read receipt when room becomes selected and WS connects ─────────
  useEffect(() => {
    if (connected && selectedRoomId) {
      sendReadReceipt(selectedRoomId);
    }
  }, [connected, selectedRoomId, sendReadReceipt]);

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="fixed inset-0 flex overflow-hidden bg-gradient-to-br from-[var(--bg-gradient-start)] via-[var(--bg-gradient-mid)] to-[var(--bg-gradient-end)]">
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

      <div className={`relative z-10 flex-shrink-0 transition-all duration-300 ${selectedRoomId ? 'hidden sm:flex' : 'flex w-full'} sm:w-80`}>
        <ChatSidebar
          contacts={contacts}
          conversations={conversations}
          selectedId={selectedRoomId}
          onSelectConversation={handleSelectRoom}
          onStartDirectChat={(contact) => {
            if (!contact.contactUserId) return;
            const existingConv = conversations.find(c => !c.isGroup && c.members.some(m => m.userId === contact.contactUserId || m.id === contact.contactUserId));
            if (existingConv) {
              handleSelectRoom(existingConv.id);
            } else {
              handleCreateRoom({ name: contact.contactName || contact.nickname, isGroup: false, memberUserIds: [user.userId, contact.contactUserId] });
            }
          }}
          onLogout={handleLogout}
          onCreateRoom={() => setShowCreateRoomModal(true)}
          onEditProfile={() => setShowProfileEditModal(true)}
          onDeleteConversation={handleDeleteRoom}
        />
      </div>

      <div className={`relative z-10 flex-col min-w-0 min-h-0 h-full ${selectedRoomId ? 'flex flex-1' : 'hidden sm:flex flex-1'}`}>
        <AnimatePresence mode="wait">
          {selectedConversation ? (
            <motion.div
              key={selectedRoomId}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.25 }}
              className="flex-1 flex flex-col min-w-0 min-h-0 h-full"
            >
              <ChatHeader
                name={selectedConversation.name}
                avatar={selectedConversation.avatar}
                isOnline={selectedConversation.online}
                isGroup={selectedConversation.isGroup}
                isAdmin={currentUserIsAdminOfSelected}
                onStartVideoCall={
                  !selectedConversation.isGroup && selectedDirectPeerUserId
                    ? handleStartVideoCall
                    : undefined
                }
                onGroupSettings={() => selectedConversation.isGroup && setShowGroupManagementModal(true)}
                onDeleteChat={() => handleDeleteRoom(selectedRoomId)}
                onLeaveGroup={() => handleLeaveGroup(selectedRoomId)}
                onClearChat={handleClearChat}
                onSetNickname={() => {
                  if (!selectedConversation.isGroup) {
                    const otherUserId = selectedMembers.find(m => m.userId !== user.userId)?.userId || selectedMembers.find(m => m.id !== user.userId)?.id;
                    if (otherUserId) setContactToSave(usersById[otherUserId]);
                  }
                }}
                onBack={() => setSelectedRoomId(null)}
                onAvatarClick={() => {
                  if (!selectedConversation.isGroup) {
                    const otherUserId = selectedMembers.find(m => m.userId !== user.userId)?.userId || selectedMembers.find(m => m.id !== user.userId)?.id;
                    if (otherUserId) setViewingProfileUserId(otherUserId);
                  }
                }}
                onNameClick={() => {
                  if (!selectedConversation.isGroup) {
                    const otherUserId = selectedMembers.find(m => m.userId !== user.userId)?.userId || selectedMembers.find(m => m.id !== user.userId)?.id;
                    if (otherUserId) setViewingProfileUserId(otherUserId);
                  } else {
                    setShowGroupManagementModal(true);
                  }
                }}
              />
              <MessageDisplay
                messages={selectedMessages}
                currentUserId={user.userId}
                isTyping={Boolean(typingByRoom[String(selectedRoomId)])}
                onEditMessage={handleEditMessage}
                onDeleteMessage={handleDeleteMessage}
                onReactMessage={handleReactMessage}
                onReplyMessage={setReplyingToMessage}
                onShowProfile={setViewingProfileUserId}
                conversation={selectedConversation}
              />
              <MessageInput
                onSendMessage={(text, files, targetLanguage) => handleSendMessage(selectedRoomId, text, files, targetLanguage)}
                onTyping={handleTyping}
                replyingTo={replyingToMessage}
                onCancelReply={() => setReplyingToMessage(null)}
              />
            </motion.div>
          ) : (
            <motion.div
              key="empty"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="flex-1 flex items-center justify-center min-h-0 h-full"
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

      {!selectedRoomId && (
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
      )}

      <VideoCallOverlay
        activeCall={videoCall.activeCall}
        incomingCall={videoCall.incomingCall}
        captionsEnabled={videoCall.captionsEnabled}
        gestureModeEnabled={videoCall.gestureModeEnabled}
        localCaption={videoCall.localCaption}
        remoteCaption={videoCall.remoteCaption}
        remoteGesture={videoCall.remoteGesture}
        gestureState={videoCall.gestureState}
        captionLanguages={videoCall.captionLanguages}
        captionTargetLanguage={videoCall.captionTargetLanguage}
        speechInputLanguage={videoCall.speechInputLanguage}
        captionsSupported={videoCall.captionsSupported}
        captionCaptureMode={videoCall.captionCaptureMode}
        speechRecognitionSupported={videoCall.speechRecognitionSupported}
        onAccept={handleAcceptVideoCall}
        onDecline={videoCall.declineIncomingCall}
        onEnd={videoCall.endCall}
        onToggleMicrophone={videoCall.toggleMicrophone}
        onToggleCamera={videoCall.toggleCamera}
        onToggleCaptions={videoCall.toggleCaptions}
        onToggleGestures={videoCall.toggleGestureMode}
        onCaptionTargetLanguageChange={videoCall.setCaptionTargetLanguage}
        onSpeechInputLanguageChange={videoCall.setSpeechInputLanguage}
      />

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
        createdBy={selectedRoom?.createdBy || ""}
        onUpdateGroup={handleUpdateGroup}
        onLeaveGroup={handleLeaveGroup}
        onDeleteGroup={handleDeleteRoom}
      />
      <UserProfileModal
        isOpen={Boolean(viewingProfileUserId)}
        onClose={() => setViewingProfileUserId(null)}
        user={viewingProfileUserId ? usersById[viewingProfileUserId] : null}
      />
      <SaveContactModal
        isOpen={Boolean(contactToSave)}
        onClose={() => setContactToSave(null)}
        userProfile={contactToSave}
        currentNickname={contactsByUserId[contactToSave?.userId]?.nickname || ""}
        onSaved={() => refreshRooms(selectedRoomId)}
      />
    </div>
  );
};

export default Chat;
