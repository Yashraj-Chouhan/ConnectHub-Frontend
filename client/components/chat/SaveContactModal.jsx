import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { User, X, Mail, Tag } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { getDisplayName } from "@/lib/chat";

export const SaveContactModal = ({ isOpen, onClose, userProfile, currentNickname, onSaved }) => {
  const { user } = useAuth();
  const [nickname, setNickname] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (isOpen) {
      setNickname(currentNickname || "");
      setError("");
      setIsSaving(false);
    }
  }, [isOpen, currentNickname]);

  if (!isOpen || !userProfile) {
    return null;
  }

  const handleSave = async (e) => {
    e.preventDefault();
    if (!user?.userId) return;

    setIsSaving(true);
    setError("");

    try {
      const email = userProfile.email || "";
      if (!email) {
        throw new Error("Cannot save contact without an email address.");
      }

      await api.contacts.save(user.userId, { 
        email: email, 
        nickname: nickname.trim() || null 
      });
      
      onSaved?.();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save contact nickname.");
      setIsSaving(false);
    }
  };

  const displayName = getDisplayName(userProfile);

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
            className="glass-dark rounded-3xl p-6 w-full max-w-sm overflow-hidden border border-white/10"
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-white">Contact Settings</h2>
              <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            <div className="flex flex-col items-center gap-3 mb-6">
              <img
                src={userProfile.avatar}
                alt={displayName}
                className="w-20 h-20 rounded-full object-cover border-4 border-white/5"
              />
              <div className="text-center">
                <h3 className="font-semibold text-white">{displayName}</h3>
                <p className="text-sm text-gray-400">{userProfile.email}</p>
              </div>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-300 flex items-center gap-2">
                  <Tag className="w-4 h-4" />
                  Nickname
                </label>
                <input
                  type="text"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  placeholder="Set a local nickname..."
                  className="glass-input w-full px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary rounded-xl text-sm"
                  autoFocus
                />
                <p className="text-[11px] text-gray-500">
                  This nickname will only be visible to you. Leave blank to clear.
                </p>
              </div>

              {error && <p className="text-sm text-red-400 font-medium">{error}</p>}

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={onClose} className="glass-button-secondary flex-1">
                  Cancel
                </button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  type="submit"
                  disabled={isSaving}
                  className="glass-button-primary flex-1 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {isSaving ? "Saving..." : "Save"}
                </motion.button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
