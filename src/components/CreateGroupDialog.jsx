import { useState } from "react";
import { X, Check, Users } from "lucide-react";
import { getContacts } from "@/data/mockChats";

const CreateGroupDialog = ({ open, onClose, onCreate }) => {
  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selected, setSelected] = useState([]);
  const contacts = getContacts();

  if (!open) return null;

  const toggleContact = (id) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  };

  const handleCreate = () => {
    const members = [
      { id: "me", name: "You", avatar: "Y", role: "admin", online: true, joinedAt: new Date().toISOString() },
      ...contacts
        .filter((c) => selected.includes(c.id))
        .map((c) => ({ ...c, role: "member", joinedAt: new Date().toISOString() })),
    ];
    onCreate(name, description, members);
    setStep(1);
    setName("");
    setDescription("");
    setSelected([]);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative glass-strong rounded-2xl w-full max-w-md mx-4 animate-scale-in overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border/20">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold text-foreground">
              {step === 1 ? "New Group" : "Add Members"}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg glass glass-hover flex items-center justify-center"
          >
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        {/* Step 1: Name & Description */}
        {step === 1 ? (
          <div className="p-4 space-y-4">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Group Name</label>
              <input
                type="text"
                placeholder="Enter group name..."
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl input-glass text-sm text-foreground placeholder:text-muted-foreground"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Description (optional)</label>
              <textarea
                placeholder="What's this group about?"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl input-glass text-sm text-foreground placeholder:text-muted-foreground resize-none h-20"
              />
            </div>
            <button
              onClick={() => name.trim() && setStep(2)}
              disabled={!name.trim()}
              className="w-full py-2.5 rounded-xl btn-glass text-primary-foreground font-medium disabled:opacity-50"
            >
              Next
            </button>
          </div>
        ) : (
          /* Step 2: Select Members */
          <div className="p-4 space-y-3">
            {selected.length > 0 && (
              <div className="flex gap-2 flex-wrap mb-2">
                {contacts
                  .filter((c) => selected.includes(c.id))
                  .map((c) => (
                    <span
                      key={c.id}
                      className="px-2 py-1 rounded-lg glass text-xs text-foreground flex items-center gap-1"
                    >
                      {c.name}
                      <X className="w-3 h-3 cursor-pointer" onClick={() => toggleContact(c.id)} />
                    </span>
                  ))}
              </div>
            )}

            <div className="max-h-60 overflow-y-auto scrollbar-glass space-y-1">
              {contacts.map((contact) => (
                <button
                  key={contact.id}
                  onClick={() => toggleContact(contact.id)}
                  className="w-full p-3 rounded-xl flex items-center gap-3 glass-hover hover:bg-muted/20"
                >
                  <div className="w-10 h-10 rounded-xl glass flex items-center justify-center text-sm font-bold text-foreground">
                    {contact.avatar}
                  </div>
                  <span className="flex-1 text-left text-sm text-foreground">{contact.name}</span>
                  <div
                    className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                      selected.includes(contact.id)
                        ? "border-primary bg-primary"
                        : "border-muted-foreground"
                    }`}
                  >
                    {selected.includes(contact.id) && (
                      <Check className="w-3 h-3 text-primary-foreground" />
                    )}
                  </div>
                </button>
              ))}
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setStep(1)}
                className="flex-1 py-2.5 rounded-xl glass glass-hover text-foreground text-sm"
              >
                Back
              </button>
              <button
                onClick={handleCreate}
                disabled={selected.length === 0}
                className="flex-1 py-2.5 rounded-xl btn-glass text-primary-foreground font-medium disabled:opacity-50"
              >
                Create ({selected.length + 1})
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CreateGroupDialog;
