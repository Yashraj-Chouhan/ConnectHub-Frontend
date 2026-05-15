import { apiUrlPrefix, resolveAvatarUrl, normalizeTranslationLanguage } from "@/lib/api";

export const defaultAvatar = (seed) => `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(seed || "ConnectHub")}`;

export const getDisplayName = (user, contactsMap = null) => {
  if (!user) return "User";
  const userId = user.userId || user.id;
  if (contactsMap && userId && contactsMap[userId]?.nickname) {
    return contactsMap[userId].nickname;
  }
  return user.fullName || user.name || user.username || user.email || user.phoneNumber || "User";
};

export const getAvatarUrl = (user, seed) => resolveAvatarUrl(user?.avatar || user?.avatarUrl) || defaultAvatar(seed || getDisplayName(user));

export const formatMessageClock = (timestamp) => {
  if (!timestamp) return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return String(timestamp);
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

export const formatRoomBadgeTime = (timestamp) => {
  if (!timestamp) return "now";
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return "now";
  const diffMinutes = Math.floor((Date.now() - date.getTime()) / 60000);
  if (diffMinutes < 1) return "now";
  if (diffMinutes < 60) return `${diffMinutes}m`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h`;
  return `${Math.floor(diffHours / 24)}d`;
};

export const normalizeUserSummary = (profile) => {
  if (!profile) return null;
  const userId = profile.userId || profile.id;
  const fullName = profile.fullName || profile.username || profile.email || "";
  return {
    id: userId,
    userId,
    username: profile.username || "",
    fullName,
    name: fullName,
    email: profile.email || "",
    phoneNumber: profile.phoneNumber || "",
    avatarUrl: resolveAvatarUrl(profile.avatarUrl) || "",
    avatar: resolveAvatarUrl(profile.avatar || profile.avatarUrl) || defaultAvatar(fullName || userId),
    bio: profile.bio || "",
    preferredLanguage: normalizeTranslationLanguage(profile.preferredLanguage, "en"),
    translationCreditsRemaining: profile.translationCreditsRemaining ?? null,
    onlineStatus: profile.onlineStatus || "OFFLINE",
    lastSeenAt: profile.lastSeenAt || null,
    role: (profile.role || "USER").toLowerCase(),
    online: String(profile.onlineStatus || "").toUpperCase() === "ONLINE",
  };
};

export const normalizeRoom = (room) => ({
  id: String(room.id || room.roomId || ""),
  name: room.name || "New Chat",
  createdBy: room.createdBy || "",
  roomType: (room.roomType || room.type || "GROUP").toUpperCase(),
  description: room.description || "",
  avatarUrl: resolveAvatarUrl(room.avatarUrl) || "",
  maxMembers: room.maxMembers ?? null,
  inviteCode: room.inviteCode || "",
  lastMessageAt: room.lastMessageAt || null,
  unread: 0,
});

export const normalizeRawMessage = (message, roomId) => {
  const id = String(message.messageId || message.id || `${roomId}-${Date.now()}`);
  const content = message.translatedContent || message.content || "";
  return {
    id,
    messageId: message.messageId || message.id || id,
    sender: message.sender || "",
    roomId: String(message.roomId || roomId || ""),
    content,
    originalContent: message.originalContent || message.content || content,
    translatedContent: message.translatedContent || "",
    timestamp: message.timestamp || new Date().toISOString(),
    messageType: message.messageType || (message.attachmentName ? "FILE" : "TEXT"),
    attachmentName: message.attachmentName || null,
    attachmentPath: message.attachmentPath || null,
    attachmentContentType: message.attachmentContentType || null,
    attachmentSize: message.attachmentSize || null,
    transcript: message.transcript || null,
    transcriptSourceLanguage: message.transcriptSourceLanguage || null,
    transcriptUpdatedAt: message.transcriptUpdatedAt || null,
    replyToMessageId: message.replyToMessageId ?? null,
    deleted: Boolean(message.deleted || message.isDeleted),
    editedAt: message.editedAt || null,
    deletedAt: message.deletedAt || null,
    detectedLanguage: message.detectedLanguage || message.sourceLanguage || null,
    sourceLanguage: message.sourceLanguage || null,
    targetLanguage: message.targetLanguage || null,
    translationCreditsRemaining: message.translationCreditsRemaining ?? null,
    translationLimitReached: Boolean(message.translationLimitReached),
    recipientId: message.recipientId || null,
    eventType: message.eventType || null,
    reactions: Array.isArray(message.reactions) ? message.reactions : [],
    read: Boolean(message.read),
  };
};

export const mergeRawMessages = (existing, incoming) => {
  const merged = { ...existing, ...incoming };
  merged.originalContent = incoming.originalContent || existing.originalContent || existing.content || incoming.content || "";
  merged.translatedContent = incoming.translatedContent || existing.translatedContent || "";
  merged.content = merged.translatedContent || incoming.content || existing.content || "";
  merged.transcript = incoming.transcript || existing.transcript || null;
  merged.transcriptSourceLanguage = incoming.transcriptSourceLanguage || existing.transcriptSourceLanguage || null;
  merged.transcriptUpdatedAt = incoming.transcriptUpdatedAt || existing.transcriptUpdatedAt || null;
  merged.reactions = incoming.reactions?.length ? incoming.reactions : existing.reactions || [];
  merged.deleted = incoming.deleted ?? existing.deleted ?? false;
  return merged;
};

export const messagePreview = (message) => {
  if (message.deleted) return "This message was deleted";
  if (String(message.messageType || "").toUpperCase() === "VOICE_NOTE") return "Voice note";
  if (message.attachmentName) return `Attachment: ${message.attachmentName}`;
  return message.translatedContent || message.content || "Message";
};

export const buildConversation = (room, members, rawMessages, currentUserId, usersById, contactsByUserId = null) => {
  const memberList = Array.isArray(members) ? members : [];
  const isGroup = room.roomType === "GROUP";
  const otherMember = memberList.find((member) => (member.userId || member.id) !== currentUserId) || memberList[0] || null;
  const otherProfile = otherMember ? usersById[otherMember.userId || otherMember.id] : null;
  const fallbackName = isGroup ? room.name : getDisplayName(otherProfile, contactsByUserId) || room.name;
  const avatar = isGroup ? resolveAvatarUrl(room.avatarUrl) || defaultAvatar(room.name) : getAvatarUrl(otherProfile, fallbackName);
  const latestMessage = rawMessages.length > 0 ? rawMessages[rawMessages.length - 1] : null;

  return {
    id: room.id,
    name: fallbackName,
    avatar,
    lastMessage: latestMessage ? messagePreview(latestMessage) : room.description || "Conversation started",
    time: latestMessage ? formatRoomBadgeTime(latestMessage.timestamp) : formatRoomBadgeTime(room.lastMessageAt),
    unread: room.unread || 0,
    online: isGroup
      ? false
      : Boolean(otherProfile?.online || String(otherProfile?.onlineStatus || "").toUpperCase() === "ONLINE"),
    isGroup,
    description: room.description,
    createdBy: room.createdBy,
    members: memberList,
    roomType: room.roomType,
    inviteCode: room.inviteCode,
    avatarUrl: resolveAvatarUrl(room.avatarUrl),
    lastMessageAt: room.lastMessageAt,
  };
};

export const buildUiMessages = (rawMessages, roomId, currentUserId, usersById, contactsByUserId = null) => {
  const byId = new Map(rawMessages.map((message) => [String(message.id), message]));

  return rawMessages.map((message) => {
    const senderProfile = usersById[message.sender];
    const senderName = getDisplayName(senderProfile, contactsByUserId) || message.sender || "User";
    const senderAvatar = getAvatarUrl(senderProfile, senderName);
    const isOwn = message.sender === currentUserId;
    const text = message.translatedContent || message.content || "";
    const originalText = message.transcript || message.originalContent || message.content || text;
    const replySource = message.replyToMessageId ? byId.get(String(message.replyToMessageId)) : null;
    const replyTo = replySource
      ? {
          id: String(replySource.id),
          senderName: getDisplayName(usersById[replySource.sender], contactsByUserId) || replySource.sender || "User",
          text: replySource.translatedContent || replySource.content || "",
        }
      : undefined;
    const files = message.attachmentName
      ? [
          {
            id: String(message.id),
            name: message.attachmentName,
            size: message.attachmentSize
              ? message.attachmentSize < 1024
                ? `${message.attachmentSize} B`
                : `${(message.attachmentSize / 1024).toFixed(1)} KB`
              : "File",
            type: message.attachmentContentType || "application/octet-stream",
            url: `${apiUrlPrefix}/messages/${roomId}/attachments/${message.id}`,
          },
        ]
      : undefined;
    const isVoiceNote =
      String(message.messageType || "").toUpperCase() === "VOICE_NOTE" ||
      Boolean(message.attachmentContentType?.startsWith("audio/"));

    return {
      id: String(message.id),
      senderId: message.sender,
      senderName,
      senderAvatar,
      text,
      originalText,
      timestamp: formatMessageClock(message.timestamp),
      sent: isOwn,
      isOwn,
      read: Boolean(message.read),
      status: isOwn ? (message.read ? "seen" : "delivered") : undefined,
      type: message.attachmentName
        ? isVoiceNote
          ? "voice-note"
          : message.attachmentContentType?.startsWith("image/")
            ? "image"
            : "file"
        : "text",
      files,
      transcript: message.transcript || "",
      transcriptSourceLanguage: message.transcriptSourceLanguage || "",
      transcriptUpdatedAt: message.transcriptUpdatedAt || null,
      replyTo,
      deleted: message.deleted,
      edited: Boolean(message.editedAt),
      reactions: message.reactions || [],
      messageType: message.messageType,
      roomId: String(message.roomId || roomId),
      translationCreditsRemaining: message.translationCreditsRemaining ?? null,
      translationLimitReached: Boolean(message.translationLimitReached),
      originalMessage: message,
    };
  });
};
