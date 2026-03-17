"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import {
  ArrowLeft,
  Phone,
  Plus,
  X,
  CalendarClock,
  Target,
} from "lucide-react";
import "../calls.css";

type Customer = { id: string; name: string };
type Contact = { id: string; firstName: string; lastName: string; email: string | null };
type Site = { id: string; name: string };
type CallType = { id: string; name: string };
type CallOutcome = {
  id: string;
  name: string;
  triggersFollowUp: boolean;
  triggersOpportunityPrompt: boolean;
};

export default function NewCallPage() {
  const router = useRouter();
  const toast = useToast();

  // Form state
  const [customerId, setCustomerId] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [contactId, setContactId] = useState("");
  const [siteId, setSiteId] = useState("");
  const [callTypeId, setCallTypeId] = useState("");
  const [callMethod, setCallMethod] = useState("PHONE");
  const [callOutcomeId, setCallOutcomeId] = useState("");
  const [durationHours, setDurationHours] = useState("0");
  const [durationMinutes, setDurationMinutes] = useState("0");
  const [competitorMentioned, setCompetitorMentioned] = useState("");
  const [notes, setNotes] = useState("");
  const [callTimestamp, setCallTimestamp] = useState(() => {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    return now.toISOString().slice(0, 16);
  });

  // Dropdown data
  const [customerSearch, setCustomerSearch] = useState("");
  const [customerResults, setCustomerResults] = useState<Customer[]>([]);
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [callTypes, setCallTypes] = useState<CallType[]>([]);
  const [callOutcomes, setCallOutcomes] = useState<CallOutcome[]>([]);

  // Submission
  const [submitting, setSubmitting] = useState(false);

  // Follow-up modal
  const [showFollowUpModal, setShowFollowUpModal] = useState(false);
  const [followUpTitle, setFollowUpTitle] = useState("");
  const [followUpDueDate, setFollowUpDueDate] = useState("");
  const [followUpNotes, setFollowUpNotes] = useState("");
  const [followUpPriority, setFollowUpPriority] = useState("MEDIUM");
  const [submittingFollowUp, setSubmittingFollowUp] = useState(false);

  // Opportunity modal
  const [showOpportunityModal, setShowOpportunityModal] = useState(false);
  const [oppTitle, setOppTitle] = useState("");
  const [oppValue, setOppValue] = useState("");
  const [oppNotes, setOppNotes] = useState("");
  const [submittingOpp, setSubmittingOpp] = useState(false);

  // Quick-add contact
  const [showQuickAddContact, setShowQuickAddContact] = useState(false);
  const [qaFirstName, setQaFirstName] = useState("");
  const [qaLastName, setQaLastName] = useState("");
  const [qaEmail, setQaEmail] = useState("");
  const [qaPhone, setQaPhone] = useState("");
  const [savingContact, setSavingContact] = useState(false);

  // Store the created call's outcome for post-submit triggers
  const [createdCallOutcome, setCreatedCallOutcome] = useState<CallOutcome | null>(null);
  const [createdCallLogId, setCreatedCallLogId] = useState<string | null>(null);

  const searchTimeout = useRef<NodeJS.Timeout | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Load call types and outcomes on mount
  useEffect(() => {
    (async () => {
      try {
        const [typesRes, outcomesRes] = await Promise.all([
          apiFetch("/api/crm/call-types"),
          apiFetch("/api/crm/call-outcomes"),
        ]);
        if (typesRes.ok) {
          const data = await typesRes.json();
          setCallTypes(data.data ?? []);
        }
        if (outcomesRes.ok) {
          const data = await outcomesRes.json();
          setCallOutcomes(data.data ?? []);
        }
      } catch {
        // Non-critical
      }
    })();
  }, []);

  // Close customer dropdown on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowCustomerDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Search customers with debounce
  const searchCustomers = useCallback(async (term: string) => {
    if (!term || term.length < 2) {
      setCustomerResults([]);
      return;
    }
    try {
      const res = await apiFetch(`/api/customers?search=${encodeURIComponent(term)}&limit=20`);
      if (res.ok) {
        const data = await res.json();
        setCustomerResults(data.data ?? []);
      }
    } catch {
      // Silently fail search
    }
  }, []);

  const handleCustomerSearchChange = (value: string) => {
    setCustomerSearch(value);
    setShowCustomerDropdown(true);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => searchCustomers(value), 300);
  };

  const selectCustomer = (customer: Customer) => {
    setCustomerId(customer.id);
    setCustomerName(customer.name);
    setCustomerSearch("");
    setShowCustomerDropdown(false);
    setContactId("");
    setSiteId("");
  };

  const clearCustomer = () => {
    setCustomerId("");
    setCustomerName("");
    setCustomerSearch("");
    setContacts([]);
    setSites([]);
    setContactId("");
    setSiteId("");
  };

  // Load contacts and sites when customer changes
  useEffect(() => {
    if (!customerId) {
      setContacts([]);
      setSites([]);
      return;
    }
    (async () => {
      try {
        const [contactsRes, sitesRes] = await Promise.all([
          apiFetch(`/api/contacts?customerId=${customerId}`),
          apiFetch(`/api/sites?customerId=${customerId}`),
        ]);
        if (contactsRes.ok) {
          const data = await contactsRes.json();
          setContacts(data.data ?? []);
        }
        if (sitesRes.ok) {
          const data = await sitesRes.json();
          setSites(data.data ?? []);
        }
      } catch {
        // Non-critical
      }
    })();
  }, [customerId]);

  // Quick-add contact handler
  const handleQuickAddContact = async () => {
    if (!qaFirstName.trim() || !qaLastName.trim()) {
      toast.warning("First and last name are required");
      return;
    }
    setSavingContact(true);
    try {
      const res = await apiFetch("/api/contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId,
          firstName: qaFirstName.trim(),
          lastName: qaLastName.trim(),
          email: qaEmail.trim() || null,
          phone: qaPhone.trim() || null,
        }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to add contact");
      }
      const result = await res.json();
      const newContact = result.data;
      setContacts((prev) => [...prev, newContact]);
      setContactId(newContact.id);
      setShowQuickAddContact(false);
      setQaFirstName("");
      setQaLastName("");
      setQaEmail("");
      setQaPhone("");
      toast.success("Contact added");
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to add contact");
    } finally {
      setSavingContact(false);
    }
  };

  // Submit the call log
  const handleSubmit = async () => {
    if (!customerId) {
      toast.warning("Please select a customer");
      return;
    }

    const totalMinutes =
      (parseInt(durationHours, 10) || 0) * 60 +
      (parseInt(durationMinutes, 10) || 0);

    setSubmitting(true);
    try {
      const payload: Record<string, unknown> = {
        customerId,
        callMethod,
        callTimestamp,
        durationMinutes: totalMinutes || null,
        competitorMentioned: competitorMentioned.trim() || null,
        notes: notes.trim() || null,
      };
      if (contactId) payload.contactId = contactId;
      if (siteId) payload.siteId = siteId;
      if (callTypeId) payload.callTypeId = callTypeId;
      if (callOutcomeId) payload.callOutcomeId = callOutcomeId;

      const res = await apiFetch("/api/call-logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to log call");
      }

      const result = await res.json();
      const callLogData = result.data ?? result;
      setCreatedCallLogId(callLogData.id ?? null);

      toast.success("Call logged successfully");

      // Determine outcome triggers
      const selectedOutcome = callOutcomes.find((o) => o.id === callOutcomeId);
      if (selectedOutcome) {
        setCreatedCallOutcome(selectedOutcome);

        if (selectedOutcome.triggersFollowUp) {
          // Pre-fill follow-up modal
          setFollowUpTitle(`Follow up: ${customerName}`);
          const dueDate = new Date();
          dueDate.setDate(dueDate.getDate() + 3);
          setFollowUpDueDate(dueDate.toISOString().slice(0, 10));
          setShowFollowUpModal(true);
          return; // Don't navigate yet
        }

        if (selectedOutcome.triggersOpportunityPrompt) {
          setOppTitle(`Opportunity: ${customerName}`);
          setShowOpportunityModal(true);
          return; // Don't navigate yet
        }
      }

      router.push("/sales/calls");
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to log call");
    } finally {
      setSubmitting(false);
    }
  };

  // Submit follow-up
  const handleSubmitFollowUp = async () => {
    if (!followUpTitle.trim()) {
      toast.warning("Please enter a follow-up title");
      return;
    }
    setSubmittingFollowUp(true);
    try {
      const payload: Record<string, unknown> = {
        title: followUpTitle.trim(),
        dueDate: followUpDueDate || null,
        notes: followUpNotes.trim() || null,
        priority: followUpPriority,
        customerId,
      };
      if (contactId) payload.contactId = contactId;
      if (createdCallLogId) payload.callLogId = createdCallLogId;

      const res = await apiFetch("/api/follow-ups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to create follow-up");
      }

      toast.success("Follow-up created");
      setShowFollowUpModal(false);

      // Check if opportunity prompt too
      if (createdCallOutcome?.triggersOpportunityPrompt) {
        setOppTitle(`Opportunity: ${customerName}`);
        setShowOpportunityModal(true);
        return;
      }

      router.push("/sales/calls");
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to create follow-up");
    } finally {
      setSubmittingFollowUp(false);
    }
  };

  // Submit opportunity
  const handleSubmitOpportunity = async () => {
    if (!oppTitle.trim()) {
      toast.warning("Please enter an opportunity title");
      return;
    }
    setSubmittingOpp(true);
    try {
      const payload: Record<string, unknown> = {
        title: oppTitle.trim(),
        estimatedValue: oppValue ? parseFloat(oppValue) : null,
        notes: oppNotes.trim() || null,
        customerId,
      };
      if (contactId) payload.contactId = contactId;
      if (createdCallLogId) payload.callLogId = createdCallLogId;

      const res = await apiFetch("/api/opportunities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to create opportunity");
      }

      toast.success("Opportunity created");
      setShowOpportunityModal(false);
      router.push("/sales/calls");
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to create opportunity");
    } finally {
      setSubmittingOpp(false);
    }
  };

  // Dismiss follow-up modal
  const skipFollowUp = () => {
    setShowFollowUpModal(false);
    if (createdCallOutcome?.triggersOpportunityPrompt) {
      setOppTitle(`Opportunity: ${customerName}`);
      setShowOpportunityModal(true);
      return;
    }
    router.push("/sales/calls");
  };

  // Dismiss opportunity modal
  const skipOpportunity = () => {
    setShowOpportunityModal(false);
    router.push("/sales/calls");
  };

  return (
    <div className="call-form-page">
      <div className="call-form-container">
        {/* Header */}
        <Link href="/sales/calls" className="call-form-back-link">
          <ArrowLeft size={16} />
          Back to Call Log
        </Link>
        <h1 className="call-form-title">Log a Call</h1>
        <p className="call-form-subtitle">
          Record a customer interaction with details, outcome, and follow-up triggers
        </p>

        {/* Customer Section */}
        <div className="call-form-section">
          <h2 className="call-form-section-title">Customer Information</h2>

          {/* Customer — searchable dropdown */}
          <div className="call-form-field">
            <label className="call-form-label">
              Customer <span className="required">*</span>
            </label>
            {customerId ? (
              <div className="call-form-selected-chip">
                {customerName}
                <button onClick={clearCustomer} title="Clear">
                  <X size={14} />
                </button>
              </div>
            ) : (
              <div className="call-form-search-dropdown" ref={dropdownRef}>
                <input
                  type="text"
                  className="call-form-input"
                  placeholder="Search customers by name..."
                  value={customerSearch}
                  onChange={(e) => handleCustomerSearchChange(e.target.value)}
                  onFocus={() => {
                    if (customerSearch.length >= 2) setShowCustomerDropdown(true);
                  }}
                />
                {showCustomerDropdown && customerResults.length > 0 && (
                  <div className="call-form-search-results">
                    {customerResults.map((c) => (
                      <div
                        key={c.id}
                        className="call-form-search-item"
                        onClick={() => selectCustomer(c)}
                      >
                        {c.name}
                      </div>
                    ))}
                  </div>
                )}
                {showCustomerDropdown && customerSearch.length >= 2 && customerResults.length === 0 && (
                  <div className="call-form-search-results">
                    <div className="call-form-search-empty">No customers found</div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Contact */}
          <div className="call-form-field">
            <label className="call-form-label">Contact</label>
            <div style={{ display: "flex", gap: "0.5rem", alignItems: "flex-start" }}>
              <select
                className="call-form-select"
                value={contactId}
                onChange={(e) => setContactId(e.target.value)}
                disabled={!customerId}
                style={{ flex: 1 }}
              >
                <option value="">No specific contact</option>
                {contacts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.firstName} {c.lastName}
                    {c.email ? ` (${c.email})` : ""}
                  </option>
                ))}
              </select>
              {customerId && (
                <button
                  type="button"
                  className="call-form-quick-add-btn"
                  onClick={() => setShowQuickAddContact(!showQuickAddContact)}
                  title="Quick-add contact"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: 38,
                    height: 38,
                    borderRadius: 8,
                    border: "1px solid var(--border-color, #e5e7eb)",
                    background: showQuickAddContact ? "var(--accent-color, #f97316)" : "white",
                    color: showQuickAddContact ? "white" : "var(--text-secondary, #6b7280)",
                    cursor: "pointer",
                    flexShrink: 0,
                  }}
                >
                  {showQuickAddContact ? <X size={16} /> : <Plus size={16} />}
                </button>
              )}
            </div>

            {/* Quick-add contact inline form */}
            {showQuickAddContact && customerId && (
              <div
                style={{
                  marginTop: "0.75rem",
                  padding: "1rem",
                  border: "1px solid var(--border-color, #e5e7eb)",
                  borderRadius: 8,
                  background: "var(--bg-secondary, #f9fafb)",
                }}
              >
                <div style={{ fontSize: "0.8125rem", fontWeight: 600, marginBottom: "0.75rem", color: "var(--text-primary, #1f2937)" }}>
                  Quick Add Contact
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
                  <input
                    type="text"
                    className="call-form-input"
                    placeholder="First name *"
                    value={qaFirstName}
                    onChange={(e) => setQaFirstName(e.target.value)}
                  />
                  <input
                    type="text"
                    className="call-form-input"
                    placeholder="Last name *"
                    value={qaLastName}
                    onChange={(e) => setQaLastName(e.target.value)}
                  />
                  <input
                    type="email"
                    className="call-form-input"
                    placeholder="Email"
                    value={qaEmail}
                    onChange={(e) => setQaEmail(e.target.value)}
                  />
                  <input
                    type="tel"
                    className="call-form-input"
                    placeholder="Phone"
                    value={qaPhone}
                    onChange={(e) => setQaPhone(e.target.value)}
                  />
                </div>
                <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem", marginTop: "0.75rem" }}>
                  <button
                    type="button"
                    style={{
                      padding: "0.375rem 0.75rem",
                      fontSize: "0.8125rem",
                      border: "1px solid var(--border-color, #e5e7eb)",
                      borderRadius: 6,
                      background: "white",
                      cursor: "pointer",
                    }}
                    onClick={() => setShowQuickAddContact(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    style={{
                      padding: "0.375rem 0.75rem",
                      fontSize: "0.8125rem",
                      border: "none",
                      borderRadius: 6,
                      background: "var(--accent-color, #f97316)",
                      color: "white",
                      cursor: "pointer",
                      opacity: savingContact ? 0.7 : 1,
                    }}
                    onClick={handleQuickAddContact}
                    disabled={savingContact || !qaFirstName.trim() || !qaLastName.trim()}
                  >
                    {savingContact ? "Adding..." : "Add Contact"}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Site */}
          <div className="call-form-field">
            <label className="call-form-label">Site</label>
            <select
              className="call-form-select"
              value={siteId}
              onChange={(e) => setSiteId(e.target.value)}
              disabled={!customerId || sites.length === 0}
            >
              <option value="">No specific site</option>
              {sites.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Call Details Section */}
        <div className="call-form-section">
          <h2 className="call-form-section-title">Call Details</h2>

          {/* Call Type */}
          <div className="call-form-field">
            <label className="call-form-label">Call Type</label>
            <select
              className="call-form-select"
              value={callTypeId}
              onChange={(e) => setCallTypeId(e.target.value)}
            >
              <option value="">Select call type...</option>
              {callTypes.map((ct) => (
                <option key={ct.id} value={ct.id}>
                  {ct.name}
                </option>
              ))}
            </select>
          </div>

          {/* Call Method */}
          <div className="call-form-field">
            <label className="call-form-label">Call Method</label>
            <select
              className="call-form-select"
              value={callMethod}
              onChange={(e) => setCallMethod(e.target.value)}
            >
              <option value="PHONE">Phone</option>
              <option value="IN_PERSON">In Person</option>
              <option value="VIDEO_CALL">Video Call</option>
              <option value="EMAIL">Email</option>
            </select>
          </div>

          {/* Call Outcome */}
          <div className="call-form-field">
            <label className="call-form-label">Call Outcome</label>
            <select
              className="call-form-select"
              value={callOutcomeId}
              onChange={(e) => setCallOutcomeId(e.target.value)}
            >
              <option value="">Select outcome...</option>
              {callOutcomes.map((co) => (
                <option key={co.id} value={co.id}>
                  {co.name}
                  {co.triggersFollowUp ? " (follow-up)" : ""}
                  {co.triggersOpportunityPrompt ? " (opportunity)" : ""}
                </option>
              ))}
            </select>
          </div>

          {/* Duration */}
          <div className="call-form-field">
            <label className="call-form-label">Duration</label>
            <div className="call-form-duration-grid">
              <div className="call-form-duration-field">
                <span className="call-form-duration-label">Hours</span>
                <input
                  type="number"
                  className="call-form-input"
                  min="0"
                  max="24"
                  value={durationHours}
                  onChange={(e) => setDurationHours(e.target.value)}
                />
              </div>
              <div className="call-form-duration-field">
                <span className="call-form-duration-label">Minutes</span>
                <input
                  type="number"
                  className="call-form-input"
                  min="0"
                  max="59"
                  value={durationMinutes}
                  onChange={(e) => setDurationMinutes(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Call Timestamp */}
          <div className="call-form-field">
            <label className="call-form-label">Call Date/Time</label>
            <input
              type="datetime-local"
              className="call-form-input"
              value={callTimestamp}
              onChange={(e) => setCallTimestamp(e.target.value)}
            />
          </div>

          {/* Competitor Mentioned */}
          <div className="call-form-field">
            <label className="call-form-label">Competitor Mentioned</label>
            <input
              type="text"
              className="call-form-input"
              placeholder="e.g., Flowserve, Sulzer..."
              value={competitorMentioned}
              onChange={(e) => setCompetitorMentioned(e.target.value)}
            />
          </div>

          {/* Notes */}
          <div className="call-form-field">
            <label className="call-form-label">Notes</label>
            <textarea
              className="call-form-textarea"
              placeholder="Key discussion points, action items, follow-up needs..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={5}
            />
          </div>
        </div>

        {/* Actions */}
        <div className="call-form-actions">
          <button
            type="button"
            className="call-form-cancel-btn"
            onClick={() => router.push("/sales/calls")}
            disabled={submitting}
          >
            Cancel
          </button>
          <button
            type="button"
            className="call-form-submit-btn"
            onClick={handleSubmit}
            disabled={submitting || !customerId}
          >
            {submitting ? "Saving..." : "Log Call"}
          </button>
        </div>
      </div>

      {/* ── Follow-Up Modal ── */}
      {showFollowUpModal && (
        <div className="ui-modal-overlay" onClick={skipFollowUp}>
          <div className="ui-modal ui-modal--md" onClick={(e) => e.stopPropagation()}>
            <div className="ui-modal-header">
              <h3 className="ui-modal-title">
                <CalendarClock size={20} style={{ marginRight: 8, verticalAlign: "middle" }} />
                Create Follow-Up
              </h3>
              <button className="ui-modal-close" onClick={skipFollowUp}>
                <X size={18} />
              </button>
            </div>
            <div className="ui-modal-body">
              <div className="call-modal-prefilled">
                Customer: <strong>{customerName}</strong>
                {contactId && contacts.length > 0 && (
                  <>
                    {" | "}Contact:{" "}
                    <strong>
                      {(() => {
                        const c = contacts.find((ct) => ct.id === contactId);
                        return c ? `${c.firstName} ${c.lastName}` : "";
                      })()}
                    </strong>
                  </>
                )}
              </div>

              <div className="call-modal-field">
                <label className="call-modal-label">Title *</label>
                <input
                  type="text"
                  className="call-modal-input"
                  value={followUpTitle}
                  onChange={(e) => setFollowUpTitle(e.target.value)}
                  placeholder="Follow-up title..."
                />
              </div>

              <div className="call-modal-field">
                <label className="call-modal-label">Due Date</label>
                <input
                  type="date"
                  className="call-modal-input"
                  value={followUpDueDate}
                  onChange={(e) => setFollowUpDueDate(e.target.value)}
                />
              </div>

              <div className="call-modal-field">
                <label className="call-modal-label">Priority</label>
                <select
                  className="call-modal-select"
                  value={followUpPriority}
                  onChange={(e) => setFollowUpPriority(e.target.value)}
                >
                  <option value="LOW">Low</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HIGH">High</option>
                  <option value="URGENT">Urgent</option>
                </select>
              </div>

              <div className="call-modal-field">
                <label className="call-modal-label">Notes</label>
                <textarea
                  className="call-modal-textarea"
                  value={followUpNotes}
                  onChange={(e) => setFollowUpNotes(e.target.value)}
                  placeholder="Follow-up details..."
                />
              </div>

              <div className="call-modal-actions">
                <button
                  className="call-modal-skip-btn"
                  onClick={skipFollowUp}
                >
                  Skip
                </button>
                <button
                  className="call-modal-submit-btn"
                  onClick={handleSubmitFollowUp}
                  disabled={submittingFollowUp || !followUpTitle.trim()}
                >
                  {submittingFollowUp ? "Creating..." : "Create Follow-Up"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Opportunity Modal ── */}
      {showOpportunityModal && (
        <div className="ui-modal-overlay" onClick={skipOpportunity}>
          <div className="ui-modal ui-modal--md" onClick={(e) => e.stopPropagation()}>
            <div className="ui-modal-header">
              <h3 className="ui-modal-title">
                <Target size={20} style={{ marginRight: 8, verticalAlign: "middle" }} />
                Create Opportunity
              </h3>
              <button className="ui-modal-close" onClick={skipOpportunity}>
                <X size={18} />
              </button>
            </div>
            <div className="ui-modal-body">
              <div className="call-modal-prefilled">
                Customer: <strong>{customerName}</strong>
                {contactId && contacts.length > 0 && (
                  <>
                    {" | "}Contact:{" "}
                    <strong>
                      {(() => {
                        const c = contacts.find((ct) => ct.id === contactId);
                        return c ? `${c.firstName} ${c.lastName}` : "";
                      })()}
                    </strong>
                  </>
                )}
              </div>

              <div className="call-modal-field">
                <label className="call-modal-label">Opportunity Title *</label>
                <input
                  type="text"
                  className="call-modal-input"
                  value={oppTitle}
                  onChange={(e) => setOppTitle(e.target.value)}
                  placeholder="Opportunity title..."
                />
              </div>

              <div className="call-modal-field">
                <label className="call-modal-label">Estimated Value ($)</label>
                <input
                  type="number"
                  className="call-modal-input"
                  value={oppValue}
                  onChange={(e) => setOppValue(e.target.value)}
                  placeholder="0.00"
                  min="0"
                  step="0.01"
                />
              </div>

              <div className="call-modal-field">
                <label className="call-modal-label">Notes</label>
                <textarea
                  className="call-modal-textarea"
                  value={oppNotes}
                  onChange={(e) => setOppNotes(e.target.value)}
                  placeholder="Opportunity details, scope, next steps..."
                />
              </div>

              <div className="call-modal-actions">
                <button
                  className="call-modal-skip-btn"
                  onClick={skipOpportunity}
                >
                  Skip
                </button>
                <button
                  className="call-modal-submit-btn"
                  onClick={handleSubmitOpportunity}
                  disabled={submittingOpp || !oppTitle.trim()}
                >
                  {submittingOpp ? "Creating..." : "Create Opportunity"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
