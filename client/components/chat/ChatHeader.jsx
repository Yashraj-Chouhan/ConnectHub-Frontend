import { useState, useRef, useEffect } from 'react';
import { Info, LogOut, Settings, Trash2, XCircle, ArrowLeft, Tag, Video } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export const ChatHeader = ({
  name, avatar, isOnline, isGroup, isAdmin,
  onGroupSettings, onDeleteChat, onLeaveGroup, onClearChat,
  onSetNickname, onBack, onAvatarClick, onNameClick, onStartVideoCall,
}) => {
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

  // Decide which bottom action to show and what label/icon to use.
  // Direct chat  → "Remove Chat"  (any member, calls onDeleteChat which uses leave API)
  // Group admin  → "Delete Group" (calls onDeleteChat)
  // Group member → "Leave Group"  (calls onLeaveGroup)
  const bottomAction = (() => {
    if (!isGroup) {
      return { label: 'Remove Chat', icon: Trash2, handler: onDeleteChat, danger: true };
    }
    if (isAdmin) {
      return { label: 'Delete Group', icon: Trash2, handler: onDeleteChat, danger: true };
    }
    return { label: 'Leave Group', icon: LogOut, handler: onLeaveGroup, danger: true };
  })();

  return (
    <div className="flex-none glass-dark border-b border-white/10 px-4 sm:px-6 py-3.5 flex items-center justify-between">
      {/* Left: Avatar + Name */}
      <div className="flex items-center gap-2 sm:gap-3">
        {onBack && (
          <button
            onClick={onBack}
            className="sm:hidden p-2 -ml-2 mr-1 hover:bg-white/10 rounded-full text-white transition-colors"
            title="Back to conversations"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
        )}
        <div className={`relative ${onAvatarClick ? 'cursor-pointer' : ''}`} onClick={() => onAvatarClick?.()}>
          <img src={avatar} alt={name} className="w-10 h-10 rounded-full" />
          {isOnline && (
            <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-[#0a0e27]" />
          )}
        </div>
        <div
          className={onNameClick ? 'cursor-pointer hover:opacity-80 transition-opacity' : ''}
          onClick={() => onNameClick?.()}
        >
          <h2 className="text-base font-semibold text-white leading-tight">{name}</h2>
          <p className="text-xs text-gray-400">
            {isOnline ? '🟢 Active now' : 'Last seen recently'}
          </p>
        </div>
      </div>

      {/* Right: Settings menu */}
      <div className="flex items-center gap-1.5">
        {!isGroup && onStartVideoCall && (
          <motion.button
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.95 }}
            onClick={onStartVideoCall}
            className="w-9 h-9 rounded-full hover:bg-white/10 flex items-center justify-center text-gray-400 hover:text-white transition-all"
            title="Start video call"
          >
            <Video className="w-5 h-5" />
          </motion.button>
        )}
        <div className="relative" ref={menuRef}>
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowMenu(!showMenu)}
            className="w-9 h-9 rounded-full hover:bg-white/10 flex items-center justify-center text-gray-400 hover:text-white transition-all"
            title="Chat Settings"
          >
            <Settings className="w-5 h-5" />
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
                {!isGroup && onSetNickname && (
                  <button
                    onClick={() => { setShowMenu(false); onSetNickname(); }}
                    className="flex items-center gap-3 px-3 py-2.5 text-white hover:bg-white/10 rounded-lg transition-colors w-full text-left"
                  >
                    <Tag className="w-4 h-4 text-gray-400" />
                    <span className="text-sm">Set Nickname</span>
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

                {/* Bottom action differs by role / chat type */}
                <button
                  onClick={() => { setShowMenu(false); bottomAction.handler?.(); }}
                  className="flex items-center gap-3 px-3 py-2.5 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors w-full text-left"
                >
                  <bottomAction.icon className="w-4 h-4" />
                  <span className="text-sm">{bottomAction.label}</span>
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};
