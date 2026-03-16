"use client";

import { useEffect, useState, useCallback } from "react";
import { apiFetch } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import {
  Settings,
  ChevronDown,
  ChevronRight,
  Plus,
  Pencil,
  Trash2,
  Star,
  Phone,
  Target,
  CalendarClock,
  Megaphone,
  Factory,
  X,
} from "lucide-react";
import "./settings.css";

/* ------------------------------------------------------------------
   Types
   ------------------------------------------------------------------ */
type ConfigItem = {
  id: string;
  name: string;
  isActive: boolean;
  isDefault: boolean;
  [key: string]: unknown;
};

type ExtraField = {
  key: string;
  label: string;
  type: "checkbox";
};

/* ------------------------------------------------------------------
   Reusable ConfigSection
   ------------------------------------------------------------------ */
function ConfigSection({
  title,
  icon,
  apiPath,
  extraFields,
}: {
  title: string;
  icon: React.ReactNode;
  apiPath: string;
  extraFields?: ExtraField[];
}) {
  const toast = useToast();
  const [expanded, setExpanded] = useState(false);
  const [items, setItems] = useState<ConfigItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState<ConfigItem | null>(null);

  // Form state
  const [formName, setFormName] = useState("");
  const [formIsActive, setFormIsActive] = useState(true);
  const [formIsDefault, setFormIsDefault] = useState(false);
  const [formExtras, setFormExtras] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);

  // Delete confirmation
  const [showConfirm, setShowConfirm] = useState(false);
  const [deletingItem, setDeletingItem] = useState<ConfigItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch(`/api/crm/${apiPath}`, {
        credentials: "include",
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`Failed to load ${title}`);
      const json = await res.json();
      setItems(json.data || []);
    } catch (e: any) {
      toast.error(e?.message || `Failed to load ${title}`);
    } finally {
      setLoading(false);
    }
  }, [apiPath, title]);

  useEffect(() => {
    if (expanded && items.length === 0) {
      fetchItems();
    }
  }, [expanded]);

  function openAddModal() {
    setEditingItem(null);
    setFormName("");
    setFormIsActive(true);
    setFormIsDefault(false);
    const defaults: Record<string, boolean> = {};
    extraFields?.forEach((f) => {
      defaults[f.key] = false;
    });
    setFormExtras(defaults);
    setShowModal(true);
  }

  function openEditModal(item: ConfigItem) {
    setEditingItem(item);
    setFormName(item.name);
    setFormIsActive(item.isActive);
    setFormIsDefault(item.isDefault);
    const vals: Record<string, boolean> = {};
    extraFields?.forEach((f) => {
      vals[f.key] = !!item[f.key];
    });
    setFormExtras(vals);
    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
    setEditingItem(null);
  }

  async function handleSave() {
    if (!formName.trim()) {
      toast.error("Name is required");
      return;
    }

    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        name: formName.trim(),
        isActive: formIsActive,
        isDefault: formIsDefault,
      };
      extraFields?.forEach((f) => {
        body[f.key] = formExtras[f.key] ?? false;
      });

      if (editingItem) {
        // Update
        const res = await apiFetch(`/api/crm/${apiPath}/${editingItem.id}`, {
          method: "PUT",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error(`Failed to update ${title}`);
        toast.success(`${title.replace(/s$/, "")} updated`);
      } else {
        // Create
        const res = await apiFetch(`/api/crm/${apiPath}`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error(`Failed to create ${title.replace(/s$/, "")}`);
        toast.success(`${title.replace(/s$/, "")} created`);
      }

      closeModal();
      await fetchItems();
    } catch (e: any) {
      toast.error(e?.message || "Save failed");
    } finally {
      setSaving(false);
    }
  }

  function confirmDelete(item: ConfigItem) {
    setDeletingItem(item);
    setShowConfirm(true);
  }

  async function handleDelete() {
    if (!deletingItem) return;
    setDeleting(true);
    try {
      const res = await apiFetch(`/api/crm/${apiPath}/${deletingItem.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error(`Failed to delete ${title.replace(/s$/, "")}`);
      toast.success(`${title.replace(/s$/, "")} deleted`);
      setShowConfirm(false);
      setDeletingItem(null);
      await fetchItems();
    } catch (e: any) {
      toast.error(e?.message || "Delete failed");
    } finally {
      setDeleting(false);
    }
  }

  async function toggleActive(item: ConfigItem) {
    try {
      const res = await apiFetch(`/api/crm/${apiPath}/${item.id}`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !item.isActive }),
      });
      if (!res.ok) throw new Error("Failed to update status");
      toast.success(`${item.name} ${item.isActive ? "deactivated" : "activated"}`);
      await fetchItems();
    } catch (e: any) {
      toast.error(e?.message || "Toggle failed");
    }
  }

  const activeCount = items.filter((i) => i.isActive).length;

  return (
    <div className="crm-config-section">
      {/* Section Header */}
      <div
        className="crm-config-header"
        onClick={() => setExpanded(!expanded)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setExpanded(!expanded);
          }
        }}
      >
        <div className="crm-config-header-left">
          {expanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
          <span className="crm-config-icon">{icon}</span>
          <h3 className="crm-config-title">{title}</h3>
          <span className="crm-config-count">
            {activeCount} active
          </span>
        </div>
        <div className="crm-config-header-right">
          <button
            className="crm-btn-add"
            onClick={(e) => {
              e.stopPropagation();
              if (!expanded) setExpanded(true);
              openAddModal();
            }}
          >
            <Plus size={16} />
            Add
          </button>
        </div>
      </div>

      {/* Section Body */}
      {expanded && (
        <div className="crm-config-body">
          {loading ? (
            <div className="crm-config-loading">
              <div className="crm-config-spinner" />
              <span>Loading...</span>
            </div>
          ) : items.length === 0 ? (
            <div className="crm-config-empty">
              No {title.toLowerCase()} configured yet.
            </div>
          ) : (
            <div className="crm-config-list">
              {items.map((item) => (
                <div
                  key={item.id}
                  className={`crm-config-item ${!item.isActive ? "crm-config-item--inactive" : ""}`}
                >
                  <div className="crm-config-item-left">
                    <span className="crm-config-item-name">{item.name}</span>
                    {item.isDefault && (
                      <span className="crm-config-default-badge">
                        <Star size={10} />
                        Default
                      </span>
                    )}
                    {extraFields?.map((f) =>
                      item[f.key] ? (
                        <span key={f.key} className="crm-config-trigger-badge">
                          {f.label}
                        </span>
                      ) : null
                    )}
                  </div>
                  <div className="crm-config-item-right">
                    <label
                      className="crm-toggle"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        type="checkbox"
                        checked={item.isActive}
                        onChange={() => toggleActive(item)}
                      />
                      <span className="crm-toggle-slider" />
                      <span className="crm-toggle-label">
                        {item.isActive ? "Active" : "Inactive"}
                      </span>
                    </label>
                    <button
                      className="crm-btn-ghost"
                      onClick={() => openEditModal(item)}
                      title="Edit"
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      className="crm-btn-ghost crm-btn-ghost--danger"
                      onClick={() => confirmDelete(item)}
                      title="Delete"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="ui-modal-overlay" onClick={closeModal}>
          <div
            className="ui-modal ui-modal--sm"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="ui-modal-header">
              <h3 className="ui-modal-title">
                {editingItem ? `Edit ${title.replace(/s$/, "")}` : `Add ${title.replace(/s$/, "")}`}
              </h3>
              <button className="ui-modal-close" onClick={closeModal}>
                <X size={18} />
              </button>
            </div>
            <div className="ui-modal-body">
              <div className="crm-form-group">
                <label className="crm-form-label">Name</label>
                <input
                  type="text"
                  className="crm-form-input"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder={`Enter ${title.replace(/s$/, "").toLowerCase()} name`}
                  autoFocus
                />
              </div>

              <div className="crm-form-row">
                <label className="crm-form-checkbox">
                  <input
                    type="checkbox"
                    checked={formIsActive}
                    onChange={(e) => setFormIsActive(e.target.checked)}
                  />
                  <span>Is Active</span>
                </label>

                <label className="crm-form-checkbox">
                  <input
                    type="checkbox"
                    checked={formIsDefault}
                    onChange={(e) => setFormIsDefault(e.target.checked)}
                  />
                  <span>Is Default</span>
                </label>
              </div>

              {extraFields && extraFields.length > 0 && (
                <div className="crm-form-extras">
                  {extraFields.map((field) => (
                    <label key={field.key} className="crm-form-checkbox">
                      <input
                        type="checkbox"
                        checked={formExtras[field.key] ?? false}
                        onChange={(e) =>
                          setFormExtras((prev) => ({
                            ...prev,
                            [field.key]: e.target.checked,
                          }))
                        }
                      />
                      <span>{field.label}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
            <div className="ui-modal-footer">
              <button
                className="ui-btn ui-btn--secondary"
                onClick={closeModal}
                disabled={saving}
              >
                Cancel
              </button>
              <button
                className="ui-btn ui-btn--primary"
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? "Saving..." : editingItem ? "Update" : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {showConfirm && (
        <div className="ui-modal-overlay" onClick={() => setShowConfirm(false)}>
          <div
            className="ui-modal ui-modal--sm"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="ui-modal-header">
              <h3 className="ui-modal-title">Delete {title.replace(/s$/, "")}?</h3>
            </div>
            <div className="ui-modal-body">
              <p className="crm-confirm-text">
                Are you sure you want to delete <strong>{deletingItem?.name}</strong>?
                This cannot be undone.
              </p>
            </div>
            <div className="ui-modal-footer">
              <button
                className="ui-btn ui-btn--secondary"
                onClick={() => setShowConfirm(false)}
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                className="ui-btn ui-btn--danger"
                onClick={handleDelete}
                disabled={deleting}
              >
                {deleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------
   Main Page
   ------------------------------------------------------------------ */
export default function CRMSettingsPage() {
  return (
    <div className="crm-settings">
      {/* Page Header */}
      <div className="crm-settings-header">
        <div className="crm-settings-header-left">
          <div className="crm-settings-icon">
            <Settings size={24} />
          </div>
          <div>
            <h1>CRM Settings</h1>
            <p className="crm-settings-subtitle">
              Manage call types, outcomes, follow-up types, lead sources, and industries for your CRM.
            </p>
          </div>
        </div>
      </div>

      {/* Config Sections */}
      <div className="crm-config-sections">
        <ConfigSection
          title="Call Types"
          icon={<Phone size={18} />}
          apiPath="call-types"
        />

        <ConfigSection
          title="Call Outcomes"
          icon={<Target size={18} />}
          apiPath="call-outcomes"
          extraFields={[
            {
              key: "triggersFollowUp",
              label: "Triggers Follow-Up",
              type: "checkbox",
            },
            {
              key: "triggersOpportunityPrompt",
              label: "Triggers Opportunity Prompt",
              type: "checkbox",
            },
          ]}
        />

        <ConfigSection
          title="Follow-Up Types"
          icon={<CalendarClock size={18} />}
          apiPath="follow-up-types"
        />

        <ConfigSection
          title="Lead Sources"
          icon={<Megaphone size={18} />}
          apiPath="lead-sources"
        />

        <ConfigSection
          title="Industries"
          icon={<Factory size={18} />}
          apiPath="industries"
        />
      </div>
    </div>
  );
}
