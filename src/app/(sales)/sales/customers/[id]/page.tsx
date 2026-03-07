"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import {
  ArrowLeft,
  Building2,
  Users,
  Phone,
  Mail,
  Smartphone,
  MapPin,
  Edit,
  Plus,
  Target,
  Ticket,
  PhoneCall,
  X,
  Star,
  Shield,
  Wrench,
  Crown,
} from "lucide-react";
import "./customer-detail.css";

// ── Types ──

type Customer = {
  id: string;
  name: string;
  status: string;
  primaryEmail: string | null;
  primaryPhone: string | null;
  billingStreet1: string | null;
  billingStreet2: string | null;
  billingCity: string | null;
  billingState: string | null;
  billingPostalCode: string | null;
  notes: string | null;
  tier: "A" | "B" | "C" | null;
  leadSourceId: string | null;
  assignedToUserId: string | null;
  assignedTo?: { id: string; name: string } | null;
  leadSource?: { id: string; name: string } | null;
};

type Contact = {
  id: string;
  firstName: string;
  lastName: string;
  title: string | null;
  email: string | null;
  phone: string | null;
  mobilePhone: string | null;
  preferredContactMethod: string | null;
  isDecisionMaker: boolean;
  isTechnicalInfluencer: boolean;
  isGatekeeper: boolean;
  isPrimary: boolean;
  notes: string | null;
  status: string;
};

type CallLog = {
  id: string;
  callMethod: string;
  callDuration: number | null;
  notes: string | null;
  callTimestamp: string;
  callType?: { name: string } | null;
  callOutcome?: { name: string } | null;
  user?: { name: string } | null;
};

type Opportunity = {
  id: string;
  name: string;
  amount: string | number | null;
  status: string;
  expectedCloseDate: string | null;
};

type ServiceTicket = {
  id: string;
  reasonForService: string;
  urgency: string;
  status: string;
  createdAt: string;
};

type LeadSource = { id: string; name: string };
type UserOption = { id: string; name: string };

type TabKey = "info" | "contacts" | "calls" | "opportunities" | "tickets";

// ── Component ──

