import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCheck,
  Edit2,
  Trash2,
  Download,
  SmilePlus,
  Reply,
  Globe,
  Loader2,
  Eye,
  Mic,
  FileAudio2,
  Captions,
} from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import { useToast } from "@/hooks/use-toast";

const readAuthToken = () => {
  try {
    return localStorage.getItem("token");
  } catch {
    return null;
  }
};

const useProtectedAttachmentUrl = (remoteUrl) => {
  const [state, setState] = useState({
    objectUrl: null,
    loading: Boolean(remoteUrl),
    error: null,
  });

  useEffect(() => {
    if (!remoteUrl) {
      setState({ objectUrl: null, loading: false, error: null });
      return undefined;
    }

    let cancelled = false;
    let createdObjectUrl = null;
    const controller = new AbortController();

    const loadAttachment = async () => {
      setState({ objectUrl: null, loading: true, error: null });
      const token = readAuthToken();

      if (!token) {
        throw new Error("Sign in again to load attachments.");
      }

      const response = await fetch(remoteUrl, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(
          response.status === 401
            ? "Sign in again to access this attachment."
            : "Could not load this attachment."
        );
      }

      const blob = await response.blob();
      createdObjectUrl = URL.createObjectURL(blob);

      if (!cancelled) {
        setState({ objectUrl: createdObjectUrl, loading: false, error: null });
      }
    };

    loadAttachment().catch((error) => {
      if (cancelled || controller.signal.aborted) {
        return;
      }

      setState({
        objectUrl: null,
        loading: false,
        error: error instanceof Error ? error.message : "Could not load this attachment.",
      });
    });

    return () => {
      cancelled = true;
      controller.abort();
      if (createdObjectUrl) {
        URL.revokeObjectURL(createdObjectUrl);
      }
    };
  }, [remoteUrl]);

  return state;
};

const downloadProtectedAttachment = async (file) => {
  const token = readAuthToken();
  if (!token) {
    throw new Error("Sign in again to download attachments.");
  }

  const response = await fetch(file.url, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error(
      response.status === 401
        ? "Sign in again to download this attachment."
        : "Could not download this attachment."
    );
  }

  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = file.name || "attachment";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
};

const SecureAudioAttachment = ({ file, isVoiceNote }) => {
  const { objectUrl, loading, error } = useProtectedAttachmentUrl(file?.url);

  return (
    <motion.div
      key={file.id}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="w-full max-w-[320px] rounded-2xl border border-primary/20 bg-black/20 p-3"
    >
      <div className="mb-2 flex items-center gap-2 text-xs text-gray-300">
        <FileAudio2 className="h-4 w-4 text-primary" />
        <span className="font-medium">{isVoiceNote ? "Voice note" : file.name}</span>
        <span className="text-gray-500">{file.size}</span>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-gray-300">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
          Loading audio...
        </div>
      ) : error ? (
        <div className="rounded-xl border border-red-400/20 bg-red-500/10 px-3 py-2 text-xs text-red-200">
          {error}
        </div>
      ) : (
        <audio controls className="w-full" preload="metadata">
          <source src={objectUrl} type={file.type || "audio/webm"} />
          Your browser does not support audio playback.
        </audio>
      )}
    </motion.div>
  );
};

const SecureImageAttachment = ({ file }) => {
  const { objectUrl, loading, error } = useProtectedAttachmentUrl(file?.url);

  if (loading) {
    return (
      <motion.div
        key={file.id}
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex h-[220px] w-[220px] items-center justify-center rounded-xl border border-white/10 bg-white/5 text-xs text-gray-400"
      >
        <Loader2 className="mr-2 h-4 w-4 animate-spin text-primary" />
        Loading image...
      </motion.div>
    );
  }

  if (error) {
    return (
      <motion.div
        key={file.id}
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-[220px] rounded-xl border border-red-400/20 bg-red-500/10 px-3 py-2 text-xs text-red-200"
      >
        {error}
      </motion.div>
    );
  }

  return (
    <motion.img
      key={file.id}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      src={objectUrl}
      alt={file.name}
      className="max-h-[220px] max-w-[220px] cursor-pointer rounded-xl border border-white/10 object-cover shadow-md transition-opacity hover:opacity-90"
    />
  );
};

