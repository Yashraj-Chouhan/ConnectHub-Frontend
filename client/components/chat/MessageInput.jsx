import { useState, useRef, useEffect } from "react";
import { Send, Paperclip, Mic, X, SmilePlus, Hand } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import EmojiPicker from "emoji-picker-react";
import { useToast } from "@/hooks/use-toast";
import { GestureRecognition } from "@/components/accessibility/GestureRecognition";
import {
  describeMediaAccessError,
  getMediaDevicesSupportMessage,
  supportsMediaDevices,
} from "@/services/videoCallService";

const formatFileSize = (bytes) => {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
};

const inferVoiceNoteExtension = (mimeType) => {
  const normalized = String(mimeType || "").toLowerCase();
  if (normalized.includes("ogg")) return "ogg";
  if (normalized.includes("wav")) return "wav";
  if (normalized.includes("mpeg") || normalized.includes("mp3")) return "mp3";
  if (normalized.includes("mp4") || normalized.includes("m4a")) return "m4a";
  return "webm";
};

const createDraftId = () =>
  typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

const formatRecordingDuration = (durationMs) => {
  const totalSeconds = Math.max(0, Math.floor(durationMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
};

const normalizeTranscriptText = (value) =>
  String(value || "")
    .replace(/\s+/g, " ")
    .trim();

const getSpeechRecognitionConstructor = () => {
  if (typeof window === "undefined") {
    return null;
  }

  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
};

export const MessageInput = ({
  onSendMessage,
  replyingToMessage,
  replyingTo,
  onCancelReply,
  onTyping,
}) => {
  const { toast } = useToast();
  const [message, setMessage] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [recordingStartedAt, setRecordingStartedAt] = useState(null);
  const [recordingDurationMs, setRecordingDurationMs] = useState(0);
  const [sharedFiles, setSharedFiles] = useState([]);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showGesture, setShowGesture] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);
  const pickerRef = useRef(null);
  const typingTimerRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const recordingChunksRef = useRef([]);
  const recordingStreamRef = useRef(null);
  const sharedFilesRef = useRef([]);
  const speechRecognitionRef = useRef(null);
  const transcriptRef = useRef("");
  const transcriptSourceLanguageRef = useRef(null);
  const recordingFinalizeTimerRef = useRef(null);
  const activeReply = replyingToMessage ?? replyingTo ?? null;

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (pickerRef.current && !pickerRef.current.contains(event.target)) {
        setShowEmojiPicker(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [message]);

  useEffect(() => {
    sharedFilesRef.current = sharedFiles;
  }, [sharedFiles]);

  useEffect(() => {
    if (!isRecording || !recordingStartedAt) {
      setRecordingDurationMs(0);
      return undefined;
    }

    setRecordingDurationMs(Date.now() - recordingStartedAt);
    const timer = window.setInterval(() => {
      setRecordingDurationMs(Date.now() - recordingStartedAt);
    }, 1000);

    return () => window.clearInterval(timer);
  }, [isRecording, recordingStartedAt]);

  useEffect(() => () => {
    if (typingTimerRef.current) {
      clearTimeout(typingTimerRef.current);
    }
    if (recordingFinalizeTimerRef.current) {
      window.clearTimeout(recordingFinalizeTimerRef.current);
    }
    if (mediaRecorderRef.current?.state && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    if (speechRecognitionRef.current) {
      try {
        speechRecognitionRef.current.abort();
      } catch {
        // Ignore best-effort browser transcription cleanup failures.
      }
    }
    if (recordingStreamRef.current) {
      recordingStreamRef.current.getTracks().forEach((track) => track.stop());
    }
    sharedFilesRef.current.forEach((file) => {
      if (file.previewUrl) {
        URL.revokeObjectURL(file.previewUrl);
      }
    });
  }, []);

  const appendFiles = (files) => {
    const nextFiles = files
      .map((entry) => {
        const file = entry?.file ?? entry;
        if (!file) {
          return null;
        }

        return {
          id: createDraftId(),
          name: file.name,
          size: formatFileSize(file.size),
          file,
          type: file.type,
          transcript: normalizeTranscriptText(entry?.transcript),
          transcriptSourceLanguage: entry?.transcriptSourceLanguage || null,
          previewUrl: file.type.startsWith("image/") ? URL.createObjectURL(file) : null,
        };
      })
      .filter(Boolean);

    setSharedFiles((prev) => [...prev, ...nextFiles]);
  };

  const stopLocalTranscription = (abort = false) => {
    const recognition = speechRecognitionRef.current;
    if (!recognition) {
      return;
    }

    try {
      if (abort && typeof recognition.abort === "function") {
        recognition.abort();
      } else {
        recognition.stop();
      }
    } catch {
      // Browsers can throw if stop/abort happens after recognition already ended.
    }
  };

  const resetLocalTranscription = () => {
    if (recordingFinalizeTimerRef.current) {
      window.clearTimeout(recordingFinalizeTimerRef.current);
      recordingFinalizeTimerRef.current = null;
    }
    speechRecognitionRef.current = null;
    transcriptRef.current = "";
    transcriptSourceLanguageRef.current = null;
  };

  const finalizeVoiceNoteDraft = (blob, mimeType) => {
    const extension = inferVoiceNoteExtension(mimeType);
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const file = new File([blob], `voice-note-${stamp}.${extension}`, { type: mimeType });
    const transcript = normalizeTranscriptText(transcriptRef.current);

    appendFiles([
      {
        file,
        transcript,
        transcriptSourceLanguage: transcript ? transcriptSourceLanguageRef.current : null,
      },
    ]);
    resetLocalTranscription();
  };

  const handleSendMessage = async () => {
    if (isSending || (!message.trim() && sharedFiles.length === 0)) {
      return;
    }

    const files = sharedFiles.length > 0
      ? sharedFiles.map((file) => ({
          file: file.file,
          transcript: file.transcript || null,
          transcriptSourceLanguage: file.transcriptSourceLanguage || null,
        }))
      : undefined;
    setIsSending(true);

    try {
      const result = await onSendMessage?.(message, files, "none");
      if (result === false) {
        return;
      }

      sharedFiles.forEach((file) => {
        if (file.previewUrl) {
          URL.revokeObjectURL(file.previewUrl);
        }
      });
      setMessage("");
      setSharedFiles([]);
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }
    } catch {
      // Keep the draft intact so the user can retry after a failed send.
    } finally {
      setIsSending(false);
    }
  };

  const handleFileSelect = (event) => {
    const files = Array.from(event.target.files || []);
    appendFiles(files);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleRemoveFile = (fileId) => {
    setSharedFiles((prev) => {
      const target = prev.find((file) => file.id === fileId);
      if (target?.previewUrl) {
        URL.revokeObjectURL(target.previewUrl);
      }
      return prev.filter((file) => file.id !== fileId);
    });
  };

  const handleKeyDown = (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSendMessage();
    }
  };

  const handleEmojiClick = (emojiObject) => {
    setMessage((prevMessage) => prevMessage + emojiObject.emoji);
  };

  const handleMessageChange = (value) => {
    setMessage(value);
    if (!onTyping) {
      return;
    }
    if (typingTimerRef.current) {
      clearTimeout(typingTimerRef.current);
    }
    typingTimerRef.current = setTimeout(() => {
      onTyping();
    }, 250);
  };

  const handleVoiceNoteToggle = async () => {
    if (isSending) {
      return;
    }

    if (isRecording) {
      stopLocalTranscription();
      mediaRecorderRef.current?.stop();
      return;
    }

    if (
      typeof window === "undefined" ||
      !supportsMediaDevices() ||
      typeof MediaRecorder === "undefined"
    ) {
      toast({
        title: "Voice notes unavailable",
        description: !supportsMediaDevices()
          ? getMediaDevicesSupportMessage("microphone")
          : "This browser can open the microphone but cannot record voice notes here. Try the latest Chrome, Edge, Firefox, or Safari.",
        variant: "destructive",
      });
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const SpeechRecognition = getSpeechRecognitionConstructor();
      recordingStreamRef.current = stream;
      recordingChunksRef.current = [];
      mediaRecorderRef.current = recorder;
      transcriptRef.current = "";
      transcriptSourceLanguageRef.current = null;

      if (false) { // Disabled local SpeechRecognition to rely on accurate backend Whisper
        try {
          const recognition = new SpeechRecognition();
          recognition.continuous = true;
          recognition.interimResults = true;
          recognition.lang = navigator.language || "en-US";
          transcriptSourceLanguageRef.current = recognition.lang;
          recognition.onresult = (event) => {
            let combinedTranscript = "";
            for (let index = 0; index < event.results.length; index += 1) {
              combinedTranscript += `${event.results[index][0]?.transcript || ""} `;
            }
            transcriptRef.current = normalizeTranscriptText(combinedTranscript);
          };
          recognition.onerror = () => {
            speechRecognitionRef.current = null;
          };
          recognition.onend = () => {
            speechRecognitionRef.current = null;
          };
          recognition.start();
          speechRecognitionRef.current = recognition;
        } catch {
          speechRecognitionRef.current = null;
        }
      }

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          recordingChunksRef.current.push(event.data);
        }
      };

      recorder.onerror = () => {
        stopLocalTranscription(true);
        setRecordingStartedAt(null);
        resetLocalTranscription();
        toast({
          title: "Recording failed",
          description: "The voice note could not be captured. Please try again.",
          variant: "destructive",
        });
      };

      recorder.onstop = () => {
        const mimeType = recorder.mimeType || "audio/webm";
        const blob = new Blob(recordingChunksRef.current, { type: mimeType });

        if (blob.size > 0) {
          recordingFinalizeTimerRef.current = window.setTimeout(() => {
            finalizeVoiceNoteDraft(blob, mimeType);
          }, 350);
        } else {
          resetLocalTranscription();
        }

        recordingChunksRef.current = [];
        if (recordingStreamRef.current) {
          recordingStreamRef.current.getTracks().forEach((track) => track.stop());
          recordingStreamRef.current = null;
        }
        mediaRecorderRef.current = null;
        setRecordingStartedAt(null);
        setIsRecording(false);
      };

      recorder.start();
      setRecordingStartedAt(Date.now());
      setIsRecording(true);
    } catch (error) {
      stopLocalTranscription(true);
      setRecordingStartedAt(null);
      resetLocalTranscription();
      toast({
        title: "Microphone access denied",
        description: describeMediaAccessError(error, "microphone"),
        variant: "destructive",
      });
    }
  };

  return (
    <div className="flex-none glass-dark border-t border-white/10 p-3 sm:p-4 relative">
      <input
        ref={fileInputRef}
        type="file"
        multiple
        onChange={handleFileSelect}
        className="hidden"
      />

      <AnimatePresence>
        {activeReply && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-3 flex items-center gap-3 rounded-r-xl border border-white/10 border-l-4 border-primary bg-white/5 px-3 py-2.5"
          >
            <div className="min-w-0 flex-1">
              <p className="mb-0.5 text-xs font-bold text-primary">{activeReply.senderName}</p>
              <p className="truncate text-xs text-gray-400">{activeReply.text}</p>
            </div>
            <button
              onClick={onCancelReply}
              className="flex-shrink-0 rounded-full p-1 text-gray-500 transition-colors hover:bg-white/10 hover:text-white"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {sharedFiles.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-3 flex flex-wrap gap-2"
          >
            {sharedFiles.map((file) => (
              <motion.div
                key={file.id}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                className="group relative"
              >
                {file.previewUrl ? (
                  <img
                    src={file.previewUrl}
                    alt={file.name}
                    className="h-16 w-16 rounded-lg border border-white/20 object-cover"
                  />
                ) : file.type?.startsWith("audio/") ? (
                  <div className="flex min-w-[180px] items-center gap-2 rounded-lg border border-primary/20 bg-white/10 px-3 py-2 text-xs text-gray-200">
                    <Mic className="h-4 w-4 flex-shrink-0 text-primary" />
                    <div className="min-w-0">
                      <p className="truncate font-medium">Voice note</p>
                      <p className="truncate text-gray-400">
                        {file.transcript || file.name}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="flex max-w-[180px] items-center gap-2 rounded-lg border border-white/10 bg-white/10 px-3 py-2 text-xs text-gray-300">
                    <svg className="h-4 w-4 flex-shrink-0 text-primary" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4V5h12v10z" />
                    </svg>
                    <span className="truncate font-medium">{file.name}</span>
                  </div>
                )}
                <button
                  onClick={() => handleRemoveFile(file.id)}
                  className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-white opacity-0 shadow-md transition-opacity group-hover:opacity-100 hover:bg-red-600"
                >
                  <X className="h-3 w-3" />
                </button>
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isRecording && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            className="pointer-events-none absolute bottom-full right-3 z-40 mb-3 flex items-center gap-3 rounded-2xl border border-red-400/25 bg-[#2f1118]/95 px-3 py-2 text-xs text-red-50 shadow-2xl shadow-red-950/40 backdrop-blur-md"
          >
            <span className="inline-block h-2.5 w-2.5 animate-pulse rounded-full bg-red-400" />
            <div className="flex flex-col">
              <span className="font-semibold tracking-wide">Recording voice note</span>
              <span className="text-[11px] text-red-100/80">
                {formatRecordingDuration(recordingDurationMs)} · tap mic again to stop
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex items-end gap-2">
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => fileInputRef.current?.click()}
          className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-white/10 text-gray-400 transition-all hover:bg-white/20 hover:text-white"
          title="Attach file"
          disabled={isSending}
        >
          <Paperclip className="h-4 w-4" />
        </motion.button>

        <div className="relative" ref={pickerRef}>
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-white/10 text-gray-400 transition-all hover:bg-white/20 hover:text-white"
            title="Emoji"
          >
            <SmilePlus className="h-4 w-4" />
          </motion.button>

          <AnimatePresence>
            {showEmojiPicker && (
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                className="fixed bottom-[80px] left-[50%] -translate-x-[50%] sm:absolute sm:bottom-12 sm:left-0 sm:translate-x-0 z-50 w-[95vw] sm:w-[350px] max-w-[350px] overflow-hidden rounded-2xl border border-white/10 shadow-2xl"
              >
                <EmojiPicker
                  onEmojiClick={handleEmojiClick}
                  theme="dark"
                  searchDisabled={false}
                  skinTonesDisabled
                  width="100%"
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="relative">
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowGesture(!showGesture)}
            className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full transition-all ${
              showGesture
                ? "bg-primary text-white shadow-lg shadow-primary/30"
                : "bg-white/10 text-gray-400 hover:bg-white/20 hover:text-white"
            }`}
            title="Gesture Communication"
          >
            <Hand className="h-4 w-4" />
          </motion.button>

          <AnimatePresence>
            {showGesture && (
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                className="fixed bottom-[80px] left-[50%] -translate-x-[50%] sm:absolute sm:bottom-12 sm:left-0 sm:translate-x-0 z-50 w-[95vw] sm:w-[300px] max-w-[350px] overflow-hidden rounded-2xl border border-white/10 shadow-2xl bg-[#0f1218]/95 backdrop-blur-xl"
              >
                <GestureRecognition
                  onSendMessage={onSendMessage}
                  disabled={isSending || isRecording}
                  onClose={() => setShowGesture(false)}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="flex-1">
          <textarea
            ref={textareaRef}
            value={message}
            onChange={(event) => handleMessageChange(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            className="glass-input min-h-[40px] max-h-32 w-full resize-none rounded-2xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            rows={1}
          />
        </div>

        <AnimatePresence mode="wait">
          {message.trim() || sharedFiles.length > 0 ? (
            <motion.button
              key="send"
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.6, opacity: 0 }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleSendMessage}
              disabled={isSending}
              className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-secondary text-white transition-all hover:shadow-lg hover:shadow-primary/40 ${
                isSending ? "cursor-not-allowed opacity-70" : ""
              }`}
            >
              <Send className={`h-4 w-4 ${isSending ? "animate-pulse" : ""}`} />
            </motion.button>
          ) : (
            <motion.button
              key="mic"
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.6, opacity: 0 }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleVoiceNoteToggle}
              className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-white transition-all ${
                isRecording
                  ? "animate-pulse bg-red-500 shadow-lg shadow-red-500/40"
                  : "bg-gradient-to-br from-primary to-secondary hover:shadow-lg hover:shadow-primary/40"
              }`}
            >
              <Mic className="h-4 w-4" />
            </motion.button>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
