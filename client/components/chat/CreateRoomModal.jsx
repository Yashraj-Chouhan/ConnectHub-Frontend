import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Mail, Plus, Search, Trash2, Users, X } from "lucide-react";
import { api, resolveAvatarUrl } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { normalizeUserSummary } from "@/lib/chat";

const isValidEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

const toContactUser = (contact) => {
  if (!contact?.registered || !contact.contactUserId) {
    return null;
  }

  return normalizeUserSummary({
    userId: contact.contactUserId,
    id: contact.contactUserId,
    username: contact.username || "",
    fullName: contact.fullName || contact.nickname || contact.contactEmail,
    email: contact.contactEmail || "",
    avatarUrl: resolveAvatarUrl(contact.avatarUrl) || "",
    bio: contact.bio || "",
    preferredLanguage: contact.preferredLanguage || null,
    onlineStatus: contact.onlineStatus || "OFFLINE",
    lastSeenAt: contact.lastSeenAt || null,
    role: "USER",
  });
};

const contactDisplayName = (contact) => contact?.nickname || contact?.fullName || contact?.username || contact?.contactEmail || "Contact";

export const CreateRoomModal = ({ isOpen, onClose, onCreateRoom }) => {
  const [roomName, setRoomName] = useState("");
  const [isGroup, setIsGroup] = useState(false);
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [availableUsers, setAvailableUsers] = useState([]);
  const [resolvedDirectUser, setResolvedDirectUser] = useState(null);
  const [savedContacts, setSavedContacts] = useState([]);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [savingContact, setSavingContact] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [error, setError] = useState("");
  const [contactMessage, setContactMessage] = useState("");
  const { user } = useAuth();

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    let cancelled = false;
    setError("");

    if (!searchQuery.trim()) {
      setAvailableUsers([]);
      setResolvedDirectUser(null);
      if (!isGroup) {
        setSelectedMembers([]);
      }
      return undefined;
    }

    const timer = setTimeout(async () => {
      setLoadingUsers(true);
      try {
        if (isGroup) {
          const results = await api.auth.searchUsers(searchQuery.trim());
          if (!cancelled) {
            setAvailableUsers(
              (Array.isArray(results) ? results : []).filter((candidate) => {
                const candidateId = candidate.userId || candidate.id;
                return candidateId !== user?.userId;
              })
            );
            setResolvedDirectUser(null);
          }
          return;
        }

        const query = searchQuery.trim();
        const results = await api.auth.searchUsers(query);
        const candidates = (Array.isArray(results) ? results : []).filter((candidate) => {
          const candidateId = candidate.userId || candidate.id;
          return candidateId !== user?.userId;
        });

        if (!cancelled) {
          setAvailableUsers(candidates);

          if (candidates.length === 0) {
            setResolvedDirectUser(null);
            setSelectedMembers([]);
            setRoomName("");
            setError("No registered user found for that email or username.");
            return;
          }

          const lowerQuery = query.toLowerCase();
          const exactMatch = candidates.find((candidate) => {
            const fields = [candidate.email, candidate.username, candidate.fullName]
              .filter(Boolean)
              .map((value) => String(value).trim().toLowerCase());
            return fields.includes(lowerQuery);
          });
          const selectedCandidate = exactMatch || (candidates.length === 1 ? candidates[0] : null);

          if (selectedCandidate) {
            const candidateId = selectedCandidate.userId || selectedCandidate.id;
            const normalizedCandidate = {
              ...selectedCandidate,
              userId: candidateId,
              id: candidateId,
            };

            setResolvedDirectUser(normalizedCandidate);
            setSelectedMembers([candidateId]);
            setRoomName((normalizedCandidate.fullName || normalizedCandidate.username || normalizedCandidate.email || "").trim());
            setError("");
            return;
          }

          setResolvedDirectUser(null);
          setSelectedMembers([]);
          setError("");
        }
      } catch (err) {
        if (!cancelled) {
          setAvailableUsers([]);
          setResolvedDirectUser(null);
          const message = err instanceof Error ? err.message : "";
          if (isGroup) {
            setError(message || "Could not load users.");
          } else {
            setSelectedMembers([]);
            setError(message || "Could not load users.");
          }
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
  }, [isOpen, isGroup, searchQuery, user?.userId]);

  useEffect(() => {
    if (!isOpen || !user?.userId) {
      return undefined;
    }

    let cancelled = false;
    setLoadingContacts(true);

    (async () => {
      try {
        const results = await api.contacts.list(user.userId);
        if (!cancelled) {
          setSavedContacts(Array.isArray(results) ? results : []);
        }
      } catch {
        if (!cancelled) {
          setSavedContacts([]);
        }
      } finally {
        if (!cancelled) {
          setLoadingContacts(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isOpen, user?.userId]);

  useEffect(() => {
    if (!isOpen) {
      setRoomName("");
      setIsGroup(false);
      setSelectedMembers([]);
      setSearchQuery("");
      setAvailableUsers([]);
      setResolvedDirectUser(null);
      setError("");
      setContactMessage("");
      setLoadingUsers(false);
      setLoadingContacts(false);
      setSavingContact(false);
    }
  }, [isOpen]);

  const selectedUsers = useMemo(
    () => availableUsers.filter((user) => selectedMembers.includes(user.userId || user.id)),
    [availableUsers, selectedMembers]
  );

  const trimmedSearch = searchQuery.trim();
  const normalizedSearch = trimmedSearch.toLowerCase();
  const exactSavedContact = useMemo(
    () =>
      savedContacts.find((contact) => {
        const haystacks = [contact.contactEmail, contact.username, contact.nickname, contact.fullName]
          .filter(Boolean)
          .map((value) => String(value).toLowerCase());
        return haystacks.includes(normalizedSearch);
      }) || null,
    [savedContacts, normalizedSearch]
  );

  const filteredSavedContacts = useMemo(() => {
    if (!trimmedSearch) {
      return savedContacts;
    }

    return savedContacts.filter((contact) => {
      const haystacks = [contact.nickname, contact.fullName, contact.username, contact.contactEmail]
        .filter(Boolean)
        .map((value) => String(value).toLowerCase());
      return haystacks.some((value) => value.includes(normalizedSearch));
    });
  }, [savedContacts, normalizedSearch, trimmedSearch]);

  const canSaveContact =
    !isGroup &&
    Boolean(user?.userId) &&
    isValidEmail(trimmedSearch) &&
    user?.email?.toLowerCase() !== normalizedSearch &&
    !exactSavedContact;

  const toggleMember = (memberId, displayName) => {
    if (isGroup) {
      setSelectedMembers((prev) => (prev.includes(memberId) ? prev.filter((id) => id !== memberId) : [...prev, memberId]));
      return;
    }

    const isAlreadySelected = selectedMembers.includes(memberId);
    setRoomName(displayName || "");
    if (isAlreadySelected) {
      setSelectedMembers([]);
      setResolvedDirectUser(null);
      return;
    }

    const matchedUser = availableUsers.find((candidate) => String(candidate.userId || candidate.id) === String(memberId)) || null;
    setResolvedDirectUser(matchedUser);
    setSelectedMembers([memberId]);
  };

  const handleSaveContact = async () => {
    if (!user?.userId) return;
    if (!canSaveContact) {
      setError("Enter a valid email address to save as a contact.");
      return;
    }

    setSavingContact(true);
    setError("");
    setContactMessage("");
    try {
      const saved = await api.contacts.save(user.userId, { email: trimmedSearch });
      setSavedContacts((prev) => {
        const next = prev.filter((contact) => contact.contactId !== saved.contactId);
        return [saved, ...next];
      });

      setContactMessage("Contact saved.");
      if (saved.registered && saved.contactUserId) {
        const candidate = toContactUser(saved);
        if (candidate) {
          setAvailableUsers([candidate]);
          setResolvedDirectUser(candidate);
          setSelectedMembers([candidate.userId]);
          setRoomName(candidate.fullName || candidate.username || candidate.email || "");
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save contact.");
    } finally {
      setSavingContact(false);
    }
  };

  const handlePickSavedContact = (contact) => {
    const email = contact?.contactEmail || "";
    setSearchQuery(contact?.username || email);
    setError("");
    setContactMessage("");

    if (!contact?.registered || !contact?.contactUserId) {
      setAvailableUsers([]);
      setResolvedDirectUser(null);
      setSelectedMembers([]);
      setRoomName(contactDisplayName(contact));
      setError("This contact is not registered yet.");
      return;
    }

    const candidate = toContactUser(contact);
    if (!candidate) {
      return;
    }

    setAvailableUsers([candidate]);
    setResolvedDirectUser(candidate);
    setSelectedMembers([candidate.userId]);
    setRoomName(candidate.fullName || candidate.username || candidate.email || "");
  };

  const handleDeleteContact = async (contactId) => {
    if (!user?.userId || !contactId) return;

    try {
      await api.contacts.delete(user.userId, contactId);
      setSavedContacts((prev) => prev.filter((contact) => contact.contactId !== contactId));
      if (exactSavedContact?.contactId === contactId) {
        setContactMessage("");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete contact.");
    }
  };

  const handleCreateRoom = () => {
    const directMemberId = selectedMembers[0] || resolvedDirectUser?.userId || resolvedDirectUser?.id;
    const directDisplayName =
      selectedUsers[0]?.fullName ||
      selectedUsers[0]?.username ||
      selectedUsers[0]?.email ||
      resolvedDirectUser?.fullName ||
      resolvedDirectUser?.username ||
      resolvedDirectUser?.email ||
      searchQuery.trim() ||
      "Direct Chat";
    const normalizedRoomName = roomName.trim() || directDisplayName;

    if (!isGroup && !directMemberId) {
      setError("Enter a registered email address to start a direct chat.");
      return;
    }

    if (isGroup && (!roomName.trim() || selectedMembers.length === 0)) {
      setError("Group name and at least one member are required.");
      return;
    }

    onCreateRoom?.({
      name: isGroup ? roomName.trim() : normalizedRoomName,
      isGroup,
      memberUserIds: isGroup ? selectedMembers : [directMemberId],
      members: selectedUsers,
    });

    setRoomName("");
    setIsGroup(false);
    setSelectedMembers([]);
    setSearchQuery("");
    setAvailableUsers([]);
    setError("");
    onClose();
  };

  if (!isOpen) {
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
            className="glass-dark rounded-3xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto border border-white/10"
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-white">New Conversation</h2>
              <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => {
                    setIsGroup(false);
                    setSelectedMembers([]);
                    setRoomName("");
                    setResolvedDirectUser(null);
                    setError("");
                  }}
                  className={`p-4 rounded-xl border-2 transition-all text-left ${
                    !isGroup
                      ? "bg-primary/15 border-primary shadow-lg shadow-primary/10"
                      : "bg-white/5 border-white/10 hover:border-white/25"
                  }`}
                >
                  <p className="font-semibold text-white text-sm">Direct Message</p>
                  <p className="text-xs text-gray-400 mt-0.5">Start with a registered email</p>
                </button>
                <button
                  onClick={() => {
                    setIsGroup(true);
                    setSelectedMembers([]);
                    setRoomName("");
                    setError("");
                  }}
                  className={`p-4 rounded-xl border-2 transition-all text-left ${
                    isGroup
                      ? "bg-primary/15 border-primary shadow-lg shadow-primary/10"
                      : "bg-white/5 border-white/10 hover:border-white/25"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-0.5">
                    <Users className="w-3.5 h-3.5 text-white" />
                    <p className="font-semibold text-white text-sm">Group</p>
                  </div>
                  <p className="text-xs text-gray-400">Multiple members</p>
                </button>
              </div>

              {isGroup && (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-300">Group Name</label>
                  <input
                    type="text"
                    value={roomName}
                    onChange={(e) => setRoomName(e.target.value)}
                    placeholder="Enter group name..."
                    className="glass-input w-full px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary rounded-xl"
                  />
                </div>
              )}

              <div className="space-y-3">
                <label className="text-sm font-medium text-gray-300">
                  {isGroup ? `Add Members (${selectedMembers.length} selected)` : "Find User by Email or Username"}
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={isGroup ? "Search by name, email, or phone..." : "Search by email or username..."}
                    className="glass-input w-full pl-9 pr-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary rounded-xl"
                  />
                </div>

                {!isGroup && (
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs text-gray-500">
                      {exactSavedContact
                        ? exactSavedContact.registered
                          ? "This contact is already in your contacts and ready to chat."
                          : "Saved contact is waiting for the person to register."
                        : "Save email addresses now and start chatting when the account is active."}
                    </p>
                    <button
                      type="button"
                      onClick={handleSaveContact}
                      disabled={!canSaveContact || savingContact}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white transition-colors hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <Mail className="w-3.5 h-3.5" />
                      {savingContact ? "Saving..." : exactSavedContact ? "Saved" : "Save Contact"}
                    </button>
                  </div>
                )}

                {contactMessage && <p className="text-xs text-emerald-300">{contactMessage}</p>}
                {error && <p className="text-xs text-red-300">{error}</p>}

                {selectedUsers.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {selectedUsers.map((user) => (
                      <span
                        key={user.userId || user.id}
                        className="px-2 py-1 rounded-lg glass text-xs text-foreground flex items-center gap-1"
                      >
                        {(user.fullName || user.username || user.email || "").trim() || "User"}
                      </span>
                    ))}
                  </div>
                )}

                {!isGroup && (
                  <div className="space-y-3 rounded-2xl border border-white/10 bg-white/5 p-3">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-400">Saved Contacts</p>
                      <span className="text-[11px] text-gray-500">{savedContacts.length}</span>
                    </div>

                    <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
                      {loadingContacts ? (
                        <p className="text-center text-gray-500 text-sm py-4">Loading contacts...</p>
                      ) : filteredSavedContacts.length === 0 ? (
                        <p className="text-center text-gray-500 text-sm py-4">
                          {trimmedSearch ? "No saved contacts match this search" : "No contacts saved yet"}
                        </p>
                      ) : (
                        filteredSavedContacts.map((contact, idx) => {
                          const userProfile = toContactUser(contact);
                          const isRegistered = Boolean(userProfile);
                          const isSelected = selectedMembers.includes(userProfile?.userId || userProfile?.id);
                          const avatarSeed = encodeURIComponent(contactDisplayName(contact));
                          const avatar = resolveAvatarUrl(contact.avatarUrl || userProfile?.avatar) || `https://api.dicebear.com/7.x/initials/svg?seed=${avatarSeed}`;

                          return (
                            <motion.button
                              key={contact.contactId}
                              initial={{ opacity: 0, x: -10 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: idx * 0.03 }}
                              type="button"
                              onClick={() => handlePickSavedContact(contact)}
                              className={`w-full flex items-center gap-3 rounded-xl border p-3 text-left transition-all ${
                                isSelected
                                  ? "border-primary/40 bg-primary/15"
                                  : "border-transparent bg-white/5 hover:bg-white/10"
                              }`}
                            >
                              <img src={avatar} alt={contactDisplayName(contact)} className="h-10 w-10 rounded-full object-cover flex-shrink-0" />
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <p className="truncate text-sm font-semibold text-white">{contactDisplayName(contact)}</p>
                                  <span className={`rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wide ${isRegistered ? "bg-emerald-500/15 text-emerald-300" : "bg-white/10 text-gray-400"}`}>
                                    {isRegistered ? "Ready" : "Pending"}
                                  </span>
                                </div>
                                <p className="truncate text-xs text-gray-400">{contact.contactEmail}</p>
                              </div>
                              <div className="flex items-center gap-2 flex-shrink-0">
                                {isRegistered ? (
                                  <span className="rounded-lg bg-white/10 px-2.5 py-1 text-[11px] text-white">Chat</span>
                                ) : (
                                  <span className="rounded-lg bg-white/5 px-2.5 py-1 text-[11px] text-gray-400">Waiting</span>
                                )}
                                <button
                                  type="button"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    handleDeleteContact(contact.contactId);
                                  }}
                                  className="rounded-lg p-1.5 text-gray-500 transition-colors hover:bg-red-500/10 hover:text-red-300"
                                  title="Delete contact"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </motion.button>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}

                <div className="space-y-2 max-h-52 overflow-y-auto">
                  {loadingUsers ? (
                    <p className="text-center text-gray-500 text-sm py-4">Loading users...</p>
                  ) : searchQuery.trim() && availableUsers.length === 0 ? (
                    <p className="text-center text-gray-500 text-sm py-4">
                      {isGroup ? "No users found" : "No registered user found for that email or username"}
                    </p>
                  ) : !searchQuery.trim() ? (
                    <p className="text-center text-gray-500 text-sm py-4">
                      {isGroup ? "Search for people to start a conversation" : "Search for a saved contact or registered user"}
                    </p>
                  ) : (
                    availableUsers.map((user, idx) => {
                      const userId = user.userId || user.id;
                      const displayName = (user.fullName || user.username || user.email || "").trim() || "User";
                      const avatarSeed = encodeURIComponent(displayName);
                      const avatar = resolveAvatarUrl(user.avatarUrl) || `https://api.dicebear.com/7.x/initials/svg?seed=${avatarSeed}`;
                      const isSelected = selectedMembers.includes(userId);

                      return (
                        <motion.button
                          key={userId}
                          initial={{ opacity: 0, x: -12 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: idx * 0.03 }}
                          onClick={() => toggleMember(userId, displayName)}
                          className={`w-full p-3 rounded-xl flex items-center gap-3 transition-all border ${
                            isSelected
                              ? "bg-primary/15 border-primary/40"
                              : "bg-white/5 hover:bg-white/10 border-transparent"
                          }`}
                        >
                          <img src={avatar} alt={displayName} className="w-10 h-10 rounded-full flex-shrink-0 object-cover" />
                          <div className="flex-1 min-w-0 text-left">
                            <p className="text-sm font-semibold text-white truncate">{displayName}</p>
                            <p className="text-xs text-gray-400 truncate">{user.email || user.phoneNumber || ""}</p>
                          </div>
                          {isSelected && (
                            <div className="w-5 h-5 bg-primary rounded-full flex items-center justify-center flex-shrink-0 shadow-md shadow-primary/30">
                              <Check className="w-3 h-3 text-white" />
                            </div>
                          )}
                        </motion.button>
                      );
                    })
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
                  onClick={handleCreateRoom}
                  disabled={!isGroup ? !(selectedMembers.length === 1 || resolvedDirectUser) : !roomName.trim() || selectedMembers.length === 0}
                  className="glass-button-primary flex-1 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Create
                </motion.button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
