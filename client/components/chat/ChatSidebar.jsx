import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Plus, Settings, LogOut, Trash2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { api, SUPPORTED_TRANSLATION_LANGUAGES, normalizeTranslationLanguage } from '@/lib/api';
import { defaultAvatar } from '@/lib/chat';
import { getThemeForLanguage, getThemeLabel } from '@/lib/theme';
import { cn } from '@/lib/utils';
import { BuyCreditsModal } from './BuyCreditsModal';

export const ChatSidebar = ({
  conversations,
  contacts,
  selectedId,
  onSelectConversation,
  onStartDirectChat,
  onLogout,
  onCreateRoom,
  onEditProfile,
  onDeleteConversation,
}) => {
  const { user, refreshUser } = useAuth();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('chats');
  const [showMenu, setShowMenu] = useState(false);
  const [isBuyCreditsOpen, setIsBuyCreditsOpen] = useState(false);
  const [openContextId, setOpenContextId] = useState(null);
  const contextMenuRef = useRef(null);
  const remainingCredits = Number(user?.translationCreditsRemaining ?? 0);
  const preferredLanguageCode = normalizeTranslationLanguage(user?.preferredLanguage, "en");
  const preferredThemeLabel = getThemeLabel(getThemeForLanguage(user?.preferredLanguage, "coffee"));
  const preferredLanguageName =
    SUPPORTED_TRANSLATION_LANGUAGES.find((language) => language.code === preferredLanguageCode)?.name ||
    (preferredLanguageCode ? preferredLanguageCode.toUpperCase() : "English");

  const handleTopUpCredits = () => {
    if (!user?.userId) {
      return;
    }
    setIsBuyCreditsOpen(true);
  };

  // Deduplicate: for DIRECT rooms, keep only the first room per peer user.
  // This prevents the same contact showing up twice if two direct rooms exist.
  const deduplicatedConversations = (() => {
    const seenDirectPeers = new Set();
    return conversations.filter((conv) => {
      if (conv.isGroup) return true;
      // For direct chats, 'name' is the peer's display name and avatar acts as key
      // Use the conversation id-based avatar seed or a peer member to deduplicate
      const peerId = conv.members?.find(m => m.userId !== user?.userId)?.userId || conv.name;
      if (seenDirectPeers.has(peerId)) return false;
      seenDirectPeers.add(peerId);
      return true;
    });
  })();

  const filteredConversations = deduplicatedConversations.filter(
    (conv) =>
      conv.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      conv.lastMessage.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredContacts = (contacts || []).filter((c) =>
    (c.contactName && c.contactName.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (c.nickname && c.nickname.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (c.contactEmail && c.contactEmail.toLowerCase().includes(searchQuery.toLowerCase()))
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
              {user?.preferredLanguage
                ? `Translation: ${preferredLanguageName} · Theme: ${preferredThemeLabel}`
                : user?.email || "Set your language preference"}
            </p>
          </div>
        </motion.button>

        <div className="flex bg-white/5 rounded-xl p-1">
          <button
            onClick={() => setActiveTab('chats')}
            className={cn(
              "flex-1 py-1.5 text-xs font-medium rounded-lg transition-all",
              activeTab === 'chats' ? "bg-white/10 text-white shadow-sm" : "text-gray-400 hover:text-gray-200 hover:bg-white/5"
            )}
          >
            Chats
          </button>
          <button
            onClick={() => setActiveTab('contacts')}
            className={cn(
              "flex-1 py-1.5 text-xs font-medium rounded-lg transition-all",
              activeTab === 'contacts' ? "bg-white/10 text-white shadow-sm" : "text-gray-400 hover:text-gray-200 hover:bg-white/5"
            )}
          >
            Contacts
          </button>
        </div>
      </div>

      {/* User Profile Context / Mini Dashboard */}
      <div className="p-4 border-b border-white/10 space-y-4 bg-white/[0.02]">
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
              Buy Credits
            </motion.button>
          </div>
          <p className="text-[11px] text-gray-400">
            When the free balance is gone, users can recharge credits here.
          </p>
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-2 space-y-1.5">
          {activeTab === 'chats' ? (
            filteredConversations.length === 0 ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center py-10 text-gray-500"
              >
                <p className="text-sm">No conversations found</p>
              </motion.div>
            ) : (
              filteredConversations.map((conv, idx) => (
                <motion.div
                  key={conv.id}
                  initial={{ opacity: 0, x: -16 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.04 }}
                  className={cn(
                    'w-full p-3 rounded-xl transition-all flex items-center gap-3 group relative',
                    selectedId === conv.id
                      ? 'bg-primary/15 border border-primary/20'
                      : 'hover:bg-white/5 border border-transparent'
                  )}
                >
                  {/* Clickable area */}
                  <div
                    className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer"
                    onClick={() => { setOpenContextId(null); onSelectConversation(conv.id); }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setOpenContextId(null);
                        onSelectConversation(conv.id);
                      }
                    }}
                    role="button"
                    tabIndex={0}
                  >
                    {/* Avatar */}
                    <div className="relative flex-shrink-0">
                      <img
                        src={conv.avatar}
                        alt={conv.name}
                        className="w-11 h-11 rounded-full"
                      />
                      {conv.online && (
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
                  </div>

                  {/* Delete Context Menu Trigger */}
                  <div className="relative flex-shrink-0">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setOpenContextId(openContextId === conv.id ? null : conv.id);
                    }}
                    className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-white/10 rounded-lg transition-all"
                    title="More options"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-gray-400" />
                  </button>

                  <AnimatePresence>
                    {openContextId === conv.id && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: -4 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: -4 }}
                        className="absolute right-0 top-8 glass-dark border border-white/10 rounded-xl p-1.5 min-w-[160px] z-50 shadow-xl"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          onClick={() => {
                            setOpenContextId(null);
                            onDeleteConversation?.(conv.id);
                          }}
                          className="flex items-center gap-2.5 px-3 py-2 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors w-full text-left"
                        >
                          <Trash2 className="w-4 h-4" />
                          <span className="text-sm">Delete Chat</span>
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>
            ))
          )
        ) : filteredContacts.length === 0 ? (
          <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center py-10 text-gray-500"
              >
                <p className="text-sm">No saved contacts</p>
              </motion.div>
            ) : (
              filteredContacts.map((contact, idx) => (
                <motion.div
                  key={contact.contactId}
                  initial={{ opacity: 0, x: -16 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.04 }}
                  onClick={() => onStartDirectChat?.(contact)}
                  className="w-full p-3 rounded-xl transition-all flex items-center gap-3 group relative cursor-pointer hover:bg-white/5 border border-transparent"
                >
                  <div className="relative flex-shrink-0">
                    <img src={contact.avatarUrl || defaultAvatar(contact.contactName)} alt={contact.contactName} className="w-11 h-11 rounded-full object-cover" />
                  </div>
                  <div className="flex-1 min-w-0 text-left">
                    <p className="font-semibold text-white text-sm truncate">{contact.nickname || contact.contactName || "User"}</p>
                    <p className="text-xs text-gray-400 truncate mt-0.5">{contact.contactEmail}</p>
                  </div>
                </motion.div>
              ))
            )
          }
        </div>
      </div>

      <BuyCreditsModal
        isOpen={isBuyCreditsOpen}
        onClose={() => setIsBuyCreditsOpen(false)}
        user={user}
        onPaymentSuccess={() => {
          refreshUser?.(user?.userId).catch(() => {});
        }}
      />
    </div>
  );
};
