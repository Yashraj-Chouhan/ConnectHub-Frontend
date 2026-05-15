import { useState } from "react";
import { X, Edit2, Check, Camera, Phone, Mail, Info } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

const ProfilePanel = ({ open, onClose, profile, onUpdateProfile }) => {
  const { user } = useAuth();
  const [editingField, setEditingField] = useState(null);
  const [editValue, setEditValue] = useState("");

  if (!open) return null;

  const startEdit = (field, value) => {
    setEditingField(field);
    setEditValue(value || "");
  };

  const saveEdit = () => {
    if (editingField) {
      onUpdateProfile({ [editingField]: editValue });
      setEditingField(null);
    }
  };

  const fields = [
    { key: "name", label: "Name", icon: Info, value: profile.name },
    { key: "about", label: "About", icon: Info, value: profile.about },
    { key: "phone", label: "Phone", icon: Phone, value: profile.phone },
    { key: "status", label: "Status", icon: Info, value: profile.status },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative glass-strong rounded-2xl w-full max-w-sm mx-4 animate-scale-in overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border/20">
          <h2 className="text-lg font-semibold text-foreground">Profile</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg glass glass-hover flex items-center justify-center"
          >
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        <div className="p-6">
          {/* Avatar */}
          <div className="text-center mb-6">
            <div className="relative inline-block">
              <div className="w-24 h-24 rounded-2xl btn-glass flex items-center justify-center text-3xl font-bold text-primary-foreground mx-auto">
                {profile.avatar || user?.name?.charAt(0).toUpperCase() || "?"}
              </div>
              <button className="absolute bottom-0 right-0 w-8 h-8 rounded-full btn-glass flex items-center justify-center">
                <Camera className="w-4 h-4 text-primary-foreground" />
              </button>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              <Mail className="w-3 h-3 inline mr-1" />
              {profile.email || user?.email}
            </p>
          </div>

          {/* Editable fields */}
          <div className="space-y-3">
            {fields.map((field) => (
              <div key={field.key} className="p-3 rounded-xl glass">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    {field.label}
                  </span>
                  {editingField === field.key ? (
                    <button onClick={saveEdit} className="text-primary">
                      <Check className="w-3.5 h-3.5" />
                    </button>
                  ) : (
                    <button
                      onClick={() => startEdit(field.key, field.value)}
                      className="text-muted-foreground hover:text-primary"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                {editingField === field.key ? (
                  <input
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && saveEdit()}
                    className="w-full px-2 py-1 rounded-lg input-glass text-sm text-foreground"
                    autoFocus
                  />
                ) : (
                  <p className="text-sm text-foreground">{field.value || "—"}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfilePanel;
