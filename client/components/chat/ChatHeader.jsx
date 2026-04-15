import { useState, useRef, useEffect } from 'react';
import { Phone, Video, Info, MoreVertical, Trash2, XCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export const ChatHeader = ({ name, avatar, isOnline, isGroup, onGroupSettings, onDeleteChat, onClearChat }) => {
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setShowMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="glass-dark border-b border-white/10 px-4 sm:px-6 py-3.5 flex items-center justify-between">
      {/* Left: Avatar + Name */}
      <div className="flex items-center gap-3">
        <div className="relative">
          <img src={avatar} alt={name} className="w-10 h-10 rounded-full" />
          {isOnline && (
            <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-[#0a0e27]" />
          )}
        </div>
        <div>
          <h2 className="text-base font-semibold text-white leading-tight">{name}</h2>
          <p className="text-xs text-gray-400">
            {isOnline ? '🟢 Active now' : 'Last seen 2h ago'}
          </p>
        </div>
      </div>

      {/* Right: Action Buttons */}
      <div className="flex items-center gap-1.5">
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
          className="w-9 h-9 rounded-full bg-primary/15 hover:bg-primary/25 flex items-center justify-center text-primary transition-all"
          title="Voice call"
        >
          <Phone className="w-4 h-4" />
        </motion.button>

        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
          className="w-9 h-9 rounded-full bg-primary/15 hover:bg-primary/25 flex items-center justify-center text-primary transition-all"
          title="Video call"
        >
          <Video className="w-4 h-4" />
        </motion.button>

        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
          onClick={isGroup ? onGroupSettings : undefined}
          className="w-9 h-9 rounded-full bg-primary/15 hover:bg-primary/25 flex items-center justify-center text-primary transition-all"
          title={isGroup ? 'Group settings' : 'Info'}
        >
          <Info className="w-4 h-4" />
        </motion.button>

        {/* More Menu */}
        <div className="relative" ref={menuRef}>
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowMenu(!showMenu)}
            className="w-9 h-9 rounded-full hover:bg-white/10 flex items-center justify-center text-gray-400 hover:text-white transition-all"
          >
            <MoreVertical className="w-4 h-4" />
          </motion.button>

          <AnimatePresence>
            {showMenu && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: -4 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: -4 }}
                transition={{ duration: 0.12 }}
                className="absolute right-0 top-11 glass-dark border border-white/10 rounded-xl p-1.5 min-w-[180px] z-50 shadow-xl"
              >
                {isGroup && (
                  <button
                    onClick={() => { setShowMenu(false); onGroupSettings?.(); }}
                    className="flex items-center gap-3 px-3 py-2.5 text-white hover:bg-white/10 rounded-lg transition-colors w-full text-left"
                  >
                    <Info className="w-4 h-4 text-gray-400" />
                    <span className="text-sm">Group Info</span>
                  </button>
                )}
                <button
                  onClick={() => { setShowMenu(false); onClearChat?.(); }}
                  className="flex items-center gap-3 px-3 py-2.5 text-white hover:bg-white/10 rounded-lg transition-colors w-full text-left"
                >
                  <XCircle className="w-4 h-4 text-gray-400" />
                  <span className="text-sm">Clear Chat</span>
                </button>
                <div className="h-px bg-white/10 mx-2 my-1" />
                <button
                  onClick={() => { setShowMenu(false); onDeleteChat?.(); }}
                  className="flex items-center gap-3 px-3 py-2.5 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors w-full text-left"
                >
                  <Trash2 className="w-4 h-4" />
                  <span className="text-sm">Delete Chat</span>
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};
