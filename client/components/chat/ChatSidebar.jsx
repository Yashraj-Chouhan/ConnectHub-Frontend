import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Plus, Settings, LogOut, MoreVertical } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

export const ChatSidebar = ({
  conversations,
  selectedId,
  onSelectConversation,
  onLogout,
  onCreateRoom,
  onEditProfile,
}) => {
  const { user, refreshUser } = useAuth();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [showMenu, setShowMenu] = useState(false);
  const remainingCredits = Number(user?.translationCreditsRemaining ?? 0);

  const handleTopUpCredits = async () => {
    if (!user?.userId) {
      return;
    }

    try {
      await api.auth.topUpTranslationCredits(user.userId, 50);
      await refreshUser?.(user.userId).catch(() => {});
      toast({
        title: 'Credits added',
        description: 'Your translation balance has been recharged.',
      });
    } catch (error) {
      toast({
        title: 'Could not add credits',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
    }
  };

  const filteredConversations = conversations.filter(
    (conv) =>
      conv.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      conv.lastMessage.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="w-full sm:w-80 glass-dark border-r border-white/10 flex flex-col h-full">
      {/* Header */}
      <div className="p-4 sm:p-5 border-b border-white/10 space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-white">Messages</h1>
          <div className="flex items-center gap-2">
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              onClick={onCreateRoom}
              className="w-9 h-9 rounded-full bg-primary/20 hover:bg-primary/30 flex items-center justify-center text-primary transition-all"
              title="New conversation"
            >
              <Plus className="w-4 h-4" />
            </motion.button>

            {/* Settings Menu */}
            <div className="relative">
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setShowMenu(!showMenu)}
                className="w-9 h-9 rounded-full bg-primary/20 hover:bg-primary/30 flex items-center justify-center text-primary transition-all"
                title="Settings"
              >
                <Settings className="w-4 h-4" />
              </motion.button>

              <AnimatePresence>
                {showMenu && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9, y: -4 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, y: -4 }}
                    className="absolute right-0 top-11 glass-dark border border-white/10 rounded-xl p-1.5 min-w-[160px] z-50 shadow-xl"
                  >
                    <button
                      onClick={() => { onEditProfile?.(); setShowMenu(false); }}
                      className="flex items-center gap-2.5 px-3 py-2 text-white hover:bg-white/10 rounded-lg transition-colors w-full text-left"
                    >
                      <Settings className="w-4 h-4 text-gray-400" />
                      <span className="text-sm">Profile & Settings</span>
                    </button>
                    <button
                      onClick={() => { onLogout(); setShowMenu(false); }}
                      className="flex items-center gap-2.5 px-3 py-2 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors w-full text-left"
                    >
                      <LogOut className="w-4 h-4" />
                      <span className="text-sm">Logout</span>
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="glass-input w-full pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary rounded-xl"
          />
        </div>

        {/* User Profile Chip */}
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={onEditProfile}
          className="w-full flex items-center gap-3 bg-white/5 hover:bg-white/10 px-3 py-2.5 rounded-xl transition-colors text-left border border-white/5"
        >
          <img
            src={user?.avatar || user?.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.username || user?.name || user?.fullName || "you"}`}
            alt={user?.fullName || user?.name || user?.username}
            className="w-9 h-9 rounded-full border border-white/20"
          />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white truncate">{user?.fullName || user?.name || user?.username || "You"}</p>
            <p className="text-xs text-gray-400 truncate">
              {user?.preferredLanguage ? `Translation: ${user.preferredLanguage.toUpperCase()}` : user?.email || "Set your language preference"}
            </p>
          </div>
        </motion.button>

        <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 space-y-2">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] uppercase tracking-[0.24em] text-gray-400">Translation credits</p>
              <p className={`text-sm font-semibold ${remainingCredits <= 0 ? 'text-red-300' : 'text-white'}`}>
                {remainingCredits <= 0 ? 'Limit reached' : `${remainingCredits} left`}
              </p>
            </div>
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={handleTopUpCredits}
              className="rounded-full bg-primary/20 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/30 transition-colors"
            >
              Top up 50
            </motion.button>
          </div>
          <p className="text-[11px] text-gray-400">
            When the free balance is gone, users can recharge credits here.
          </p>
        </div>
      </div>

      {/* Conversation List */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-2">
          {filteredConversations.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-10 text-gray-500"
            >
              <p className="text-sm">No conversations found</p>
            </motion.div>
          ) : (
            filteredConversations.map((conv, idx) => (
              <motion.button
                key={conv.id}
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.04 }}
                onClick={() => onSelectConversation(conv.id)}
                className={cn(
                  'w-full p-3 rounded-xl mb-1.5 transition-all flex items-center gap-3 group relative',
                  selectedId === conv.id
                    ? 'bg-primary/15 border border-primary/20'
                    : 'hover:bg-white/5 border border-transparent'
                )}
              >
                {/* Avatar */}
                <div className="relative flex-shrink-0">
                  <img
                    src={conv.avatar}
                    alt={conv.name}
                    className="w-11 h-11 rounded-full"
                  />
                  {conv.isOnline && (
                    <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-[#0a0e27]" />
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0 text-left">
                  <div className="flex items-baseline justify-between mb-0.5">
                    <p className="font-semibold text-white text-sm truncate">{conv.name}</p>
                    <span className="text-xs text-gray-500 ml-2 flex-shrink-0">{conv.timestamp}</span>
                  </div>
                  <p className="text-xs text-gray-400 truncate">{conv.lastMessage}</p>
                </div>

                {/* Unread Badge */}
                {conv.unread > 0 && (
                  <div className="w-5 h-5 bg-primary rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0 shadow-md shadow-primary/30">
                    {conv.unread}
                  </div>
                )}

                {/* More Options */}
                <button
                  onClick={(e) => e.stopPropagation()}
                  className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-white/10 rounded-lg transition-all"
                >
                  <MoreVertical className="w-3.5 h-3.5 text-gray-400" />
                </button>
              </motion.button>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
