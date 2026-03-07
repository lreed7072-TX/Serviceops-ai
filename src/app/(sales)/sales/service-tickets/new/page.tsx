"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import {
  ArrowLeft,
  Search,
  Building2,
  MapPin,
  User,
  AlertTriangle,
  Calendar,
  FileText,
  Send,
} from "lucide-react";
import "../service-tickets.css";

type Customer = {
  id: string;
  name: string;
};

type Site = {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
};

type Contact = {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
};

export default function NewServiceTicketPage() {
  const router = useRouter();
  const toast = useToast();

  // Customer search state
  const [customerSearch, setCustomerSearch] = useState("");
  const [customerResults, setCustomerResults] = useState<Customer[]>([]);
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [searchingCustomers, setSearchingCustomers] = useState(false);
  const customerSearchRef = useRef<HTMLDivElement>(null);
  const customerSearchTimeout = useRef<NodeJS.Timeout | null>(null);

  // Dependent dropdowns
  const [sites, setSites] = useState<Site[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);

  // Form state
  const [formData, setFormData] = useState({
    customerId: "",
    siteId: "",
    contactId: "",
    reason: "",
    urgency: "NORMAL",
    requestedDate: "",
    siteAddress: "",
    notes: "",
  });

  const [submitting, setSubmitting] = useState(false);

  // Close customer dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        customerSearchRef.current &&
        !customerSearchRef.current.contains(e.target as Node)
      ) {
        setShowCustomerDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Search customers with debounce
  useEffect(() => {
    if (customerSearchTimeout.current) {
      clearTimeout(customerSearchTimeout.current);
    }

    if (!customerSearch.trim()) {
      setCustomerResults([]);
      setShowCustomerDropdown(false);
      return;
    }

    customerSearchTimeout.current = setTimeout(async () => {
      setSearchingCustomers(true);
      try {
        const res = await apiFetch(
          `/api/customers?search=${encodeURIComponent(customerSearch)}&limit=10`
        );
        if (res.ok) {
          const data = await res.json();
          setCustomerResults(data.data ?? []);
          setShowCustomerDropdown(true);
        }
      } catch {
        // Silently fail search
      } finally {
        setSearchingCustomers(false);
      }
    }, 300);

    return () => {
      if (customerSearchTimeout.current) {
        clearTimeout(customerSearchTimeout.current);
      }
    };
  }, [customerSearch]);

  // Fetch sites and contacts when customer changes
  useEffect(() => {
    if (!formData.customerId) {
      setSites([]);
      setContacts([]);
      return;
    }

    const fetchDependents = async () => {
      try {
        const [sitesRes, contactsRes] = await Promise.all([
          apiFetch(`/api/sites?customerId=${formData.customerId}`),
          apiFetch(`/api/contacts?customerId=${formData.customerId}`),
        ]);

        if (sitesRes.ok) {
          const data = await sitesRes.json();
          setSites(data.data ?? []);
        }
        if (contactsRes.ok) {
          const data = await contactsRes.json();
          setContacts(data.data ?? []);
        }
      } catch {
        // Silently fail
      }
    };

    fetchDependents();
  }, [formData.customerId]);

  const handleSelectCustomer = (customer: Customer) => {
    setSelectedCustomer(customer);
    setCustomerSearch(customer.name);
    setShowCustomerDropdown(false);
    setFormData((prev) => ({
      ...prev,
      customerId: customer.id,
      siteId: "",
      contactId: "",
      siteAddress: "",
    }));
  };

  const handleClearCustomer = () => {
    setSelectedCustomer(null);
    setCustomerSearch("");
    setCustomerResults([]);
    setFormData((prev) => ({
      ...prev,
      customerId: "",
      siteId: "",
      contactId: "",
      siteAddress: "",
    }));
    setSites([]);
    setContacts([]);
  };

  const handleSiteChange = (siteId: string) => {
    setFormData((prev) => ({ ...prev, siteId }));

    // Auto-fill site address
    if (siteId) {
      const site = sites.find((s) => s.id === siteId);
      if (site) {
        const parts = [site.address, site.city, site.state, site.zip].filter(
          Boolean
        );
        setFormData((prev) => ({
          ...prev,
          siteId,
          siteAddress: parts.join(", "),
        }));
      }
    } else {
      setFormData((prev) => ({ ...prev, siteId, siteAddress: "" }));
    }
  };

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.customerId) {
      toast.error("Please select a customer");
      return;
    }
    if (!formData.reason.trim()) {
      toast.error("Please enter a reason for service");
      return;
    }

    setSubmitting(true);
    try {
      const body: Record<string, any> = {
        customerId: formData.customerId,
        reason: formData.reason.trim(),
        urgency: formData.urgency,
      };
      if (formData.siteId) body.siteId = formData.siteId;
      if (formData.contactId) body.contactId = formData.contactId;
      if (formData.requestedDate) body.requestedDate = formData.requestedDate;
      if (formData.siteAddress.trim())
        body.siteAddress = formData.siteAddress.trim();
      if (formData.notes.trim()) body.notes = formData.notes.trim();

      const res = await apiFetch("/api/service-tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to create service ticket");
      }

      toast.success("Service ticket created successfully");
      router.push("/sales/service-tickets");
    } catch (e: any) {
      toast.error(e?.message || "Failed to create service ticket");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="st-page">
      {/* Back Link */}
      <Link href="/sales/service-tickets" className="st-back-link">
        <ArrowLeft size={16} />
        Back to Service Tickets
      </Link>

      {/* Page Header */}
      <div className="st-form-header">
        <h1>New Service Ticket</h1>
        <p className="st-page-subtitle">
          Create a new service request from a customer
        </p>
      </div>

      <form onSubmit={handleSubmit} className="st-form">
        {/* Customer (searchable dropdown) */}
        <div className="st-form-group">
          <label className="st-form-label">
            <Building2 size={14} />
            Customer <span className="st-required">*</span>
          </label>
          <div className="st-searchable-dropdown" ref={customerSearchRef}>
            <div className="st-search-input-wrapper">
              <Search size={14} className="st-input-icon" />
              <input
                type="text"
                className="st-form-input st-search-field"
                placeholder="Search customers..."
                value={customerSearch}
                onChange={(e) => {
                  setCustomerSearch(e.target.value);
                  if (selectedCustomer) {
                    handleClearCustomer();
                  }
                }}
                onFocus={() => {
                  if (customerResults.length > 0) {
                    setShowCustomerDropdown(true);
                  }
                }}
              />
              {selectedCustomer && (
                <button
                  type="button"
                  className="st-clear-btn"
                  onClick={handleClearCustomer}
                  title="Clear selection"
                >
                  x
                </button>
              )}
            </div>
            {showCustomerDropdown && (
              <div className="st-dropdown-list">
                {searchingCustomers && (
                  <div className="st-dropdown-loading">Searching...</div>
                )}
                {!searchingCustomers && customerResults.length === 0 && (
                  <div className="st-dropdown-empty">No customers found</div>
                )}
                {customerResults.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className="st-dropdown-item"
                    onClick={() => handleSelectCustomer(c)}
                  >
                    <Building2 size={14} />
                    {c.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Site (filtered by customer) */}
        {formData.customerId && (
          <div className="st-form-group">
            <label className="st-form-label">
              <MapPin size={14} />
              Site
            </label>
            <select
              className="st-form-select"
              name="siteId"
              value={formData.siteId}
              onChange={(e) => handleSiteChange(e.target.value)}
            >
              <option value="">Select a site (optional)</option>
              {sites.map((site) => (
                <option key={site.id} value={site.id}>
                  {site.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Contact (filtered by customer) */}
        {formData.customerId && (
          <div className="st-form-group">
            <label className="st-form-label">
              <User size={14} />
              Contact
            </label>
            <select
              className="st-form-select"
              name="contactId"
              value={formData.contactId}
              onChange={handleChange}
            >
              <option value="">Select a contact (optional)</option>
              {contacts.map((contact) => (
                <option key={contact.id} value={contact.id}>
                  {contact.name || contact.email || "Unnamed contact"}
                  {contact.phone ? ` - ${contact.phone}` : ""}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Reason for Service */}
        <div className="st-form-group">
          <label className="st-form-label">
            <FileText size={14} />
            Reason for Service <span className="st-required">*</span>
          </label>
          <textarea
            className="st-form-textarea"
            name="reason"
            value={formData.reason}
            onChange={handleChange}
            placeholder="Describe the reason for the service request..."
            rows={4}
            required
          />
        </div>

        {/* Urgency */}
        <div className="st-form-group">
          <label className="st-form-label">
            <AlertTriangle size={14} />
            Urgency
          </label>
          <select
            className="st-form-select"
            name="urgency"
            value={formData.urgency}
            onChange={handleChange}
          >
            <option value="LOW">Low</option>
            <option value="NORMAL">Normal</option>
            <option value="HIGH">High</option>
            <option value="EMERGENCY">Emergency</option>
          </select>
        </div>

        {/* Requested Service Date */}
        <div className="st-form-group">
          <label className="st-form-label">
            <Calendar size={14} />
            Requested Service Date
          </label>
          <input
            type="date"
            className="st-form-input"
            name="requestedDate"
            value={formData.requestedDate}
            onChange={handleChange}
          />
        </div>

        {/* Site Address */}
        <div className="st-form-group">
          <label className="st-form-label">
            <MapPin size={14} />
            Site Address
          </label>
          <input
            type="text"
            className="st-form-input"
            name="siteAddress"
            value={formData.siteAddress}
            onChange={handleChange}
            placeholder="Auto-fills from selected site, or enter manually"
          />
        </div>

        {/* Notes */}
        <div className="st-form-group">
          <label className="st-form-label">
            <FileText size={14} />
            Notes
          </label>
          <textarea
            className="st-form-textarea"
            name="notes"
            value={formData.notes}
            onChange={handleChange}
            placeholder="Additional notes or instructions..."
            rows={3}
          />
        </div>

        {/* Actions */}
        <div className="st-form-actions">
          <Link href="/sales/service-tickets" className="st-form-cancel-btn">
            Cancel
          </Link>
          <button
            type="submit"
            className="st-form-submit-btn"
            disabled={submitting}
          >
            {submitting ? (
              "Creating..."
            ) : (
              <>
                <Send size={16} />
                Create Ticket
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
