import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Plus, Trash2, Shield, User, Search, Crown } from "lucide-react";
import { api, resolveAvatarUrl } from "@/lib/api";

export const GroupManagementModal = ({ isOpen, onClose, roomId, groupName, members, currentUserId, createdBy, onUpdateGroup, onLeaveGroup, onDeleteGroup }) => {
  const [editedName, setEditedName] = useState(groupName);
  const [groupMembers, setGroupMembers] = useState(members);
  const [showAddMembers, setShowAddMembers] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [availableUsers, setAvailableUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setEditedName(groupName);
      setGroupMembers(members);
    }
  }, [isOpen, groupName, members]);

  useEffect(() => {
    if (!isOpen || !showAddMembers) {
      return undefined;
    }

    let cancelled = false;
    if (!searchQuery.trim()) {
      setAvailableUsers([]);
      return undefined;
    }

    const timer = setTimeout(async () => {
      setLoadingUsers(true);
      try {
        const results = await api.auth.searchUsers(searchQuery.trim());
        if (!cancelled) {
          setAvailableUsers(Array.isArray(results) ? results : []);
        }
      } catch {
        if (!cancelled) {
          setAvailableUsers([]);
        }
      } finally {
        if (!cancelled) {
          setLoadingUsers(false);
        }
      }
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [isOpen, showAddMembers, searchQuery]);

  const isAdmin = useMemo(
    () => {
      if (!currentUserId) return false;
      // Creator is always treated as admin even if the role field hasn't loaded yet.
      if (createdBy && currentUserId === createdBy) return true;
      return groupMembers.some(
        (member) =>
          (member.userId || member.id) === currentUserId &&
          String(member.role || "").toLowerCase() === "admin"
      );
    },
    [groupMembers, currentUserId, createdBy]
  );

  const handleRemoveMember = (memberId) => {
    setGroupMembers((prev) => prev.filter((member) => (member.userId || member.id) !== memberId));
  };

  const handleAddMember = (user) => {
    const userId = user.userId || user.id;
    const displayName = (user.fullName || user.username || user.email || "").trim() || "User";
    if (!userId || groupMembers.some((member) => (member.userId || member.id) === userId)) {
      return;
    }

    setGroupMembers((prev) => [
      ...prev,
      {
        id: userId,
        userId,
        name: displayName,
        avatar: resolveAvatarUrl(user.avatarUrl) || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(displayName)}`,
        role: "member",
      },
    ]);
    setShowAddMembers(false);
    setSearchQuery("");
  };

  const handleToggleAdmin = (memberId) => {
    setGroupMembers((prev) =>
      prev.map((member) => {
        const id = member.userId || member.id;
        if (id !== memberId) {
          return member;
        }
        return {
          ...member,
          role: member.role === "admin" ? "member" : "admin",
        };
      })
    );
  };

  const handleSave = () => {
    onUpdateGroup?.({
      name: editedName,
      members: groupMembers,
    });
    onClose();
  };

  if (!isOpen) {
    return null;
  }

  const memberCount = groupMembers.length;

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
            className="glass-dark rounded-3xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto border border-white/10"
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-white">Group Settings</h2>
              <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            <div className="space-y-5">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-300">Group Name</label>
                <input
                  type="text"
                  value={editedName}
                  onChange={(e) => setEditedName(e.target.value)}
                  disabled={!isAdmin}
                  className="glass-input w-full px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-40 disabled:cursor-not-allowed rounded-xl"
                />
                {!isAdmin && <p className="text-xs text-gray-500">Only admins can change the group name</p>}
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-gray-300">Members ({memberCount})</label>
                  {isAdmin && (
                    <motion.button
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => setShowAddMembers((prev) => !prev)}
                      className="p-1.5 bg-primary/20 hover:bg-primary/30 rounded-lg text-primary transition-all"
                    >
                      <Plus className="w-4 h-4" />
                    </motion.button>
                  )}
                </div>

                <AnimatePresence>
                  {showAddMembers && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="space-y-2 bg-white/5 p-3 rounded-xl border border-white/10"
                    >
                      <p className="text-xs font-medium text-gray-400 mb-1">Search users to add</p>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                        <input
                          type="text"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          placeholder="Search by name, email, or phone..."
                          className="glass-input w-full pl-9 pr-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary rounded-lg"
                        />
                      </div>

                      {loadingUsers ? (
                        <p className="text-xs text-gray-500">Loading users...</p>
                      ) : searchQuery.trim() && availableUsers.length === 0 ? (
                        <p className="text-xs text-gray-500">No users found</p>
                      ) : (
                        <div className="space-y-1 max-h-40 overflow-y-auto">
                          {availableUsers
                            .filter((user) => {
                              const userId = user.userId || user.id;
                              return (
                                userId &&
                                userId !== currentUserId &&
                                !groupMembers.some((member) => (member.userId || member.id) === userId)
                              );
                            })
                            .map((user, idx) => {
                              const userId = user.userId || user.id;
                              const displayName = (user.fullName || user.username || user.email || "").trim() || "User";
                              const avatar = resolveAvatarUrl(user.avatarUrl) || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(displayName)}`;

                              return (
                                <motion.button
                                  key={userId}
                                  initial={{ opacity: 0, x: -16 }}
                                  animate={{ opacity: 1, x: 0 }}
                                  transition={{ delay: idx * 0.03 }}
                                  onClick={() => handleAddMember(user)}
                                  className="w-full p-2 flex items-center gap-3 hover:bg-white/10 rounded-lg transition-colors"
                                >
                                  <img src={avatar} alt={displayName} className="w-8 h-8 rounded-full object-cover" />
                                  <span className="text-sm text-white flex-1 text-left">{displayName}</span>
                                  <Plus className="w-3.5 h-3.5 text-primary" />
                                </motion.button>
                              );
                            })}
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="space-y-2 max-h-56 overflow-y-auto">
                  {groupMembers.map((member) => {
                    const memberId = member.userId || member.id;
                    return (
                      <motion.div
                        layout
                        key={memberId}
                        className="p-3 bg-white/5 rounded-xl flex items-center gap-3 hover:bg-white/8 transition-colors group border border-white/5"
                      >
                        <img
                          src={resolveAvatarUrl(member.avatar) || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(member.name || member.username || memberId)}`}
                          alt={member.name || member.username || "Member"}
                          className="w-9 h-9 rounded-full object-cover flex-shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-white truncate">{member.name || member.username || member.email || "Member"}</p>
                          <p className="text-xs text-gray-400 capitalize">{member.role}</p>
                        </div>

                        {member.role === "admin" && (
                          <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full border border-primary/20 flex items-center gap-1">
                            <Crown className="w-3 h-3" />
                            Admin
                          </span>
                        )}

                        {isAdmin && memberId !== currentUserId && (
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <motion.button
                              whileHover={{ scale: 1.1 }}
                              onClick={() => handleToggleAdmin(memberId)}
                              title={member.role === "admin" ? "Demote" : "Make admin"}
                              className="p-1.5 hover:bg-primary/20 rounded-lg text-gray-400 hover:text-primary transition-colors"
                            >
                              {member.role === "admin" ? <Shield className="w-3.5 h-3.5" /> : <User className="w-3.5 h-3.5" />}
                            </motion.button>
                            <motion.button
                              whileHover={{ scale: 1.1 }}
                              onClick={() => handleRemoveMember(memberId)}
                              className="p-1.5 hover:bg-red-500/20 rounded-lg text-gray-400 hover:text-red-400 transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </motion.button>
                          </div>
                        )}
                      </motion.div>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-3 pt-2">
                <div className="flex gap-3">
                  <button onClick={onClose} className="glass-button-secondary flex-1">
                    Cancel
                  </button>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleSave}
                    className="glass-button-primary flex-1"
                  >
                    Save Changes
                  </motion.button>
                </div>

                <div className="grid gap-2">
                  {onLeaveGroup && (
                    <button
                      onClick={() => onLeaveGroup?.(roomId)}
                      className="w-full py-2.5 rounded-xl glass glass-hover text-sm text-destructive flex items-center justify-center gap-2"
                    >
                      Leave Group
                    </button>
                  )}
                  {onDeleteGroup && isAdmin && (
                    <button
                      onClick={() => onDeleteGroup?.(roomId)}
                      className="w-full py-2.5 rounded-xl glass glass-hover text-sm text-destructive flex items-center justify-center gap-2"
                    >
                      Delete Group
                    </button>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
