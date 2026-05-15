import { useState } from "react";
import { X, Shield, UserMinus, UserPlus, Plus, Edit2, Check, Trash2, Crown, Users } from "lucide-react";
import { getContacts } from "@/data/mockChats";

const GroupInfoPanel = ({ chat, open, onClose, onUpdateGroup, onLeaveGroup, onDeleteGroup }) => {
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(chat.name);
  const [editDesc, setEditDesc] = useState(chat.description || "");
  const [showAddMember, setShowAddMember] = useState(false);

  if (!open) return null;

  const isAdmin = chat.members?.some((m) => m.id === "me" && m.role === "admin");
  const contacts = getContacts();
  const memberIds = chat.members?.map((m) => m.id) || [];
  const availableContacts = contacts.filter((c) => !memberIds.includes(c.id));

  const handleSaveEdit = () => {
    onUpdateGroup(chat.id, { name: editName, description: editDesc });
    setEditing(false);
  };

  const handleToggleRole = (memberId) => {
    if (!isAdmin || memberId === "me") return;
    const updatedMembers = chat.members?.map((m) =>
      m.id === memberId ? { ...m, role: m.role === "admin" ? "member" : "admin" } : m
    );
    onUpdateGroup(chat.id, { members: updatedMembers });
  };

  const handleRemoveMember = (memberId) => {
    if (!isAdmin || memberId === "me") return;
    const updatedMembers = chat.members?.filter((m) => m.id !== memberId);
    onUpdateGroup(chat.id, { members: updatedMembers });
  };

  const handleAddMember = (contact) => {
    const newMember = { ...contact, role: "member", joinedAt: new Date().toISOString() };
    onUpdateGroup(chat.id, { members: [...(chat.members || []), newMember] });
    setShowAddMember(false);
  };

  return (
    <div className="w-80 h-full glass-strong border-l border-border/20 flex flex-col animate-slide-in-right shrink-0">
      {/* Header */}
      <div className="p-4 border-b border-border/20 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Group Info</h3>
        <button
          onClick={onClose}
          className="w-8 h-8 rounded-lg glass glass-hover flex items-center justify-center"
        >
          <X className="w-4 h-4 text-muted-foreground" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-glass p-4 space-y-4">
        {/* Group avatar & name */}
        <div className="text-center">
          <div className="w-20 h-20 rounded-2xl glass flex items-center justify-center text-2xl font-bold text-foreground mx-auto mb-3">
            {chat.avatar}
          </div>
          {editing ? (
            <div className="space-y-2">
              <input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="w-full px-3 py-1.5 rounded-lg input-glass text-sm text-foreground text-center"
              />
              <textarea
                value={editDesc}
                onChange={(e) => setEditDesc(e.target.value)}
                className="w-full px-3 py-1.5 rounded-lg input-glass text-xs text-foreground resize-none h-16"
                placeholder="Group description"
              />
              <div className="flex gap-2 justify-center">
                <button
                  onClick={() => setEditing(false)}
                  className="px-3 py-1 rounded-lg glass text-xs text-muted-foreground"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveEdit}
                  className="px-3 py-1 rounded-lg btn-glass text-xs text-primary-foreground flex items-center gap-1"
                >
                  <Check className="w-3 h-3" /> Save
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-center gap-2">
                <h4 className="text-lg font-semibold text-foreground">{chat.name}</h4>
                {isAdmin && (
                  <button
                    onClick={() => setEditing(true)}
                    className="text-muted-foreground hover:text-primary"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-1">{chat.description || "No description"}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                <Users className="w-3 h-3 inline mr-1" />
                {chat.members?.length} members
              </p>
            </>
          )}
        </div>

        {/* Members list */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Members</span>
            {isAdmin && (
              <button
                onClick={() => setShowAddMember(!showAddMember)}
                className="w-6 h-6 rounded-md glass glass-hover flex items-center justify-center"
              >
                <UserPlus className="w-3.5 h-3.5 text-primary" />
              </button>
            )}
          </div>

          {showAddMember && availableContacts.length > 0 && (
            <div className="mb-2 p-2 rounded-xl glass space-y-1">
              <p className="text-[10px] text-muted-foreground mb-1">Add member:</p>
              {availableContacts.map((c) => (
                <button
                  key={c.id}
                  onClick={() => handleAddMember(c)}
                  className="w-full flex items-center gap-2 p-1.5 rounded-lg hover:bg-muted/20 transition-colors"
                >
                  <div className="w-7 h-7 rounded-lg glass flex items-center justify-center text-[10px] font-bold text-foreground">
                    {c.avatar}
                  </div>
                  <span className="text-xs text-foreground">{c.name}</span>
                  <Plus className="w-3 h-3 text-primary ml-auto" />
                </button>
              ))}
            </div>
          )}

          <div className="space-y-1">
            {chat.members?.map((member) => (
              <div
                key={member.id}
                className="flex items-center gap-2 p-2 rounded-xl hover:bg-muted/10 transition-colors group"
              >
                <div className="relative">
                  <div className="w-9 h-9 rounded-lg glass flex items-center justify-center text-xs font-bold text-foreground">
                    {member.avatar}
                  </div>
                  {member.online && (
                    <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-background" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1">
                    <span className="text-xs font-medium text-foreground truncate">{member.name}</span>
                    {member.role === "admin" && <Crown className="w-3 h-3 text-amber-400" />}
                  </div>
                  <span className="text-[10px] text-muted-foreground">{member.role}</span>
                </div>
                {isAdmin && member.id !== "me" && (
                  <div className="hidden group-hover:flex items-center gap-1">
                    <button
                      onClick={() => handleToggleRole(member.id)}
                      className="w-6 h-6 rounded-md glass flex items-center justify-center"
                      title={member.role === "admin" ? "Remove admin" : "Make admin"}
                    >
                      <Shield className="w-3 h-3 text-primary" />
                    </button>
                    <button
                      onClick={() => handleRemoveMember(member.id)}
                      className="w-6 h-6 rounded-md glass flex items-center justify-center"
                      title="Remove member"
                    >
                      <UserMinus className="w-3 h-3 text-destructive" />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="space-y-2 pt-2 border-t border-border/20">
          <button
            onClick={() => onLeaveGroup(chat.id)}
            className="w-full py-2 rounded-xl glass glass-hover text-sm text-destructive flex items-center justify-center gap-2"
          >
            <UserMinus className="w-4 h-4" /> Leave Group
          </button>
          {isAdmin && (
            <button
              onClick={() => onDeleteGroup(chat.id)}
              className="w-full py-2 rounded-xl glass glass-hover text-sm text-destructive flex items-center justify-center gap-2"
            >
              <Trash2 className="w-4 h-4" /> Delete Group
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default GroupInfoPanel;
