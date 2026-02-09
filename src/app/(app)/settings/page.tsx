"use client";

import { useState } from "react";
import SettingsTabs from "@/components/settings/SettingsTabs";
import CompanySettings from "@/components/settings/CompanySettings";
import EmailSettings from "@/components/settings/EmailSettings";
import "./settings.css";

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState("company");

  const renderContent = () => {
    switch (activeTab) {
      case "company":
        return <CompanySettings />;
      case "email":
        return <EmailSettings />;
      case "labor-rates":
        return (
          <div className="settings-placeholder">
            <h2>Labor Rates</h2>
            <p>Labor rate management coming soon.</p>
          </div>
        );
      case "users":
        return (
          <div className="settings-placeholder">
            <h2>User Management</h2>
            <p>User invitation and role management coming soon.</p>
          </div>
        );
      case "organization":
        return (
          <div className="settings-placeholder">
            <h2>Organization Preferences</h2>
            <p>Timezone, currency, and other preferences coming soon.</p>
          </div>
        );
      default:
        return <CompanySettings />;
    }
  };

  return (
    <div className="page-container settings-page">
      <div className="page-header">
        <div>
          <h1>Settings</h1>
          <p className="page-subtitle">
            Manage your organization settings and preferences
          </p>
        </div>
      </div>

      <div className="settings-layout">
        <SettingsTabs activeTab={activeTab} onTabChange={setActiveTab} />
        <div className="settings-content">
          {renderContent()}
        </div>
      </div>
    </div>
  );
}
