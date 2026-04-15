import { useState, useRef, useEffect } from 'react';
import { Send, Paperclip, Mic, X, SmilePlus } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import EmojiPicker from 'emoji-picker-react';

export const MessageInput = ({ onSendMessage, replyingToMessage, onCancelReply, onTyping }) => {
  const [message, setMessage] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [sharedFiles, setSharedFiles] = useState([]);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);
  const pickerRef = useRef(null);
  const typingTimerRef = useRef(null);

  // Close emoji picker on click outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (pickerRef.current && !pickerRef.current.contains(event.target)) {
        setShowEmojiPicker(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + 'px';
    }
  }, [message]);

  useEffect(() => () => {
    if (typingTimerRef.current) {
      clearTimeout(typingTimerRef.current);
    }
  }, []);

  const handleSendMessage = () => {
    if (message.trim() || sharedFiles.length > 0) {
      onSendMessage(message, sharedFiles.length > 0 ? sharedFiles.map((f) => f.file) : undefined);
      setMessage('');
      setSharedFiles([]);
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    }
  };

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files || []);
    files.forEach((file) => {
      const fileSize = file.size < 1024 ? `${file.size}B` : `${(file.size / 1024).toFixed(2)}KB`;
      setSharedFiles((prev) => [
        ...prev,
        {
          id: Math.random().toString(),
          name: file.name,
          size: fileSize,
          file,
          type: file.type,
          previewUrl: file.type.startsWith('image/') ? URL.createObjectURL(file) : null,
        },
      ]);
    });
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleRemoveFile = (fileId) => {
    setSharedFiles((prev) => prev.filter((f) => f.id !== fileId));
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleEmojiClick = (emojiObject) => {
    setMessage((prevMsg) => prevMsg + emojiObject.emoji);
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

  return (
    <div className="glass-dark border-t border-white/10 p-3 sm:p-4 relative">
      <input
        ref={fileInputRef}
        type="file"
        multiple
        onChange={handleFileSelect}
        className="hidden"
      />

      {/* Reply Preview */}
      <AnimatePresence>
        {replyingToMessage && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="flex items-center gap-3 bg-white/5 px-3 py-2.5 border-l-4 border-primary rounded-r-xl mb-3 border border-white/10"
          >
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-primary mb-0.5">{replyingToMessage.senderName}</p>
              <p className="text-xs text-gray-400 truncate">{replyingToMessage.text}</p>
            </div>
            <button
              onClick={onCancelReply}
              className="p-1 hover:bg-white/10 rounded-full text-gray-500 hover:text-white transition-colors flex-shrink-0"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* File Preview Row */}
      <AnimatePresence>
        {sharedFiles.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="flex flex-wrap gap-2 mb-3"
          >
            {sharedFiles.map((file) => (
              <motion.div
                key={file.id}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                className="relative group"
              >
                {file.previewUrl ? (
                  <img
                    src={file.previewUrl}
                    alt={file.name}
                    className="w-16 h-16 rounded-lg object-cover border border-white/20"
                  />
                ) : (
                  <div className="flex items-center gap-2 bg-white/10 px-3 py-2 rounded-lg border border-white/10 text-xs text-gray-300 max-w-[180px]">
                    <svg className="w-4 h-4 flex-shrink-0 text-primary" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4V5h12v10z" />
                    </svg>
                    <span className="truncate font-medium">{file.name}</span>
                  </div>
                )}
                <button
                  onClick={() => handleRemoveFile(file.id)}
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity shadow-md"
                >
                  <X className="w-3 h-3" />
                </button>
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input Row */}
      <div className="flex items-end gap-2">
        {/* Attachment button */}
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => fileInputRef.current?.click()}
          className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-gray-400 hover:text-white transition-all flex-shrink-0"
          title="Attach file"
        >
          <Paperclip className="w-4 h-4" />
        </motion.button>

        {/* Emoji button */}
        <div className="relative" ref={pickerRef}>
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-gray-400 hover:text-white transition-all flex-shrink-0"
            title="Emoji"
          >
            <SmilePlus className="w-4 h-4" />
          </motion.button>
          
          <AnimatePresence>
            {showEmojiPicker && (
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                className="absolute bottom-12 left-0 z-50 shadow-2xl rounded-2xl overflow-hidden border border-white/10"
              >
                <EmojiPicker
                  onEmojiClick={handleEmojiClick}
                  theme="dark"
                  searchDisabled={false}
                  skinTonesDisabled
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Textarea */}
        <div className="flex-1">
            <textarea
            ref={textareaRef}
            value={message}
            onChange={(e) => handleMessageChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            className="glass-input w-full px-4 py-2.5 resize-none focus:outline-none focus:ring-2 focus:ring-primary rounded-2xl min-h-[40px] max-h-32 text-sm"
            rows={1}
          />
        </div>

        {/* Send / Mic button */}
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
              className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white flex-shrink-0 hover:shadow-lg hover:shadow-primary/40 transition-all"
            >
              <Send className="w-4 h-4" />
            </motion.button>
          ) : (
            <motion.button
              key="mic"
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.6, opacity: 0 }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setIsRecording(!isRecording)}
              className={`w-10 h-10 rounded-full flex items-center justify-center text-white flex-shrink-0 transition-all ${
                isRecording
                  ? 'bg-red-500 animate-pulse shadow-lg shadow-red-500/40'
                  : 'bg-gradient-to-br from-primary to-secondary hover:shadow-lg hover:shadow-primary/40'
              }`}
            >
              <Mic className="w-4 h-4" />
            </motion.button>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
