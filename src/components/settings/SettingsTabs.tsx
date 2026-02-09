"use client";

import "./SettingsTabs.css";

interface SettingsTabsProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const TABS = [
  { id: "company", label: "Company Info" },
  { id: "email", label: "Email Config" },
  { id: "labor-rates", label: "Labor Rates" },
  { id: "users", label: "Users" },
  { id: "organization", label: "Organization" },
];

export default function SettingsTabs({ activeTab, onTabChange }: SettingsTabsProps) {
  return (
    <nav className="settings-tabs">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          className={`settings-tab ${activeTab === tab.id ? "active" : ""}`}
          onClick={() => onTabChange(tab.id)}
        >
          <span className="tab-label">{tab.label}</span>
        </button>
      ))}
    </nav>
  );
}