export default function SalesCustomerDetailPage() {
  const params = useParams();
  const router = useRouter();
  const toast = useToast();
  const customerId = params?.id as string | undefined;

  // Data state
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [callLogs, setCallLogs] = useState<CallLog[]>([]);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [tickets, setTickets] = useState<ServiceTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Tab state
  const [activeTab, setActiveTab] = useState<TabKey>("info");

  // Lookup data
  const [leadSources, setLeadSources] = useState<LeadSource[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);

  // Edit CRM modal state
  const [showEditModal, setShowEditModal] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    tier: "" as string,
    leadSourceId: "" as string,
    assignedToUserId: "" as string,
  });

  // Add/Edit contact modal state
  const [showContactModal, setShowContactModal] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [contactSaving, setContactSaving] = useState(false);
  const [contactError, setContactError] = useState<string | null>(null);
  const [contactForm, setContactForm] = useState({
    firstName: "",
    lastName: "",
    title: "",
    email: "",
    phone: "",
    mobilePhone: "",
    preferredContactMethod: "",
    isDecisionMaker: false,
    isTechnicalInfluencer: false,
    isGatekeeper: false,
    isPrimary: false,
    notes: "",
  });

  // ── Data Loading ──

  const loadCustomer = useCallback(async () => {
    if (!customerId) return;
    setLoading(true);
    setError(null);

    try {
      const res = await apiFetch(`/api/customers/${customerId}`, { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load customer");
      const json = await res.json();
      setCustomer(json.data);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load customer");
    } finally {
      setLoading(false);
    }
  }, [customerId]);

  const loadContacts = useCallback(async () => {
    if (!customerId) return;
    try {
      const res = await apiFetch(`/api/contacts?customerId=${customerId}`, { cache: "no-store" });
      if (res.ok) {
        const json = await res.json();
        setContacts(json.data ?? []);
      }
    } catch { /* ignore */ }
  }, [customerId]);

  const loadCallLogs = useCallback(async () => {
    if (!customerId) return;
    try {
      const res = await apiFetch(`/api/call-logs?customerId=${customerId}`, { cache: "no-store" });
      if (res.ok) {
        const json = await res.json();
        setCallLogs(json.data ?? []);
      }
    } catch { /* ignore */ }
  }, [customerId]);

  const loadOpportunities = useCallback(async () => {
    if (!customerId) return;
    try {
      const res = await apiFetch(`/api/opportunities?customerId=${customerId}`, { cache: "no-store" });
      if (res.ok) {
        const json = await res.json();
        setOpportunities(json.data ?? []);
      }
    } catch { /* ignore */ }
  }, [customerId]);

  const loadTickets = useCallback(async () => {
    if (!customerId) return;
    try {
      const res = await apiFetch(`/api/service-tickets?customerId=${customerId}`, { cache: "no-store" });
      if (res.ok) {
        const json = await res.json();
        setTickets(json.data ?? []);
      }
    } catch { /* ignore */ }
  }, [customerId]);

  const loadLookups = useCallback(async () => {
    try {
      const [lsRes, usersRes] = await Promise.all([
        apiFetch("/api/crm/lead-sources"),
        apiFetch("/api/users"),
      ]);
      if (lsRes.ok) {
        const lsJson = await lsRes.json();
        setLeadSources(lsJson.data ?? []);
      }
      if (usersRes.ok) {
        const usersJson = await usersRes.json();
        setUsers(usersJson.data ?? []);
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    loadCustomer();
    loadContacts();
    loadCallLogs();
    loadOpportunities();
    loadTickets();
    loadLookups();
  }, [loadCustomer, loadContacts, loadCallLogs, loadOpportunities, loadTickets, loadLookups]);

  // ── Helpers ──

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "\u2014";
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const formatDateTime = (dateStr: string | null) => {
    if (!dateStr) return "\u2014";
    return new Date(dateStr).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const formatDuration = (seconds: number | null): string => {
    if (!seconds) return "\u2014";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
  };

  const formatCurrency = (value: number | string | null) => {
    if (value == null) return "\u2014";
    const num = typeof value === "string" ? parseFloat(value) : value;
    if (isNaN(num)) return "\u2014";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
    }).format(num);
  };

  // ── Edit CRM Fields ──

  const openEditModal = () => {
    if (!customer) return;
    setEditForm({
      tier: customer.tier ?? "",
      leadSourceId: customer.leadSourceId ?? "",
      assignedToUserId: customer.assignedToUserId ?? "",
    });
    setEditError(null);
    setShowEditModal(true);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editSaving) return;
    setEditSaving(true);
    setEditError(null);

    try {
      const res = await apiFetch(`/api/customers/${customerId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tier: editForm.tier || null,
          leadSourceId: editForm.leadSourceId || null,
          assignedToUserId: editForm.assignedToUserId || null,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save");
      }
      toast.success("Customer updated");
      setShowEditModal(false);
      await loadCustomer();
    } catch (e: any) {
      setEditError(e?.message ?? "Failed to save");
    } finally {
      setEditSaving(false);
    }
  };

  // ── Contact Modal ──

  const resetContactForm = () => {
    setContactForm({
      firstName: "",
      lastName: "",
      title: "",
      email: "",
      phone: "",
      mobilePhone: "",
      preferredContactMethod: "",
      isDecisionMaker: false,
      isTechnicalInfluencer: false,
      isGatekeeper: false,
      isPrimary: false,
      notes: "",
    });
    setEditingContact(null);
    setContactError(null);
  };

  const openAddContact = () => {
    resetContactForm();
    setShowContactModal(true);
  };

  const openEditContact = (contact: Contact) => {
    setEditingContact(contact);
    setContactForm({
      firstName: contact.firstName,
      lastName: contact.lastName,
      title: contact.title ?? "",
      email: contact.email ?? "",
      phone: contact.phone ?? "",
      mobilePhone: contact.mobilePhone ?? "",
      preferredContactMethod: contact.preferredContactMethod ?? "",
      isDecisionMaker: contact.isDecisionMaker,
      isTechnicalInfluencer: contact.isTechnicalInfluencer,
      isGatekeeper: contact.isGatekeeper,
      isPrimary: contact.isPrimary,
      notes: contact.notes ?? "",
    });
    setContactError(null);
    setShowContactModal(true);
  };

  const handleSaveContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (contactSaving || !contactForm.firstName.trim() || !contactForm.lastName.trim()) return;
    setContactSaving(true);
    setContactError(null);

    try {
      const payload = {
        customerId: customerId!,
        firstName: contactForm.firstName.trim(),
        lastName: contactForm.lastName.trim(),
        title: contactForm.title.trim() || null,
        email: contactForm.email.trim() || null,
        phone: contactForm.phone.trim() || null,
        mobilePhone: contactForm.mobilePhone.trim() || null,
        preferredContactMethod: contactForm.preferredContactMethod || null,
        isDecisionMaker: contactForm.isDecisionMaker,
        isTechnicalInfluencer: contactForm.isTechnicalInfluencer,
        isGatekeeper: contactForm.isGatekeeper,
        isPrimary: contactForm.isPrimary,
        notes: contactForm.notes.trim() || null,
      };

      const url = editingContact
        ? `/api/contacts/${editingContact.id}`
        : "/api/contacts";
      const method = editingContact ? "PUT" : "POST";

      const res = await apiFetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save contact");
      }

      toast.success(editingContact ? "Contact updated" : "Contact added");
      setShowContactModal(false);
      resetContactForm();
      await loadContacts();
    } catch (e: any) {
      setContactError(e?.message ?? "Failed to save contact");
    } finally {
      setContactSaving(false);
    }
  };

  // ── Render Guards ──

  if (!customerId) {
    return (
      <div className="sales-customer-detail">
        <div className="scd-error">
          <h2>Missing Customer ID</h2>
          <p>No customer ID was provided in the URL.</p>
          <Link href="/sales/customers" className="scd-back-link">
            <ArrowLeft size={16} /> Back to Customers
          </Link>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="sales-customer-detail">
        <div className="scd-loading">
          <div className="scd-loading-spinner" />
          <span className="scd-loading-text">Loading customer...</span>
        </div>
      </div>
    );
  }

  if (error || !customer) {
    return (
      <div className="sales-customer-detail">
        <div className="scd-error">
          <h2>Customer Not Found</h2>
          <p>{error || "The requested customer could not be found."}</p>
          <Link href="/sales/customers" className="scd-back-link">
            <ArrowLeft size={16} /> Back to Customers
          </Link>
        </div>
      </div>
    );
  }

  // ── Tab Content Renderers ──

  const renderInfoTab = () => (
    <div className="scd-info-grid">
      {/* Company Info */}
      <div className="scd-info-card">
        <h3><Building2 size={16} /> Company Details</h3>
        <div className="scd-info-row">
          <span className="scd-info-label">Name</span>
          <span className="scd-info-value">{customer.name}</span>
        </div>
        <div className="scd-info-row">
          <span className="scd-info-label">Tier</span>
          <span className="scd-info-value">
            <span className={`scd-tier-badge ${customer.tier ? `tier-${customer.tier.toLowerCase()}` : "tier-none"}`}>
              {customer.tier ?? "None"}
            </span>
          </span>
        </div>
        <div className="scd-info-row">
          <span className="scd-info-label">Lead Source</span>
          <span className="scd-info-value">
            {customer.leadSource?.name ?? leadSources.find((ls) => ls.id === customer.leadSourceId)?.name ?? "\u2014"}
          </span>
        </div>
        <div className="scd-info-row">
          <span className="scd-info-label">Assigned Rep</span>
          <span className="scd-info-value">
            {customer.assignedTo?.name ?? users.find((u) => u.id === customer.assignedToUserId)?.name ?? "\u2014"}
          </span>
        </div>
      </div>

      {/* Contact Info */}
      <div className="scd-info-card">
        <h3><Phone size={16} /> Contact Info</h3>
        <div className="scd-info-row">
          <span className="scd-info-label">Phone</span>
          <span className="scd-info-value">{customer.primaryPhone || "\u2014"}</span>
        </div>
        <div className="scd-info-row">
          <span className="scd-info-label">Email</span>
          <span className="scd-info-value">{customer.primaryEmail || "\u2014"}</span>
        </div>
        <div className="scd-info-row">
          <span className="scd-info-label">Status</span>
          <span className="scd-info-value">{customer.status || "ACTIVE"}</span>
        </div>
      </div>

      {/* Billing Address */}
      <div className="scd-info-card full-width">
        <h3><MapPin size={16} /> Billing Address</h3>
        <div className="scd-info-row">
          <span className="scd-info-label">Address</span>
          <span className="scd-info-value">
            {[
              customer.billingStreet1,
              customer.billingStreet2,
              customer.billingCity,
              customer.billingState,
              customer.billingPostalCode,
            ]
              .filter(Boolean)
              .join(", ") || "\u2014"}
          </span>
        </div>
        {customer.notes && (
          <div className="scd-info-row">
            <span className="scd-info-label">Notes</span>
            <span className="scd-info-value">{customer.notes}</span>
          </div>
        )}
      </div>
    </div>
  );

  const renderContactsTab = () => (
    <>
      <div className="scd-section-header">
        <h2><Users size={20} /> Contacts ({contacts.length})</h2>
        <button className="scd-add-btn" onClick={openAddContact}>
          <Plus size={14} /> Add Contact
        </button>
      </div>

      {contacts.length === 0 ? (
        <div className="scd-empty-section">
          <p>No contacts yet. Add a contact to get started.</p>
        </div>
      ) : (
        <div className="scd-contacts-grid">
          {contacts.map((contact) => (
            <div
              key={contact.id}
              className="scd-contact-card"
              onClick={() => openEditContact(contact)}
            >
              <div className="scd-contact-header">
                <div>
                  <h4 className="scd-contact-name">
                    {contact.firstName} {contact.lastName}
                  </h4>
                  {contact.title && (
                    <p className="scd-contact-title">{contact.title}</p>
                  )}
                </div>
                {contact.isPrimary && (
                  <span className="scd-contact-primary-badge">Primary</span>
                )}
              </div>

              {contact.email && (
                <div className="scd-contact-detail">
                  <Mail size={13} /> {contact.email}
                </div>
              )}
              {contact.phone && (
                <div className="scd-contact-detail">
                  <Phone size={13} /> {contact.phone}
                </div>
              )}
              {contact.mobilePhone && (
                <div className="scd-contact-detail">
                  <Smartphone size={13} /> {contact.mobilePhone}
                </div>
              )}

              {(contact.isDecisionMaker || contact.isTechnicalInfluencer || contact.isGatekeeper) && (
                <div className="scd-contact-roles">
                  {contact.isDecisionMaker && (
                    <span className="scd-role-badge decision-maker">
                      <Crown size={10} style={{ marginRight: 3, verticalAlign: "middle" }} />
                      Decision Maker
                    </span>
                  )}
                  {contact.isTechnicalInfluencer && (
                    <span className="scd-role-badge technical">
                      <Wrench size={10} style={{ marginRight: 3, verticalAlign: "middle" }} />
                      Technical
                    </span>
                  )}
                  {contact.isGatekeeper && (
                    <span className="scd-role-badge gatekeeper">
                      <Shield size={10} style={{ marginRight: 3, verticalAlign: "middle" }} />
                      Gatekeeper
                    </span>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  );

  const renderCallsTab = () => (
    <>
      <div className="scd-section-header">
        <h2><PhoneCall size={20} /> Call History ({callLogs.length})</h2>
      </div>

      {callLogs.length === 0 ? (
        <div className="scd-empty-section">
          <p>No call history recorded for this customer.</p>
        </div>
      ) : (
        <div className="scd-calls-table-card">
          <table className="scd-calls-table">
            <thead>
              <tr>
                <th>Type</th>
                <th>Outcome</th>
                <th>Method</th>
                <th>Duration</th>
                <th>Notes</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {callLogs.map((call) => (
                <tr key={call.id}>
                  <td>{call.callType?.name ?? "\u2014"}</td>
                  <td>{call.callOutcome?.name ?? "\u2014"}</td>
                  <td>
                    <span className="scd-method-badge">
                      {call.callMethod?.replace("_", " ") ?? "\u2014"}
                    </span>
                  </td>
                  <td>
                    <span className="scd-call-duration">
                      {formatDuration(call.callDuration)}
                    </span>
                  </td>
                  <td>
                    <span className="scd-call-notes">
                      {call.notes || "\u2014"}
                    </span>
                  </td>
                  <td>
                    <span className="scd-call-timestamp">
                      {formatDateTime(call.callTimestamp)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );

  const renderOpportunitiesTab = () => (
    <>
      <div className="scd-section-header">
        <h2><Target size={20} /> Opportunities ({opportunities.length})</h2>
      </div>

      {opportunities.length === 0 ? (
        <div className="scd-empty-section">
          <p>No opportunities for this customer yet.</p>
        </div>
      ) : (
        <div className="scd-mini-table-card">
          <table className="scd-mini-table">
            <thead>
              <tr>
                <th>Name</th>
                <th className="text-right">Amount</th>
                <th>Status</th>
                <th>Expected Close</th>
              </tr>
            </thead>
            <tbody>
              {opportunities.map((opp) => (
                <tr key={opp.id}>
                  <td>
                    <span className="scd-opp-name">{opp.name}</span>
                  </td>
                  <td className="text-right">
                    <span className="scd-opp-amount">
                      {formatCurrency(opp.amount)}
                    </span>
                  </td>
                  <td>
                    <span
                      className={`scd-status-badge ${opp.status?.toLowerCase()}`}
                    >
                      {opp.status?.replace("_", " ")}
                    </span>
                  </td>
                  <td>{formatDate(opp.expectedCloseDate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );

  const renderTicketsTab = () => (
    <>
      <div className="scd-section-header">
        <h2><Ticket size={20} /> Service Tickets ({tickets.length})</h2>
      </div>

      {tickets.length === 0 ? (
        <div className="scd-empty-section">
          <p>No service tickets for this customer.</p>
        </div>
      ) : (
        <div className="scd-mini-table-card">
          <table className="scd-mini-table">
            <thead>
              <tr>
                <th>Reason</th>
                <th>Urgency</th>
                <th>Status</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {tickets.map((ticket) => (
                <tr key={ticket.id}>
                  <td>{ticket.reasonForService}</td>
                  <td>
                    <span
                      className={`scd-urgency-badge ${ticket.urgency?.toLowerCase()}`}
                    >
                      {ticket.urgency}
                    </span>
                  </td>
                  <td>
                    <span
                      className={`scd-status-badge ${ticket.status?.toLowerCase()}`}
                    >
                      {ticket.status}
                    </span>
                  </td>
                  <td>{formatDate(ticket.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );

  // ── Main Render ──

  return (
    <div className="sales-customer-detail">
      {/* Back link */}
      <Link href="/sales/customers" className="scd-back-link">
        <ArrowLeft size={16} /> Back to Customers
      </Link>

      {/* Header */}
      <div className="scd-header">
        <div className="scd-header-left">
          <h1>{customer.name}</h1>
          <div className="scd-header-meta">
            <span
              className={`scd-tier-badge ${
                customer.tier ? `tier-${customer.tier.toLowerCase()}` : "tier-none"
              }`}
            >
              Tier {customer.tier ?? "None"}
            </span>
            {customer.assignedTo?.name && (
              <span style={{ fontSize: 13, color: "#6b7280" }}>
                Rep: {customer.assignedTo.name}
              </span>
            )}
          </div>
        </div>
        <div className="scd-header-right">
          <button className="scd-edit-btn" onClick={openEditModal}>
            <Edit size={14} /> Edit CRM Fields
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="scd-tabs">
        <button
          className={`scd-tab ${activeTab === "info" ? "active" : ""}`}
          onClick={() => setActiveTab("info")}
        >
          <Building2 size={15} /> Info
        </button>
        <button
          className={`scd-tab ${activeTab === "contacts" ? "active" : ""}`}
          onClick={() => setActiveTab("contacts")}
        >
          <Users size={15} /> Contacts
          <span className="scd-tab-count">{contacts.length}</span>
        </button>
        <button
          className={`scd-tab ${activeTab === "calls" ? "active" : ""}`}
          onClick={() => setActiveTab("calls")}
        >
          <PhoneCall size={15} /> Call History
          <span className="scd-tab-count">{callLogs.length}</span>
        </button>
        <button
          className={`scd-tab ${activeTab === "opportunities" ? "active" : ""}`}
          onClick={() => setActiveTab("opportunities")}
        >
          <Target size={15} /> Opportunities
          <span className="scd-tab-count">{opportunities.length}</span>
        </button>
        <button
          className={`scd-tab ${activeTab === "tickets" ? "active" : ""}`}
          onClick={() => setActiveTab("tickets")}
        >
          <Ticket size={15} /> Service Tickets
          <span className="scd-tab-count">{tickets.length}</span>
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === "info" && renderInfoTab()}
      {activeTab === "contacts" && renderContactsTab()}
      {activeTab === "calls" && renderCallsTab()}
      {activeTab === "opportunities" && renderOpportunitiesTab()}
      {activeTab === "tickets" && renderTicketsTab()}

      {/* Edit CRM Fields Modal */}
      {showEditModal && (
        <div className="ui-modal-overlay" onClick={() => !editSaving && setShowEditModal(false)}>
          <div className="ui-modal ui-modal--md" onClick={(e) => e.stopPropagation()}>
            <div className="ui-modal-header">
              <h3 className="ui-modal-title">Edit CRM Fields</h3>
              <button
                className="ui-modal-close"
                onClick={() => setShowEditModal(false)}
                disabled={editSaving}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveEdit}>
              <div className="ui-modal-body">
                {editError && <div className="scd-form-error">{editError}</div>}

                <div className="scd-form-field">
                  <label>Tier</label>
                  <select
                    value={editForm.tier}
                    onChange={(e) => setEditForm({ ...editForm, tier: e.target.value })}
                  >
                    <option value="">No Tier</option>
                    <option value="A">A - Key Account</option>
                    <option value="B">B - Growth Account</option>
                    <option value="C">C - Standard</option>
                  </select>
                </div>

                <div className="scd-form-field">
                  <label>Lead Source</label>
                  <select
                    value={editForm.leadSourceId}
                    onChange={(e) => setEditForm({ ...editForm, leadSourceId: e.target.value })}
                  >
                    <option value="">None</option>
                    {leadSources.map((ls) => (
                      <option key={ls.id} value={ls.id}>
                        {ls.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="scd-form-field">
                  <label>Assigned Rep</label>
                  <select
                    value={editForm.assignedToUserId}
                    onChange={(e) => setEditForm({ ...editForm, assignedToUserId: e.target.value })}
                  >
                    <option value="">Unassigned</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="ui-modal-footer">
                <button
                  type="button"
                  className="btn-cancel"
                  onClick={() => setShowEditModal(false)}
                  disabled={editSaving}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-submit" disabled={editSaving}>
                  {editSaving ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add/Edit Contact Modal */}
      {showContactModal && (
        <div className="ui-modal-overlay" onClick={() => !contactSaving && setShowContactModal(false)}>
          <div className="ui-modal ui-modal--lg" onClick={(e) => e.stopPropagation()}>
            <div className="ui-modal-header">
              <h3 className="ui-modal-title">
                {editingContact ? "Edit Contact" : "Add Contact"}
              </h3>
              <button
                className="ui-modal-close"
                onClick={() => {
                  setShowContactModal(false);
                  resetContactForm();
                }}
                disabled={contactSaving}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveContact}>
              <div className="ui-modal-body">
                {contactError && <div className="scd-form-error">{contactError}</div>}

                <div className="scd-form-row">
                  <div className="scd-form-field">
                    <label>First Name *</label>
                    <input
                      type="text"
                      value={contactForm.firstName}
                      onChange={(e) => setContactForm({ ...contactForm, firstName: e.target.value })}
                      placeholder="First name"
                      required
                    />
                  </div>
                  <div className="scd-form-field">
                    <label>Last Name *</label>
                    <input
                      type="text"
                      value={contactForm.lastName}
                      onChange={(e) => setContactForm({ ...contactForm, lastName: e.target.value })}
                      placeholder="Last name"
                      required
                    />
                  </div>
                </div>

                <div className="scd-form-row">
                  <div className="scd-form-field">
                    <label>Title</label>
                    <input
                      type="text"
                      value={contactForm.title}
                      onChange={(e) => setContactForm({ ...contactForm, title: e.target.value })}
                      placeholder="e.g. Plant Manager"
                    />
                  </div>
                  <div className="scd-form-field">
                    <label>Preferred Contact Method</label>
                    <select
                      value={contactForm.preferredContactMethod}
                      onChange={(e) =>
                        setContactForm({ ...contactForm, preferredContactMethod: e.target.value })
                      }
                    >
                      <option value="">None selected</option>
                      <option value="PHONE">Phone</option>
                      <option value="EMAIL">Email</option>
                      <option value="TEXT">Text</option>
                    </select>
                  </div>
                </div>

                <div className="scd-form-row">
                  <div className="scd-form-field">
                    <label>Email</label>
                    <input
                      type="email"
                      value={contactForm.email}
                      onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
                      placeholder="email@example.com"
                    />
                  </div>
                  <div className="scd-form-field">
                    <label>Phone</label>
                    <input
                      type="tel"
                      value={contactForm.phone}
                      onChange={(e) => setContactForm({ ...contactForm, phone: e.target.value })}
                      placeholder="(555) 123-4567"
                    />
                  </div>
                </div>

                <div className="scd-form-field">
                  <label>Mobile Phone</label>
                  <input
                    type="tel"
                    value={contactForm.mobilePhone}
                    onChange={(e) => setContactForm({ ...contactForm, mobilePhone: e.target.value })}
                    placeholder="(555) 987-6543"
                    style={{ maxWidth: "50%" }}
                  />
                </div>

                <div className="scd-checkbox-row">
                  <label className="scd-checkbox-item">
                    <input
                      type="checkbox"
                      checked={contactForm.isDecisionMaker}
                      onChange={(e) =>
                        setContactForm({ ...contactForm, isDecisionMaker: e.target.checked })
                      }
                    />
                    Decision Maker
                  </label>
                  <label className="scd-checkbox-item">
                    <input
                      type="checkbox"
                      checked={contactForm.isTechnicalInfluencer}
                      onChange={(e) =>
                        setContactForm({ ...contactForm, isTechnicalInfluencer: e.target.checked })
                      }
                    />
                    Technical Influencer
                  </label>
                  <label className="scd-checkbox-item">
                    <input
                      type="checkbox"
                      checked={contactForm.isGatekeeper}
                      onChange={(e) =>
                        setContactForm({ ...contactForm, isGatekeeper: e.target.checked })
                      }
                    />
                    Gatekeeper
                  </label>
                  <label className="scd-checkbox-item">
                    <input
                      type="checkbox"
                      checked={contactForm.isPrimary}
                      onChange={(e) =>
                        setContactForm({ ...contactForm, isPrimary: e.target.checked })
                      }
                    />
                    Primary Contact
                  </label>
                </div>

                <div className="scd-form-field">
                  <label>Notes</label>
                  <textarea
                    value={contactForm.notes}
                    onChange={(e) => setContactForm({ ...contactForm, notes: e.target.value })}
                    placeholder="Additional notes about this contact..."
                    rows={3}
                  />
                </div>
              </div>

              <div className="ui-modal-footer">
                <button
                  type="button"
                  className="btn-cancel"
                  onClick={() => {
                    setShowContactModal(false);
                    resetContactForm();
                  }}
                  disabled={contactSaving}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-submit"
                  disabled={contactSaving || !contactForm.firstName.trim() || !contactForm.lastName.trim()}
                >
                  {contactSaving
                    ? "Saving..."
                    : editingContact
                      ? "Save Changes"
                      : "Add Contact"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
