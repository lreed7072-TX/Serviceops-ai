"use client";

import type { TemplateDefinition } from "./types";

interface TemplateSettingsProps {
  definition: TemplateDefinition;
  onChange: (def: TemplateDefinition) => void;
}

export default function TemplateSettings({ definition, onChange }: TemplateSettingsProps) {
  const { settings } = definition;
  const { coverPage } = settings;

  const updateSettings = (patch: Partial<TemplateDefinition["settings"]>) => {
    onChange({
      ...definition,
      settings: { ...settings, ...patch },
    });
  };

  const updateCoverPage = (patch: Partial<TemplateDefinition["settings"]["coverPage"]>) => {
    onChange({
      ...definition,
      settings: {
        ...settings,
        coverPage: { ...coverPage, ...patch },
      },
    });
  };

  return (
    <div className="template-settings">
      <h3 className="template-settings-title">Template Settings</h3>

      <div className="template-settings-grid">
        {/* Cover Page */}
        <div className="properties-checkbox-row">
          <input
            id="setting-cover-enabled"
            type="checkbox"
            checked={coverPage.enabled}
            onChange={(e) => updateCoverPage({ enabled: e.target.checked })}
          />
          <label htmlFor="setting-cover-enabled">Cover Page Enabled</label>
        </div>

        {coverPage.enabled && (
          <div className="template-settings-subsection">
            <div className="properties-checkbox-row">
              <input
                id="setting-show-logo"
                type="checkbox"
                checked={coverPage.showLogo}
                onChange={(e) => updateCoverPage({ showLogo: e.target.checked })}
              />
              <label htmlFor="setting-show-logo">Show Logo</label>
            </div>

            <div className="properties-checkbox-row">
              <input
                id="setting-show-customer"
                type="checkbox"
                checked={coverPage.showCustomerName}
                onChange={(e) => updateCoverPage({ showCustomerName: e.target.checked })}
              />
              <label htmlFor="setting-show-customer">Show Customer Name</label>
            </div>

            <div className="properties-field-group">
              <label htmlFor="setting-subtitle">Subtitle</label>
              <input
                id="setting-subtitle"
                type="text"
                value={coverPage.subtitle}
                onChange={(e) => updateCoverPage({ subtitle: e.target.value })}
                placeholder="e.g., Pump Startup Report"
              />
            </div>
          </div>
        )}

        {/* Require All Fields */}
        <div className="properties-checkbox-row">
          <input
            id="setting-require-all"
            type="checkbox"
            checked={settings.requireAllFields}
            onChange={(e) => updateSettings({ requireAllFields: e.target.checked })}
          />
          <label htmlFor="setting-require-all">Require All Fields</label>
        </div>
      </div>
    </div>
  );
}
