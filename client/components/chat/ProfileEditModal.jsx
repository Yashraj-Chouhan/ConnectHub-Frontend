import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, User, Mail, Camera, Save, Globe } from "lucide-react";
import { SUPPORTED_TRANSLATION_LANGUAGES, normalizeTranslationLanguage } from "@/lib/api";

const SUPPORTED_LANGUAGES = [
  { code: "none", name: "Disable Translation" },
  ...SUPPORTED_TRANSLATION_LANGUAGES,
];

export const ProfileEditModal = ({ isOpen, onClose, user, onSaveProfile }) => {
  const [fullName, setFullName] = useState(user?.fullName || user?.name || user?.username || "");
  const [username, setUsername] = useState(user?.username || "");
  const [bio, setBio] = useState(user?.bio || "");
  const [avatarPreview, setAvatarPreview] = useState(user?.avatar || user?.avatarUrl || "");
  const [preferredLanguage, setPreferredLanguage] = useState(
    normalizeTranslationLanguage(user?.preferredLanguage, "en")
  );

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    setFullName(user?.fullName || user?.name || user?.username || "");
    setUsername(user?.username || "");
    setBio(user?.bio || "");
    setAvatarPreview(user?.avatar || user?.avatarUrl || "");
    setPreferredLanguage(normalizeTranslationLanguage(user?.preferredLanguage, "en"));
  }, [isOpen, user]);

  if (!isOpen) {
    return null;
  }

  const handleSave = async () => {
    await onSaveProfile?.({
      fullName: fullName.trim(),
      username: username.trim(),
      bio: bio.trim(),
      preferredLanguage: preferredLanguage === "none" ? "" : preferredLanguage,
    });
    onClose();
  };

  const selectedLang = SUPPORTED_LANGUAGES.find((lang) => lang.code === preferredLanguage);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            onClick={(e) => e.stopPropagation()}
            className="glass-dark rounded-3xl p-6 sm:p-8 w-full max-w-md max-h-[90vh] overflow-y-auto border border-white/10"
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-white">Edit Profile</h2>
              <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
                <X className="w-6 h-6 text-gray-400" />
              </button>
            </div>

            <div className="space-y-6">
              <div className="flex justify-center">
                <div className="relative">
                  <img
                    src={avatarPreview || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(fullName || username || "You")}`}
                    alt={fullName || username || "Profile"}
                    className="w-24 h-24 rounded-full border-2 border-primary/50 object-cover"
                  />
                  <button
                    type="button"
                    className="absolute bottom-0 right-0 w-8 h-8 bg-gradient-to-r from-primary to-secondary rounded-full flex items-center justify-center text-white shadow-lg"
                    title="Avatar changes are handled by the backend API"
                  >
                    <Camera className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-300 flex items-center gap-2">
                    <User className="w-4 h-4" />
                    Full name
                  </label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="glass-input w-full px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary rounded-xl"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-300 flex items-center gap-2">
                    <User className="w-4 h-4" />
                    Username
                  </label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="glass-input w-full px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary rounded-xl"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-300 flex items-center gap-2">
                    <Mail className="w-4 h-4" />
                    Email
                  </label>
                  <input
                    type="email"
                    value={user?.email || ""}
                    readOnly
                    className="glass-input w-full px-4 py-3 focus:outline-none rounded-xl opacity-70 cursor-not-allowed"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-300">Bio</label>
                  <textarea
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    placeholder="Tell people about yourself..."
                    className="glass-input w-full px-4 py-3 resize-none focus:outline-none focus:ring-2 focus:ring-primary rounded-xl"
                    rows={3}
                  />
                </div>

                <div className="space-y-2 pt-2 border-t border-white/10">
                  <label className="text-sm font-medium text-gray-300 flex items-center gap-2">
                    <Globe className="w-4 h-4 text-primary" />
                    Translation language
                  </label>
                  <p className="text-xs text-gray-500">
                    Messages in other languages will automatically translate to this language in real time.
                  </p>
                  <select
                    value={preferredLanguage}
                    onChange={(e) => setPreferredLanguage(e.target.value)}
                    className="glass-input w-full px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary rounded-xl bg-transparent appearance-none cursor-pointer"
                  >
                    {SUPPORTED_LANGUAGES.map((language) => (
                      <option key={language.code} value={language.code} className="bg-gray-900 text-white">
                        {language.name}
                      </option>
                    ))}
                  </select>
                  {preferredLanguage && preferredLanguage !== "none" && (
                    <div className="flex items-center gap-2 bg-primary/10 border border-primary/20 rounded-xl px-3 py-2 text-xs text-primary">
                      <Globe className="w-3 h-3" />
                      <span>Messages will be translated to {selectedLang?.name || preferredLanguage}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex gap-3">
                <button onClick={onClose} className="glass-button-secondary flex-1">
                  Cancel
                </button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleSave}
                  disabled={!username.trim() || !fullName.trim()}
                  className="glass-button-primary flex-1 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  <Save className="w-5 h-5" />
                  Save Changes
                </motion.button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
