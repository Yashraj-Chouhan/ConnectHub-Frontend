import { motion, AnimatePresence } from "framer-motion";
import { X, User, Mail, Globe, MapPin } from "lucide-react";
import { resolveAvatarUrl } from "@/lib/api";

export const UserProfileModal = ({ isOpen, onClose, user }) => {
  if (!isOpen || !user) {
    return null;
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            onClick={(e) => e.stopPropagation()}
            className="glass-dark rounded-3xl p-6 sm:p-8 w-full max-w-sm border border-white/10 shadow-2xl relative overflow-hidden"
          >
            {/* Dynamic background element */}
            <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-br from-primary/30 to-fuchsia-600/30 blur-2xl opacity-50 pointer-events-none" />

            <div className="relative z-10">
              <div className="flex items-start justify-between mb-2">
                <div />
                <button
                  onClick={onClose}
                  className="p-2 hover:bg-white/10 rounded-full transition-colors absolute -top-4 -right-4"
                >
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>

              <div className="flex flex-col items-center mb-6">
                <div className="relative">
                  <img
                    src={resolveAvatarUrl(user.avatar || user.avatarUrl) || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(user.fullName || user.username || "User")}`}
                    alt={user.fullName || user.username}
                    className="w-24 h-24 rounded-full border-4 border-black/40 object-cover shadow-xl"
                  />
                  <span
                    className={`absolute bottom-1 right-1 w-5 h-5 rounded-full border-2 border-black/40 ${
                      user.onlineStatus === "ONLINE" || user.online ? "bg-green-500" : "bg-gray-500"
                    }`}
                  />
                </div>
                <h2 className="text-2xl font-bold text-white mt-4 tracking-tight">
                  {user.fullName || user.name || user.username}
                </h2>
                <p className="text-primary font-medium text-sm">@{user.username}</p>
                <div className="flex items-center gap-2 mt-2 px-3 py-1 bg-white/5 rounded-full border border-white/10 text-xs text-gray-300">
                  <Globe className="w-3 h-3 text-gray-400" />
                  {user.preferredLanguage === "none" || !user.preferredLanguage
                    ? "Global"
                    : user.preferredLanguage.toUpperCase()}
                </div>
              </div>

              <div className="space-y-4">
                {user.bio ? (
                  <div className="p-4 bg-white/5 border border-white/10 rounded-2xl relative">
                    <p className="text-sm text-gray-300 leading-relaxed italic pr-2">"{user.bio}"</p>
                  </div>
                ) : (
                  <div className="p-4 bg-white/5 border border-white/10 rounded-2xl flex justify-center italic text-gray-500 text-sm">
                    No bio provided.
                  </div>
                )}
              </div>
              
              <button
                onClick={onClose}
                className="w-full mt-6 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl text-sm font-medium transition-colors"
              >
                Close Profile
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