export const MessageDisplay = ({
  messages,
  currentUserId,
  isTyping,
  onEditMessage,
  onDeleteMessage,
  onReactMessage,
  onReplyMessage,
  onShowProfile,
  conversation,
}) => {
  const { toast } = useToast();
  const messagesEndRef = useRef(null);
  const containerRef = useRef(null);
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState("");
  const [activeMessageId, setActiveMessageId] = useState(null);
  const [activeReactionId, setActiveReactionId] = useState(null);
  const [visibleTranscripts, setVisibleTranscripts] = useState({});
  const { translateMessage, getMessageTranslation, isPreferredLanguageSet, remainingCredits } = useTranslation();

  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;
    
    // Auto-scroll only if we're near the bottom (within 150px)
    // Or if this is the initial load (messages.length is small or we haven't scrolled yet)
    const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 150;
    
    if (isNearBottom) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isTyping]);

  const handleEditStart = (message) => {
    setEditingId(message.id);
    setEditText(message.text);
  };

  const handleEditSave = (messageId) => {
    if (editText.trim() && onEditMessage) {
      onEditMessage(messageId, editText);
      setEditingId(null);
    }
  };

  const handleEditCancel = () => {
    setEditingId(null);
    setEditText("");
  };

  const toggleTranscript = (messageId) => {
    const willShow = !visibleTranscripts[messageId];
    setVisibleTranscripts((prev) => ({
      ...prev,
      [messageId]: willShow,
    }));
    
    if (willShow && isPreferredLanguageSet()) {
      const targetLang = getPreferredLanguage();
      const message = messages.find(m => m.id === messageId);
      const isTranslationVisible = getMessageTranslation(messageId)?.visible;
      if (message && message.transcript && message.transcriptSourceLanguage !== targetLang && !isTranslationVisible) {
        translateMessage(messageId, message.roomId, message.transcript);
      }
    }
  };

  if (messages.length === 0) {
    const isGroup = conversation?.isGroup;
    const name = conversation?.name || (isGroup ? "Group Chat" : "Chat");
    const avatar = conversation?.avatar;
    const members = conversation?.members || [];
    const memberCount = members.length;
    const previewMembers = members.slice(0, 5);

    return (
      <div className="flex flex-1 items-center justify-center overflow-y-auto p-4 sm:p-6">
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="w-full max-w-sm space-y-6 text-center"
        >
          <div className="flex justify-center">
            <div className="relative">
              <div className="absolute inset-0 scale-150 rounded-full bg-primary/30 blur-2xl opacity-60" />
              <img
                src={avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name)}`}
                alt={name}
                className="relative h-24 w-24 rounded-full border-4 border-primary/30 object-cover shadow-2xl"
              />
              {isGroup && (
                <div className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full border-2 border-[#0a0e27] bg-primary text-xs font-bold text-white shadow">
                  {memberCount}
                </div>
              )}
            </div>
          </div>

          <div className="space-y-1">
            <h2 className="text-2xl font-bold text-white">{name}</h2>
            {isGroup ? (
              <p className="text-sm text-gray-400">
                {memberCount} member{memberCount !== 1 ? "s" : ""}
              </p>
            ) : (
              <p className="text-sm text-gray-400">Direct Message</p>
            )}
          </div>

          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.15 }}
            className="space-y-2 rounded-2xl border border-primary/20 bg-primary/10 px-5 py-4"
          >
            {isGroup ? (
              <>
                <p className="text-sm font-semibold text-white">You&apos;re in the group</p>
                <p className="text-xs text-gray-400">
                  You were added to <span className="font-medium text-primary">{name}</span>. Say hi to everyone.
                </p>
              </>
            ) : (
              <>
                <p className="text-sm font-semibold text-white">Start the conversation</p>
                <p className="text-xs text-gray-400">
                  This is the very beginning of your conversation with{" "}
                  <span className="font-medium text-primary">{name}</span>.
                </p>
              </>
            )}
          </motion.div>

          {isGroup && previewMembers.length > 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.25 }}
              className="space-y-2"
            >
              <p className="text-xs uppercase tracking-wider text-gray-500">Members</p>
              <div className="flex flex-wrap items-center justify-center gap-2">
                {previewMembers.map((member, idx) => {
                  const memberId = member.userId || member.id;
                  const memberName = member.name || member.fullName || member.username || "Member";
                  const memberAvatar =
                    member.avatar ||
                    member.avatarUrl ||
                    `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(memberName)}`;
                  return (
                    <motion.div
                      key={memberId || idx}
                      initial={{ opacity: 0, scale: 0 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.3 + idx * 0.06 }}
                      className="flex flex-col items-center gap-1"
                      title={memberName}
                    >
                      <img
                        src={memberAvatar}
                        alt={memberName}
                        className="h-10 w-10 rounded-full border-2 border-white/10 object-cover"
                      />
                      <span className="max-w-[48px] truncate text-[10px] text-gray-500">{memberName}</span>
                    </motion.div>
                  );
                })}
                {memberCount > 5 && (
                  <div className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-white/10 bg-white/10 text-xs font-medium text-gray-400">
                    +{memberCount - 5}
                  </div>
                )}
              </div>
            </motion.div>
          )}

          <p className="animate-pulse text-xs text-gray-600">Send a message to get started</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="flex-1 space-y-4 overflow-y-auto p-4 scroll-smooth sm:p-6">
      <AnimatePresence mode="popLayout">
        {messages.map((message) => {
          const trans = getMessageTranslation(message.id);
          const audioFiles = (message.files || []).filter((file) => file.type?.startsWith("audio/"));
          const nonAudioFiles = (message.files || []).filter((file) => !file.type?.startsWith("audio/"));
          const hasTranscript = Boolean(message.transcript);
          const showTranscript = Boolean(visibleTranscripts[message.id]) && hasTranscript;
          const isVoiceNote = message.type === "voice-note";

          return (
            <motion.div
              key={message.id}
              initial={{ opacity: 0, scale: 0.85, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.85 }}
              transition={{ type: "spring", bounce: 0.35, duration: 0.5 }}
              onMouseEnter={() => setActiveMessageId(message.id)}
              onMouseLeave={() => {
                setActiveMessageId(null);
                setActiveReactionId(null);
              }}
              onClick={(e) => {
                // If it's a touch device, toggle the active menu on tap
                if (window.matchMedia('(hover: none)').matches) {
                  // Don't toggle if they tapped a button inside
                  if (e.target.closest('button')) return;
                  setActiveMessageId(activeMessageId === message.id ? null : message.id);
                  setActiveReactionId(null);
                }
              }}
              className={`flex items-end gap-3 ${message.isOwn ? "justify-end" : "justify-start"}`}
            >
              {!message.isOwn && (
                <img
                  src={message.senderAvatar}
                  alt={message.senderName}
                  onClick={() => onShowProfile && onShowProfile(message.sender)}
                  className="h-8 w-8 cursor-pointer self-end rounded-full flex-shrink-0"
                />
              )}

              <div className={`flex max-w-xs flex-col sm:max-w-md lg:max-w-lg ${message.isOwn ? "items-end" : "items-start"}`}>
                {editingId === message.id ? (
                  <div className="w-full space-y-2">
                    <textarea
                      value={editText}
                      onChange={(event) => setEditText(event.target.value)}
                      className="glass-input w-full resize-none rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                      rows={2}
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleEditSave(message.id)}
                        className="rounded-lg bg-primary/20 px-3 py-1 text-xs text-primary transition-colors hover:bg-primary/30"
                      >
                        Save
                      </button>
                      <button
                        onClick={handleEditCancel}
                        className="rounded-lg bg-white/10 px-3 py-1 text-xs text-gray-400 transition-colors hover:bg-white/20"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div
                      className={`rounded-2xl px-4 py-3 ${
                        message.isOwn
                          ? "rounded-br-none bg-gradient-to-br from-primary to-secondary text-white"
                          : "rounded-bl-none bg-white/10 text-gray-100"
                      }`}
                    >
                      {message.replyTo && (
                        <div className="mb-2 rounded-lg border-l-4 border-white/40 bg-black/25 p-2 text-xs">
                          <p className="truncate font-bold text-white/90">{message.replyTo.senderName}</p>
                          <p className="max-w-[200px] truncate text-white/70">{message.replyTo.text}</p>
                        </div>
                      )}

                      {!message.isOwn && (
                        <p className="mb-1 text-xs font-semibold text-primary">{message.senderName}</p>
                      )}

                      {message.text ? (
                        <p className="break-words text-sm leading-relaxed">{message.text}</p>
                      ) : isVoiceNote ? (
                        <div className="flex items-center gap-2 text-sm text-white/85">
                          <Mic className="h-4 w-4" />
                          <span>Voice note</span>
                        </div>
                      ) : null}

                      {message.edited && <p className="mt-1 text-xs opacity-60">(edited)</p>}
                    </div>

                    {audioFiles.length > 0 && (
                      <div className={`mt-2 flex flex-col gap-2 ${message.isOwn ? "items-end" : "items-start"}`}>
                        {audioFiles.map((file) => (
                          <SecureAudioAttachment key={file.id} file={file} isVoiceNote={isVoiceNote} />
                        ))}
                      </div>
                    )}

                    {nonAudioFiles.length > 0 && (
                      <div className={`mt-2 flex flex-col gap-2 ${message.isOwn ? "items-end" : "items-start"}`}>
                        {nonAudioFiles.map((file) => {
                          if (file.type?.startsWith("image/")) {
                            return <SecureImageAttachment key={file.id} file={file} />;
                          }

                          return (
                            <motion.div
                              key={file.id}
                              initial={{ opacity: 0, scale: 0.9 }}
                              animate={{ opacity: 1, scale: 1 }}
                              className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-xs text-gray-300 transition-colors hover:bg-white/20"
                            >
                              <svg className="h-4 w-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4V5h12v10z" />
                              </svg>
                              <div className="min-w-0 flex-1">
                                <p className="truncate font-medium">{file.name}</p>
                                <p className="text-gray-500">{file.size}</p>
                              </div>
                              <motion.button
                                whileHover={{ scale: 1.1 }}
                                whileTap={{ scale: 0.95 }}
                                type="button"
                                onClick={async () => {
                                  try {
                                    await downloadProtectedAttachment(file);
                                  } catch (error) {
                                    toast({
                                      title: "Download failed",
                                      description:
                                        error instanceof Error ? error.message : "Could not download this attachment.",
                                      variant: "destructive",
                                    });
                                  }
                                }}
                                className="rounded p-1 text-primary hover:bg-primary/20"
                                title="Download"
                              >
                                <Download className="h-4 w-4" />
                              </motion.button>
                            </motion.div>
                          );
                        })}
                      </div>
                    )}

                    <AnimatePresence>
                      {showTranscript && (
                        <motion.div
                          key="transcript"
                          initial={{ opacity: 0, height: 0, marginTop: 0 }}
                          animate={{ opacity: 1, height: "auto", marginTop: 6 }}
                          exit={{ opacity: 0, height: 0, marginTop: 0 }}
                          className={`overflow-hidden rounded-xl border px-3 py-2 text-xs ${
                            message.isOwn
                              ? "border-white/20 bg-white/5"
                              : "border-cyan-400/20 bg-cyan-400/5"
                          }`}
                        >
                          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-cyan-200">
                            Transcript
                            {message.transcriptSourceLanguage ? ` · ${message.transcriptSourceLanguage.toUpperCase()}` : ""}
                            {trans?.translatedText && trans?.targetLang ? ` (Translated to ${trans.targetLang.toUpperCase()})` : ""}
                          </p>
                          <p className="leading-relaxed text-gray-200">
                            {trans?.translatedText || message.transcript}
                          </p>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    <AnimatePresence>
                      {trans?.visible && (
                        <motion.div
                          key="translation"
                          initial={{ opacity: 0, height: 0, marginTop: 0 }}
                          animate={{ opacity: 1, height: "auto", marginTop: 6 }}
                          exit={{ opacity: 0, height: 0, marginTop: 0 }}
                          className={`overflow-hidden rounded-xl border px-3 py-2 text-xs ${
                            message.isOwn
                              ? "border-white/20 bg-white/5"
                              : "border-primary/20 bg-primary/5"
                          }`}
                        >
                          {trans.loading && (
                            <div className="flex items-center gap-2 text-gray-400">
                              <Loader2 className="h-3 w-3 animate-spin" />
                              <span>{isVoiceNote ? "Transcribing and translating..." : "Translating..."}</span>
                            </div>
                          )}
                          {trans.error && <p className="text-red-400">{trans.error}</p>}
                          {!trans.loading && !trans.error && trans.translatedText && (
                            <div className="space-y-1">
                              <p className="leading-relaxed text-gray-200 italic">{trans.translatedText}</p>
                              <p className="text-gray-500">
                                Translated
                                {trans.detectedLang ? ` from ${trans.detectedLang.toUpperCase()}` : ""}
                                {trans.targetLang ? ` to ${trans.targetLang.toUpperCase()}` : ""}
                              </p>
                            </div>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {message.reactions && message.reactions.length > 0 && (
                      <div className={`mt-2 flex flex-wrap gap-1 ${message.isOwn ? "justify-end" : "justify-start"}`}>
                        {message.reactions.map((emoji, idx) => (
                          <motion.span
                            key={`${message.id}-reaction-${idx}`}
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            className="rounded-full border border-white/10 bg-black/50 px-2 py-0.5 text-sm shadow"
                          >
                            {emoji}
                          </motion.span>
                        ))}
                      </div>
                    )}
                  </>
                )}

                <div className={`mt-1 flex items-center gap-1.5 px-1 text-xs text-gray-500 ${message.isOwn ? "justify-end" : "justify-start"}`}>
                  <span>{message.timestamp}</span>
                  {message.isOwn &&
                    (message.read ? (
                      <Eye className="h-3.5 w-3.5 text-blue-400" title="Seen" />
                    ) : (
                      <CheckCheck className="h-3.5 w-3.5 text-gray-400" title="Delivered" />
                    ))}

                  {!message.isOwn && (
                    <motion.button
                      whileHover={{ scale: 1.15 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => translateMessage(message.id, message.roomId, message.originalText || message.text || message.transcript || "")}
                      disabled={!isPreferredLanguageSet() || (remainingCredits !== null && remainingCredits <= 0)}
                      className={`flex items-center gap-1 rounded p-1 transition-colors ${
                        !isPreferredLanguageSet() || (remainingCredits !== null && remainingCredits <= 0)
                          ? "cursor-not-allowed text-gray-600"
                          : trans?.visible
                            ? "text-primary"
                            : "text-gray-400 hover:text-primary"
                      }`}
                      title={
                        !isPreferredLanguageSet()
                          ? "Set a preferred language to translate messages"
                          : remainingCredits !== null && remainingCredits <= 0
                            ? "Translation credits exhausted"
                            : "Translate message"
                      }
                    >
                      <Globe className="h-3.5 w-3.5" />
                      <span className="text-[10px] font-medium uppercase">Translate</span>
                    </motion.button>
                  )}

                  {hasTranscript && (
                    <motion.button
                      whileHover={{ scale: 1.15 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => toggleTranscript(message.id)}
                      className={`flex items-center gap-1 rounded p-1 transition-colors ${
                        showTranscript ? "text-cyan-300" : "text-gray-400 hover:text-cyan-300"
                      }`}
                      title={showTranscript ? "Hide transcript" : "Show transcript"}
                    >
                      <Captions className="h-3.5 w-3.5" />
                      <span className="text-[10px] font-medium uppercase">Transcript</span>
                    </motion.button>
                  )}

                  <AnimatePresence>
                    {activeMessageId === message.id && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        className="ml-1 flex items-center gap-1"
                      >
                        <motion.button
                          whileHover={{ scale: 1.15 }}
                          whileTap={{ scale: 0.9 }}
                          onClick={() => onReplyMessage?.(message)}
                          className="rounded-full p-1 text-gray-400 transition-colors hover:bg-white/10 hover:text-white"
                          title="Reply"
                        >
                          <Reply className="h-3 w-3" />
                        </motion.button>

                        <div className="relative">
                          <motion.button
                            whileHover={{ scale: 1.15 }}
                            whileTap={{ scale: 0.9 }}
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveReactionId(activeReactionId === message.id ? null : message.id);
                            }}
                            onMouseEnter={() => {
                              if (!window.matchMedia('(hover: none)').matches) {
                                setActiveReactionId(message.id);
                              }
                            }}
                            className="rounded-full p-1 text-gray-400 transition-colors hover:bg-white/10 hover:text-white"
                            title="React"
                          >
                            <SmilePlus className="h-3 w-3" />
                          </motion.button>
                          
                          <AnimatePresence>
                            {activeReactionId === message.id && (
                              <motion.div 
                                initial={{ opacity: 0, y: 5 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: 5 }}
                                className="absolute bottom-full left-1/2 z-50 -translate-x-1/2 pb-2"
                              >
                                <div className="flex gap-2 whitespace-nowrap rounded-full border border-white/10 bg-black/95 px-2 py-1.5 shadow-2xl backdrop-blur-md">
                                  {["❤", "👍", "😂", "😮", "😢"].map((emoji) => (
                                    <button
                                      key={`${message.id}-${emoji}`}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        onReactMessage?.(message.id, emoji);
                                        setActiveReactionId(null);
                                      }}
                                      className="text-base transition-transform hover:scale-125"
                                    >
                                      {emoji}
                                    </button>
                                  ))}
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>

                        {message.isOwn && (
                          <>
                            <motion.button
                              whileHover={{ scale: 1.15 }}
                              whileTap={{ scale: 0.9 }}
                              onClick={() => handleEditStart(message)}
                              className="rounded-full p-1 text-gray-400 transition-colors hover:bg-primary/20 hover:text-primary"
                              title="Edit"
                            >
                              <Edit2 className="h-3 w-3" />
                            </motion.button>
                            <motion.button
                              whileHover={{ scale: 1.15 }}
                              whileTap={{ scale: 0.9 }}
                              onClick={() => onDeleteMessage?.(message.id)}
                              className="rounded-full p-1 text-gray-400 transition-colors hover:bg-red-500/20 hover:text-red-400"
                              title="Delete"
                            >
                              <Trash2 className="h-3 w-3" />
                            </motion.button>
                          </>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              {message.isOwn && (
                <img
                  src={message.senderAvatar}
                  alt={message.senderName}
                  className="h-8 w-8 self-end rounded-full flex-shrink-0"
                />
              )}
            </motion.div>
          );
        })}

        {isTyping && (
          <motion.div
            key="typing"
            initial={{ opacity: 0, y: 10, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="flex items-end justify-start gap-3"
          >
            <div className="flex items-center gap-1.5 rounded-2xl rounded-bl-none border border-white/10 bg-white/8 px-4 py-3 text-gray-100 shadow-sm">
              {[0, 0.2, 0.4].map((delay, index) => (
                <motion.div
                  key={`typing-${index}`}
                  animate={{ y: [0, -5, 0] }}
                  transition={{ repeat: Infinity, duration: 1, delay }}
                  className="h-2 w-2 rounded-full bg-gray-400"
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div ref={messagesEndRef} />
    </div>
  );
};
