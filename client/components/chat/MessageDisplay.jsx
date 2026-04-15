import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, CheckCheck, Edit2, Trash2, Download, SmilePlus, Reply, Globe, Loader2 } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';

export const MessageDisplay = ({
  messages,
  currentUserId,
  isTyping,
  onEditMessage,
  onDeleteMessage,
  onReactMessage,
  onReplyMessage,
}) => {
  const messagesEndRef = useRef(null);
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState('');
  const [hoveredMessageId, setHoveredMessageId] = useState(null);
  const { translateMessage, getMessageTranslation, isPreferredLanguageSet, remainingCredits } = useTranslation();

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
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
    setEditText('');
  };

  if (messages.length === 0) {
    return (
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 flex items-center justify-center text-center">
        <div className="space-y-4">
          <div className="text-5xl">👋</div>
          <h3 className="text-xl font-semibold text-white">No messages yet</h3>
          <p className="text-gray-400">Start a conversation by sending a message</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
      <AnimatePresence mode="popLayout">
        {messages.map((message) => {
          const trans = getMessageTranslation(message.id);

          return (
            <motion.div
              layout
              key={message.id}
              initial={{ opacity: 0, scale: 0.85, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.85 }}
              transition={{ type: 'spring', bounce: 0.35, duration: 0.5 }}
              onMouseEnter={() => setHoveredMessageId(message.id)}
              onMouseLeave={() => setHoveredMessageId(null)}
              className={`flex items-end gap-3 ${message.isOwn ? 'justify-end' : 'justify-start'}`}
            >
              {/* Sender Avatar (left side, received only) */}
              {!message.isOwn && (
                <img
                  src={message.senderAvatar}
                  alt={message.senderName}
                  className="w-8 h-8 rounded-full flex-shrink-0 self-end"
                />
              )}

              {/* Message Column */}
              <div className={`flex flex-col max-w-xs sm:max-w-md lg:max-w-lg ${message.isOwn ? 'items-end' : 'items-start'}`}>

                {/* Edit Mode */}
                {editingId === message.id ? (
                  <div className="space-y-2 w-full">
                    <textarea
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      className="glass-input w-full px-4 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary rounded-lg"
                      rows={2}
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleEditSave(message.id)}
                        className="text-xs px-3 py-1 bg-primary/20 hover:bg-primary/30 text-primary rounded-lg transition-colors"
                      >
                        Save
                      </button>
                      <button
                        onClick={handleEditCancel}
                        className="text-xs px-3 py-1 bg-white/10 hover:bg-white/20 text-gray-400 rounded-lg transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Message Bubble */}
                    <div
                      className={`px-4 py-3 rounded-2xl ${
                        message.isOwn
                          ? 'bg-gradient-to-br from-primary to-secondary text-white rounded-br-none'
                          : 'bg-white/10 text-gray-100 rounded-bl-none'
                      }`}
                    >
                      {/* Reply Quote */}
                      {message.replyTo && (
                        <div className="bg-black/25 rounded-lg p-2 mb-2 border-l-4 border-white/40 text-xs">
                          <p className="font-bold text-white/90 truncate">{message.replyTo.senderName}</p>
                          <p className="text-white/70 truncate max-w-[200px]">{message.replyTo.text}</p>
                        </div>
                      )}

                      {/* Sender name (group chats) */}
                      {!message.isOwn && (
                        <p className="text-xs font-semibold text-primary mb-1">{message.senderName}</p>
                      )}

                      {/* Message text */}
                      <p className="break-words text-sm leading-relaxed">{message.text}</p>

                      {/* Edited indicator */}
                      {message.edited && (
                        <p className="text-xs opacity-60 mt-1">(edited)</p>
                      )}
                    </div>

                    {/* Image Attachments */}
                    {message.files && message.files.length > 0 && (
                      <div className={`mt-2 flex flex-col gap-2 ${message.isOwn ? 'items-end' : 'items-start'}`}>
                        {message.files.map((file) => {
                          if (file.type?.startsWith('image/')) {
                            return (
                              <motion.img
                                key={file.id}
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                src={file.url}
                                alt={file.name}
                                className="rounded-xl max-w-[220px] max-h-[220px] object-cover border border-white/10 hover:opacity-90 cursor-pointer shadow-md transition-opacity"
                              />
                            );
                          }
                          return (
                            <motion.div
                              key={file.id}
                              initial={{ opacity: 0, scale: 0.9 }}
                              animate={{ opacity: 1, scale: 1 }}
                              className="flex items-center gap-2 bg-white/10 px-3 py-2 rounded-xl text-xs text-gray-300 hover:bg-white/20 transition-colors border border-white/10"
                            >
                              <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4V5h12v10z" />
                              </svg>
                              <div className="flex-1 min-w-0">
                                <p className="truncate font-medium">{file.name}</p>
                                <p className="text-gray-500">{file.size}</p>
                              </div>
                              <motion.button
                                whileHover={{ scale: 1.1 }}
                                whileTap={{ scale: 0.95 }}
                                type="button"
                                onClick={() => window.open(file.url, "_blank", "noopener,noreferrer")}
                                className="p-1 hover:bg-primary/20 rounded text-primary"
                                title="Download"
                              >
                                <Download className="w-4 h-4" />
                              </motion.button>
                            </motion.div>
                          );
                        })}
                      </div>
                    )}

                    {/* Translation Block */}
                    <AnimatePresence>
                      {trans?.visible && (
                        <motion.div
                          key="translation"
                          initial={{ opacity: 0, height: 0, marginTop: 0 }}
                          animate={{ opacity: 1, height: 'auto', marginTop: 6 }}
                          exit={{ opacity: 0, height: 0, marginTop: 0 }}
                          className={`rounded-xl px-3 py-2 border text-xs overflow-hidden ${
                            message.isOwn
                              ? 'border-white/20 bg-white/5'
                              : 'border-primary/20 bg-primary/5'
                          }`}
                        >
                          {trans.loading && (
                            <div className="flex items-center gap-2 text-gray-400">
                              <Loader2 className="w-3 h-3 animate-spin" />
                              <span>Translating...</span>
                            </div>
                          )}
                          {trans.error && (
                            <p className="text-red-400">{trans.error}</p>
                          )}
                          {!trans.loading && !trans.error && trans.translatedText && (
                            <div className="space-y-1">
                              <p className="italic text-gray-200 leading-relaxed">{trans.translatedText}</p>
                              <p className="text-gray-500">
                                🌐 Translated
                                {trans.detectedLang ? ` from ${trans.detectedLang.toUpperCase()}` : ''}
                                {trans.targetLang ? ` → ${trans.targetLang.toUpperCase()}` : ''}
                              </p>
                            </div>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Emoji Reactions */}
                    {message.reactions && message.reactions.length > 0 && (
                      <div className={`flex flex-wrap gap-1 mt-2 ${message.isOwn ? 'justify-end' : 'justify-start'}`}>
                        {message.reactions.map((emoji, idx) => (
                          <motion.span
                            key={idx}
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            className="text-sm bg-black/50 rounded-full px-2 py-0.5 border border-white/10 shadow"
                          >
                            {emoji}
                          </motion.span>
                        ))}
                      </div>
                    )}
                  </>
                )}

                {/* Timestamp + Read Status + Action Buttons */}
                <div className={`flex items-center gap-1.5 mt-1 px-1 text-xs text-gray-500 ${message.isOwn ? 'justify-end' : 'justify-start'}`}>
                  <span>{message.timestamp}</span>
                  {message.isOwn && (
                    message.read
                      ? <CheckCheck className="w-3.5 h-3.5 text-primary" />
                      : <Check className="w-3.5 h-3.5" />
                  )}

                  {/* Hover Action Buttons */}
                  <AnimatePresence>
                    {hoveredMessageId === message.id && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        className="flex items-center gap-1 ml-1"
                      >
                        {/* Translate (received messages only, when language is set) */}
                        {!message.isOwn && isPreferredLanguageSet() && (
                          <motion.button
                            whileHover={{ scale: 1.15 }}
                            whileTap={{ scale: 0.9 }}
                            onClick={() => translateMessage(message.id, message.roomId, message.originalText || message.text)}
                            disabled={remainingCredits !== null && remainingCredits <= 0}
                            className={`p-1 rounded-full transition-colors ${
                              remainingCredits !== null && remainingCredits <= 0
                                ? "text-gray-600 cursor-not-allowed"
                                : ""
                            } ${
                              trans?.visible
                                ? 'text-primary bg-primary/20'
                                : 'text-gray-400 hover:text-primary hover:bg-primary/10'
                            }`}
                            title={
                              remainingCredits !== null && remainingCredits <= 0
                                ? "Translation credits exhausted"
                                : "Translate message"
                            }
                          >
                            <Globe className="w-3 h-3" />
                          </motion.button>
                        )}

                        {/* Reply */}
                        <motion.button
                          whileHover={{ scale: 1.15 }}
                          whileTap={{ scale: 0.9 }}
                          onClick={() => onReplyMessage?.(message)}
                          className="p-1 hover:bg-white/10 rounded-full text-gray-400 hover:text-white transition-colors"
                          title="Reply"
                        >
                          <Reply className="w-3 h-3" />
                        </motion.button>

                        {/* Emoji React */}
                        <div className="relative group/reaction">
                          <motion.button
                            whileHover={{ scale: 1.15 }}
                            whileTap={{ scale: 0.9 }}
                            className="p-1 hover:bg-white/10 rounded-full text-gray-400 hover:text-white transition-colors"
                            title="React"
                          >
                            <SmilePlus className="w-3 h-3" />
                          </motion.button>
                          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover/reaction:flex bg-black/85 backdrop-blur-sm rounded-full px-2 py-1.5 gap-2 border border-white/10 shadow-xl z-50 whitespace-nowrap">
                            {['❤️', '👍', '😂', '😮', '😢'].map((emoji) => (
                              <button
                                key={emoji}
                                onClick={() => onReactMessage?.(message.id, emoji)}
                                className="hover:scale-125 transition-transform text-base"
                              >
                                {emoji}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Edit + Delete (own messages only) */}
                        {message.isOwn && (
                          <>
                            <motion.button
                              whileHover={{ scale: 1.15 }}
                              whileTap={{ scale: 0.9 }}
                              onClick={() => handleEditStart(message)}
                              className="p-1 hover:bg-primary/20 rounded-full text-gray-400 hover:text-primary transition-colors"
                              title="Edit"
                            >
                              <Edit2 className="w-3 h-3" />
                            </motion.button>
                            <motion.button
                              whileHover={{ scale: 1.15 }}
                              whileTap={{ scale: 0.9 }}
                              onClick={() => onDeleteMessage?.(message.id)}
                              className="p-1 hover:bg-red-500/20 rounded-full text-gray-400 hover:text-red-400 transition-colors"
                              title="Delete"
                            >
                              <Trash2 className="w-3 h-3" />
                            </motion.button>
                          </>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              {/* Own Avatar (right side) */}
              {message.isOwn && (
                <img
                  src={message.senderAvatar}
                  alt={message.senderName}
                  className="w-8 h-8 rounded-full flex-shrink-0 self-end"
                />
              )}
            </motion.div>
          );
        })}

        {/* Typing Indicator */}
        {isTyping && (
          <motion.div
            key="typing"
            layout
            initial={{ opacity: 0, y: 10, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="flex items-end gap-3 justify-start"
          >
            <div className="bg-white/8 border border-white/10 text-gray-100 rounded-2xl rounded-bl-none px-4 py-3 flex gap-1.5 items-center shadow-sm">
              {[0, 0.2, 0.4].map((delay, i) => (
                <motion.div
                  key={i}
                  animate={{ y: [0, -5, 0] }}
                  transition={{ repeat: Infinity, duration: 1, delay }}
                  className="w-2 h-2 bg-gray-400 rounded-full"
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
