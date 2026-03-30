// ============================================================================
// ServiceOpsIQ Help Center Data
// ============================================================================
// Contains all help categories, articles, and search functionality.
// Categories 1-10 articles are defined below.
// Categories 11-19 articles will be appended in a subsequent update.
// ============================================================================

// --- Type Exports ---

export interface HelpStep {
  title: string;
  description: string;
}

export interface HelpArticle {
  id: string;
  categoryId: string;
  title: string;
  summary: string;
  content: string[];
  steps?: HelpStep[];
  tips?: string[];
  relatedArticleIds?: string[];
  keywords: string[];
  videoUrl?: string;
}

export interface HelpCategory {
  id: string;
  title: string;
  description: string;
}

// --- All 19 Categories ---

export const HELP_CATEGORIES: HelpCategory[] = [
  { id: "training-videos", title: "Training Videos", description: "Watch step-by-step video tutorials covering every feature in ServiceOpsIQ" },
  { id: "getting-started", title: "Getting Started", description: "Set up your organization, invite users, and learn the basics" },
  { id: "customers", title: "Customer Management", description: "Create and manage customer accounts, contacts, and service history" },
  { id: "sites", title: "Site Management", description: "Manage job sites, access notes, and site-specific assets" },
  { id: "assets", title: "Asset Management", description: "Track equipment with classification, criticality, and service history" },
  { id: "procedures", title: "Procedure Templates", description: "Build reusable procedure templates for standardized field work" },
  { id: "standards", title: "Standards Packs", description: "Group tasks and procedures into reusable standards packs" },
  { id: "work-orders", title: "Work Orders", description: "Create, assign, and manage work orders through their lifecycle" },
  { id: "visits", title: "Visit Execution", description: "Schedule visits, track time, capture photos and signatures" },
  { id: "quotes", title: "Quoting", description: "Create quotes, manage approvals, and convert to work orders" },
  { id: "invoices", title: "Invoicing", description: "Generate invoices, record payments, and sync with QuickBooks" },
  { id: "pm-schedules", title: "PM Schedules", description: "Set up preventive maintenance schedules with auto-generated work orders" },
  { id: "materials", title: "Materials & Inventory", description: "Manage your parts catalog, stock levels, and material usage" },
  { id: "reports", title: "Reports & Analytics", description: "Track KPIs, revenue, technician performance, and export reports" },
  { id: "knowledge-base", title: "Knowledge Base", description: "Upload and organize technical documents for your team" },
  { id: "portal-customer", title: "Customer Portal", description: "Give customers self-service access to quotes, invoices, and work orders" },
  { id: "portal-tech", title: "Tech Portal", description: "Technician mobile interface for assigned work and field documentation" },
  { id: "settings", title: "Settings", description: "Manage users, roles, integrations, and organization settings" },
  { id: "global-search", title: "Global Search", description: "Quickly find any record with keyboard-driven global search" },
  { id: "tips", title: "Tips & Shortcuts", description: "Power user tips, keyboard shortcuts, and productivity tricks" },
  { id: "qbo-integration", title: "QuickBooks Integration", description: "Connect, configure, and manage your QuickBooks Online accounting sync" },
  { id: "ai-features", title: "AI Features", description: "AI-powered insights, copilot assistant, risk assessment, and smart recommendations" },
  { id: "crm-sales", title: "CRM & Sales", description: "Manage your sales pipeline, call logs, follow-ups, opportunities, and service tickets" },
  { id: "custom-reports", title: "Custom Reports & Forms", description: "Build custom report templates with drag-and-drop and capture field data with custom forms" },
];

// ============================================================================
// CATEGORY 1: Getting Started (6 articles)
// ============================================================================

export const GETTING_STARTED_ARTICLES: HelpArticle[] = [
  {
    id: "gs-welcome",
    categoryId: "getting-started",
    title: "Welcome to ServiceOpsIQ",
    summary: "An overview of the platform and what you can accomplish with ServiceOpsIQ.",
    content: [
      "ServiceOpsIQ is an enterprise field service management platform designed for rotating equipment service companies. It covers the full lifecycle from quoting and scheduling through execution, invoicing, and analytics.",
      "The platform is organized around a sidebar navigation with modules for Customers, Sites, Assets, Work Orders, Visits, Quotes, Invoices, and more. Each module connects seamlessly so data flows from one stage to the next without re-entry.",
      "Start by setting up your organization profile, inviting your team, and creating your first customer. From there you can build out sites, assets, procedures, and begin managing work orders in production.",
    ],
    steps: [
      { title: "Log in to your account", description: "Use the credentials provided during signup to access your dashboard." },
      { title: "Review the sidebar navigation", description: "Familiarize yourself with the main modules: Customers, Sites, Assets, Work Orders, Quotes, Invoices, and Reports." },
      { title: "Set up your organization", description: "Navigate to Settings to configure your company name, address, and logo." },
      { title: "Invite your team", description: "Go to Settings > Users and send invitations to dispatchers and technicians." },
      { title: "Create your first customer", description: "Head to the Customers module and add your first customer record to get started." },
    ],
    tips: [
      "Bookmark the dashboard page for quick access each morning.",
      "Use the global search (Ctrl+K) to jump to any record instantly.",
      "Check the Reports module weekly to monitor team performance and revenue trends.",
    ],
    relatedArticleIds: ["gs-org-setup", "gs-invite-users", "gs-dashboard"],
    keywords: ["welcome", "overview", "getting started", "introduction", "first time", "new user", "setup", "onboarding"],
  },
  {
    id: "gs-org-setup",
    categoryId: "getting-started",
    title: "Setting Up Your Organization",
    summary: "Configure your company profile including name, address, logo, and default settings.",
    content: [
      "Your organization profile appears on all customer-facing documents including quotes, invoices, and work order reports. Keeping it accurate ensures a professional appearance on every PDF you generate.",
      "Navigate to Settings to update your company name, physical address, phone number, and email. You can also upload your company logo which will appear in the header of generated documents.",
      "Default settings like tax rates, payment terms, and work order numbering prefixes can also be configured here. These defaults are applied automatically when creating new records but can be overridden on individual items.",
    ],
    steps: [
      { title: "Open Settings", description: "Click Settings in the sidebar navigation to access organization configuration." },
      { title: "Enter company information", description: "Fill in your company name, address, phone, and primary email address." },
      { title: "Upload your logo", description: "Click the logo upload area and select a PNG or JPG file. Recommended size is 400x100 pixels." },
      { title: "Configure defaults", description: "Set your default tax rate, payment terms (Net 30, Net 60, etc.), and currency." },
      { title: "Save changes", description: "Click Save to apply your organization settings across the platform." },
    ],
    tips: [
      "Use a transparent PNG logo for the cleanest look on generated PDFs.",
      "Setting accurate default payment terms saves time when creating invoices.",
      "You can update your organization details at any time without affecting existing documents.",
    ],
    relatedArticleIds: ["gs-welcome", "gs-invite-users", "inv-pdf"],
    keywords: ["organization", "company", "profile", "settings", "logo", "address", "setup", "configure"],
  },
  {
    id: "gs-invite-users",
    categoryId: "getting-started",
    title: "Inviting Team Members",
    summary: "Add dispatchers, technicians, and administrators to your organization.",
    content: [
      "ServiceOpsIQ supports multiple user roles so each team member sees only the features relevant to their job. Administrators have full access, dispatchers manage scheduling and work orders, and technicians focus on field execution.",
      "To invite a new user, navigate to Settings > Users and click the Invite User button. Enter their email address and select the appropriate role. They will receive an email invitation with a link to create their account.",
      "Invited users appear in a pending state until they accept the invitation and complete their account setup. You can resend invitations or revoke them if needed from the same Users management page.",
    ],
    steps: [
      { title: "Navigate to Settings > Users", description: "Open the Settings page and select the Users tab to see your team roster." },
      { title: "Click Invite User", description: "Click the Invite User button to open the invitation form." },
      { title: "Enter email and select role", description: "Type the user's email address and choose Admin, Dispatcher, or Tech from the role dropdown." },
      { title: "Send the invitation", description: "Click Send Invite. The user will receive an email with a signup link." },
      { title: "Verify acceptance", description: "Check the Users list to confirm the invitation was accepted and the user is active." },
    ],
    tips: [
      "Start with the Dispatcher role for office staff who manage scheduling but should not change settings.",
      "Technicians can be invited in bulk by entering multiple email addresses separated by commas.",
      "Revoke pending invitations immediately if sent to the wrong email address.",
    ],
    relatedArticleIds: ["gs-roles", "gs-org-setup", "gs-welcome"],
    keywords: ["invite", "users", "team", "add user", "email", "dispatcher", "technician", "admin", "onboarding"],
  },
  {
    id: "gs-roles",
    categoryId: "getting-started",
    title: "Understanding Roles & Permissions",
    summary: "Learn what each role can access and how permissions are enforced across the platform.",
    content: [
      "ServiceOpsIQ uses three primary roles: Admin, Dispatcher, and Tech. Each role defines what modules a user can access, what actions they can perform, and what data they can see. Roles are assigned during invitation and can be changed by an Admin at any time.",
      "Admins have unrestricted access to all modules including Settings, user management, integrations, and billing. Dispatchers can create and manage work orders, quotes, invoices, customers, and sites but cannot modify organization settings or manage other users.",
      "Technicians have a focused view designed for field work. They can view their assigned work orders, log visits, capture photos and signatures, and update task completion. They cannot create quotes, invoices, or access financial reports.",
    ],
    steps: [
      { title: "Review role capabilities", description: "Check the roles table in Settings > Users to see a breakdown of permissions for each role." },
      { title: "Assign roles during invitation", description: "Choose the appropriate role when inviting a new team member based on their job function." },
      { title: "Change a user's role", description: "Click on a user in the Users list and select a new role from the dropdown. Changes take effect immediately." },
    ],
    tips: [
      "Keep the number of Admin users minimal for better security and audit control.",
      "Dispatchers are ideal for office coordinators who handle customer communication and scheduling.",
      "Tech role users automatically see the mobile-optimized Tech Portal when accessing from a phone.",
    ],
    relatedArticleIds: ["gs-invite-users", "gs-org-setup", "gs-welcome"],
    keywords: ["roles", "permissions", "admin", "dispatcher", "tech", "access", "security", "authorization"],
  },
  {
    id: "gs-dashboard",
    categoryId: "getting-started",
    title: "Navigating the Dashboard",
    summary: "Understand the main dashboard layout, KPI cards, and quick-action buttons.",
    content: [
      "The dashboard is your home base when you log in. It displays key performance indicators (KPIs) at the top including open work orders, pending quotes, outstanding invoices, and revenue for the current month. These numbers update in real time as your team works.",
      "Below the KPIs you will find quick-action buttons for common tasks like creating a new work order, adding a customer, or generating a quote. These shortcuts save you from navigating through multiple menus for everyday operations.",
      "The dashboard also shows recent activity including the latest work orders, upcoming visits, and overdue invoices. Use the sidebar to navigate to specific modules for deeper management of any area.",
    ],
    steps: [
      { title: "Review KPI cards", description: "Check the top row for a snapshot of open work orders, pending quotes, and monthly revenue." },
      { title: "Use quick actions", description: "Click any quick-action button to jump directly to creating a new record." },
      { title: "Check recent activity", description: "Scroll down to see the latest work orders, visits, and invoice activity." },
      { title: "Navigate via sidebar", description: "Click any module in the sidebar to drill into that area for detailed management." },
    ],
    tips: [
      "The dashboard KPIs refresh automatically so you always see current numbers.",
      "Overdue invoices appear highlighted in red on the dashboard for easy identification.",
      "Customize your workflow by starting each day with the dashboard to prioritize tasks.",
    ],
    relatedArticleIds: ["gs-welcome", "gs-search", "wo-create"],
    keywords: ["dashboard", "home", "KPI", "overview", "navigation", "sidebar", "quick actions", "metrics"],
  },
  {
    id: "gs-search",
    categoryId: "getting-started",
    title: "Using Global Search",
    summary: "Find any record instantly with the keyboard-driven global search feature.",
    content: [
      "Global search lets you find any customer, site, asset, work order, quote, or invoice by typing a few characters. Press Ctrl+K (or Cmd+K on Mac) from anywhere in the application to open the search overlay.",
      "As you type, results appear grouped by record type with the most relevant matches at the top. Click a result or use arrow keys and Enter to navigate directly to that record. Search checks names, numbers, addresses, and other key fields.",
      "Global search also supports quick filters. Type a prefix like 'wo:' to search only work orders, 'cust:' for customers, or 'inv:' for invoices. This narrows results when you know what type of record you are looking for.",
    ],
    steps: [
      { title: "Open global search", description: "Press Ctrl+K (Cmd+K on Mac) or click the search icon in the top navigation bar." },
      { title: "Type your search term", description: "Enter a name, number, address, or any identifying text. Results appear as you type." },
      { title: "Navigate results", description: "Use arrow keys to highlight a result and press Enter to open it, or click directly." },
      { title: "Use type prefixes", description: "Narrow results by typing 'wo:', 'cust:', 'inv:', 'quote:', or 'site:' before your search term." },
    ],
    tips: [
      "Global search is the fastest way to navigate the platform once you have data in the system.",
      "Search by work order number (e.g., 'WO-1042') for instant access to a specific record.",
      "Press Escape to close the search overlay without navigating away from your current page.",
    ],
    relatedArticleIds: ["gs-dashboard", "gs-welcome"],
    keywords: ["search", "find", "global search", "Ctrl+K", "lookup", "quick find", "navigate", "filter"],
  },
];

// ============================================================================
// CATEGORY 2: Customer Management (5 articles)
// ============================================================================

export const CUSTOMER_ARTICLES: HelpArticle[] = [
  {
    id: "cust-create",
    categoryId: "customers",
    title: "Creating a Customer",
    summary: "Add a new customer with company details, billing address, and default payment terms.",
    content: [
      "Customers are the foundation of your service operations. Every site, work order, quote, and invoice ties back to a customer record. Creating a complete customer profile upfront saves time on every downstream record.",
      "Navigate to the Customers module and click Create Customer. Enter the company name, primary address, phone number, and email. You can also set default payment terms (Net 30, Net 60, etc.) that will auto-populate on new invoices.",
      "After creating a customer, you can immediately add contacts, create sites, and begin building work orders. The customer record serves as the central hub linking all related service activity.",
    ],
    steps: [
      { title: "Open the Customers module", description: "Click Customers in the sidebar to view your customer list." },
      { title: "Click Create Customer", description: "Click the Create Customer button in the top-right corner of the list." },
      { title: "Enter company details", description: "Fill in the company name, address, phone number, and primary email." },
      { title: "Set payment terms", description: "Choose default payment terms from the dropdown. These apply to all new invoices for this customer." },
      { title: "Save the customer", description: "Click Save to create the customer record. You can now add contacts and sites." },
    ],
    tips: [
      "Use the official company name as it should appear on invoices and quotes.",
      "Setting payment terms at the customer level avoids manually entering them on every invoice.",
      "You can always edit customer details later without affecting existing invoices.",
    ],
    relatedArticleIds: ["cust-contacts", "cust-edit", "site-create", "inv-from-wo"],
    keywords: ["customer", "create", "add", "company", "billing", "new customer", "account", "client"],
  },
  {
    id: "cust-edit",
    categoryId: "customers",
    title: "Editing Customer Details",
    summary: "Update customer information including address, payment terms, and notes.",
    content: [
      "Customer details can be updated at any time by opening the customer record and clicking the Edit button. Changes to the company name or address will apply to future documents but will not retroactively change existing invoices or quotes.",
      "Common edits include updating the billing address after a customer relocates, changing payment terms based on a new agreement, or adding internal notes about the account. All changes are saved immediately and visible to your team.",
      "If a customer has been acquired or renamed, update the company name in the customer record. Historical work orders and invoices will still reference the original name at the time they were created.",
    ],
    steps: [
      { title: "Open the customer record", description: "Navigate to Customers and click on the customer you want to edit." },
      { title: "Click Edit", description: "Click the Edit button to enable editing of all customer fields." },
      { title: "Make your changes", description: "Update the company name, address, payment terms, phone, email, or notes as needed." },
      { title: "Save changes", description: "Click Save to apply your updates. Changes take effect immediately for new records." },
    ],
    tips: [
      "Add internal notes to the customer record to capture important context like preferred contact methods.",
      "Changes to payment terms only affect new invoices, not existing ones.",
      "Use the customer notes field to document any special billing or service arrangements.",
    ],
    relatedArticleIds: ["cust-create", "cust-contacts", "cust-status"],
    keywords: ["edit", "update", "customer", "modify", "change", "address", "payment terms", "notes"],
  },
  {
    id: "cust-contacts",
    categoryId: "customers",
    title: "Managing Contacts",
    summary: "Add multiple contacts per customer with roles, phone numbers, and email addresses.",
    content: [
      "Each customer can have multiple contacts representing different people at the company. Contacts typically include the primary decision maker, the accounts payable representative, and on-site personnel who interact with your technicians.",
      "To add a contact, open the customer record and navigate to the Contacts tab. Enter the contact's name, title, email, phone, and mark whether they are the primary contact. The primary contact receives all automated notifications and is the default recipient for quotes and invoices.",
      "Contacts can also be associated with specific sites. When a technician arrives at a job site, they can see the on-site contact's name and phone number to coordinate access and approvals.",
    ],
    steps: [
      { title: "Open the customer record", description: "Navigate to the Customers module and select the customer." },
      { title: "Go to the Contacts tab", description: "Click the Contacts tab to see existing contacts and add new ones." },
      { title: "Click Add Contact", description: "Click Add Contact and fill in the name, title, email, and phone number." },
      { title: "Set as primary if applicable", description: "Toggle the Primary Contact switch if this person is the main point of contact." },
      { title: "Save the contact", description: "Click Save. The contact is now available when creating work orders and sending documents." },
    ],
    tips: [
      "Always set a primary contact to ensure notifications and documents reach the right person.",
      "Include the contact's direct phone number so technicians can reach them from the field.",
      "Associate site-level contacts so techs know exactly who to call when arriving at a specific location.",
    ],
    relatedArticleIds: ["cust-create", "cust-edit", "site-create", "quote-send"],
    keywords: ["contacts", "contact", "phone", "email", "primary contact", "people", "representative", "personnel"],
  },
  {
    id: "cust-status",
    categoryId: "customers",
    title: "Customer Status",
    summary: "Manage active, inactive, and archived customer statuses to keep your list organized.",
    content: [
      "Customer records have three statuses: Active, Inactive, and Archived. Active customers appear in all dropdowns and search results by default. Inactive customers are hidden from dropdowns but their historical data is fully preserved.",
      "Mark a customer as Inactive when they are no longer contracting your services but you want to retain their service history for reference. Archived customers are completely hidden from standard views and are typically used for companies that have closed or been absorbed by another entity.",
      "You can reactivate an Inactive or Archived customer at any time. Reactivation restores them to all dropdowns and they can immediately receive new work orders, quotes, and invoices.",
    ],
    steps: [
      { title: "Open the customer record", description: "Navigate to the customer you want to update." },
      { title: "Click the status badge", description: "Click the status badge near the customer name to open the status options." },
      { title: "Select new status", description: "Choose Active, Inactive, or Archived from the dropdown." },
      { title: "Confirm the change", description: "Confirm the status change. The customer list will update accordingly." },
    ],
    tips: [
      "Use Inactive for seasonal customers who may return rather than archiving them permanently.",
      "The customer list filter defaults to Active. Toggle the filter to see Inactive or Archived records.",
      "Inactive customers still appear in reports and historical data so your revenue numbers remain accurate.",
    ],
    relatedArticleIds: ["cust-create", "cust-edit", "cust-history"],
    keywords: ["status", "active", "inactive", "archived", "deactivate", "hide", "customer status", "reactivate"],
  },
  {
    id: "cust-history",
    categoryId: "customers",
    title: "Viewing Service History",
    summary: "Review a customer's complete service history including work orders, quotes, and invoices.",
    content: [
      "Every customer record includes a Service History tab that consolidates all work orders, quotes, invoices, and visits associated with that account. This gives you a complete timeline of your relationship with the customer.",
      "Service history entries are sorted by date with the most recent activity at the top. You can filter by record type (work orders, quotes, invoices) or by date range to focus on a specific period. Each entry links directly to the full record.",
      "Use service history during customer calls to quickly reference past work, outstanding balances, or upcoming scheduled maintenance. It eliminates the need to search through multiple modules to piece together a customer's activity.",
    ],
    steps: [
      { title: "Open the customer record", description: "Navigate to the customer whose history you want to review." },
      { title: "Click the History tab", description: "Select the Service History tab to see the full activity timeline." },
      { title: "Filter by record type", description: "Use the filter buttons to show only work orders, quotes, or invoices." },
      { title: "Click any entry to view details", description: "Click a line item to open the full record in its respective module." },
    ],
    tips: [
      "Review service history before customer calls to be fully prepared with context.",
      "Use date range filters to isolate activity for a specific contract period or fiscal year.",
      "Service history is read-only and updates automatically as new records are created.",
    ],
    relatedArticleIds: ["cust-create", "cust-status", "wo-create", "inv-from-wo"],
    keywords: ["history", "service history", "timeline", "past work", "activity", "record", "work orders", "invoices"],
  },
];

// ============================================================================
// CATEGORY 3: Site Management (4 articles)
// ============================================================================

export const SITE_ARTICLES: HelpArticle[] = [
  {
    id: "site-create",
    categoryId: "sites",
    title: "Creating a Site",
    summary: "Add a job site with address, coordinates, and customer association.",
    content: [
      "Sites represent the physical locations where your technicians perform service work. Every site belongs to a customer and can have its own assets, access notes, and work order history. A single customer can have dozens of sites across different locations.",
      "To create a site, navigate to the Sites module and click Create Site. Select the parent customer, then enter the site name, address, and any GPS coordinates. The address is used for routing and the site name helps your team quickly identify the location.",
      "After creating a site you can add assets (equipment at that location), access notes (gate codes, safety requirements), and begin scheduling work orders. Sites with detailed information reduce confusion and callbacks in the field.",
    ],
    steps: [
      { title: "Open the Sites module", description: "Click Sites in the sidebar navigation." },
      { title: "Click Create Site", description: "Click the Create Site button to open the new site form." },
      { title: "Select the customer", description: "Choose the customer that owns this site from the dropdown." },
      { title: "Enter site details", description: "Fill in the site name, street address, city, state, and zip code." },
      { title: "Save the site", description: "Click Save. The site is now available for work orders and asset tracking." },
    ],
    tips: [
      "Use descriptive site names like 'Main Plant - Building A' rather than just an address for easy identification.",
      "Add GPS coordinates for remote locations where street addresses may be unreliable.",
      "Create separate sites for distinct buildings or areas within a large facility for better tracking.",
    ],
    relatedArticleIds: ["site-access", "site-assets", "cust-create", "wo-create"],
    keywords: ["site", "create", "location", "address", "job site", "facility", "plant", "building"],
  },
  {
    id: "site-access",
    categoryId: "sites",
    title: "Site Access Notes",
    summary: "Document gate codes, safety requirements, and access instructions for field technicians.",
    content: [
      "Site access notes contain critical information that technicians need before arriving at a location. This includes gate codes, parking instructions, safety requirements, check-in procedures, and contact information for on-site personnel.",
      "Access notes appear prominently on the technician's work order view so they can review them before and during the visit. Keeping these notes current prevents wasted trips, safety incidents, and frustrating phone calls from the field.",
      "Update access notes whenever a customer changes their gate codes, adds security procedures, or modifies check-in requirements. You can also note hazards like confined spaces, high-voltage areas, or required PPE so technicians arrive prepared.",
    ],
    steps: [
      { title: "Open the site record", description: "Navigate to the Sites module and select the site to update." },
      { title: "Find the Access Notes section", description: "Scroll to the Access Notes section on the site detail page." },
      { title: "Enter access information", description: "Document gate codes, check-in procedures, parking instructions, and safety notes." },
      { title: "Save changes", description: "Click Save. Access notes will appear on all work orders at this site." },
    ],
    tips: [
      "Include the date when gate codes were last verified so techs know if they might be outdated.",
      "Note required PPE (hard hat, steel toes, safety glasses) so technicians come prepared.",
      "Add the on-site contact's direct phone number for when gate codes do not work.",
    ],
    relatedArticleIds: ["site-create", "visit-workflow", "wo-create"],
    keywords: ["access", "gate code", "safety", "PPE", "check-in", "directions", "parking", "hazard"],
  },
  {
    id: "site-assets",
    categoryId: "sites",
    title: "Managing Site Assets",
    summary: "View and manage all equipment associated with a specific site.",
    content: [
      "The Assets tab on a site record shows all equipment installed or stored at that location. This gives you a complete picture of what is on-site without having to search through the full asset catalog. Each asset links to its individual record with full service history.",
      "To associate an asset with a site, you can either create the asset from the site's Assets tab or edit an existing asset to change its site assignment. Assets can be moved between sites when equipment is relocated.",
      "Site-level asset views are especially useful for planning preventive maintenance rounds. A technician can see all equipment due for service at a single location and schedule one visit to cover multiple assets.",
    ],
    steps: [
      { title: "Open the site record", description: "Navigate to the site whose assets you want to review." },
      { title: "Click the Assets tab", description: "Select the Assets tab to see all equipment at this location." },
      { title: "Add a new asset", description: "Click Add Asset to create a new equipment record linked to this site." },
      { title: "View asset details", description: "Click any asset to open its full record including service history and specifications." },
    ],
    tips: [
      "Review site assets before scheduling a maintenance visit to ensure the tech brings the right parts.",
      "Use the asset criticality ratings to prioritize which equipment gets serviced first during site visits.",
      "When equipment moves between locations, update the site assignment to keep your records accurate.",
    ],
    relatedArticleIds: ["asset-add", "site-create", "asset-criticality", "wo-create"],
    keywords: ["site assets", "equipment", "installed", "on-site", "machinery", "asset list", "location assets"],
  },
  {
    id: "site-history",
    categoryId: "sites",
    title: "Site Work Order History",
    summary: "Review all past and current work orders associated with a specific site.",
    content: [
      "The Work Order History tab on a site record shows every work order that has been created for that location. This includes completed, in-progress, and cancelled work orders in chronological order. Each entry shows the work order number, type, status, assigned technician, and date.",
      "Site history is invaluable for identifying recurring issues at a location. If the same equipment fails repeatedly or similar service calls happen at regular intervals, the history makes the pattern visible so you can address root causes.",
      "You can also use site history to verify past work when a customer questions a charge or asks about previous service. The complete record gives you the documentation needed to answer confidently.",
    ],
    steps: [
      { title: "Open the site record", description: "Navigate to the Sites module and select the site." },
      { title: "Click the Work Orders tab", description: "Select the Work Orders or History tab to see all work orders for this site." },
      { title: "Filter by status or date", description: "Use the filters to narrow results to a specific time period or work order status." },
      { title: "Click to view details", description: "Click any work order entry to open the full work order record." },
    ],
    tips: [
      "Look for patterns in site history such as repeated emergency calls that could be prevented with scheduled PM.",
      "Export site history when preparing service reports or contract renewal proposals for the customer.",
      "Compare work order counts across sites to identify which locations need the most attention.",
    ],
    relatedArticleIds: ["site-create", "wo-status", "cust-history", "wo-create"],
    keywords: ["site history", "work order history", "past work", "completed", "service record", "location history"],
  },
];

// ============================================================================
// CATEGORY 4: Asset Management (5 articles)
// ============================================================================

export const ASSET_ARTICLES: HelpArticle[] = [
  {
    id: "asset-add",
    categoryId: "assets",
    title: "Adding an Asset",
    summary: "Create a new equipment record with manufacturer, model, and site assignment.",
    content: [
      "Assets represent individual pieces of equipment that your team services. Each asset belongs to a customer and is typically assigned to a specific site. Common asset types include pumps, compressors, motors, generators, and HVAC units.",
      "To add an asset, navigate to the Assets module and click Add Asset. Select the customer and site, then enter the manufacturer, model, and serial number. You can also set the asset classification and criticality rating.",
      "A well-documented asset record reduces troubleshooting time in the field. Include specifications, nameplate data, and installation dates so technicians have the information they need before arriving on-site.",
    ],
    steps: [
      { title: "Open the Assets module", description: "Click Assets in the sidebar navigation." },
      { title: "Click Add Asset", description: "Click the Add Asset button to open the new asset form." },
      { title: "Select customer and site", description: "Choose the owning customer and the site where the equipment is installed." },
      { title: "Enter equipment details", description: "Fill in the manufacturer, model, serial number, and any specifications." },
      { title: "Set classification and criticality", description: "Choose the asset classification and criticality rating, then save." },
    ],
    tips: [
      "Photograph the nameplate when installing equipment and attach the image to the asset record.",
      "Include the installation date to help calculate equipment age and plan replacements.",
      "Use consistent naming conventions like 'Pump - Grundfos CR 64-3' for easier searching.",
    ],
    relatedArticleIds: ["asset-taxonomy", "asset-criticality", "asset-serials", "site-assets"],
    keywords: ["asset", "add", "create", "equipment", "pump", "motor", "compressor", "machinery", "new asset"],
  },
  {
    id: "asset-taxonomy",
    categoryId: "assets",
    title: "Asset Classification",
    summary: "Organize assets using classification categories for better filtering and reporting.",
    content: [
      "Asset classification lets you categorize equipment by type, function, or system. Classifications like Rotating Equipment, Electrical, HVAC, and Plumbing help you filter asset lists, generate category-specific reports, and assign specialized technicians.",
      "Set the classification when creating an asset or edit it later. Classifications are organization-wide so all users see the same categories. This consistency makes it easier to analyze maintenance costs and failure rates by equipment type.",
      "You can use classification data in reports to answer questions like 'How much did we spend on pump maintenance this quarter?' or 'Which equipment category has the highest failure rate?' This drives better purchasing and maintenance strategy decisions.",
    ],
    steps: [
      { title: "Open the asset record", description: "Navigate to the asset you want to classify." },
      { title: "Find the Classification field", description: "Locate the Classification dropdown on the asset detail form." },
      { title: "Select a classification", description: "Choose from available classifications like Rotating Equipment, Electrical, HVAC, etc." },
      { title: "Save the asset", description: "Click Save to apply the classification. The asset is now filterable by this category." },
    ],
    tips: [
      "Apply classifications consistently across all assets so reports give accurate category breakdowns.",
      "Filter the asset list by classification to quickly find all pumps, motors, or compressors.",
      "Use classification reports to identify which equipment types drive the most service revenue.",
    ],
    relatedArticleIds: ["asset-add", "asset-criticality", "asset-history"],
    keywords: ["classification", "category", "type", "taxonomy", "organize", "filter", "equipment type", "class"],
  },
  {
    id: "asset-criticality",
    categoryId: "assets",
    title: "Setting Asset Criticality",
    summary: "Rate equipment criticality to prioritize maintenance and emergency response.",
    content: [
      "Asset criticality indicates how important a piece of equipment is to your customer's operations. A Critical rating means failure causes immediate production shutdown. High means significant impact. Medium and Low indicate decreasing operational impact.",
      "Setting accurate criticality ratings helps dispatchers prioritize work when multiple requests come in simultaneously. A critical pump failure at a water treatment plant should be dispatched before a low-priority HVAC tune-up at an office building.",
      "Criticality also drives preventive maintenance scheduling. Critical assets should have more frequent PM intervals and shorter response time targets. Use this data to build compelling maintenance contract proposals that protect your customers' most important equipment.",
    ],
    steps: [
      { title: "Open the asset record", description: "Navigate to the asset you want to rate." },
      { title: "Find the Criticality field", description: "Locate the Criticality dropdown on the asset detail page." },
      { title: "Assess operational impact", description: "Consider what happens if this equipment fails. Does production stop? Is safety affected?" },
      { title: "Select the rating", description: "Choose Critical, High, Medium, or Low based on your assessment." },
      { title: "Save the asset", description: "Click Save. The criticality rating will influence PM scheduling and dispatch priority." },
    ],
    tips: [
      "Ask the customer about operational impact to set accurate criticality rather than guessing.",
      "Review criticality ratings annually since business conditions and equipment importance change.",
      "Critical assets should have shorter PM intervals and faster response time commitments.",
    ],
    relatedArticleIds: ["asset-add", "asset-taxonomy", "wo-create"],
    keywords: ["criticality", "priority", "critical", "high", "medium", "low", "importance", "impact"],
  },
  {
    id: "asset-serials",
    categoryId: "assets",
    title: "Serial Numbers & Identification",
    summary: "Track serial numbers, barcodes, and unique identifiers for each piece of equipment.",
    content: [
      "Every asset should have a unique identifier recorded in the system. Serial numbers from the manufacturer's nameplate are the most common identifier. You can also track model numbers, part numbers, and any internal asset tags your organization uses.",
      "Accurate serial numbers are essential for warranty claims, parts ordering, and service history continuity. When a technician reports on a specific piece of equipment, the serial number ensures there is no confusion about which unit was serviced.",
      "Enter serial numbers exactly as they appear on the nameplate including dashes, spaces, and letter casing. This ensures searches return exact matches and prevents duplicate asset records for the same physical equipment.",
    ],
    steps: [
      { title: "Open the asset record", description: "Navigate to the asset to update its identification details." },
      { title: "Enter the serial number", description: "Type the serial number exactly as shown on the equipment nameplate." },
      { title: "Add additional identifiers", description: "Enter the model number, part number, or internal asset tag if applicable." },
      { title: "Save the record", description: "Click Save. The serial number is now searchable via global search." },
    ],
    tips: [
      "Have technicians verify serial numbers during site visits by photographing the nameplate.",
      "Enter serial numbers exactly as printed including all dashes and spaces for accurate searching.",
      "Use the global search to quickly look up any asset by its serial number from anywhere in the app.",
    ],
    relatedArticleIds: ["asset-add", "asset-history", "gs-search"],
    keywords: ["serial number", "serial", "barcode", "nameplate", "model number", "identifier", "tag", "part number"],
  },
  {
    id: "asset-history",
    categoryId: "assets",
    title: "Asset Service History",
    summary: "Review all work orders, visits, and maintenance performed on a specific asset.",
    content: [
      "Every asset maintains a complete service history showing all work orders, visits, and parts used on that piece of equipment. This history helps identify failure patterns, calculate total cost of ownership, and make repair-versus-replace decisions.",
      "The service history is accessible from the asset detail page under the History tab. Entries include dates, work order numbers, descriptions of work performed, parts used, and costs. You can filter by date range or work type.",
      "When proposing a replacement to a customer, asset service history provides the documentation to support your recommendation. Showing increasing repair frequency and cost over time makes a compelling case for capital investment.",
    ],
    steps: [
      { title: "Open the asset record", description: "Navigate to the specific asset you want to review." },
      { title: "Click the History tab", description: "Select the History tab to view all service activity for this asset." },
      { title: "Review work order entries", description: "Scroll through the timeline of maintenance events, repairs, and inspections." },
      { title: "Filter by date range", description: "Use date filters to focus on a specific period for reporting or analysis." },
    ],
    tips: [
      "Compare maintenance costs over time to identify when repair costs exceed the value of the asset.",
      "Use asset history in proposals to demonstrate the value of preventive maintenance programs.",
      "Check history before dispatching a tech so they know what has been done recently and what to expect.",
    ],
    relatedArticleIds: ["asset-add", "asset-criticality", "wo-complete", "cust-history"],
    keywords: ["asset history", "service history", "maintenance log", "repair history", "work log", "cost history"],
  },
];

// ============================================================================
// CATEGORY 5: Procedure Templates (5 articles)
// ============================================================================

export const PROCEDURE_ARTICLES: HelpArticle[] = [
  {
    id: "proc-create",
    categoryId: "procedures",
    title: "Creating a Procedure Template",
    summary: "Build reusable procedure templates that standardize field work across your team.",
    content: [
      "Procedure templates define the step-by-step instructions for common service tasks like pump inspections, motor alignments, or vibration analysis. Creating templates ensures every technician follows the same process regardless of experience level.",
      "To create a procedure, navigate to the Procedures module and click Create Procedure. Give it a descriptive name, select the applicable context (e.g., Inspection, Repair, Installation), and begin adding steps.",
      "Well-designed procedures reduce errors, improve consistency, and provide documentation that protects your company in disputes. They also accelerate onboarding since new technicians can follow established procedures from day one.",
    ],
    steps: [
      { title: "Open the Procedures module", description: "Click Procedures in the sidebar navigation." },
      { title: "Click Create Procedure", description: "Click the Create Procedure button to start a new template." },
      { title: "Enter the procedure name", description: "Give it a clear, descriptive name like 'Centrifugal Pump Quarterly Inspection'." },
      { title: "Select the context", description: "Choose the context that best describes when this procedure applies." },
      { title: "Add steps", description: "Add individual steps with instructions, expected values, and pass/fail criteria." },
    ],
    tips: [
      "Name procedures specifically (e.g., 'VFD Pre-Start Checklist') rather than generically ('Electrical Check').",
      "Start with your most common service tasks to get immediate value from procedure templates.",
      "Have experienced technicians review new procedures before deploying them to the full team.",
    ],
    relatedArticleIds: ["proc-steps", "proc-contexts", "proc-link", "std-procedures"],
    keywords: ["procedure", "template", "create", "checklist", "steps", "standardize", "SOP", "process"],
  },
  {
    id: "proc-contexts",
    categoryId: "procedures",
    title: "Procedure Contexts",
    summary: "Understand how contexts categorize procedures by their purpose and application.",
    content: [
      "Procedure contexts define when and why a procedure is used. Common contexts include Inspection, Repair, Installation, Commissioning, and Decommission. Assigning the correct context helps the system suggest relevant procedures when creating work orders.",
      "When a dispatcher creates a work order for a pump repair, procedures tagged with the Repair context are surfaced automatically. This makes it easy to attach the right procedure without browsing through the entire template library.",
      "You can create custom contexts to match your specific service offerings. For example, if you perform vibration analysis as a specialty service, create a Vibration Analysis context so those procedures are grouped logically.",
    ],
    steps: [
      { title: "Open a procedure template", description: "Navigate to the Procedures module and select or create a procedure." },
      { title: "Locate the Context field", description: "Find the Context dropdown on the procedure form." },
      { title: "Select the appropriate context", description: "Choose from Inspection, Repair, Installation, or another context that matches the purpose." },
      { title: "Save the procedure", description: "Click Save. The procedure will now appear in filtered views matching this context." },
    ],
    tips: [
      "Use consistent contexts across all procedures so filtering and auto-suggestion work reliably.",
      "The Inspection context is typically the most used since routine inspections are the bread and butter of field service.",
      "Custom contexts let you align procedures with your specific service catalog offerings.",
    ],
    relatedArticleIds: ["proc-create", "proc-steps", "wo-create"],
    keywords: ["context", "category", "inspection", "repair", "installation", "procedure type", "classification"],
  },
  {
    id: "proc-steps",
    categoryId: "procedures",
    title: "Adding Steps to a Procedure",
    summary: "Define individual steps with instructions, expected values, and completion criteria.",
    content: [
      "Procedure steps are the individual actions a technician performs in sequence. Each step has a title, detailed instructions, and optional fields for expected values, tolerances, and pass/fail criteria. Steps appear in order on the technician's mobile view.",
      "Write step instructions clearly and concisely. Include specific measurements, tool requirements, and safety warnings. For example, 'Measure bearing temperature with IR thermometer. Expected: 120-160 deg F. Exceeding 180 deg F requires immediate shutdown.'",
      "Steps can be reordered by dragging them within the procedure editor. You can also duplicate steps when creating similar procedures to save time. Each step is independently tracked for completion during visit execution.",
    ],
    steps: [
      { title: "Open the procedure template", description: "Navigate to the procedure where you want to add steps." },
      { title: "Click Add Step", description: "Click the Add Step button to create a new step in the procedure." },
      { title: "Enter step title and instructions", description: "Write a clear title and detailed instructions for the technician to follow." },
      { title: "Set expected values if applicable", description: "Enter measurement ranges, tolerances, or pass/fail thresholds." },
      { title: "Reorder as needed", description: "Drag steps to rearrange them in the correct execution sequence." },
    ],
    tips: [
      "Write step instructions assuming the technician has never performed this task before.",
      "Include specific measurements and tolerances rather than vague instructions like 'check temperature'.",
      "Add safety warnings at the beginning of steps that involve hazardous energy or confined spaces.",
    ],
    relatedArticleIds: ["proc-create", "proc-use", "visit-workflow"],
    keywords: ["steps", "instructions", "checklist", "measurements", "tolerances", "pass fail", "procedure steps"],
  },
  {
    id: "proc-link",
    categoryId: "procedures",
    title: "Linking Procedures to Standards Packs",
    summary: "Attach procedure templates to standards packs for bundled deployment on work orders.",
    content: [
      "Procedures can be linked to standards packs, which are collections of tasks and procedures that represent a complete scope of work. For example, a 'Quarterly Pump Maintenance' standards pack might include a vibration analysis procedure, a bearing inspection procedure, and an oil sample procedure.",
      "Linking procedures to standards packs means that when the pack is applied to a work order, all associated procedures are automatically attached. This eliminates the need to manually add individual procedures to each work order.",
      "A single procedure can be linked to multiple standards packs. The vibration analysis procedure might appear in both the quarterly maintenance pack and the annual overhaul pack since vibration data is collected in both scenarios.",
    ],
    steps: [
      { title: "Open the standards pack", description: "Navigate to Standards Packs and select the pack to modify." },
      { title: "Go to the Procedures section", description: "Find the Procedures section within the standards pack editor." },
      { title: "Click Link Procedure", description: "Click Link Procedure and select the template from the dropdown." },
      { title: "Save the pack", description: "Click Save. The procedure will now be included whenever this pack is applied to a work order." },
    ],
    tips: [
      "Review linked procedures when updating a standards pack to ensure all procedures are still relevant.",
      "Link procedures to multiple packs to maximize reuse and reduce template maintenance.",
      "Test the full standards pack on a sample work order to verify all procedures appear correctly.",
    ],
    relatedArticleIds: ["proc-create", "std-create", "std-procedures", "wo-create"],
    keywords: ["link", "standards pack", "attach", "associate", "bundle", "procedure pack", "group"],
  },
  {
    id: "proc-use",
    categoryId: "procedures",
    title: "Using Procedures on Work Orders",
    summary: "Attach procedure templates to work orders for technicians to follow in the field.",
    content: [
      "Procedures are attached to work orders to give technicians specific instructions for the job. When a procedure is attached, its steps appear in the technician's visit workflow. The tech completes each step, enters measurements, and marks them pass or fail.",
      "To attach a procedure manually, open the work order and click Add Procedure. Select from available templates filtered by context. If a standards pack is applied, its linked procedures are attached automatically.",
      "Completed procedure data is stored on the work order record. This creates a documented trail of exactly what was done, what was measured, and whether everything met specifications. Use this data in customer reports and for regulatory compliance.",
    ],
    steps: [
      { title: "Open the work order", description: "Navigate to the work order where you want to add procedures." },
      { title: "Click Add Procedure", description: "Click Add Procedure to browse available templates." },
      { title: "Select the procedure", description: "Choose the appropriate procedure template from the list. Use context filters to narrow options." },
      { title: "Confirm attachment", description: "Click Attach. The procedure steps now appear on the work order for the assigned technician." },
    ],
    tips: [
      "Attach procedures before dispatching the work order so the technician sees them immediately.",
      "Use standards packs for recurring service types to avoid manually attaching procedures each time.",
      "Review completed procedure data to verify quality of work before invoicing the customer.",
    ],
    relatedArticleIds: ["proc-create", "proc-steps", "wo-create", "visit-workflow"],
    keywords: ["use procedure", "attach", "work order", "field", "execute", "follow", "apply procedure"],
  },
];

// ============================================================================
// CATEGORY 6: Standards Packs (5 articles)
// ============================================================================

export const STANDARDS_ARTICLES: HelpArticle[] = [
  {
    id: "std-create",
    categoryId: "standards",
    title: "Creating a Standards Pack",
    summary: "Build a reusable package of tasks and procedures for common service scopes.",
    content: [
      "A standards pack is a reusable bundle of tasks and procedures that represents a complete scope of work. For example, a 'Quarterly Pump Maintenance' pack might include tasks for oil sampling, vibration measurement, and bearing inspection along with the corresponding procedures.",
      "To create a standards pack, navigate to the Standards module and click Create Pack. Enter a descriptive name and description that explains the purpose and scope. Then add tasks and link procedures to build out the complete package.",
      "Standards packs save significant time when creating repetitive work orders. Instead of manually adding tasks and procedures each time, apply the pack with one click and everything is populated automatically.",
    ],
    steps: [
      { title: "Open the Standards module", description: "Click Standards in the sidebar navigation." },
      { title: "Click Create Pack", description: "Click the Create Pack button to start building a new standards pack." },
      { title: "Enter name and description", description: "Give the pack a clear name like 'Annual Compressor Overhaul' and describe its scope." },
      { title: "Add tasks", description: "Add individual tasks that define the work to be performed." },
      { title: "Link procedures", description: "Attach procedure templates that provide step-by-step instructions for the tasks." },
    ],
    tips: [
      "Create packs for every recurring service type your company offers to maximize consistency.",
      "Include estimated hours in the pack description to help dispatchers with scheduling.",
      "Review and update packs quarterly to incorporate lessons learned and process improvements.",
    ],
    relatedArticleIds: ["std-tasks", "std-procedures", "std-wo", "proc-create"],
    keywords: ["standards pack", "create", "bundle", "scope", "template", "service package", "reusable"],
  },
  {
    id: "std-tasks",
    categoryId: "standards",
    title: "Adding Tasks to a Pack",
    summary: "Define the individual work items included in a standards pack.",
    content: [
      "Tasks within a standards pack define what work needs to be done. Each task has a title, description, and estimated duration. When the pack is applied to a work order, these tasks become the work order's task list.",
      "Write task titles as clear action items: 'Replace mechanical seal', 'Perform laser alignment', 'Collect oil sample for analysis'. The description should include any specific requirements, part numbers, or specifications the technician needs.",
      "Tasks can be marked as required or optional within the pack. Required tasks must be completed before the work order can be closed. Optional tasks can be skipped based on field conditions without blocking completion.",
    ],
    steps: [
      { title: "Open the standards pack", description: "Navigate to the pack where you want to add tasks." },
      { title: "Click Add Task", description: "Click the Add Task button within the pack editor." },
      { title: "Enter task details", description: "Write a clear title, description, and estimated duration for the task." },
      { title: "Set required or optional", description: "Mark whether this task is required for work order completion or optional." },
      { title: "Reorder tasks", description: "Drag tasks into the preferred execution order and save the pack." },
    ],
    tips: [
      "Write task titles as action items starting with a verb (Replace, Inspect, Measure, Clean).",
      "Include part numbers and specifications in task descriptions so techs do not have to look them up.",
      "Mark safety-related tasks as required to ensure they are never skipped.",
    ],
    relatedArticleIds: ["std-create", "std-procedures", "wo-tasks", "std-wo"],
    keywords: ["tasks", "add task", "work items", "checklist", "required", "optional", "scope of work"],
  },
  {
    id: "std-procedures",
    categoryId: "standards",
    title: "Linking Procedures",
    summary: "Attach procedure templates to a standards pack for automatic deployment.",
    content: [
      "Linking procedures to a standards pack ensures that technicians receive detailed step-by-step instructions alongside their task list. While tasks define what needs to be done, procedures define how to do it.",
      "Open the standards pack and navigate to the Procedures section. Click Link Procedure and select from your procedure template library. You can filter by context to find the relevant procedures quickly.",
      "When the standards pack is applied to a work order, all linked procedures are automatically attached. Technicians see the procedures alongside their tasks during visit execution, providing a complete picture of the required work.",
    ],
    steps: [
      { title: "Open the standards pack", description: "Navigate to the pack in the Standards module." },
      { title: "Go to the Procedures section", description: "Find the Procedures area within the pack editor." },
      { title: "Click Link Procedure", description: "Click Link Procedure and browse available templates." },
      { title: "Select procedures", description: "Choose one or more procedures relevant to the pack's scope of work." },
      { title: "Save the pack", description: "Click Save. Linked procedures will deploy automatically with the pack." },
    ],
    tips: [
      "Match procedures to tasks so every task has a corresponding procedure for maximum field guidance.",
      "Link procedures from different contexts when a pack covers multiple service types.",
      "Periodically review linked procedures to ensure they reflect current best practices.",
    ],
    relatedArticleIds: ["std-create", "std-tasks", "proc-link", "proc-create"],
    keywords: ["link procedures", "attach", "procedure templates", "instructions", "standards procedures"],
  },
  {
    id: "std-wo",
    categoryId: "standards",
    title: "Using Standards Packs on Work Orders",
    summary: "Apply a standards pack to a work order to auto-populate tasks and procedures.",
    content: [
      "Applying a standards pack to a work order is the fastest way to build out a complete scope of work. Click Apply Standards Pack on the work order form, select the pack, and all tasks and procedures are populated instantly.",
      "You can modify the auto-populated tasks after applying the pack. Remove tasks that are not applicable, add site-specific tasks, or adjust descriptions based on the particular job. The pack provides the starting point but does not lock you in.",
      "Standards packs are especially powerful for preventive maintenance work orders. When PM schedules auto-generate work orders, the associated standards pack is applied automatically so the work order arrives fully configured and ready for dispatch.",
    ],
    steps: [
      { title: "Open or create a work order", description: "Navigate to an existing work order or create a new one." },
      { title: "Click Apply Standards Pack", description: "Click the Apply Standards Pack button on the work order form." },
      { title: "Select the pack", description: "Choose the appropriate standards pack from the dropdown list." },
      { title: "Review populated tasks", description: "Review the auto-populated tasks and procedures. Make adjustments as needed." },
      { title: "Save the work order", description: "Click Save. The work order is now fully scoped and ready for assignment." },
    ],
    tips: [
      "Apply the pack before assigning a technician so they see the full scope when they receive the job.",
      "You can apply multiple packs to a single work order if the job covers multiple service scopes.",
      "Customize auto-populated tasks for site-specific conditions without modifying the original pack.",
    ],
    relatedArticleIds: ["std-create", "wo-create", "wo-tasks", "proc-use"],
    keywords: ["apply pack", "work order", "auto-populate", "deploy", "use standards", "scope"],
  },
  {
    id: "std-best",
    categoryId: "standards",
    title: "Best Practices for Standards Packs",
    summary: "Tips for organizing and maintaining your standards pack library effectively.",
    content: [
      "A well-organized standards pack library is one of the most valuable assets in ServiceOpsIQ. Name packs consistently using a format like '[Equipment Type] - [Service Level] - [Frequency]'. For example: 'Centrifugal Pump - Full Service - Quarterly'.",
      "Keep packs focused on a single scope of work rather than trying to cover everything in one pack. A 'Pump Inspection' pack and a 'Pump Overhaul' pack are easier to manage than a single 'Pump Everything' pack. You can always apply multiple packs to one work order.",
      "Review packs at least quarterly. Update task descriptions based on field feedback, add new procedures when processes change, and retire outdated packs to keep the library clean. A stale library erodes trust and adoption among your team.",
    ],
    steps: [
      { title: "Audit your current packs", description: "Review all existing standards packs and note which ones are actively used." },
      { title: "Standardize naming conventions", description: "Rename packs to follow a consistent format across your organization." },
      { title: "Gather field feedback", description: "Ask technicians which tasks are unclear, missing, or unnecessary." },
      { title: "Update and retire packs", description: "Update active packs with improvements and archive packs that are no longer used." },
    ],
    tips: [
      "Name packs with the equipment type first so they sort alphabetically by equipment category.",
      "Keep packs focused on a single service scope rather than combining multiple scopes into one.",
      "Archive outdated packs rather than deleting them to preserve historical work order references.",
    ],
    relatedArticleIds: ["std-create", "std-tasks", "std-procedures", "proc-create"],
    keywords: ["best practices", "organize", "naming", "maintain", "library", "standards tips", "conventions"],
  },
];

// ============================================================================
// CATEGORY 7: Work Orders (7 articles)
// ============================================================================

export const WORK_ORDER_ARTICLES: HelpArticle[] = [
  {
    id: "wo-create",
    categoryId: "work-orders",
    title: "Creating a Work Order",
    summary: "Create a new work order with customer, site, asset, and scope details.",
    content: [
      "Work orders are the core operational record in ServiceOpsIQ. They track a job from creation through completion, linking everything from the customer and site to the assigned technician, tasks performed, materials used, and final invoice.",
      "To create a work order, navigate to the Work Orders module and click Create Work Order. Select the customer, site, and optionally the specific asset being serviced. Add a description of the work needed and set the priority level.",
      "After creating the work order you can apply standards packs, attach procedures, assign a technician, and schedule visits. The work order serves as the single source of truth for the entire job lifecycle.",
    ],
    steps: [
      { title: "Open Work Orders module", description: "Click Work Orders in the sidebar navigation." },
      { title: "Click Create Work Order", description: "Click the Create Work Order button in the top-right corner." },
      { title: "Select customer and site", description: "Choose the customer and the specific site where work will be performed." },
      { title: "Enter work description", description: "Describe the work needed, set the priority, and select the work order type." },
      { title: "Apply standards pack (optional)", description: "Optionally apply a standards pack to auto-populate tasks and procedures." },
    ],
    tips: [
      "Include specific symptoms or problem descriptions to help the technician prepare before arriving.",
      "Set priority based on asset criticality and customer impact, not just who called first.",
      "Apply a standards pack for recurring service types to ensure consistent scoping.",
    ],
    relatedArticleIds: ["wo-types", "wo-assign", "wo-tasks", "std-wo", "cust-create"],
    keywords: ["work order", "create", "new", "job", "service call", "dispatch", "WO", "ticket"],
  },
  {
    id: "wo-types",
    categoryId: "work-orders",
    title: "Work Order Types",
    summary: "Understand the different work order types: Reactive, Preventive, Project, and Inspection.",
    content: [
      "ServiceOpsIQ supports four work order types: Reactive, Preventive Maintenance (PM), Project, and Inspection. The type helps categorize work for scheduling, reporting, and billing purposes.",
      "Reactive work orders are created in response to equipment failures or customer service requests. PM work orders are generated automatically by PM schedules on a recurring basis. Project work orders cover larger scopes like equipment installations or facility upgrades.",
      "Inspection work orders are for condition assessments that may lead to follow-up reactive or project work. Choosing the correct type ensures accurate reporting on your mix of reactive versus preventive work, a key metric for service organizations.",
    ],
    steps: [
      { title: "Create or open a work order", description: "Navigate to an existing work order or create a new one." },
      { title: "Locate the Type field", description: "Find the Work Order Type dropdown on the form." },
      { title: "Select the appropriate type", description: "Choose Reactive, PM, Project, or Inspection based on the nature of the work." },
      { title: "Save the work order", description: "Click Save. The type is now set and will appear in reports and filters." },
    ],
    tips: [
      "Track your reactive-to-PM ratio in reports to measure how well your maintenance program prevents failures.",
      "Use Inspection type for site surveys and condition assessments that precede a formal quote.",
      "PM work orders are auto-created by schedules so you rarely need to create them manually.",
    ],
    relatedArticleIds: ["wo-create", "wo-status", "wo-assign"],
    keywords: ["type", "reactive", "preventive", "PM", "project", "inspection", "work order type", "category"],
  },
  {
    id: "wo-status",
    categoryId: "work-orders",
    title: "Work Order Status Flow",
    summary: "Follow a work order through its lifecycle from Draft to Completed or Cancelled.",
    content: [
      "Work orders progress through defined statuses: Draft, Open, In Progress, On Hold, Completed, and Cancelled. Each status transition reflects a real operational event and controls what actions are available on the work order.",
      "Draft work orders are being prepared and are not yet visible to technicians. Open means the work order is ready for dispatch. In Progress indicates a technician has started work. On Hold pauses the work order when waiting for parts or customer approval.",
      "Completed work orders have all required tasks finished and are ready for invoicing. Cancelled work orders were abandoned before completion. Status changes are logged with timestamps creating an audit trail of the work order lifecycle.",
    ],
    steps: [
      { title: "Check current status", description: "The status badge is displayed prominently at the top of the work order detail page." },
      { title: "Advance the status", description: "Click the status badge or use the action button to move to the next status in the workflow." },
      { title: "Add notes when changing status", description: "Enter a reason when placing a work order On Hold or Cancelling it for the audit trail." },
      { title: "Complete the work order", description: "Mark as Completed once all required tasks are done and the tech has confirmed the work." },
    ],
    tips: [
      "Use On Hold status when waiting for parts rather than leaving the work order In Progress.",
      "Status transitions are logged with timestamps so you can measure time spent in each phase.",
      "Work orders cannot be invoiced until they reach Completed status.",
    ],
    relatedArticleIds: ["wo-create", "wo-complete", "wo-assign", "inv-from-wo"],
    keywords: ["status", "workflow", "draft", "open", "in progress", "completed", "cancelled", "on hold", "lifecycle"],
  },
  {
    id: "wo-assign",
    categoryId: "work-orders",
    title: "Assigning Technicians",
    summary: "Assign one or more technicians to a work order for field execution.",
    content: [
      "Assigning a technician to a work order makes it appear on their schedule and mobile view. The technician receives a notification and can review the work order details, site access notes, and attached procedures before heading to the job.",
      "To assign a technician, open the work order and click the Assign Technician button. Select from available technicians on your team. You can assign multiple technicians when a job requires a crew. The primary assignee is responsible for logging visits.",
      "Consider technician skills, location, and current workload when making assignments. A technician closer to the site can respond faster for emergency calls. For specialized work, assign the tech with the relevant equipment experience.",
    ],
    steps: [
      { title: "Open the work order", description: "Navigate to the work order you want to assign." },
      { title: "Click Assign Technician", description: "Click the Assign Technician button to see available team members." },
      { title: "Select the technician", description: "Choose the appropriate technician based on skills, location, and availability." },
      { title: "Set as primary if assigning multiple", description: "When assigning a crew, designate one technician as the primary for visit logging." },
      { title: "Notify the technician", description: "Save the assignment. The technician receives a notification with the work order details." },
    ],
    tips: [
      "Consider proximity to the job site when assigning emergency or same-day work orders.",
      "Check the technician's current schedule before assigning to avoid overloading one person.",
      "The primary technician on a crew is responsible for logging visits and capturing signatures.",
    ],
    relatedArticleIds: ["wo-create", "visit-schedule", "wo-status", "gs-roles"],
    keywords: ["assign", "technician", "dispatch", "schedule", "crew", "team", "field", "assignment"],
  },
  {
    id: "wo-tasks",
    categoryId: "work-orders",
    title: "Managing WO Tasks",
    summary: "Add, edit, and track individual tasks within a work order.",
    content: [
      "Work order tasks break down the scope of work into individual line items that technicians complete in the field. Tasks can be added manually, populated from a standards pack, or created by the assigned technician during execution.",
      "Each task has a title, description, and completion status. Technicians mark tasks as complete during their visit. Required tasks must be completed before the work order can be moved to Completed status.",
      "Dispatchers and admins can add tasks to a work order at any time, even after work has started. This is useful when the customer adds scope or the technician discovers additional issues during the visit.",
    ],
    steps: [
      { title: "Open the work order", description: "Navigate to the work order to manage its tasks." },
      { title: "View existing tasks", description: "Check the Tasks section to see all current tasks and their completion status." },
      { title: "Add a new task", description: "Click Add Task, enter the title and description, and mark it as required or optional." },
      { title: "Edit or remove tasks", description: "Click on any task to edit its details or remove it from the work order." },
    ],
    tips: [
      "Add tasks discovered in the field immediately so they are documented and billable.",
      "Use the standards pack to bulk-add tasks rather than typing them individually for recurring work.",
      "Mark safety-critical tasks as required to ensure they cannot be skipped during execution.",
    ],
    relatedArticleIds: ["wo-create", "std-tasks", "wo-complete", "visit-workflow"],
    keywords: ["tasks", "work items", "checklist", "complete", "add task", "scope", "task list"],
  },
  {
    id: "wo-complete",
    categoryId: "work-orders",
    title: "Completing a Work Order",
    summary: "Finalize a work order after all tasks, visits, and documentation are complete.",
    content: [
      "Completing a work order signals that all field work is finished and the job is ready for invoicing. Before a work order can be completed, all required tasks must be marked as done and at least one visit must be logged.",
      "To complete a work order, open it and click the Complete button. The system checks that all required tasks are finished. If any required tasks remain incomplete, you will be prompted to either complete them or change them to optional before proceeding.",
      "Once completed, the work order is locked from further task changes. You can still add notes and the work order can be used to generate an invoice. The completion timestamp is recorded for reporting on turnaround times.",
    ],
    steps: [
      { title: "Verify all tasks are complete", description: "Check the task list and ensure all required tasks are marked as completed." },
      { title: "Review visit logs", description: "Confirm that visits are logged with time entries, photos, and signatures as needed." },
      { title: "Click Complete", description: "Click the Complete Work Order button. The system validates that all requirements are met." },
      { title: "Generate invoice (optional)", description: "After completion, click Generate Invoice to create an invoice from the work order." },
    ],
    tips: [
      "Complete work orders promptly after the last visit to keep your reporting metrics accurate.",
      "Review technician notes and photos before completing to ensure quality documentation.",
      "Completed work orders can be reopened if follow-up work is discovered, but this resets the status.",
    ],
    relatedArticleIds: ["wo-status", "wo-tasks", "inv-from-wo", "visit-workflow"],
    keywords: ["complete", "finish", "close", "finalize", "done", "work order complete", "wrap up"],
  },
  {
    id: "wo-convert",
    categoryId: "work-orders",
    title: "Converting a Quote to Work Order",
    summary: "Turn an approved quote into a work order to begin scheduling and execution.",
    content: [
      "When a customer approves a quote, the next step is converting it into a work order. This process transfers all line items, scope details, and pricing from the quote to a new work order, eliminating double data entry.",
      "Navigate to the approved quote and click Convert to Work Order. The system creates a new work order pre-populated with the quote details. The customer, site, and scope are carried over. You can then assign a technician and schedule visits.",
      "The quote and work order remain linked so you can track the full lifecycle from initial estimate through execution and final invoice. This linkage is valuable for comparing quoted versus actual costs on completed jobs.",
    ],
    steps: [
      { title: "Open the approved quote", description: "Navigate to the Quotes module and find the approved quote." },
      { title: "Click Convert to Work Order", description: "Click the Convert to Work Order button on the quote detail page." },
      { title: "Review pre-populated fields", description: "Verify the customer, site, and scope details carried over correctly." },
      { title: "Assign a technician", description: "Select a technician and schedule the first visit." },
      { title: "Save the work order", description: "Click Save. The new work order is linked to the original quote." },
    ],
    tips: [
      "Convert quotes to work orders promptly after approval to maintain momentum with the customer.",
      "Review and adjust the scope after conversion since field conditions may differ from the estimate.",
      "The quote-to-WO link helps you analyze how accurately your team estimates jobs.",
    ],
    relatedArticleIds: ["quote-approve", "quote-convert", "wo-create", "wo-assign"],
    keywords: ["convert", "quote to work order", "approved", "create from quote", "transform", "transition"],
  },
];

// ============================================================================
// CATEGORY 8: Visit Execution (6 articles)
// ============================================================================

export const VISIT_ARTICLES: HelpArticle[] = [
  {
    id: "visit-schedule",
    categoryId: "visits",
    title: "Scheduling a Visit",
    summary: "Schedule a visit to a job site with date, time, and technician assignment.",
    content: [
      "Visits represent the actual trips a technician makes to a job site. A single work order may require multiple visits, for example an initial diagnosis visit followed by a repair visit after parts arrive.",
      "To schedule a visit, open the work order and click Schedule Visit. Select the date, estimated start time, and the technician. The visit appears on the technician's schedule and on the dispatch calendar for the assigned date.",
      "The dispatch calendar provides a timeline view of all scheduled visits across your team. Use it to spot scheduling conflicts, identify available time slots, and balance workload across technicians.",
    ],
    steps: [
      { title: "Open the work order", description: "Navigate to the work order that needs a site visit scheduled." },
      { title: "Click Schedule Visit", description: "Click the Schedule Visit button to open the scheduling form." },
      { title: "Select date and time", description: "Choose the visit date and estimated start time." },
      { title: "Assign a technician", description: "Select the technician who will perform the visit." },
      { title: "Save the visit", description: "Click Save. The visit appears on the tech's schedule and dispatch calendar." },
    ],
    tips: [
      "Schedule visits with buffer time between appointments to account for travel and unexpected delays.",
      "Check the dispatch calendar before scheduling to avoid double-booking a technician.",
      "Set realistic time estimates to help the tech plan their day and manage customer expectations.",
    ],
    relatedArticleIds: ["visit-workflow", "wo-assign", "visit-time", "wo-create"],
    keywords: ["schedule", "visit", "appointment", "calendar", "dispatch", "date", "time", "book"],
  },
  {
    id: "visit-workflow",
    categoryId: "visits",
    title: "Technician Visit Workflow",
    summary: "The step-by-step process a technician follows during a site visit.",
    content: [
      "When a technician starts a visit, they follow a structured workflow: check in at the site, review tasks and procedures, perform the work while logging progress, capture photos and measurements, obtain a customer signature, and check out.",
      "The visit interface on the technician's device shows the work order details, site access notes, task checklist, and any attached procedures. The tech works through each item, marking tasks complete and entering measurement data as they go.",
      "Upon finishing the work, the technician captures the customer's signature on the device, adds any final notes, and completes the visit. This triggers a notification to the dispatcher confirming the visit is done and the data has been recorded.",
    ],
    steps: [
      { title: "Check in", description: "The technician opens the visit on their device and taps Check In to start the clock." },
      { title: "Review site access notes", description: "Check access notes for gate codes, safety requirements, and on-site contacts." },
      { title: "Work through tasks", description: "Complete each task on the checklist, marking them done as work progresses." },
      { title: "Follow procedures", description: "Execute procedure steps, entering measurements and pass/fail results." },
      { title: "Complete and check out", description: "Capture a signature, add notes, and tap Complete Visit to stop the clock." },
    ],
    tips: [
      "Check in at arrival and check out at departure for accurate time tracking.",
      "Review site access notes before driving to the site to avoid surprises at the gate.",
      "Add notes during the visit while details are fresh rather than trying to remember later.",
    ],
    relatedArticleIds: ["visit-schedule", "visit-time", "visit-photos", "visit-signatures"],
    keywords: ["workflow", "visit", "check in", "check out", "technician", "field", "on-site", "process"],
  },
  {
    id: "visit-time",
    categoryId: "visits",
    title: "Time Tracking",
    summary: "Track technician time on-site with automatic clock-in and clock-out.",
    content: [
      "Time tracking starts when the technician checks in to a visit and stops when they check out. The elapsed time is automatically calculated and recorded on the visit record. This data feeds into invoicing, payroll reporting, and productivity analytics.",
      "If a technician forgets to check in or out, a dispatcher or admin can manually edit the visit times. Manual time entries are flagged in the system so you can distinguish between automatic and adjusted time records.",
      "Time data is aggregated across all visits on a work order to show total labor hours. This total is used when generating invoices and comparing actual time against quoted estimates for profitability analysis.",
    ],
    steps: [
      { title: "Check in to start tracking", description: "The technician taps Check In when arriving at the site. The clock starts automatically." },
      { title: "Work on-site", description: "Time runs continuously while the technician performs the work." },
      { title: "Check out to stop tracking", description: "The technician taps Complete Visit when leaving. The clock stops and elapsed time is recorded." },
      { title: "Review time entries", description: "Dispatchers can review and adjust time entries from the visit detail page if corrections are needed." },
    ],
    tips: [
      "Train technicians to check in immediately on arrival for the most accurate time records.",
      "Manually adjusted time entries are flagged so you can audit corrections easily.",
      "Use time data in reports to identify which job types take longer than estimated.",
    ],
    relatedArticleIds: ["visit-workflow", "visit-schedule", "inv-from-wo"],
    keywords: ["time", "tracking", "clock", "hours", "labor", "check in", "check out", "duration", "timesheet"],
  },
  {
    id: "visit-photos",
    categoryId: "visits",
    title: "Adding Photos",
    summary: "Capture and attach photos during a visit for documentation and customer reports.",
    content: [
      "Photos captured during visits provide visual documentation of equipment condition, completed work, and any issues discovered. Technicians can take photos directly from their device camera or upload existing images from their gallery.",
      "Each photo is attached to the visit record and can include a caption describing what it shows. Photos are organized by visit date and appear in the work order's media gallery. They can also be included in customer-facing reports and PDFs.",
      "Encourage technicians to photograph equipment condition before starting work, during key steps, and after completion. Before-and-after photos are particularly valuable for demonstrating the value of your service to customers.",
    ],
    steps: [
      { title: "Open the active visit", description: "The technician opens their current visit on the mobile interface." },
      { title: "Tap Add Photo", description: "Tap the Add Photo button to open the camera or gallery picker." },
      { title: "Capture or select the image", description: "Take a new photo or choose an existing image from the device." },
      { title: "Add a caption", description: "Enter a brief description of what the photo shows for context." },
      { title: "Save the photo", description: "Tap Save. The photo is uploaded and attached to the visit record." },
    ],
    tips: [
      "Always photograph the nameplate and overall equipment condition before starting any work.",
      "Capture before-and-after photos to clearly demonstrate the value of the service performed.",
      "Add descriptive captions to every photo so the context is clear months later in reports.",
    ],
    relatedArticleIds: ["visit-workflow", "visit-notes", "visit-signatures"],
    keywords: ["photos", "pictures", "images", "camera", "documentation", "visual", "before after", "capture"],
  },
  {
    id: "visit-signatures",
    categoryId: "visits",
    title: "Capturing Signatures",
    summary: "Collect customer signatures on-site to confirm work completion and acceptance.",
    content: [
      "Customer signatures provide formal acknowledgment that work was performed and accepted. At the end of a visit, the technician presents the device to the customer for a signature. The signature is saved with a timestamp and the signer's name.",
      "Signatures are captured using the touch screen on the technician's device. The customer signs with their finger or a stylus directly on the screen. The signature is attached to the visit record and can be included on invoices and completion reports.",
      "In cases where no customer representative is available on-site, the technician can note this and proceed without a signature. However, collecting signatures whenever possible protects against disputes about work performed or hours billed.",
    ],
    steps: [
      { title: "Complete all visit tasks", description: "Ensure all work is done and documented before requesting a signature." },
      { title: "Tap Capture Signature", description: "Tap the Capture Signature button on the visit completion screen." },
      { title: "Enter signer's name", description: "Type the name of the person signing to associate it with the signature." },
      { title: "Customer signs on screen", description: "Hand the device to the customer to sign with their finger or stylus." },
      { title: "Save and complete", description: "Tap Save. The signature is attached to the visit and the visit can be completed." },
    ],
    tips: [
      "Always attempt to get a signature even for routine visits as it protects against billing disputes.",
      "If no one is available to sign, document why in the visit notes for your records.",
      "Signatures appear on generated PDFs and invoices, adding professionalism to your deliverables.",
    ],
    relatedArticleIds: ["visit-workflow", "visit-notes", "inv-from-wo"],
    keywords: ["signature", "sign", "approval", "acceptance", "customer sign-off", "confirm", "authorization"],
  },
  {
    id: "visit-notes",
    categoryId: "visits",
    title: "Visit Notes & Documentation",
    summary: "Record observations, findings, and recommendations during a site visit.",
    content: [
      "Visit notes capture the technician's observations, findings, and recommendations during a site visit. Notes should document what was found, what was done, and any follow-up actions needed. They become part of the permanent work order record.",
      "Good visit notes are specific and factual: 'Bearing temperature measured at 185 deg F, exceeding 180 deg F threshold. Recommended bearing replacement within 30 days.' Avoid vague notes like 'equipment looked fine' that provide no actionable information.",
      "Notes are visible to dispatchers and admins immediately and can be shared with customers through work order reports. Technicians should add notes throughout the visit while observations are fresh rather than trying to summarize everything at the end.",
    ],
    steps: [
      { title: "Open the active visit", description: "Access the current visit from the technician mobile view." },
      { title: "Tap Add Note", description: "Tap the Add Note button to open the notes editor." },
      { title: "Enter your observations", description: "Document findings, measurements, conditions, and recommendations." },
      { title: "Save the note", description: "Tap Save. The note is timestamped and attached to the visit." },
    ],
    tips: [
      "Write notes with specific measurements and observations rather than subjective assessments.",
      "Add notes throughout the visit while details are fresh instead of summarizing at the end.",
      "Include recommendations for follow-up work to help dispatchers create subsequent work orders.",
    ],
    relatedArticleIds: ["visit-workflow", "visit-photos", "wo-complete"],
    keywords: ["notes", "documentation", "findings", "observations", "recommendations", "comments", "field notes"],
  },
];

// ============================================================================
// CATEGORY 9: Quoting (7 articles)
// ============================================================================

export const QUOTE_ARTICLES: HelpArticle[] = [
  {
    id: "quote-create",
    categoryId: "quotes",
    title: "Creating a Quote",
    summary: "Build a new quote with customer details, line items, and terms.",
    content: [
      "Quotes let you present pricing to customers before committing to work. A quote includes customer information, a scope description, line items with pricing, and terms and conditions. Professional quotes help win work and set clear expectations.",
      "To create a quote, navigate to the Quotes module and click Create Quote. Select the customer, site, and enter a description of the proposed work. Add line items for labor, materials, and any other charges.",
      "Quotes can be created from scratch or generated from a work order when you discover additional scope during a visit. The flexibility to create quotes in multiple contexts ensures you never miss an opportunity to capture revenue.",
    ],
    steps: [
      { title: "Open the Quotes module", description: "Click Quotes in the sidebar navigation." },
      { title: "Click Create Quote", description: "Click the Create Quote button to start a new quote." },
      { title: "Select customer and site", description: "Choose the customer and the site where the quoted work would be performed." },
      { title: "Enter scope description", description: "Describe the proposed work clearly so the customer understands what is included." },
      { title: "Add line items", description: "Add labor, materials, and other charges with quantities and unit prices." },
    ],
    tips: [
      "Include a clear scope description so the customer knows exactly what they are approving.",
      "Create quotes from the field when technicians discover additional work during a visit.",
      "Set an expiration date on quotes to encourage timely customer decisions.",
    ],
    relatedArticleIds: ["quote-lines", "quote-send", "quote-status", "cust-create"],
    keywords: ["quote", "create", "estimate", "proposal", "pricing", "bid", "new quote"],
  },
  {
    id: "quote-lines",
    categoryId: "quotes",
    title: "Adding Line Items",
    summary: "Add labor, materials, and services to a quote with quantities and pricing.",
    content: [
      "Quote line items define the specific charges included in the proposal. Each line item has a description, quantity, unit price, and total. Common line item types include labor hours, material costs, equipment rental, travel charges, and flat-rate service fees.",
      "When adding materials, you can pull from your materials catalog to ensure consistent pricing and descriptions. Labor line items should specify the type of work (standard rate, overtime, specialty) and the estimated hours.",
      "Line items are subtotaled and tax is calculated based on your organization's default tax rate. You can override the tax rate on individual quotes for tax-exempt customers or different jurisdictions. The grand total updates automatically as you add or modify line items.",
    ],
    steps: [
      { title: "Open the quote", description: "Navigate to the quote where you want to add line items." },
      { title: "Click Add Line Item", description: "Click Add Line Item to create a new charge on the quote." },
      { title: "Enter description and type", description: "Describe the charge and select the type (labor, material, service, etc.)." },
      { title: "Set quantity and unit price", description: "Enter the quantity and price per unit. The line total calculates automatically." },
      { title: "Review totals", description: "Check the subtotal, tax, and grand total at the bottom of the quote." },
    ],
    tips: [
      "Pull materials from the catalog for consistent pricing rather than typing prices from memory.",
      "Separate labor and materials on different line items for clearer customer communication.",
      "Include a contingency line item for complex jobs where the final scope may vary from the estimate.",
    ],
    relatedArticleIds: ["quote-create", "quote-send", "quote-pdf"],
    keywords: ["line items", "pricing", "labor", "materials", "charges", "quantity", "unit price", "total"],
  },
  {
    id: "quote-status",
    categoryId: "quotes",
    title: "Quote Status Flow",
    summary: "Track quotes through their lifecycle: Draft, Sent, Approved, Rejected, and Expired.",
    content: [
      "Quotes move through five statuses: Draft, Sent, Approved, Rejected, and Expired. Draft quotes are being prepared and have not been shared with the customer. Sent quotes have been delivered and are awaiting the customer's response.",
      "Approved quotes have been accepted by the customer and can be converted into work orders. Rejected quotes were declined. Expired quotes passed their expiration date without a customer response.",
      "Tracking quote status helps your team follow up on pending quotes and measure your win rate. Filter the quotes list by status to see all outstanding proposals that need customer follow-up.",
    ],
    steps: [
      { title: "Check current status", description: "View the status badge at the top of the quote detail page." },
      { title: "Send the quote", description: "Click Send to change the status from Draft to Sent and deliver it to the customer." },
      { title: "Record customer response", description: "Update the status to Approved or Rejected based on the customer's decision." },
      { title: "Monitor expiration", description: "Quotes automatically change to Expired when they pass their expiration date without a response." },
    ],
    tips: [
      "Follow up on Sent quotes within 48 hours to improve your approval rate.",
      "Set realistic expiration dates (typically 30 days) to create urgency without pressuring the customer.",
      "Track your approval-to-rejection ratio to identify pricing or scope issues.",
    ],
    relatedArticleIds: ["quote-create", "quote-send", "quote-approve", "quote-convert"],
    keywords: ["status", "draft", "sent", "approved", "rejected", "expired", "quote lifecycle", "workflow"],
  },
  {
    id: "quote-send",
    categoryId: "quotes",
    title: "Sending a Quote",
    summary: "Email a quote directly to the customer with a professional PDF attachment.",
    content: [
      "When a quote is ready for the customer, click Send to deliver it via email. The system generates a professional PDF and emails it to the customer's primary contact. You can customize the email message and add CC recipients.",
      "The sent email includes a link to the Customer Portal where the customer can view the quote, approve it, or request changes. This self-service option accelerates the approval process and reduces back-and-forth phone calls.",
      "After sending, the quote status changes to Sent and the delivery is logged with a timestamp. You can resend a quote if the customer did not receive it or if you have made revisions to the original proposal.",
    ],
    steps: [
      { title: "Finalize the quote", description: "Review all line items, descriptions, and totals before sending." },
      { title: "Click Send Quote", description: "Click the Send Quote button on the quote detail page." },
      { title: "Customize the email", description: "Edit the email subject and message if desired. Add CC recipients as needed." },
      { title: "Confirm and send", description: "Click Send. The quote PDF is emailed and the status changes to Sent." },
    ],
    tips: [
      "Preview the PDF before sending to ensure it looks professional and all details are correct.",
      "Include a personalized message in the email that highlights the key benefits of the proposed work.",
      "Mention the Customer Portal link so the customer knows they can approve directly from their browser.",
    ],
    relatedArticleIds: ["quote-create", "quote-pdf", "quote-approve", "cust-contacts"],
    keywords: ["send", "email", "deliver", "customer", "PDF", "notification", "share", "quote email"],
  },
  {
    id: "quote-approve",
    categoryId: "quotes",
    title: "Quote Approval Process",
    summary: "How customers approve quotes and what happens after approval.",
    content: [
      "Customers can approve quotes through two channels: the Customer Portal or by communicating directly with your team. In the portal, the customer clicks Approve on the quote, which immediately updates the status and notifies your team.",
      "When a customer approves verbally or via email, a dispatcher or admin updates the quote status to Approved manually. Either way, the approved quote can then be converted into a work order to begin scheduling the work.",
      "If a customer wants changes before approving, they can leave comments in the portal or contact your team directly. You can revise the quote, update line items, and resend it for review. The revision history is maintained on the quote record.",
    ],
    steps: [
      { title: "Customer receives the quote", description: "The customer reviews the quote via email or the Customer Portal." },
      { title: "Customer approves or requests changes", description: "The customer clicks Approve in the portal or communicates their decision to your team." },
      { title: "Status updates to Approved", description: "The quote status changes to Approved and your team is notified." },
      { title: "Convert to work order", description: "Click Convert to Work Order to begin scheduling the approved work." },
    ],
    tips: [
      "Enable Customer Portal access for faster quote approvals without phone tag.",
      "Follow up within 24 hours if a customer has questions to keep the approval process moving.",
      "Convert approved quotes to work orders within the same day to demonstrate responsiveness.",
    ],
    relatedArticleIds: ["quote-send", "quote-convert", "quote-status", "wo-convert"],
    keywords: ["approve", "approval", "accept", "customer portal", "authorize", "confirm", "sign off"],
  },
  {
    id: "quote-convert",
    categoryId: "quotes",
    title: "Converting Quote to Work Order",
    summary: "Transform an approved quote into an actionable work order.",
    content: [
      "Converting a quote to a work order is a one-click operation that transfers all quote details to a new work order. The customer, site, scope description, and line items are carried over automatically. This eliminates duplicate data entry and ensures the work order matches what the customer approved.",
      "After conversion, the work order is created in Draft status ready for technician assignment and scheduling. The original quote is updated to show it has been converted, with a direct link to the resulting work order.",
      "You can still modify the work order after conversion. Add tasks from standards packs, attach procedures, or adjust the scope based on additional information. The quote remains linked as a reference for the original approved pricing.",
    ],
    steps: [
      { title: "Open the approved quote", description: "Navigate to the quote with Approved status." },
      { title: "Click Convert to Work Order", description: "Click the conversion button on the quote detail page." },
      { title: "Review the new work order", description: "Verify that customer, site, and scope details transferred correctly." },
      { title: "Assign and schedule", description: "Assign a technician and schedule the first visit on the new work order." },
    ],
    tips: [
      "Convert approved quotes promptly to maintain customer confidence and scheduling momentum.",
      "Add standards packs to the converted work order for detailed task checklists.",
      "The quote-to-WO link lets you compare quoted pricing against actual costs after completion.",
    ],
    relatedArticleIds: ["quote-approve", "wo-convert", "wo-create", "wo-assign"],
    keywords: ["convert", "transform", "work order", "approved quote", "create WO", "transition"],
  },
  {
    id: "quote-pdf",
    categoryId: "quotes",
    title: "Generating Quote PDFs",
    summary: "Create professional PDF documents from your quotes for download or email.",
    content: [
      "ServiceOpsIQ generates professional PDF documents from your quotes with your company logo, customer details, line items, totals, and terms. PDFs are created automatically when you send a quote and can also be downloaded on demand.",
      "The PDF layout includes your organization header, the quote number and date, customer billing information, a detailed line item table with descriptions and pricing, subtotals, tax, and the grand total. Terms and conditions appear at the bottom.",
      "You can download the PDF from the quote detail page by clicking the Download PDF button. Use this to share quotes via other channels, attach them to emails sent from outside the platform, or print physical copies for in-person presentations.",
    ],
    steps: [
      { title: "Open the quote", description: "Navigate to the quote you want to generate a PDF for." },
      { title: "Click Download PDF", description: "Click the Download PDF button to generate and download the document." },
      { title: "Review the PDF", description: "Open the downloaded file to verify the layout, line items, and totals are correct." },
      { title: "Share as needed", description: "Email the PDF manually, print it, or share via your preferred method." },
    ],
    tips: [
      "Ensure your organization logo is uploaded in Settings for branded PDF headers.",
      "Preview the PDF before sending to catch formatting issues or missing information.",
      "Save quote PDFs locally as backups when working with high-value proposals.",
    ],
    relatedArticleIds: ["quote-create", "quote-send", "gs-org-setup", "inv-pdf"],
    keywords: ["PDF", "download", "print", "document", "generate", "export", "quote PDF", "proposal PDF"],
  },
];

// ============================================================================
// CATEGORY 10: Invoicing (8 articles)
// ============================================================================

export const INVOICE_ARTICLES: HelpArticle[] = [
  {
    id: "inv-from-wo",
    categoryId: "invoices",
    title: "Generating Invoice from Work Order",
    summary: "Create an invoice directly from a completed work order with pre-populated details.",
    content: [
      "The most common way to create an invoice is from a completed work order. This pre-populates the invoice with the customer, site, work description, labor hours, and materials used during the job. All data flows from the work order so there is no re-entry.",
      "To generate an invoice, open a completed work order and click Generate Invoice. Review the pre-populated line items, adjust pricing if needed, and set the payment terms. The invoice is created in Draft status ready for final review before sending.",
      "Labor hours are calculated from visit time entries. Materials are pulled from the parts used on the work order. You can add additional line items for charges that are not tracked in the work order, such as travel fees or equipment rental.",
    ],
    steps: [
      { title: "Open the completed work order", description: "Navigate to a work order with Completed status." },
      { title: "Click Generate Invoice", description: "Click the Generate Invoice button to create a new invoice from this work order." },
      { title: "Review line items", description: "Verify that labor hours, materials, and other charges are correct." },
      { title: "Set payment terms", description: "Choose payment terms (Net 30, Net 60, etc.) or accept the customer default." },
      { title: "Save the invoice", description: "Click Save. The invoice is created in Draft status linked to the work order." },
    ],
    tips: [
      "Generate invoices within 24 hours of work order completion to maintain steady cash flow.",
      "Review visit time entries before generating to ensure all labor hours are accurate.",
      "Add materials during the visit so they automatically appear on the generated invoice.",
    ],
    relatedArticleIds: ["inv-lines", "inv-send", "wo-complete", "inv-status"],
    keywords: ["invoice", "generate", "work order", "billing", "create invoice", "from WO", "labor", "materials"],
  },
  {
    id: "inv-standalone",
    categoryId: "invoices",
    title: "Creating a Standalone Invoice",
    summary: "Create an invoice without an associated work order for miscellaneous charges.",
    content: [
      "Standalone invoices are created when you need to bill a customer for charges that are not tied to a specific work order. Common uses include consulting fees, equipment sales, contract retainers, or adjustments to previous invoices.",
      "Navigate to the Invoices module and click Create Invoice. Select the customer, enter a description, and add line items manually. Standalone invoices follow the same status flow and payment tracking as work-order-generated invoices.",
      "While standalone invoices are useful for edge cases, generating invoices from work orders is preferred whenever possible. Work order links provide a complete audit trail connecting the invoice to the specific work performed, time logged, and materials used.",
    ],
    steps: [
      { title: "Open the Invoices module", description: "Click Invoices in the sidebar navigation." },
      { title: "Click Create Invoice", description: "Click the Create Invoice button to start a new standalone invoice." },
      { title: "Select the customer", description: "Choose the customer to bill from the dropdown." },
      { title: "Add line items", description: "Enter descriptions, quantities, and prices for each charge." },
      { title: "Save the invoice", description: "Click Save. The invoice is created in Draft status ready for review." },
    ],
    tips: [
      "Use standalone invoices sparingly to keep your audit trail clean with work order linkages.",
      "Include detailed descriptions on standalone invoice line items since there is no work order for context.",
      "Set the same payment terms you use for work-order invoices to keep your AR consistent.",
    ],
    relatedArticleIds: ["inv-from-wo", "inv-lines", "inv-send", "cust-create"],
    keywords: ["standalone", "manual", "create invoice", "miscellaneous", "no work order", "direct invoice"],
  },
  {
    id: "inv-lines",
    categoryId: "invoices",
    title: "Managing Line Items",
    summary: "Add, edit, and organize line items on an invoice including labor, materials, and services.",
    content: [
      "Invoice line items define what the customer is being charged for. Each line item has a description, quantity, unit price, and calculated total. Line items can represent labor hours, materials, flat-rate services, travel charges, or any other billable item.",
      "When an invoice is generated from a work order, line items are pre-populated from visit time entries and materials used. You can edit these items, add new ones, or remove charges that should not be billed. Changes are reflected in the totals immediately.",
      "Organize line items logically with labor grouped together, followed by materials, then miscellaneous charges. A well-organized invoice is easier for customers to review and reduces questions about charges.",
    ],
    steps: [
      { title: "Open the invoice", description: "Navigate to the invoice you want to edit." },
      { title: "Review existing line items", description: "Check the pre-populated line items from the work order for accuracy." },
      { title: "Edit quantities or prices", description: "Click on any line item to modify its description, quantity, or unit price." },
      { title: "Add new line items", description: "Click Add Line Item for additional charges not captured automatically." },
      { title: "Verify totals", description: "Check the subtotal, tax, and grand total to ensure accuracy before sending." },
    ],
    tips: [
      "Group line items by type (labor, materials, services) for a clean, professional invoice layout.",
      "Double-check material quantities against what was actually used to avoid over-billing.",
      "Use consistent descriptions for labor line items (e.g., 'Standard Labor Rate - 4 hrs') across all invoices.",
    ],
    relatedArticleIds: ["inv-from-wo", "inv-standalone", "inv-send", "quote-lines"],
    keywords: ["line items", "charges", "pricing", "edit", "labor", "materials", "billing", "total"],
  },
  {
    id: "inv-send",
    categoryId: "invoices",
    title: "Sending Invoices",
    summary: "Email invoices to customers with a professional PDF and payment instructions.",
    content: [
      "When an invoice is finalized, click Send to email it to the customer. The system generates a professional PDF, attaches it to the email, and delivers it to the customer's primary contact. You can customize the email message and add CC recipients.",
      "The sent email includes a link to the Customer Portal where the customer can view the invoice, see a breakdown of charges, and track payment status. Customers appreciate the transparency of being able to review invoices at their convenience.",
      "Sending an invoice changes its status from Draft to Sent and records the delivery timestamp. If you need to resend the invoice or the customer did not receive it, you can send it again from the invoice detail page.",
    ],
    steps: [
      { title: "Finalize the invoice", description: "Review all line items and totals for accuracy." },
      { title: "Click Send Invoice", description: "Click the Send Invoice button on the invoice detail page." },
      { title: "Customize the email", description: "Edit the subject line and message body. Add CC recipients if needed." },
      { title: "Confirm and send", description: "Click Send. The PDF is generated and emailed. Status changes to Sent." },
    ],
    tips: [
      "Send invoices promptly after work completion to improve cash flow and customer satisfaction.",
      "Preview the PDF before sending to catch any formatting issues or incorrect line items.",
      "Include your payment terms and accepted payment methods in the email message.",
    ],
    relatedArticleIds: ["inv-from-wo", "inv-pdf", "inv-payments", "cust-contacts"],
    keywords: ["send", "email", "deliver", "invoice email", "notification", "bill", "customer"],
  },
  {
    id: "inv-payments",
    categoryId: "invoices",
    title: "Recording Payments",
    summary: "Record full or partial payments against invoices and track outstanding balances.",
    content: [
      "When a customer makes a payment, record it against the invoice to update the balance. ServiceOpsIQ supports full payments, partial payments, and multiple payments against a single invoice. Each payment is logged with the date, amount, and payment method.",
      "To record a payment, open the invoice and click Record Payment. Enter the amount received, the payment date, the method (check, ACH, credit card, cash), and any reference number like a check number. The invoice balance updates automatically.",
      "When the total payments equal the invoice total, the status automatically changes to Paid. If a partial payment is recorded, the remaining balance is displayed on the invoice and in your accounts receivable reports.",
    ],
    steps: [
      { title: "Open the invoice", description: "Navigate to the invoice where you want to record a payment." },
      { title: "Click Record Payment", description: "Click the Record Payment button to open the payment form." },
      { title: "Enter payment details", description: "Enter the amount, date, payment method, and reference number." },
      { title: "Save the payment", description: "Click Save. The invoice balance updates and status may change to Paid or Partial." },
    ],
    tips: [
      "Record payments on the same day they are received for accurate cash flow reporting.",
      "Include check numbers or transaction IDs in the reference field for easy reconciliation.",
      "Use the accounts receivable report to identify overdue invoices that need follow-up.",
    ],
    relatedArticleIds: ["inv-send", "inv-status", "inv-qbo"],
    keywords: ["payment", "record", "pay", "received", "balance", "check", "ACH", "partial payment"],
  },
  {
    id: "inv-pdf",
    categoryId: "invoices",
    title: "Generating Invoice PDFs",
    summary: "Create professional PDF invoices with your company branding for download or print.",
    content: [
      "Invoice PDFs are generated automatically when you send an invoice and can also be downloaded on demand. The PDF includes your company header with logo, invoice number and date, customer billing details, line items with pricing, and payment terms.",
      "The layout is designed for professional presentation with clearly organized sections for charges, subtotals, tax, and the grand total. Payment instructions and terms appear at the bottom of the document.",
      "Download invoice PDFs for physical mailing, record keeping, or sharing through channels outside the platform. The same PDF format is used for all invoices ensuring consistent branding across your business.",
    ],
    steps: [
      { title: "Open the invoice", description: "Navigate to the invoice you want to generate a PDF for." },
      { title: "Click Download PDF", description: "Click the Download PDF button to generate and download the document." },
      { title: "Review the PDF", description: "Open the file to verify formatting, line items, and totals." },
      { title: "Share or print", description: "Email the PDF manually, print it, or save it for your records." },
    ],
    tips: [
      "Ensure your organization logo and address are up to date in Settings for accurate PDF headers.",
      "Invoice PDFs include payment terms so customers have all billing details in one document.",
      "Save PDF copies of large invoices locally as part of your documentation best practices.",
    ],
    relatedArticleIds: ["inv-send", "inv-from-wo", "quote-pdf", "gs-org-setup"],
    keywords: ["PDF", "download", "print", "invoice document", "generate", "export", "branded", "professional"],
  },
  {
    id: "inv-qbo",
    categoryId: "invoices",
    title: "QuickBooks Sync",
    summary: "Sync invoices and payments with QuickBooks Online for seamless accounting.",
    content: [
      "ServiceOpsIQ integrates with QuickBooks Online (QBO) to sync invoices, payments, and customer records. Once connected, invoices created in ServiceOpsIQ can be pushed to QuickBooks with one click, eliminating duplicate entry in your accounting system.",
      "To set up the integration, navigate to Settings > Integrations > QuickBooks and click Connect. You will be redirected to QuickBooks to authorize the connection. Once authorized, customer mapping and sync options become available.",
      "When you sync an invoice, the customer, line items, tax, and totals are transferred to QuickBooks. Payments recorded in ServiceOpsIQ can also be synced to keep both systems in agreement. Any discrepancies are flagged in the sync log for review.",
    ],
    steps: [
      { title: "Connect QuickBooks", description: "Go to Settings > Integrations > QuickBooks and click Connect to authorize." },
      { title: "Map customers", description: "Match ServiceOpsIQ customers to their QuickBooks counterparts." },
      { title: "Sync an invoice", description: "Open an invoice and click Sync to QuickBooks to push it to your accounting system." },
      { title: "Verify in QuickBooks", description: "Log into QuickBooks Online to confirm the invoice appears correctly." },
      { title: "Sync payments", description: "Record payments in ServiceOpsIQ and sync them to keep both systems aligned." },
    ],
    tips: [
      "Map all customers before syncing invoices to avoid creating duplicate records in QuickBooks.",
      "Check the sync log regularly for errors or discrepancies that need manual resolution.",
      "Sync invoices daily to keep your accounting system current with field operations.",
    ],
    relatedArticleIds: ["inv-from-wo", "inv-payments", "inv-status", "gs-org-setup"],
    keywords: ["QuickBooks", "QBO", "sync", "accounting", "integration", "bookkeeping", "export", "connect"],
  },
  {
    id: "inv-status",
    categoryId: "invoices",
    title: "Invoice Status Flow",
    summary: "Track invoices through Draft, Sent, Partial, Paid, and Overdue statuses.",
    content: [
      "Invoices progress through defined statuses: Draft, Sent, Partial, Paid, Overdue, and Void. Draft invoices are being prepared and have not been delivered to the customer. Sent invoices have been emailed and are awaiting payment.",
      "Partial status indicates the customer has made a payment but the balance is not fully settled. Paid means the full amount has been received. Overdue is automatically applied when a Sent invoice passes its due date without full payment.",
      "Void status is used to cancel an invoice that was sent in error. Voiding an invoice reverses any QuickBooks sync and removes it from accounts receivable totals while preserving the record for audit purposes.",
    ],
    steps: [
      { title: "Check the current status", description: "View the status badge at the top of the invoice detail page." },
      { title: "Send the invoice", description: "Click Send to move from Draft to Sent and deliver to the customer." },
      { title: "Record payments", description: "Record payments to move to Partial or Paid status automatically." },
      { title: "Monitor overdue invoices", description: "Check the Overdue filter on the invoice list to identify invoices past their due date." },
      { title: "Void if needed", description: "Click Void to cancel an invoice sent in error. This preserves the record for audit." },
    ],
    tips: [
      "Monitor overdue invoices weekly and follow up with customers to maintain healthy cash flow.",
      "Void invoices rather than deleting them to maintain a complete audit trail.",
      "Set shorter payment terms (Net 15 or Net 30) for new customers until a payment history is established.",
    ],
    relatedArticleIds: ["inv-send", "inv-payments", "inv-from-wo", "inv-qbo"],
    keywords: ["status", "draft", "sent", "paid", "overdue", "partial", "void", "invoice lifecycle", "workflow"],
  },
];

// === CATEGORIES 11-19 ARTICLES INSERTED VIA MERGE ===
const PM_SCHEDULE_ARTICLES: HelpArticle[] = [
  {
    id: 'pm-create',
    categoryId: 'pm-schedules',
    title: 'Creating a PM Schedule',
    summary: 'Set up preventive maintenance schedules for your assets with defined frequencies and start dates.',
    content: [
      'Preventive maintenance schedules automate the creation of recurring work orders for your critical assets. By establishing PM schedules, you ensure that equipment receives regular inspections and servicing before failures occur.',
      'To create a PM schedule, navigate to Preventive Maintenance from the sidebar and click "New PM Schedule." You will select the target asset, define the maintenance frequency, set a start date, and optionally attach procedures that technicians should follow.',
      'Once activated, the system automatically generates work orders based on your configured schedule. Each generated work order inherits the asset details, assigned procedures, and any default technician assignments you have configured.'
    ],
    steps: [
      { title: 'Navigate to PM Schedules', description: 'Click "Preventive Maintenance" in the sidebar to open the PM management page.' },
      { title: 'Click New PM Schedule', description: 'Click the "New PM Schedule" button in the top-right corner to open the creation form.' },
      { title: 'Select an Asset', description: 'Choose the asset that requires preventive maintenance from the asset dropdown. The asset must already exist in your system.' },
      { title: 'Set Frequency and Start Date', description: 'Select the maintenance frequency (daily, weekly, monthly, quarterly, or annual) and pick the date when the schedule should begin generating work orders.' },
      { title: 'Save and Activate', description: 'Review your settings and click "Save" to activate the PM schedule. The first work order will be generated on or after the start date.' }
    ],
    tips: [
      'Start with your most critical assets first — pumps, compressors, and other rotating equipment that would cause the most downtime if they failed.',
      'Set the start date to the next expected service date, not today, to avoid generating an immediate work order if maintenance was just performed.',
      'Attach procedures to the PM schedule so technicians have step-by-step instructions automatically included on every generated work order.'
    ],
    relatedArticleIds: ['pm-frequency', 'pm-auto', 'pm-procedures', 'asset-detail', 'wo-create'],
    keywords: ['preventive maintenance', 'PM schedule', 'create PM', 'recurring maintenance', 'asset maintenance', 'schedule setup']
  },
  {
    id: 'pm-frequency',
    categoryId: 'pm-schedules',
    title: 'Setting PM Frequency',
    summary: 'Configure how often preventive maintenance work orders are generated — daily, weekly, monthly, quarterly, annual, or custom intervals.',
    content: [
      'PM frequency determines how often the system generates a new work order for a scheduled asset. ServiceOpsIQ supports standard intervals including daily, weekly, monthly, quarterly, and annual frequencies to cover the most common maintenance cycles.',
      'When selecting a frequency, consider the manufacturer recommendations for the asset, its operating environment, and its criticality to your operations. High-criticality assets in harsh environments typically require more frequent maintenance than low-criticality assets in controlled settings.',
      'You can change the frequency of an existing PM schedule at any time without losing the history of previously generated work orders. The new frequency takes effect from the next generation cycle.'
    ],
    steps: [
      { title: 'Open the PM Schedule', description: 'Navigate to Preventive Maintenance and click on the schedule you want to configure or create a new one.' },
      { title: 'Locate the Frequency Setting', description: 'Find the "Frequency" dropdown in the PM schedule form. This controls how often work orders are generated.' },
      { title: 'Select the Interval', description: 'Choose from Daily, Weekly, Monthly, Quarterly, or Annual. Each option sets the number of days between generated work orders.' },
      { title: 'Review the Next Due Date', description: 'After selecting a frequency, the system displays the next calculated due date. Verify this aligns with your maintenance plan.' },
      { title: 'Save Changes', description: 'Click "Save" to apply the frequency. The cron job will use this frequency to determine when to generate the next work order.' }
    ],
    tips: [
      'Monthly frequency is the most common choice for rotating equipment like pumps and compressors in typical industrial environments.',
      'Use quarterly or annual frequencies for less critical assets like office HVAC units or backup equipment that sees limited runtime.',
      'If you need a non-standard interval, consider using the closest standard frequency and adjusting the schedule as needed.'
    ],
    relatedArticleIds: ['pm-create', 'pm-auto', 'pm-manage', 'wo-create'],
    keywords: ['PM frequency', 'maintenance interval', 'daily', 'weekly', 'monthly', 'quarterly', 'annual', 'schedule frequency']
  },
  {
    id: 'pm-auto',
    categoryId: 'pm-schedules',
    title: 'Automatic Work Order Generation',
    summary: 'Learn how the daily cron job at 6 AM UTC automatically creates work orders from active PM schedules.',
    content: [
      'ServiceOpsIQ runs an automated cron job every day at 6 AM UTC that scans all active PM schedules across every organization. When a schedule\'s next due date has arrived, the system automatically generates a new work order with all the relevant details pre-populated.',
      'The generated work order includes the asset information, site location, any linked procedures, and default assignments from the PM schedule. The work order is created with a status of "Open" and appears in the dispatcher\'s queue ready for assignment or confirmation.',
      'This automation eliminates the risk of missed maintenance tasks and removes the manual overhead of creating recurring work orders. The cron job is secured with a CRON_SECRET environment variable and runs on Vercel\'s cron infrastructure.'
    ],
    steps: [
      { title: 'Ensure PM Schedule Is Active', description: 'Verify that the PM schedule status is set to "Active." Paused or inactive schedules are skipped by the cron job.' },
      { title: 'Verify Start Date Has Passed', description: 'The cron job only generates work orders for schedules whose start date is on or before the current date.' },
      { title: 'Check Generated Work Orders', description: 'After 6 AM UTC, navigate to Work Orders to see any newly generated PM work orders. They will be tagged as PM-generated.' },
      { title: 'Assign or Confirm', description: 'Review the auto-generated work orders and assign them to technicians if they were not auto-assigned from the PM schedule.' },
      { title: 'Monitor Compliance', description: 'Use the PM History view to track whether generated work orders are being completed on schedule.' }
    ],
    tips: [
      'The cron runs at 6 AM UTC — adjust your expectations based on your local time zone. For US Central Time, this is midnight.',
      'If a PM schedule was paused and then reactivated, the cron will generate any overdue work orders on the next run.',
      'Set the CRON_SECRET environment variable in your Vercel deployment settings to secure the cron endpoint against unauthorized access.'
    ],
    relatedArticleIds: ['pm-create', 'pm-frequency', 'wo-lifecycle', 'wo-create'],
    keywords: ['automatic generation', 'cron job', 'auto WO', 'scheduled maintenance', 'PM automation', '6 AM UTC', 'Vercel cron']
  },
  {
    id: 'pm-procedures',
    categoryId: 'pm-schedules',
    title: 'Linking Procedures to PMs',
    summary: 'Attach standard operating procedures to PM schedules so generated work orders include step-by-step instructions.',
    content: [
      'Procedures define the step-by-step tasks that a technician should complete during a maintenance visit. By linking procedures to a PM schedule, every work order generated from that schedule automatically includes those instructions, ensuring consistency and compliance.',
      'Procedures are created and managed separately in the Procedures section of ServiceOpsIQ. Once created, they can be linked to one or more PM schedules. This means a single vibration analysis procedure can be reused across multiple pump PM schedules.',
      'When a technician opens a PM-generated work order, they see the linked procedure steps as a checklist. Each step can be marked complete, and notes or readings can be added to individual steps for documentation purposes.'
    ],
    steps: [
      { title: 'Create or Select a Procedure', description: 'Navigate to Procedures in the sidebar and either create a new procedure or identify an existing one to link.' },
      { title: 'Open the PM Schedule', description: 'Go to Preventive Maintenance and click on the PM schedule you want to add the procedure to.' },
      { title: 'Link the Procedure', description: 'In the PM schedule edit form, find the "Procedures" section and select the procedure from the dropdown to attach it.' },
      { title: 'Verify on Next Generated WO', description: 'After the next cron run generates a work order, open it and confirm that the procedure steps appear in the work order details.' }
    ],
    tips: [
      'Create detailed procedures with specific measurements, torque values, and acceptance criteria so technicians know exactly what to check.',
      'Link multiple procedures to a single PM schedule if the maintenance task involves several distinct workflows.',
      'Review and update procedures periodically to incorporate lessons learned from completed maintenance work orders.'
    ],
    relatedArticleIds: ['pm-create', 'pm-auto', 'tech-tasks', 'wo-detail'],
    keywords: ['procedures', 'PM procedures', 'standard operating procedure', 'SOP', 'maintenance steps', 'checklist', 'linked procedures']
  },
  {
    id: 'pm-manage',
    categoryId: 'pm-schedules',
    title: 'Managing Active Schedules',
    summary: 'Pause, edit, or delete PM schedules to keep your preventive maintenance program current.',
    content: [
      'As your equipment and maintenance needs change, you will need to modify your PM schedules. ServiceOpsIQ allows you to pause, edit, or delete schedules at any time. Pausing a schedule temporarily stops work order generation without losing the schedule configuration.',
      'Editing a PM schedule lets you change the frequency, assigned asset, linked procedures, or other details. Changes take effect from the next generation cycle — any work orders already created are not retroactively modified.',
      'Deleting a PM schedule permanently removes it from the system. Previously generated work orders remain in the system for historical reference, but no new work orders will be created from the deleted schedule.'
    ],
    steps: [
      { title: 'Navigate to PM Schedules', description: 'Click "Preventive Maintenance" in the sidebar to see all PM schedules for your organization.' },
      { title: 'Find the Schedule', description: 'Use the search or scroll to locate the PM schedule you want to manage. Schedules can be filtered by status or asset.' },
      { title: 'Pause a Schedule', description: 'Click the pause button or toggle to temporarily deactivate the schedule. The cron job will skip paused schedules.' },
      { title: 'Edit Schedule Details', description: 'Click the edit button to modify frequency, procedures, asset assignment, or other configuration options.' },
      { title: 'Delete If Necessary', description: 'Click the delete button and confirm to permanently remove the schedule. This action cannot be undone.' }
    ],
    tips: [
      'Pause a schedule instead of deleting it if the asset is temporarily out of service — this preserves your configuration for when it returns.',
      'After editing a schedule, check the calculated next due date to confirm the change produces the expected result.',
      'Use the PM history view to review whether a schedule has been effective before deciding to modify or remove it.'
    ],
    relatedArticleIds: ['pm-create', 'pm-frequency', 'pm-history', 'wo-lifecycle'],
    keywords: ['manage PM', 'pause schedule', 'edit PM', 'delete PM', 'deactivate', 'modify schedule']
  },
  {
    id: 'pm-history',
    categoryId: 'pm-schedules',
    title: 'PM Completion History',
    summary: 'Track preventive maintenance compliance by reviewing the history of generated and completed PM work orders.',
    content: [
      'PM completion history gives you visibility into how well your maintenance program is performing. For each PM schedule, you can see every work order that was generated, whether it was completed on time, and any notes or issues recorded during the work.',
      'Compliance tracking is essential for regulated industries and for maintaining asset warranties. ServiceOpsIQ calculates compliance rates by comparing the number of completed PM work orders against the number generated within a given time period.',
      'Use the PM history view to identify patterns such as schedules that are frequently overdue, assets that require more attention than planned, or technicians who consistently complete PM tasks ahead of schedule.'
    ],
    steps: [
      { title: 'Open PM History', description: 'Navigate to Preventive Maintenance and click on a specific PM schedule to view its history tab.' },
      { title: 'Review Generated Work Orders', description: 'The history shows a chronological list of all work orders created by this PM schedule with their current status.' },
      { title: 'Check Compliance Rate', description: 'Look at the compliance percentage which shows how many PM work orders were completed on time versus total generated.' },
      { title: 'Investigate Overdue Items', description: 'Click on any overdue or incomplete work order to see why it was not completed and take corrective action.' }
    ],
    tips: [
      'Aim for 90% or higher PM compliance to maintain asset reliability and satisfy warranty and regulatory requirements.',
      'Export PM history data for compliance audits or management reports using the export functionality.',
      'Review PM history monthly to catch declining compliance trends before they become critical maintenance gaps.'
    ],
    relatedArticleIds: ['pm-manage', 'pm-auto', 'rpt-wo', 'rpt-dashboard'],
    keywords: ['PM history', 'compliance', 'completion rate', 'maintenance history', 'PM tracking', 'overdue maintenance']
  }
];

const MATERIAL_ARTICLES: HelpArticle[] = [
  {
    id: 'mat-catalog',
    categoryId: 'materials',
    title: 'Material Catalog',
    summary: 'Manage your inventory of parts, materials, and supplies with part numbers, descriptions, and cost tracking.',
    content: [
      'The material catalog is your centralized inventory of all parts, materials, and supplies used across your service operations. Each material entry includes a part number, description, unit of measure, and cost information that flows through to work orders and invoicing.',
      'Maintaining an accurate catalog ensures that technicians can quickly find and log the materials they use on jobs, and that invoices reflect the correct material costs. Part numbers serve as unique identifiers and can match your supplier or internal numbering system.',
      'You can add materials individually or review and update existing entries as pricing and availability change. The catalog supports categorization to help organize materials by type such as bearings, seals, lubricants, or electrical components.'
    ],
    steps: [
      { title: 'Navigate to Materials', description: 'Click "Materials" in the sidebar to open the material catalog page.' },
      { title: 'Click Add Material', description: 'Click the "Add Material" button to open the new material form.' },
      { title: 'Enter Part Details', description: 'Fill in the part number, description, unit of measure (each, box, gallon, etc.), and unit cost.' },
      { title: 'Set Category', description: 'Assign a category to the material for easier filtering and organization within the catalog.' },
      { title: 'Save the Material', description: 'Click "Save" to add the material to your catalog. It is now available for use on work orders.' }
    ],
    tips: [
      'Use consistent part numbering conventions across your catalog to make searching faster — for example, prefix bearing part numbers with "BRG-".',
      'Keep unit costs updated regularly so that work order material costs and invoice line items reflect current pricing.',
      'Add commonly used consumables like lubricants, rags, and safety supplies to the catalog even if they are low-cost items — this helps track true job costs.'
    ],
    relatedArticleIds: ['mat-stock', 'mat-wo', 'mat-movements', 'inv-line-items'],
    keywords: ['material catalog', 'parts', 'part number', 'inventory', 'supplies', 'unit cost', 'materials management']
  },
  {
    id: 'mat-stock',
    categoryId: 'materials',
    title: 'Stock Tracking',
    summary: 'Monitor inventory quantities, set minimum stock levels, and receive alerts when materials need reordering.',
    content: [
      'Stock tracking lets you monitor the current quantity on hand for each material in your catalog. As materials are received into inventory or issued to work orders, the stock levels update automatically, giving you real-time visibility into what is available.',
      'Minimum stock levels can be configured for each material to trigger alerts when quantities fall below the threshold. This helps prevent stockouts of critical parts that could delay service work and impact customer satisfaction.',
      'The stock overview page shows all materials with their current quantities, minimum levels, and reorder status at a glance. Materials that are at or below their minimum level are highlighted so you can take action quickly.'
    ],
    steps: [
      { title: 'View Stock Levels', description: 'Navigate to Materials to see the current quantity on hand for each material in your catalog.' },
      { title: 'Set Minimum Levels', description: 'Edit a material and set the "Minimum Stock Level" field to the quantity that should trigger a reorder alert.' },
      { title: 'Monitor Alerts', description: 'Check the Materials page for highlighted items that have fallen below their minimum stock level.' },
      { title: 'Reorder Materials', description: 'Use the low-stock alerts to create purchase orders or contact your suppliers for replenishment.' }
    ],
    tips: [
      'Set minimum stock levels based on lead times — if a bearing takes two weeks to arrive, keep enough stock to cover two weeks of expected usage.',
      'Review stock levels weekly to catch discrepancies early before they impact scheduled work.',
      'Consider seasonal demand patterns when setting minimums — you may need higher levels during peak service months.'
    ],
    relatedArticleIds: ['mat-catalog', 'mat-movements', 'mat-reports', 'mat-wo'],
    keywords: ['stock tracking', 'inventory levels', 'minimum stock', 'reorder', 'quantity on hand', 'stock alerts']
  },
  {
    id: 'mat-movements',
    categoryId: 'materials',
    title: 'Stock Movements',
    summary: 'Record inventory transactions including receiving new stock, issuing materials to jobs, and making adjustments.',
    content: [
      'Stock movements track every transaction that changes your inventory quantities. There are three primary movement types: receiving (adding stock from a supplier), issuing (removing stock for use on a work order), and adjustments (correcting quantities after a physical count or to account for damaged goods).',
      'Each movement is recorded with a timestamp, the user who performed it, the quantity changed, and a reference such as a work order number or purchase order. This audit trail provides full traceability of where materials came from and where they went.',
      'Receiving movements increase your on-hand quantity, while issuing movements decrease it. Adjustments can go in either direction and are typically used after a physical inventory count reveals discrepancies between the system quantity and the actual count.'
    ],
    steps: [
      { title: 'Navigate to the Material', description: 'Go to Materials and click on the specific material you need to record a movement for.' },
      { title: 'Select Movement Type', description: 'Choose "Receive," "Issue," or "Adjust" depending on the type of inventory transaction.' },
      { title: 'Enter Quantity', description: 'Enter the quantity being received, issued, or adjusted. For adjustments, enter the difference (positive to add, negative to subtract).' },
      { title: 'Add Reference', description: 'Enter a reference number such as a PO number for receiving or a work order number for issuing.' },
      { title: 'Submit the Movement', description: 'Click "Submit" to record the movement. The on-hand quantity updates immediately.' }
    ],
    tips: [
      'Always record receiving movements when new stock arrives — do not wait until the materials are used, or your stock levels will be inaccurate.',
      'When issuing materials to a work order, use the work order materials feature instead of manual movements so the cost flows to the job automatically.',
      'Perform a physical inventory count at least quarterly and use adjustment movements to reconcile any discrepancies.'
    ],
    relatedArticleIds: ['mat-stock', 'mat-catalog', 'mat-wo', 'mat-reports'],
    keywords: ['stock movements', 'receiving', 'issuing', 'inventory adjustment', 'material transactions', 'audit trail']
  },
  {
    id: 'mat-wo',
    categoryId: 'materials',
    title: 'Materials on Work Orders',
    summary: 'Add materials used during service work to work orders for accurate job costing and invoicing.',
    content: [
      'When technicians use parts and materials during a service job, those materials should be recorded on the work order. This captures the true cost of the job and ensures that material charges can be included on the customer invoice.',
      'Materials can be added to a work order by selecting items from your material catalog. The system pulls in the part number, description, and unit cost automatically. The technician enters the quantity used, and the total material cost is calculated.',
      'Material usage on work orders also drives inventory updates. When materials are logged against a work order, the stock levels for those items are reduced accordingly, keeping your inventory accurate without requiring separate stock movement entries.'
    ],
    steps: [
      { title: 'Open the Work Order', description: 'Navigate to the work order detail page for the job where materials were used.' },
      { title: 'Go to Materials Section', description: 'Scroll to or click on the "Materials" tab within the work order detail view.' },
      { title: 'Add Material', description: 'Click "Add Material" and search for the item by part number or description from the catalog.' },
      { title: 'Enter Quantity Used', description: 'Enter the quantity of the material that was used on this job. The cost is calculated automatically from the catalog unit cost.' },
      { title: 'Save', description: 'Click "Save" to record the material usage. The work order total and inventory are updated.' }
    ],
    tips: [
      'Encourage technicians to log materials as they use them rather than at the end of the job — this reduces forgotten items and improves accuracy.',
      'If a material is not in the catalog, add it first before logging it on the work order to maintain a complete inventory record.',
      'Review material costs on work orders before generating invoices to catch any errors in quantity or pricing.'
    ],
    relatedArticleIds: ['mat-catalog', 'mat-stock', 'wo-detail', 'inv-from-wo'],
    keywords: ['materials on WO', 'job materials', 'parts used', 'material cost', 'work order materials', 'job costing']
  },
  {
    id: 'mat-reports',
    categoryId: 'materials',
    title: 'Inventory Reports',
    summary: 'Generate reports on stock levels, material usage trends, and reorder needs across your organization.',
    content: [
      'Inventory reports provide insights into your material management effectiveness. The stock level report shows current quantities for all materials, highlighting items at or below minimum levels that need reordering.',
      'Usage reports show which materials are consumed most frequently and on which types of work orders. This data helps with purchasing decisions, vendor negotiations, and identifying opportunities to stock materials more efficiently.',
      'Reorder reports consolidate all materials that need replenishment into a single view, making it easy to create purchase orders or communicate needs to your procurement team. Reports can be filtered by date range, material category, or specific materials.'
    ],
    steps: [
      { title: 'Navigate to Reports', description: 'Click "Reports" in the sidebar and select the inventory or materials report section.' },
      { title: 'Select Report Type', description: 'Choose from stock level, usage, or reorder reports depending on the information you need.' },
      { title: 'Set Filters', description: 'Apply filters such as date range, material category, or minimum quantity thresholds to narrow the report.' },
      { title: 'Review Results', description: 'Examine the report data in the table and chart views to identify trends and action items.' },
      { title: 'Export If Needed', description: 'Use the export button to download the report as a PDF for sharing or record-keeping.' }
    ],
    tips: [
      'Run the reorder report weekly and share it with your purchasing team to maintain optimal stock levels.',
      'Use usage trend reports to negotiate better pricing with suppliers by demonstrating consistent volume on key materials.',
      'Compare material usage across similar work order types to identify where costs can be reduced or standardized.'
    ],
    relatedArticleIds: ['mat-stock', 'mat-movements', 'rpt-dashboard', 'rpt-export'],
    keywords: ['inventory reports', 'stock report', 'usage report', 'reorder report', 'material analytics', 'inventory analysis']
  }
];

const REPORT_ARTICLES: HelpArticle[] = [
  {
    id: 'rpt-dashboard',
    categoryId: 'reports',
    title: 'Analytics Dashboard',
    summary: 'View key performance indicators, interactive charts, and operational metrics on the analytics dashboard.',
    content: [
      'The analytics dashboard is your operational command center, presenting key performance indicators and interactive charts that summarize your service operations. Built with Recharts, the dashboard includes six chart components covering revenue, work order volume, technician utilization, and more.',
      'Dashboard KPIs update in real-time as work orders are completed, invoices are paid, and new jobs are created. You can adjust the date range to view metrics for the current week, month, quarter, or any custom period.',
      'Each chart on the dashboard is interactive — hover over data points to see exact values, click on chart segments to drill down into the underlying data, and use the date range selector to compare performance across different time periods.'
    ],
    steps: [
      { title: 'Navigate to Analytics', description: 'Click "Analytics" in the sidebar to open the dashboard. It loads with the current month\'s data by default.' },
      { title: 'Review KPI Cards', description: 'The top row shows key metrics: total revenue, open work orders, completion rate, and average response time.' },
      { title: 'Explore Charts', description: 'Scroll through the six chart panels covering revenue trends, WO volume, technician performance, and service type breakdown.' },
      { title: 'Adjust Date Range', description: 'Use the date range picker at the top to change the reporting period. All charts and KPIs update to reflect the selected range.' },
      { title: 'Drill Into Details', description: 'Click on chart elements to navigate to filtered views showing the underlying work orders or invoices.' }
    ],
    tips: [
      'Check the dashboard at the start of each day to get a quick pulse on open work orders, overdue items, and revenue trends.',
      'Use the monthly view to prepare for management meetings — the dashboard provides all the key metrics in one screen.',
      'Compare date ranges to identify seasonal patterns in service volume and revenue that can inform staffing decisions.'
    ],
    relatedArticleIds: ['rpt-revenue', 'rpt-wo', 'rpt-tech', 'rpt-custom'],
    keywords: ['analytics', 'dashboard', 'KPIs', 'charts', 'metrics', 'Recharts', 'performance indicators']
  },
  {
    id: 'rpt-revenue',
    categoryId: 'reports',
    title: 'Revenue Reports',
    summary: 'Analyze revenue by time period, customer, and service type to understand your financial performance.',
    content: [
      'Revenue reports break down your income from service operations across multiple dimensions. View revenue by time period to identify growth trends, by customer to find your most valuable accounts, or by service type to understand which offerings generate the most income.',
      'Revenue data is pulled from completed and paid invoices, giving you an accurate picture of actual collected revenue rather than just billed amounts. The report distinguishes between invoiced, paid, and outstanding amounts.',
      'Use revenue reports to set financial targets, evaluate pricing strategies, and identify customers or service types where revenue is growing or declining. These insights are essential for strategic planning and resource allocation.'
    ],
    steps: [
      { title: 'Open Revenue Reports', description: 'Navigate to Reports and select "Revenue" from the report type options.' },
      { title: 'Select Grouping', description: 'Choose how to group revenue data: by month, by customer, or by service type.' },
      { title: 'Set Date Range', description: 'Define the time period for the report. Wider ranges show trends while narrow ranges show recent performance.' },
      { title: 'Review Charts and Tables', description: 'Examine the revenue chart for visual trends and the data table for exact figures.' },
      { title: 'Export for Sharing', description: 'Export the report as a PDF to share with stakeholders or include in financial reviews.' }
    ],
    tips: [
      'Track revenue by customer monthly to quickly spot accounts where activity is declining — this is an early warning for potential churn.',
      'Compare revenue by service type quarter over quarter to identify which services are growing and deserve more investment.',
      'Use revenue reports alongside QuickBooks data to reconcile your service revenue with your accounting system.'
    ],
    relatedArticleIds: ['rpt-dashboard', 'rpt-custom', 'rpt-export', 'inv-overview', 'qbo-sync'],
    keywords: ['revenue', 'financial reports', 'income', 'revenue by customer', 'revenue trends', 'financial performance']
  },
  {
    id: 'rpt-wo',
    categoryId: 'reports',
    title: 'Work Order Analytics',
    summary: 'Track work order completion rates, average completion times, and volume by type and status.',
    content: [
      'Work order analytics help you understand operational efficiency by measuring how quickly and consistently your team completes service work. Key metrics include completion rate, average time from creation to completion, and work order volume by type.',
      'The completion rate metric shows the percentage of work orders finished within a given time period. Average completion time measures the elapsed time from when a work order is created to when it is marked complete, helping you identify bottlenecks in your workflow.',
      'Volume analysis breaks down work orders by type (reactive, preventive, inspection) and by status (open, in progress, completed, on hold) to give you a clear picture of your workload distribution and throughput.'
    ],
    steps: [
      { title: 'Open WO Analytics', description: 'Navigate to Reports and select "Work Orders" to see work order performance metrics.' },
      { title: 'Review Completion Metrics', description: 'Check the completion rate percentage and average completion time displayed in the summary cards.' },
      { title: 'Analyze by Type', description: 'View the breakdown of work orders by type to understand the mix of reactive versus preventive work.' },
      { title: 'Check Status Distribution', description: 'Review the status chart to see how many work orders are currently open, in progress, completed, or on hold.' },
      { title: 'Filter by Date Range', description: 'Adjust the date range to compare performance across different periods and identify trends.' }
    ],
    tips: [
      'A healthy operation typically shows a higher ratio of preventive to reactive work orders — aim for 60% preventive or better.',
      'If average completion time is increasing, investigate whether the cause is parts availability, technician capacity, or process inefficiency.',
      'Track work order volume trends to anticipate staffing needs during peak periods and avoid technician overload.'
    ],
    relatedArticleIds: ['rpt-dashboard', 'rpt-tech', 'rpt-custom', 'wo-lifecycle', 'pm-history'],
    keywords: ['work order analytics', 'completion rate', 'average time', 'WO volume', 'WO by type', 'operational efficiency']
  },
  {
    id: 'rpt-tech',
    categoryId: 'reports',
    title: 'Technician Performance',
    summary: 'Evaluate technician productivity with metrics on hours worked, work orders completed, and efficiency ratings.',
    content: [
      'Technician performance reports give managers visibility into individual and team productivity. Metrics include total hours logged, number of work orders completed, average completion time per work order, and first-time fix rate.',
      'These reports help identify top performers who can mentor others, as well as technicians who may need additional training or support. Performance data is pulled from work order time entries and completion records.',
      'Use technician reports to balance workload distribution across your team and ensure that no single technician is overburdened while others are underutilized. Fair workload distribution improves team morale and service quality.'
    ],
    steps: [
      { title: 'Open Technician Reports', description: 'Navigate to Reports and select "Technician Performance" to see individual and team metrics.' },
      { title: 'Select Time Period', description: 'Choose the date range for the performance review — weekly for operational reviews, monthly or quarterly for formal evaluations.' },
      { title: 'Review Individual Metrics', description: 'Examine each technician\'s hours logged, WOs completed, and average completion time.' },
      { title: 'Compare Across Team', description: 'Use the comparison view to see how technicians perform relative to team averages and each other.' },
      { title: 'Identify Action Items', description: 'Note technicians with unusually high or low metrics for follow-up discussion or workload rebalancing.' }
    ],
    tips: [
      'Do not use these reports as the sole basis for performance reviews — context matters, and harder jobs take longer.',
      'Look at trends over time rather than single data points to get a fair picture of technician performance.',
      'Share performance metrics with your team transparently to build a culture of continuous improvement.'
    ],
    relatedArticleIds: ['rpt-dashboard', 'rpt-wo', 'tech-timer', 'wo-lifecycle'],
    keywords: ['technician performance', 'productivity', 'hours worked', 'WOs completed', 'efficiency', 'tech metrics', 'workload']
  },
  {
    id: 'rpt-export',
    categoryId: 'reports',
    title: 'Exporting Reports',
    summary: 'Export reports as PDF documents and download data for external analysis or stakeholder presentations.',
    content: [
      'ServiceOpsIQ uses @react-pdf/renderer to generate professional PDF exports of your reports and documents. Export functionality is available on the analytics dashboard, revenue reports, work order analytics, and technician performance views.',
      'PDF exports include all charts, tables, and summary metrics visible on the screen at the time of export. The exported document is formatted for print with your organization branding and includes the date range and filter settings applied.',
      'Exported reports are ideal for management presentations, customer reviews, compliance documentation, and archival purposes. The PDF format ensures the report looks the same on any device or when printed.'
    ],
    steps: [
      { title: 'Navigate to the Report', description: 'Open the specific report you want to export from the Reports section.' },
      { title: 'Configure Filters', description: 'Set the date range and any other filters to show exactly the data you want in the export.' },
      { title: 'Click Export PDF', description: 'Click the "Export PDF" button typically located in the top-right area of the report page.' },
      { title: 'Wait for Generation', description: 'The PDF is generated in the browser. Larger reports may take a few seconds to render.' },
      { title: 'Download the File', description: 'The PDF downloads automatically to your browser\'s download folder. Open it to verify the contents.' }
    ],
    tips: [
      'Set your desired filters and date range before exporting — the PDF captures exactly what is displayed on screen.',
      'Use PDF exports for monthly management reports to maintain a consistent archive of operational performance.',
      'If you need the raw data for spreadsheet analysis, check if a CSV or data export option is available alongside the PDF export.'
    ],
    relatedArticleIds: ['rpt-dashboard', 'rpt-revenue', 'rpt-wo', 'rpt-tech'],
    keywords: ['export', 'PDF', 'download', 'report export', 'print report', 'react-pdf', 'document generation']
  },
  {
    id: 'rpt-custom',
    categoryId: 'reports',
    title: 'Custom Date Ranges',
    summary: 'Filter all reports by custom date ranges to analyze specific time periods relevant to your business.',
    content: [
      'Every report in ServiceOpsIQ supports custom date range filtering, allowing you to analyze data for any time period. Preset options include this week, this month, this quarter, this year, and last 30/60/90 days for quick selection.',
      'For more specific needs, the custom date range picker lets you select exact start and end dates. This is useful for analyzing performance during a specific project, contract period, or between two events.',
      'Date range selections persist within your session as you navigate between different report views, so you do not need to re-enter the same dates when switching from revenue to work order to technician reports.'
    ],
    steps: [
      { title: 'Open Any Report', description: 'Navigate to the report you want to filter — analytics dashboard, revenue, work orders, or technician performance.' },
      { title: 'Click the Date Range Picker', description: 'Click on the date range selector, typically located at the top of the report page.' },
      { title: 'Choose a Preset or Custom', description: 'Select a preset period (this month, last quarter, etc.) or click "Custom" to define your own dates.' },
      { title: 'Set Start and End Dates', description: 'For custom ranges, click the start date and end date on the calendar picker. Both dates are inclusive.' },
      { title: 'Apply the Filter', description: 'Click "Apply" to refresh all report data with the selected date range.' }
    ],
    tips: [
      'Use quarter-over-quarter comparisons to identify seasonal patterns in your service business.',
      'When preparing for a client review, set the date range to match the contract or service period being discussed.',
      'The date range persists across report tabs in the same session, making it easy to review multiple report types for the same period.'
    ],
    relatedArticleIds: ['rpt-dashboard', 'rpt-revenue', 'rpt-wo', 'rpt-tech'],
    keywords: ['date range', 'custom dates', 'filter', 'time period', 'date picker', 'reporting period', 'date filter']
  }
];

const KB_ARTICLES: HelpArticle[] = [
  {
    id: 'kb-upload',
    categoryId: 'knowledge-base',
    title: 'Uploading Documents',
    summary: 'Upload technical documents, manuals, and reference materials to the knowledge base for team-wide access.',
    content: [
      'The knowledge base serves as a centralized document repository for your organization\'s technical reference materials. Upload equipment manuals, safety data sheets, standard procedures, wiring diagrams, and any other documents your team needs access to in the field.',
      'Supported file types include PDF, Word documents, Excel spreadsheets, and image files. Each upload can be tagged with categories and keywords to make the document easy to find through search.',
      'Uploaded documents are available to all users in your organization based on their role permissions. Technicians can access the knowledge base from the field to look up specifications, procedures, or troubleshooting guides while on site.'
    ],
    steps: [
      { title: 'Navigate to Knowledge Base', description: 'Click "Knowledge Base" in the sidebar to open the document repository.' },
      { title: 'Click Upload Document', description: 'Click the "Upload" button to open the document upload form.' },
      { title: 'Select Your File', description: 'Choose the file from your computer. Supported formats include PDF, DOCX, XLSX, PNG, and JPG.' },
      { title: 'Add Metadata', description: 'Enter a title, description, and select a category for the document. Add relevant keywords to improve searchability.' },
      { title: 'Upload and Confirm', description: 'Click "Upload" to save the document. It becomes immediately available to your team.' }
    ],
    tips: [
      'Use descriptive titles that include the equipment model number — for example, "Grundfos CR 32 Installation Manual" rather than just "Manual."',
      'Upload documents as PDF when possible since they display best in the in-browser viewer and maintain formatting across devices.',
      'Organize uploads into categories immediately rather than dumping everything into a single folder — it saves significant time when searching later.'
    ],
    relatedArticleIds: ['kb-categories', 'kb-search', 'kb-viewer', 'kb-manage'],
    keywords: ['upload', 'document upload', 'knowledge base', 'manuals', 'reference materials', 'file upload', 'technical documents']
  },
  {
    id: 'kb-categories',
    categoryId: 'knowledge-base',
    title: 'Organizing by Category',
    summary: 'Create categories and tag documents to keep your knowledge base organized and easy to navigate.',
    content: [
      'Categories provide a folder-like structure for organizing documents in your knowledge base. Create categories that match your operational needs, such as "Equipment Manuals," "Safety Data Sheets," "Standard Procedures," or "Wiring Diagrams."',
      'Each document can be assigned to one category and tagged with multiple keywords. Categories help users browse the knowledge base by topic, while keywords enable more specific search results when users know what they are looking for.',
      'As your knowledge base grows, a well-organized category structure becomes increasingly important. Plan your categories early and review them periodically to ensure they still make sense as new document types are added.'
    ],
    steps: [
      { title: 'Open Knowledge Base Settings', description: 'Navigate to the Knowledge Base and click the "Categories" or settings option to manage categories.' },
      { title: 'Create a New Category', description: 'Click "Add Category" and enter a descriptive name such as "Pump Manuals" or "Safety Procedures."' },
      { title: 'Organize Existing Documents', description: 'Edit existing documents to assign them to the appropriate categories if they were uploaded without one.' },
      { title: 'Tag Documents with Keywords', description: 'When uploading or editing documents, add keywords like equipment model numbers, manufacturer names, or procedure types.' }
    ],
    tips: [
      'Keep category names broad enough to hold multiple documents but specific enough to be meaningful — "Pump Manuals" is better than "Manuals" or "Grundfos CR 32 Manual."',
      'Include manufacturer names and model numbers as keywords on equipment documents so they appear in search results for specific equipment.',
      'Review and consolidate categories quarterly to prevent category sprawl that makes the knowledge base harder to navigate.'
    ],
    relatedArticleIds: ['kb-upload', 'kb-search', 'kb-manage'],
    keywords: ['categories', 'organize', 'tags', 'document categories', 'knowledge base organization', 'keywords']
  },
  {
    id: 'kb-search',
    categoryId: 'knowledge-base',
    title: 'Searching the Knowledge Base',
    summary: 'Use full-text search to quickly find documents, manuals, and procedures in your knowledge base.',
    content: [
      'The knowledge base search function lets you find documents quickly by searching titles, descriptions, and keywords. Type your search term into the search bar on the Knowledge Base page and results appear as you type.',
      'Search matches against document titles, descriptions, category names, and any keywords that were added during upload. This means you can search for a manufacturer name, model number, procedure type, or any other term and find relevant documents.',
      'Search results are ranked by relevance, with exact title matches appearing first, followed by description matches and keyword matches. You can further filter results by category to narrow down to a specific document type.'
    ],
    steps: [
      { title: 'Open the Knowledge Base', description: 'Click "Knowledge Base" in the sidebar to access the document repository.' },
      { title: 'Enter Search Terms', description: 'Type your search query into the search bar at the top of the page. Results begin appearing as you type.' },
      { title: 'Review Results', description: 'Scan the search results list showing document titles, descriptions, and categories that match your query.' },
      { title: 'Filter by Category', description: 'Optionally select a category filter to narrow results to a specific document type.' },
      { title: 'Open the Document', description: 'Click on a search result to open the document in the viewer or download it.' }
    ],
    tips: [
      'Search by equipment model number when you need a specific manual — this is faster than browsing through categories.',
      'Use partial terms if you are unsure of the exact name — searching "Grundfos" will find all Grundfos-related documents.',
      'If search returns too many results, add more specific terms or use category filters to narrow down.'
    ],
    relatedArticleIds: ['kb-upload', 'kb-categories', 'kb-viewer', 'search-overview'],
    keywords: ['search', 'find documents', 'full-text search', 'knowledge base search', 'document search', 'lookup']
  },
  {
    id: 'kb-viewer',
    categoryId: 'knowledge-base',
    title: 'Document Viewer',
    summary: 'View documents directly in your browser without downloading, with options to download when needed.',
    content: [
      'The in-browser document viewer lets you read PDF documents, view images, and preview other file types without downloading them to your device. This is especially useful for technicians in the field who need quick access to a manual or diagram.',
      'The viewer supports zoom, page navigation, and full-screen mode for PDFs. Image files display with zoom and pan controls. For file types that cannot be previewed in the browser, a download button is provided.',
      'Documents open in the viewer by default when clicked from the knowledge base. You can always download a copy using the download button in the viewer toolbar if you need an offline copy.'
    ],
    steps: [
      { title: 'Find the Document', description: 'Search or browse the knowledge base to locate the document you want to view.' },
      { title: 'Click to Open', description: 'Click on the document title or preview icon to open it in the in-browser viewer.' },
      { title: 'Navigate the Document', description: 'Use the page controls to move through multi-page PDFs, or zoom controls for images and detailed diagrams.' },
      { title: 'Download If Needed', description: 'Click the download button in the viewer toolbar to save a local copy of the document.' }
    ],
    tips: [
      'Use full-screen mode when viewing wiring diagrams or detailed schematics for the best readability.',
      'On mobile devices, pinch-to-zoom works in the document viewer for examining fine details on technical drawings.',
      'If a PDF is slow to load, it may be a very large file — consider uploading a compressed version for faster access.'
    ],
    relatedArticleIds: ['kb-search', 'kb-upload', 'kb-manage'],
    keywords: ['document viewer', 'view documents', 'PDF viewer', 'in-browser', 'preview', 'download document']
  },
  {
    id: 'kb-manage',
    categoryId: 'knowledge-base',
    title: 'Managing Documents',
    summary: 'Update, replace, or delete documents in the knowledge base to keep your reference materials current.',
    content: [
      'Keeping your knowledge base current is essential for ensuring technicians have access to the latest procedures, specifications, and reference materials. Documents can be updated with new metadata, replaced with newer versions, or deleted when they are no longer relevant.',
      'When replacing a document, the system maintains the same URL and category assignment, so any bookmarks or references to the document continue to work. The upload date is updated to reflect the new version.',
      'Deleting a document removes it permanently from the knowledge base. Consider whether the document should be archived or moved to a different category before deleting. Only users with ADMIN or DISPATCHER roles can delete documents.'
    ],
    steps: [
      { title: 'Find the Document', description: 'Navigate to the knowledge base and locate the document you want to manage.' },
      { title: 'Edit Metadata', description: 'Click the edit button to update the title, description, category, or keywords without replacing the file.' },
      { title: 'Replace the File', description: 'To upload a newer version, click "Replace" and select the new file. The metadata and category are preserved.' },
      { title: 'Delete If Necessary', description: 'Click "Delete" and confirm to permanently remove the document from the knowledge base.' }
    ],
    tips: [
      'When equipment manufacturers release updated manuals, replace the old version rather than uploading a second copy to avoid confusion.',
      'Add a version note in the document description when replacing files so users know the document was recently updated.',
      'Perform a quarterly review of the knowledge base to remove outdated documents and update anything that has changed.'
    ],
    relatedArticleIds: ['kb-upload', 'kb-categories', 'kb-search'],
    keywords: ['manage documents', 'update document', 'replace document', 'delete document', 'document management', 'version control']
  }
];

const PORTAL_CUSTOMER_ARTICLES: HelpArticle[] = [
  {
    id: 'portal-overview',
    categoryId: 'portal-customer',
    title: 'Customer Portal Overview',
    summary: 'Understand what the customer portal provides — a self-service view of quotes, invoices, and work order status.',
    content: [
      'The customer portal is a self-service interface that gives your customers visibility into their service activity without needing to call or email your office. Customers can view quotes, invoices, and work order status for their organization.',
      'The portal uses token-based authentication rather than traditional login credentials. Administrators generate access tokens for customers, who then use those tokens to access their portal. This approach simplifies access management and eliminates the need for customers to remember passwords.',
      'Portal access is read-only for most features — customers can view and approve quotes but cannot modify work orders or invoices. This ensures data integrity while providing the transparency customers expect from a professional service provider.'
    ],
    steps: [
      { title: 'Understand Portal Features', description: 'The customer portal includes quote viewing and approval, invoice viewing with payment status, and work order status tracking.' },
      { title: 'Share Portal Access', description: 'Generate an access token in the admin panel and share the portal URL and token with your customer contact.' },
      { title: 'Customer Logs In', description: 'The customer navigates to the portal URL and enters their access token to authenticate.' },
      { title: 'Customer Views Their Data', description: 'Once authenticated, the customer sees only their organization\'s quotes, invoices, and work orders.' }
    ],
    tips: [
      'Mention the customer portal during sales conversations — it differentiates your service from competitors who only provide phone or email updates.',
      'Set up portal access proactively for your top customers rather than waiting for them to ask for status updates.',
      'The portal reduces inbound calls and emails by giving customers the information they need on demand.'
    ],
    relatedArticleIds: ['portal-tokens', 'portal-quotes', 'portal-invoices', 'portal-wo', 'portal-setup'],
    keywords: ['customer portal', 'self-service', 'portal overview', 'customer access', 'token authentication', 'transparency']
  },
  {
    id: 'portal-tokens',
    categoryId: 'portal-customer',
    title: 'Managing Access Tokens',
    summary: 'Generate, share, and revoke customer portal access tokens for secure, controlled access.',
    content: [
      'Access tokens are the authentication method for the customer portal. Each token is generated for a specific customer organization and grants access to only that customer\'s data. Tokens are long, random strings that are difficult to guess.',
      'Administrators generate tokens from the portal management section and share them with customer contacts via email or secure message. A single token provides access for anyone who has it, so share tokens only with authorized customer representatives.',
      'Tokens can be revoked at any time if a customer relationship ends, a contact leaves the customer organization, or if you suspect a token has been shared with unauthorized parties. Revoking a token immediately blocks all access using that token.'
    ],
    steps: [
      { title: 'Navigate to Portal Management', description: 'Go to the admin section and click on "Customer Portal" or "Portal Management" to manage tokens.' },
      { title: 'Select the Customer', description: 'Choose the customer organization you want to generate a portal access token for.' },
      { title: 'Generate a Token', description: 'Click "Generate Token" to create a new access token for the selected customer.' },
      { title: 'Share the Token Securely', description: 'Copy the token and share it with the customer contact via email. Include the portal URL and basic instructions.' },
      { title: 'Revoke When Needed', description: 'To revoke access, find the token in the management view and click "Revoke." Access is terminated immediately.' }
    ],
    tips: [
      'Generate a new token rather than sharing one token with multiple contacts at the same customer — this way you can revoke individual access.',
      'Include a brief instruction sheet when sharing portal access for the first time so the customer knows how to use the portal.',
      'Review active tokens quarterly and revoke any that are no longer needed to maintain tight access control.'
    ],
    relatedArticleIds: ['portal-overview', 'portal-setup', 'set-users', 'set-audit'],
    keywords: ['access tokens', 'portal tokens', 'generate token', 'revoke token', 'portal authentication', 'customer access control']
  },
  {
    id: 'portal-quotes',
    categoryId: 'portal-customer',
    title: 'Viewing Quotes in the Portal',
    summary: 'Customers can view, review, and approve quotes through the customer portal.',
    content: [
      'The customer portal displays all quotes associated with the customer\'s organization. Each quote shows the line items, pricing, terms, and current status (draft, sent, approved, or rejected). Customers can review quote details at their convenience.',
      'Quote approval is a key portal feature — customers can approve quotes directly from the portal instead of requiring email or phone confirmation. This streamlines the approval process and creates a documented record of the customer\'s acceptance.',
      'Customers can also view the history of all their quotes, making it easy to reference past pricing or compare quotes for similar work. The portal shows the quote PDF for download if one has been generated.'
    ],
    steps: [
      { title: 'Customer Opens Portal', description: 'The customer navigates to the portal URL and authenticates with their access token.' },
      { title: 'Navigate to Quotes', description: 'The customer clicks "Quotes" in the portal navigation to see all quotes for their organization.' },
      { title: 'Review Quote Details', description: 'The customer clicks on a specific quote to view line items, pricing, terms, and conditions.' },
      { title: 'Approve or Respond', description: 'If the quote status allows approval, the customer can click "Approve" to accept the quote directly from the portal.' },
      { title: 'Download PDF', description: 'The customer can download a PDF version of the quote for their records or internal approval processes.' }
    ],
    tips: [
      'Send customers an email notification when a new quote is available in the portal to prompt timely review and approval.',
      'Ensure quotes are complete and professional before sending them to the portal — the customer sees exactly what you have entered.',
      'Use the portal quote approval feature to reduce turnaround time on approvals from days to hours.'
    ],
    relatedArticleIds: ['portal-overview', 'portal-invoices', 'quote-create', 'quote-send'],
    keywords: ['portal quotes', 'quote approval', 'customer quotes', 'view quotes', 'approve quote', 'quote portal']
  },
  {
    id: 'portal-invoices',
    categoryId: 'portal-customer',
    title: 'Viewing Invoices in the Portal',
    summary: 'Customers can view their invoice history, payment status, and download invoice PDFs through the portal.',
    content: [
      'The invoice section of the customer portal shows all invoices associated with the customer\'s organization. Each invoice displays the date, amount, line items, and current payment status (pending, paid, partially paid, or overdue).',
      'Customers can view invoice details and download PDF copies for their accounting records. The payment status updates automatically when payments are recorded in ServiceOpsIQ or synced from QuickBooks Online.',
      'The invoice history provides a complete record of all financial transactions between your organization and the customer. This transparency builds trust and reduces payment disputes by giving customers immediate access to their billing information.'
    ],
    steps: [
      { title: 'Customer Opens Portal', description: 'The customer authenticates to the portal using their access token.' },
      { title: 'Navigate to Invoices', description: 'The customer clicks "Invoices" in the portal navigation to see their invoice history.' },
      { title: 'Review Invoice Details', description: 'Click on a specific invoice to see line items, amounts, dates, and payment status.' },
      { title: 'Download Invoice PDF', description: 'Click the download button to save a PDF copy of the invoice for accounting purposes.' }
    ],
    tips: [
      'Encourage customers to check the portal for invoice status before calling your office — it reduces administrative overhead.',
      'Ensure QuickBooks sync is working so that payment statuses update promptly and customers see accurate information.',
      'Use the portal invoice view as a professional differentiator — many competitors only provide invoices via email or mail.'
    ],
    relatedArticleIds: ['portal-overview', 'portal-quotes', 'inv-overview', 'set-qbo'],
    keywords: ['portal invoices', 'customer invoices', 'payment status', 'invoice history', 'invoice PDF', 'billing portal']
  },
  {
    id: 'portal-wo',
    categoryId: 'portal-customer',
    title: 'Viewing Work Orders in the Portal',
    summary: 'Customers can track the status of their work orders through the portal without contacting your office.',
    content: [
      'The work order section of the customer portal shows all active and completed work orders for the customer\'s sites and assets. Customers can see the work order status, assigned technician, scheduled date, and a summary of the work being performed.',
      'This real-time visibility eliminates the need for customers to call or email for status updates. They can check the portal at any time to see whether a technician has been dispatched, if work is in progress, or if the job has been completed.',
      'Completed work orders show a summary of the work performed, materials used, and time spent. This information helps customers understand the value of the service they are receiving and builds confidence in your team\'s thoroughness.'
    ],
    steps: [
      { title: 'Customer Opens Portal', description: 'The customer logs into the portal with their access token.' },
      { title: 'Navigate to Work Orders', description: 'The customer clicks "Work Orders" in the portal navigation to see all service activity.' },
      { title: 'View WO Status', description: 'Each work order shows its current status — Open, In Progress, On Hold, or Completed — along with the scheduled date.' },
      { title: 'Review Completed Work', description: 'Click on a completed work order to see the work summary, materials used, and technician notes.' }
    ],
    tips: [
      'Keep work order statuses updated in real-time so customers always see accurate information in the portal.',
      'Add clear, professional notes to work orders since customers can see the work summary in the portal.',
      'Use the portal work order view to demonstrate service level agreement (SLA) compliance to your customers.'
    ],
    relatedArticleIds: ['portal-overview', 'wo-lifecycle', 'wo-detail', 'portal-setup'],
    keywords: ['portal work orders', 'WO status', 'customer work orders', 'service tracking', 'job status', 'portal WO']
  },
  {
    id: 'portal-setup',
    categoryId: 'portal-customer',
    title: 'Setting Up Portal Access',
    summary: 'Administrator steps to enable the customer portal, generate tokens, and onboard customers.',
    content: [
      'Setting up customer portal access is an admin-level task that involves enabling the portal feature, generating access tokens for specific customers, and sharing portal credentials. The portal is available at a dedicated URL path under your ServiceOpsIQ instance.',
      'Before generating tokens, ensure that the customer has been created in your system with accurate organization details. The portal links the token to a customer organization, so all data displayed is scoped to that specific customer.',
      'When onboarding a customer to the portal, provide them with the portal URL, their access token, and a brief overview of what they can see and do. Consider creating a standard onboarding email template that you can reuse for each new portal customer.'
    ],
    steps: [
      { title: 'Verify Customer Record', description: 'Ensure the customer organization exists in ServiceOpsIQ with accurate details before setting up portal access.' },
      { title: 'Navigate to Portal Management', description: 'Go to Settings or Admin and find the "Customer Portal" management section.' },
      { title: 'Generate Access Token', description: 'Select the customer and generate a new access token. Copy it securely.' },
      { title: 'Send Onboarding Email', description: 'Email the customer with the portal URL, their token, and instructions on how to log in and navigate.' },
      { title: 'Verify Customer Access', description: 'Ask the customer to confirm they can log in and see their data correctly. Troubleshoot any issues.' }
    ],
    tips: [
      'Create a standard onboarding email template for portal access to ensure consistent messaging and professional presentation.',
      'Test the portal experience yourself using the customer token before sharing it to make sure the data displays correctly.',
      'Set up portal access for new customers during the initial account creation process rather than as an afterthought.'
    ],
    relatedArticleIds: ['portal-overview', 'portal-tokens', 'set-users', 'cust-create'],
    keywords: ['portal setup', 'enable portal', 'onboard customer', 'portal configuration', 'admin setup', 'customer onboarding']
  }
];

const PORTAL_TECH_ARTICLES: HelpArticle[] = [
  {
    id: 'tech-overview',
    categoryId: 'portal-tech',
    title: 'Tech Portal Overview',
    summary: 'Understand the technician portal — a focused interface for field technicians to manage their assigned work.',
    content: [
      'The technician portal provides field technicians with a streamlined interface focused on their daily work. Technicians see only their assigned work orders, can update task status, log time, add materials, upload photos, and collect customer signatures.',
      'The portal is optimized for mobile use through the Progressive Web App (PWA) features of ServiceOpsIQ. Technicians can install it as an app on their phone or tablet for quick access without opening a browser.',
      'Unlike the full admin interface, the tech portal removes navigation complexity and only shows features relevant to field work. This reduces training time and helps technicians focus on completing their assignments efficiently.'
    ],
    steps: [
      { title: 'Log In', description: 'Technicians log in with their ServiceOpsIQ credentials. Their TECH role automatically directs them to the technician portal view.' },
      { title: 'View Today\'s Work', description: 'The home screen shows work orders assigned to the technician, sorted by scheduled date with today\'s work highlighted.' },
      { title: 'Select a Work Order', description: 'Tap on a work order to open it and see the full details including site, asset, procedures, and customer information.' },
      { title: 'Complete Work and Log Activity', description: 'Use the work order detail view to start the timer, complete tasks, add materials, take photos, and collect signatures.' }
    ],
    tips: [
      'Install ServiceOpsIQ as a PWA on your phone by using the browser\'s "Add to Home Screen" option for app-like access.',
      'Review your assigned work orders the evening before to plan your route and materials for the next day.',
      'Keep the app open during jobs so the work timer runs accurately and you do not forget to log activity.'
    ],
    relatedArticleIds: ['tech-wo', 'tech-tasks', 'tech-timer', 'tech-photos', 'tech-signatures'],
    keywords: ['tech portal', 'technician portal', 'field technician', 'mobile portal', 'tech interface', 'PWA']
  },
  {
    id: 'tech-wo',
    categoryId: 'portal-tech',
    title: 'Viewing Assigned Work Orders',
    summary: 'See your assigned work orders, filter by status or date, and access all job details from the technician portal.',
    content: [
      'The work order list in the technician portal shows all work orders assigned to you, organized by scheduled date. Each entry shows the customer name, site address, asset, work order type, and current status so you can quickly identify your next job.',
      'Filter your work order list by status to see only open or in-progress jobs, or by date to focus on today\'s schedule. The list updates in real-time as dispatchers assign new work orders or change priorities.',
      'Tapping on a work order opens the full detail view where you can see procedures, special instructions, customer contact information, site access notes, and the asset\'s maintenance history.'
    ],
    steps: [
      { title: 'Open the Work Order List', description: 'The technician portal home screen displays your assigned work orders. Pull down to refresh the list.' },
      { title: 'Filter Work Orders', description: 'Use the filter options to show only certain statuses (Open, In Progress) or date ranges (Today, This Week).' },
      { title: 'Review Job Details', description: 'Tap on a work order to see the complete details including customer, site, asset, procedures, and instructions.' },
      { title: 'Navigate to the Site', description: 'Tap the site address to open it in your phone\'s maps app for turn-by-turn navigation.' },
      { title: 'Contact the Customer', description: 'Tap the customer phone number to call directly from the work order detail view if you need to coordinate access.' }
    ],
    tips: [
      'Check for new assignments throughout the day — dispatchers may add urgent work orders that require immediate attention.',
      'Use the "Today" filter to focus on your current day\'s jobs and avoid being distracted by future scheduled work.',
      'Review the asset maintenance history before arriving on site to understand what work has been done previously.'
    ],
    relatedArticleIds: ['tech-overview', 'tech-tasks', 'wo-lifecycle', 'wo-detail'],
    keywords: ['assigned work orders', 'tech WO list', 'view assignments', 'job list', 'work schedule', 'technician assignments']
  },
  {
    id: 'tech-tasks',
    categoryId: 'portal-tech',
    title: 'Completing Tasks',
    summary: 'Check off procedure steps, add notes to individual tasks, and document your work as you complete it.',
    content: [
      'When a work order includes linked procedures, each procedure step appears as a task in the work order detail view. Technicians check off each task as they complete it, providing a documented record of every step performed during the maintenance visit.',
      'Each task can have notes added to it, allowing technicians to record readings, observations, or exceptions. For example, if a vibration reading is taken during an inspection, the technician enters the measurement value as a note on that specific task.',
      'Task completion is saved in real-time, so if you lose connectivity temporarily, your progress is preserved. The dispatcher and admin team can see task completion progress on the work order, giving them visibility into job status without calling the technician.'
    ],
    steps: [
      { title: 'Open the Work Order', description: 'Tap on the assigned work order to see its details and the linked procedure tasks.' },
      { title: 'Review the Task List', description: 'Scroll through the procedure steps to understand the full scope of work before beginning.' },
      { title: 'Complete Each Task', description: 'Tap the checkbox next to each task as you complete it. The task is marked with a timestamp.' },
      { title: 'Add Notes', description: 'Tap the note icon on any task to add observations, measurements, or details about what you found or did.' },
      { title: 'Review Before Closing', description: 'Review all tasks to ensure everything is checked off and notes are complete before marking the work order as done.' }
    ],
    tips: [
      'Complete tasks in real-time as you work rather than checking everything off at the end — this creates accurate timestamps and reduces the chance of forgetting a step.',
      'Add notes even when everything is normal — "bearings inspected, no abnormal wear" is more valuable than an empty note.',
      'If you cannot complete a task, add a note explaining why and leave it unchecked so the dispatcher knows what remains.'
    ],
    relatedArticleIds: ['tech-overview', 'tech-wo', 'pm-procedures', 'tech-photos'],
    keywords: ['complete tasks', 'procedure steps', 'checklist', 'task notes', 'step completion', 'field documentation']
  },
  {
    id: 'tech-timer',
    categoryId: 'portal-tech',
    title: 'Using the Work Timer',
    summary: 'Start and stop the work timer to accurately log labor hours on each work order.',
    content: [
      'The work timer in the technician portal tracks the time you spend on each job. Start the timer when you begin working on a work order and stop it when you finish or take a break. The logged time flows directly into the work order for billing and performance tracking.',
      'Accurate time tracking is essential for job costing, invoicing, and understanding how long different types of service work actually take. The timer records start and stop events so multiple time entries can be created for a single work order if you take breaks.',
      'Timer data feeds into the technician performance reports and is used to calculate labor costs on invoices. Consistent, accurate time logging helps your organization bill correctly and identify opportunities to improve efficiency.'
    ],
    steps: [
      { title: 'Open the Work Order', description: 'Navigate to the work order you are about to start working on.' },
      { title: 'Start the Timer', description: 'Tap the "Start Timer" button to begin recording your work time. A running clock appears on screen.' },
      { title: 'Work on the Job', description: 'Complete the assigned tasks while the timer runs. You can navigate between tasks without stopping the timer.' },
      { title: 'Pause for Breaks', description: 'If you need to take a break or leave the site temporarily, stop the timer and restart it when you resume work.' },
      { title: 'Stop When Complete', description: 'Tap "Stop Timer" when you have finished all work on the job. The total time is logged to the work order.' }
    ],
    tips: [
      'Start the timer when you begin hands-on work, not when you are still driving to the site — travel time should be tracked separately if your organization bills for it.',
      'If you forget to start the timer, you can manually enter the time spent on the work order through the time entry form.',
      'Stop the timer during extended breaks or while waiting for parts — this keeps your logged time accurate and avoids inflated billing.'
    ],
    relatedArticleIds: ['tech-overview', 'tech-tasks', 'rpt-tech', 'wo-detail'],
    keywords: ['work timer', 'time tracking', 'labor hours', 'start stop timer', 'time entry', 'job timing']
  },
  {
    id: 'tech-photos',
    categoryId: 'portal-tech',
    title: 'Uploading Job Photos',
    summary: 'Capture and upload photos from the job site to document equipment condition, work performed, and findings.',
    content: [
      'Photo documentation is a powerful tool for recording equipment condition before and after service, documenting issues found during inspections, and providing visual evidence of completed work. The technician portal integrates with your device camera for quick photo capture.',
      'Photos are attached directly to the work order and become part of the permanent service record. They can be viewed by dispatchers, administrators, and customers (through the portal), providing visual context that complements written notes.',
      'Take photos of nameplate data, defective components, completed installations, meter readings, and any unusual conditions encountered during the job. These images are invaluable for troubleshooting, warranty claims, and demonstrating the quality of your work.'
    ],
    steps: [
      { title: 'Open the Work Order', description: 'Navigate to the work order where you want to add photos.' },
      { title: 'Tap the Photo Button', description: 'Tap the camera or photo upload button in the work order detail view.' },
      { title: 'Capture or Select', description: 'Take a new photo with your device camera or select an existing photo from your gallery.' },
      { title: 'Add a Caption', description: 'Enter a brief description of what the photo shows — for example, "Bearing wear on drive end" or "Completed alignment."' },
      { title: 'Upload', description: 'Tap "Upload" to attach the photo to the work order. It appears in the work order\'s photo gallery.' }
    ],
    tips: [
      'Take "before and after" photos on every job — they demonstrate the value of your work to customers and serve as evidence of pre-existing conditions.',
      'Always photograph equipment nameplates when visiting a site for the first time to capture model and serial number information.',
      'Add descriptive captions to every photo so anyone viewing the work order later understands what they are looking at.'
    ],
    relatedArticleIds: ['tech-overview', 'tech-tasks', 'wo-detail', 'tech-signatures'],
    keywords: ['job photos', 'photo upload', 'camera', 'photo documentation', 'image capture', 'visual documentation', 'before after']
  },
  {
    id: 'tech-signatures',
    categoryId: 'portal-tech',
    title: 'Collecting Customer Signatures',
    summary: 'Capture customer signatures on-site to confirm work completion and acceptance.',
    content: [
      'Customer signature capture provides documented proof that the customer reviewed and accepted the completed work. This is important for billing, dispute resolution, and maintaining professional service records.',
      'The signature capture feature uses a touch-enabled canvas that works on phones and tablets. The customer signs directly on the device screen with their finger or a stylus, and the signature is saved as part of the work order record.',
      'Signatures are typically collected at the end of a service visit after reviewing the completed work with the customer. The signed record can be included in the work order PDF report and serves as confirmation that the customer was satisfied with the work performed.'
    ],
    steps: [
      { title: 'Complete All Work', description: 'Finish all tasks, log time, add materials, and upload photos before requesting the customer\'s signature.' },
      { title: 'Open Signature Capture', description: 'Tap the "Collect Signature" button in the work order detail view to open the signature pad.' },
      { title: 'Review Work with Customer', description: 'Briefly review the work performed with the customer so they understand what they are signing off on.' },
      { title: 'Customer Signs', description: 'Hand the device to the customer and have them sign on the touch screen with their finger or stylus.' },
      { title: 'Save and Confirm', description: 'Tap "Save Signature" to attach it to the work order. The signature becomes part of the permanent record.' }
    ],
    tips: [
      'Always review the completed work with the customer before asking for a signature — this prevents misunderstandings and builds trust.',
      'If the customer is unavailable to sign, note this on the work order and follow up later rather than leaving the job unsigned.',
      'Clean the device screen before handing it to the customer for signature capture — a smudged screen creates illegible signatures.'
    ],
    relatedArticleIds: ['tech-overview', 'tech-tasks', 'tech-photos', 'wo-lifecycle'],
    keywords: ['customer signature', 'signature capture', 'sign off', 'work acceptance', 'digital signature', 'completion confirmation']
  }
];

const SETTINGS_ARTICLES: HelpArticle[] = [
  {
    id: 'set-users',
    categoryId: 'settings',
    title: 'User Management',
    summary: 'Add new users, edit existing accounts, and deactivate users who no longer need access.',
    content: [
      'User management in ServiceOpsIQ allows administrators to control who has access to the system and what they can do. Each user account includes a name, email address, role assignment, and active/inactive status.',
      'Adding a new user involves entering their information and selecting their role (ADMIN, DISPATCHER, or TECH). The user receives an invitation to set up their account. All users belong to a single organization in the multi-tenant architecture.',
      'Deactivating a user immediately revokes their access without deleting their historical data. This is the preferred approach when someone leaves the organization, as it preserves the audit trail of their actions and the work orders they were involved with.'
    ],
    steps: [
      { title: 'Navigate to Settings', description: 'Click "Settings" in the sidebar and then select "Users" to open the user management page.' },
      { title: 'Add a New User', description: 'Click "Add User" and enter the person\'s name, email address, and select their role.' },
      { title: 'Send Invitation', description: 'Save the new user record to trigger an invitation email that lets them set up their account.' },
      { title: 'Edit an Existing User', description: 'Click on a user to edit their role, contact information, or other details.' },
      { title: 'Deactivate a User', description: 'Toggle the user\'s status to "Inactive" to revoke access while preserving their historical data.' }
    ],
    tips: [
      'Deactivate users rather than deleting them to maintain complete audit trails and work order history.',
      'Assign the minimum role needed — most field staff only need the TECH role, not DISPATCHER or ADMIN.',
      'Review the user list periodically to ensure only current team members have active access.'
    ],
    relatedArticleIds: ['set-roles', 'set-audit', 'set-org', 'gs-welcome'],
    keywords: ['user management', 'add user', 'deactivate user', 'user accounts', 'team management', 'access control']
  },
  {
    id: 'set-roles',
    categoryId: 'settings',
    title: 'Role Configuration',
    summary: 'Understand the three user roles — ADMIN, DISPATCHER, and TECH — and their permission levels.',
    content: [
      'ServiceOpsIQ uses three predefined roles to control access and permissions. ADMIN has full access to all features including settings, billing, user management, and portal configuration. DISPATCHER can manage work orders, customers, scheduling, and reporting but cannot access system settings.',
      'The TECH role is designed for field technicians and provides access to assigned work orders, time tracking, task completion, photo upload, and signature capture. Technicians cannot view financial data, manage other users, or access administrative features.',
      'Role assignments are made when creating or editing a user account. A user can have only one role at a time. If someone needs a different level of access, an admin can change their role through the user management page.'
    ],
    steps: [
      { title: 'Review Role Definitions', description: 'ADMIN: full access. DISPATCHER: operations and reporting. TECH: assigned work orders and field tools.' },
      { title: 'Navigate to User Management', description: 'Go to Settings > Users to see all users and their current role assignments.' },
      { title: 'Assign or Change a Role', description: 'Click on a user and select the appropriate role from the role dropdown.' },
      { title: 'Save the Change', description: 'Click "Save" to apply the new role. The user\'s permissions update immediately on their next page load.' }
    ],
    tips: [
      'Start with one or two ADMINs and promote others to DISPATCHER only when they need access to scheduling and customer management.',
      'The TECH role keeps the interface focused for field workers — resist the temptation to give everyone DISPATCHER access.',
      'Document which users have ADMIN access and review this list quarterly for security best practices.'
    ],
    relatedArticleIds: ['set-users', 'set-audit', 'tech-overview', 'set-org'],
    keywords: ['roles', 'permissions', 'ADMIN', 'DISPATCHER', 'TECH', 'role configuration', 'access levels']
  },
  {
    id: 'set-qbo',
    categoryId: 'settings',
    title: 'QuickBooks Integration Setup',
    summary: 'Connect ServiceOpsIQ to QuickBooks Online for customer and invoice synchronization.',
    content: [
      'The QuickBooks Online (QBO) integration connects ServiceOpsIQ to your accounting system through OAuth 2.0 authentication. Once connected, you can sync customers between the two systems and push invoices from ServiceOpsIQ to QuickBooks for accounting and payment processing.',
      'Setting up the integration requires a QuickBooks Online account with admin access. The OAuth flow securely connects the two systems without sharing your QuickBooks password. The connection can be managed and disconnected from the ServiceOpsIQ settings page.',
      'After connecting, configure the sync settings to control what data flows between the systems. Customer sync can be one-way or bidirectional. Invoice sync pushes ServiceOpsIQ invoices to QuickBooks where they can be sent to customers for payment through QuickBooks payment channels.'
    ],
    steps: [
      { title: 'Navigate to Integrations', description: 'Go to Settings and click "Integrations" or "QuickBooks" to open the QBO integration page.' },
      { title: 'Click Connect to QuickBooks', description: 'Click the "Connect" button to begin the OAuth 2.0 authorization flow with Intuit.' },
      { title: 'Authorize Access', description: 'Log in to your QuickBooks Online account and authorize ServiceOpsIQ to access your data.' },
      { title: 'Configure Sync Settings', description: 'After connecting, configure which data to sync: customers, invoices, and payment status.' },
      { title: 'Run Initial Sync', description: 'Click "Sync Now" to perform the initial data synchronization between the two systems.' }
    ],
    tips: [
      'Use the same customer names in ServiceOpsIQ and QuickBooks to make the initial sync matching easier.',
      'Test the integration with a single invoice before syncing everything to verify that line items and amounts map correctly.',
      'If the OAuth connection expires, you will see a warning in settings — simply reconnect by clicking "Connect" again.'
    ],
    relatedArticleIds: ['set-org', 'inv-overview', 'rpt-revenue', 'portal-invoices'],
    keywords: ['QuickBooks', 'QBO', 'integration', 'OAuth', 'accounting sync', 'invoice sync', 'QuickBooks Online']
  },
  {
    id: 'set-audit',
    categoryId: 'settings',
    title: 'Audit Logs',
    summary: 'Review system activity logs to see who changed what and when for compliance and troubleshooting.',
    content: [
      'Audit logs provide a chronological record of significant actions taken in ServiceOpsIQ. Every create, update, and delete operation is logged with the user who performed it, the timestamp, and the details of what changed.',
      'Audit logs are essential for compliance, security, and troubleshooting. If a work order was unexpectedly modified, you can check the audit log to see who made the change and when. If a customer record was deleted, the log shows who deleted it.',
      'Only ADMIN users can access the full audit log. The log can be filtered by user, action type, entity type, and date range to help you find specific events quickly.'
    ],
    steps: [
      { title: 'Navigate to Audit Logs', description: 'Go to Settings and click "Audit Logs" to open the activity log viewer.' },
      { title: 'Set Filters', description: 'Filter by date range, user, action type (create, update, delete), or entity type (work order, invoice, customer, etc.).' },
      { title: 'Review Entries', description: 'Each log entry shows the user, action, affected entity, timestamp, and a summary of changes.' },
      { title: 'Investigate Details', description: 'Click on a log entry to see the full details of what was changed, including before and after values when available.' }
    ],
    tips: [
      'Review audit logs weekly to catch any unusual activity such as bulk deletions or unauthorized access attempts.',
      'Use audit logs to resolve disputes about when a work order status was changed or who approved a quote.',
      'Filter by "delete" action type periodically to ensure that important records are not being accidentally removed.'
    ],
    relatedArticleIds: ['set-users', 'set-roles', 'set-org'],
    keywords: ['audit logs', 'activity log', 'change history', 'who changed', 'compliance', 'system activity', 'security audit']
  },
  {
    id: 'set-org',
    categoryId: 'settings',
    title: 'Organization Settings',
    summary: 'Configure your company information, branding, and system-wide preferences.',
    content: [
      'Organization settings define your company identity within ServiceOpsIQ. This includes your company name, address, phone number, email, and logo. This information appears on generated PDFs such as quotes, invoices, and work order reports.',
      'Branding settings control the visual presentation of your ServiceOpsIQ instance. The system uses a professional dark theme with customizable accent colors. Your company logo is displayed in the sidebar navigation and on all customer-facing documents.',
      'System-wide preferences such as default work order settings, notification preferences, and timezone configuration are also managed in organization settings. These defaults apply to all users in your organization unless overridden at the individual level.'
    ],
    steps: [
      { title: 'Navigate to Organization Settings', description: 'Go to Settings and click "Organization" to open your company configuration page.' },
      { title: 'Update Company Information', description: 'Enter or update your company name, address, phone, email, and website.' },
      { title: 'Upload Logo', description: 'Upload your company logo for use on PDFs and the application sidebar.' },
      { title: 'Configure Preferences', description: 'Set timezone, default work order type, notification preferences, and other system-wide options.' },
      { title: 'Save Changes', description: 'Click "Save" to apply your settings. Changes take effect immediately across the system.' }
    ],
    tips: [
      'Upload a high-resolution logo (at least 200x200 pixels) for the best appearance on generated PDF documents.',
      'Keep your company contact information current — it appears on every quote and invoice your customers receive.',
      'Set the correct timezone to ensure that work order timestamps and scheduled dates display accurately for your region.'
    ],
    relatedArticleIds: ['set-users', 'set-qbo', 'rpt-export', 'gs-welcome'],
    keywords: ['organization settings', 'company info', 'branding', 'logo', 'company settings', 'preferences', 'configuration']
  }
];

const SEARCH_ARTICLES: HelpArticle[] = [
  {
    id: 'search-overview',
    categoryId: 'global-search',
    title: 'Global Search Overview',
    summary: 'Use Cmd+K to instantly search across all entities in ServiceOpsIQ from anywhere in the application.',
    content: [
      'Global search provides instant access to any record in ServiceOpsIQ without navigating through menus. Press Cmd+K (or Ctrl+K on Windows) from any page to open the search overlay and start typing your query.',
      'The search function queries across multiple entity types simultaneously — customers, sites, assets, work orders, quotes, and invoices — and returns results grouped by type. This means you can find a customer, their site, or a specific work order all from the same search bar.',
      'Results appear as you type with real-time filtering. Each result shows the entity type, primary identifier, and a brief summary to help you quickly identify the correct record. Clicking a result navigates directly to that record\'s detail page.'
    ],
    steps: [
      { title: 'Open Global Search', description: 'Press Cmd+K (Mac) or Ctrl+K (Windows) from any page in ServiceOpsIQ to open the search overlay.' },
      { title: 'Type Your Query', description: 'Start typing the name, number, or keyword you are searching for. Results appear in real-time as you type.' },
      { title: 'Review Grouped Results', description: 'Results are organized by entity type (customers, sites, assets, work orders, etc.) for easy scanning.' },
      { title: 'Select a Result', description: 'Click on a result or use keyboard navigation to select it. You are taken directly to the record\'s detail page.' },
      { title: 'Close Search', description: 'Press Escape to close the search overlay without navigating, or click outside the search panel.' }
    ],
    tips: [
      'Use global search as your primary navigation method — it is faster than clicking through sidebar menus for most tasks.',
      'Search by work order number, customer name, or asset serial number for the most targeted results.',
      'The search overlay remembers your recent searches, making it quick to revisit records you accessed earlier.'
    ],
    relatedArticleIds: ['search-entities', 'search-tips', 'search-keyboard', 'tips-keyboard'],
    keywords: ['global search', 'Cmd+K', 'search overlay', 'quick search', 'find records', 'universal search']
  },
  {
    id: 'search-entities',
    categoryId: 'global-search',
    title: 'Searchable Entities',
    summary: 'Learn which record types are included in global search — customers, sites, assets, work orders, quotes, and invoices.',
    content: [
      'Global search indexes six primary entity types: customers, sites, assets, work orders, quotes, and invoices. Each entity type has specific searchable fields that determine what terms will return matches.',
      'Customer records are searchable by company name and contact name. Sites are searchable by site name and address. Assets are searchable by asset name, serial number, and model. Work orders are searchable by WO number and description.',
      'Quotes and invoices are searchable by their document number and the associated customer name. This comprehensive coverage means that virtually any record in ServiceOpsIQ can be found through global search using the identifier you are most likely to remember.'
    ],
    steps: [
      { title: 'Search for Customers', description: 'Type a customer or company name to find customer records. Results show the customer name and primary contact.' },
      { title: 'Search for Sites', description: 'Type a site name or address to find site records. Results include the site name and associated customer.' },
      { title: 'Search for Assets', description: 'Type an asset name, serial number, or model to find equipment records.' },
      { title: 'Search for Work Orders', description: 'Type a WO number or description keywords to find specific work orders.' },
      { title: 'Search for Quotes or Invoices', description: 'Type a quote or invoice number, or the customer name, to find financial documents.' }
    ],
    tips: [
      'If searching by serial number, enter the exact number or a significant portion of it for the best results.',
      'Search by customer name to quickly see all their associated records grouped by type in the results.',
      'Work order numbers are the most reliable search term since they are unique identifiers.'
    ],
    relatedArticleIds: ['search-overview', 'search-tips', 'cust-create', 'wo-create'],
    keywords: ['searchable entities', 'customers', 'sites', 'assets', 'work orders', 'quotes', 'invoices', 'search fields']
  },
  {
    id: 'search-tips',
    categoryId: 'global-search',
    title: 'Search Tips',
    summary: 'Get the most out of global search with partial matching, keyword strategies, and filtering techniques.',
    content: [
      'Global search supports partial matching, so you do not need to type the complete name or number to find a record. Typing "Grund" will match "Grundfos," and typing "4521" will match work order "WO-4521." This makes searching fast even when you do not remember the full identifier.',
      'For best results, use the most distinctive part of what you are looking for. If searching for a customer named "Texas Industrial Pump Services," typing "Industrial Pump" is more effective than "Texas" which might match many records.',
      'If your search returns too many results, add more specific terms. If it returns too few, try a shorter or different search term. The search updates in real-time, so you can iteratively refine your query until you find what you need.'
    ],
    steps: [
      { title: 'Use Partial Terms', description: 'Type the first few characters of a name or number. Search results update as you type.' },
      { title: 'Use Distinctive Keywords', description: 'Choose the most unique part of the name or description for the fewest, most relevant results.' },
      { title: 'Refine Iteratively', description: 'If results are not what you expected, modify your search term. Add or remove characters to adjust.' },
      { title: 'Scan Grouped Results', description: 'Look at the entity type groupings in results to quickly find the right category of record.' }
    ],
    tips: [
      'Numbers are often the best search terms — work order numbers, invoice numbers, and serial numbers are unique and return precise results.',
      'If you cannot find a record, try searching by a different field — for example, search by site address instead of customer name.',
      'Clear the search field completely before starting a new search to avoid confusing results from leftover characters.'
    ],
    relatedArticleIds: ['search-overview', 'search-entities', 'search-keyboard'],
    keywords: ['search tips', 'partial matching', 'keywords', 'search strategies', 'finding records', 'search techniques']
  },
  {
    id: 'search-keyboard',
    categoryId: 'global-search',
    title: 'Keyboard Navigation',
    summary: 'Navigate search results efficiently using arrow keys, Enter to select, and Escape to close.',
    content: [
      'The global search overlay supports full keyboard navigation, allowing you to search, browse results, and navigate to records without touching the mouse. This is designed for power users who want the fastest possible workflow.',
      'After opening search with Cmd+K, type your query and then use the arrow keys to move through the results list. The currently highlighted result is visually indicated. Press Enter to navigate to the highlighted result.',
      'Press Escape at any time to close the search overlay and return to your current page. If you are in the search input field, pressing Escape clears the current query first, and a second Escape closes the overlay.'
    ],
    steps: [
      { title: 'Open Search', description: 'Press Cmd+K (Mac) or Ctrl+K (Windows) to open the search overlay with cursor in the search field.' },
      { title: 'Type Your Query', description: 'Begin typing to search. Results appear below the search input as you type.' },
      { title: 'Navigate with Arrow Keys', description: 'Press the down arrow to move into the results list, then use up/down arrows to highlight different results.' },
      { title: 'Select with Enter', description: 'Press Enter to navigate to the currently highlighted result. The search overlay closes automatically.' },
      { title: 'Close with Escape', description: 'Press Escape to close the search overlay without selecting a result.' }
    ],
    tips: [
      'Practice the Cmd+K workflow until it becomes muscle memory — it is significantly faster than clicking through menus.',
      'Use Tab to move focus between the search input and the results list if arrow keys do not behave as expected.',
      'Combine global search with other keyboard shortcuts for a completely keyboard-driven workflow.'
    ],
    relatedArticleIds: ['search-overview', 'search-tips', 'tips-keyboard'],
    keywords: ['keyboard navigation', 'arrow keys', 'Enter', 'Escape', 'keyboard shortcuts', 'power user', 'search navigation']
  }
];

const TIPS_ARTICLES: HelpArticle[] = [
  {
    id: 'tips-keyboard',
    categoryId: 'tips',
    title: 'Keyboard Shortcuts',
    summary: 'Learn the keyboard shortcuts that speed up your daily workflow in ServiceOpsIQ.',
    content: [
      'ServiceOpsIQ includes keyboard shortcuts for common actions to help power users work more efficiently. The most important shortcut is Cmd+K (Ctrl+K on Windows) which opens global search from any page.',
      'Navigation shortcuts let you jump between major sections without clicking through the sidebar. These shortcuts are available globally and work regardless of which page you are currently viewing.',
      'Learning even a few keyboard shortcuts can significantly reduce the time you spend navigating the application. Start with Cmd+K for search and gradually add more shortcuts to your workflow as you become comfortable.'
    ],
    steps: [
      { title: 'Learn Cmd+K', description: 'Press Cmd+K (Mac) or Ctrl+K (Windows) to open global search. This is the single most useful shortcut.' },
      { title: 'Use Escape to Close', description: 'Press Escape to close modals, search overlays, and dialog boxes throughout the application.' },
      { title: 'Navigate with Tab', description: 'Use Tab to move between form fields and interactive elements. Shift+Tab moves backward.' },
      { title: 'Submit with Enter', description: 'Press Enter to submit forms and confirm dialogs when the submit button is focused.' }
    ],
    tips: [
      'Start by memorizing Cmd+K — once this becomes second nature, you will naturally want to learn more shortcuts.',
      'Keyboard shortcuts work best on desktop browsers. On mobile devices, use the touch interface instead.',
      'Print out a shortcut reference card and keep it next to your monitor while you are learning the shortcuts.'
    ],
    relatedArticleIds: ['search-keyboard', 'search-overview', 'tips-productivity', 'tips-browser'],
    keywords: ['keyboard shortcuts', 'Cmd+K', 'hotkeys', 'shortcut keys', 'power user', 'efficiency']
  },
  {
    id: 'tips-productivity',
    categoryId: 'tips',
    title: 'Productivity Tips',
    summary: 'Work smarter with batch operations, quick filters, and workflow optimization techniques.',
    content: [
      'ServiceOpsIQ includes several features designed to help you accomplish routine tasks faster. Quick filters on list pages let you switch between common views (all, open, in progress, completed) with a single click instead of configuring filter criteria.',
      'Batch operations allow you to perform the same action on multiple records at once. For example, you can select multiple work orders and update their status, assign them to a technician, or export them as a group.',
      'Building consistent workflows — such as always creating the customer, then the site, then the asset, then the work order — helps you move through the application efficiently and reduces the chance of missing required information.'
    ],
    steps: [
      { title: 'Use Quick Filters', description: 'On list pages, use the status filter tabs (All, Open, In Progress, Completed) for instant filtering without building custom filters.' },
      { title: 'Leverage Batch Actions', description: 'Select multiple records using checkboxes and use the batch action toolbar for bulk status changes or assignments.' },
      { title: 'Follow a Consistent Workflow', description: 'Create records in a logical order: Customer > Site > Asset > Work Order to ensure all relationships are established.' },
      { title: 'Use Global Search for Navigation', description: 'Press Cmd+K to jump directly to any record instead of navigating through menus and lists.' },
      { title: 'Set Up PM Schedules', description: 'Automate recurring work by creating PM schedules instead of manually creating the same work orders each month.' }
    ],
    tips: [
      'Open frequently accessed pages in browser bookmarks for one-click access to your most-used views.',
      'Use the analytics dashboard as your home page to start each day with a clear picture of your operational status.',
      'Delegate work order creation to dispatchers and let technicians focus on field execution — role separation improves overall productivity.'
    ],
    relatedArticleIds: ['tips-keyboard', 'search-overview', 'pm-create', 'wo-create'],
    keywords: ['productivity', 'batch operations', 'quick filters', 'workflow', 'efficiency tips', 'time saving']
  },
  {
    id: 'tips-mobile',
    categoryId: 'tips',
    title: 'Mobile & PWA Usage',
    summary: 'Install ServiceOpsIQ as a Progressive Web App on your phone or tablet for app-like access in the field.',
    content: [
      'ServiceOpsIQ is built as a Progressive Web App (PWA), which means it can be installed on your phone or tablet and used like a native app. The PWA provides a full-screen experience, app icon on your home screen, and basic offline functionality.',
      'Installing the PWA is simple — visit ServiceOpsIQ in your mobile browser and use the browser\'s "Add to Home Screen" option. On iOS Safari, tap the share button and select "Add to Home Screen." On Android Chrome, tap the three-dot menu and select "Install App."',
      'The mobile experience is fully responsive with optimized layouts for smaller screens. All features are accessible on mobile, though some complex operations like report analysis may be more comfortable on a larger screen.'
    ],
    steps: [
      { title: 'Open in Mobile Browser', description: 'Navigate to your ServiceOpsIQ URL in Safari (iOS) or Chrome (Android).' },
      { title: 'Install as PWA', description: 'On iOS: tap Share > "Add to Home Screen." On Android: tap menu > "Install App" or "Add to Home Screen."' },
      { title: 'Open from Home Screen', description: 'Tap the ServiceOpsIQ icon on your home screen to launch in full-screen app mode.' },
      { title: 'Enable Notifications', description: 'Allow notifications when prompted to receive alerts about new assignments and status changes.' },
      { title: 'Use Offline Features', description: 'Basic pages load from cache when offline. Full functionality resumes when connectivity is restored.' }
    ],
    tips: [
      'Technicians should install the PWA on their primary work device for the best field experience.',
      'The PWA loads faster than the browser version after installation because it caches core application files.',
      'If the PWA feels outdated, close and reopen it while connected to WiFi to force a cache update.'
    ],
    relatedArticleIds: ['tech-overview', 'tips-browser', 'tips-keyboard', 'tech-photos'],
    keywords: ['mobile', 'PWA', 'progressive web app', 'install app', 'offline', 'add to home screen', 'responsive']
  },
  {
    id: 'tips-browser',
    categoryId: 'tips',
    title: 'Browser Tips',
    summary: 'Supported browsers, cache management, and performance optimization for the best ServiceOpsIQ experience.',
    content: [
      'ServiceOpsIQ is optimized for modern browsers including Chrome, Firefox, Safari, and Edge. For the best experience, use the latest version of your preferred browser. Chrome and Edge typically offer the best performance for web applications.',
      'If the application feels slow or displays outdated information, clearing your browser cache can resolve most issues. The cached data includes CSS styles, JavaScript bundles, and static assets that may become stale after an update.',
      'For optimal performance, close unnecessary browser tabs when using ServiceOpsIQ, especially if your device has limited memory. The analytics dashboard and report pages use more memory than simpler list and detail pages.'
    ],
    steps: [
      { title: 'Check Browser Version', description: 'Ensure you are using the latest version of Chrome, Firefox, Safari, or Edge for the best compatibility.' },
      { title: 'Clear Cache If Needed', description: 'If pages look wrong or data seems stale: Chrome/Edge: Ctrl+Shift+Delete. Safari: Cmd+Option+E.' },
      { title: 'Hard Refresh', description: 'Press Cmd+Shift+R (Mac) or Ctrl+Shift+R (Windows) to force reload the page bypassing the cache.' },
      { title: 'Close Unused Tabs', description: 'Free up browser memory by closing tabs you are not actively using, especially on devices with limited RAM.' },
      { title: 'Disable Conflicting Extensions', description: 'If you experience issues, try disabling ad blockers or other extensions that might interfere with the application.' }
    ],
    tips: [
      'Chrome offers the best developer tools if you need to troubleshoot issues — press F12 to open the developer console.',
      'Bookmark your most-used ServiceOpsIQ pages (like the work order list) for quick access from the browser toolbar.',
      'If you use ServiceOpsIQ heavily, consider using a dedicated browser profile to keep your work separate from personal browsing.'
    ],
    relatedArticleIds: ['tips-mobile', 'tips-keyboard', 'tips-productivity'],
    keywords: ['browser', 'Chrome', 'Safari', 'Firefox', 'cache', 'performance', 'supported browsers', 'clear cache']
  }
];


// ============================================================================
// CATEGORY 20: QuickBooks Integration (7 articles)
// ============================================================================

const QBO_INTEGRATION_ARTICLES: HelpArticle[] = [
  {
    id: 'qbo-connect',
    categoryId: 'qbo-integration',
    title: 'Connecting QuickBooks Online',
    summary: 'Authorize ServiceOpsIQ to access your QuickBooks Online account via secure OAuth 2.0.',
    content: [
      'ServiceOpsIQ connects to QuickBooks Online through OAuth 2.0, the industry-standard authorization protocol. This means your QuickBooks credentials are never stored in ServiceOpsIQ — you authorize the connection directly with Intuit and can revoke it at any time.',
      'To connect, navigate to Settings > Integrations > QuickBooks and click the Connect button. You will be redirected to the Intuit authorization page where you log in to your QuickBooks account and grant ServiceOpsIQ access to read and write financial data.',
      'After authorization, you are redirected back to ServiceOpsIQ and the connection status updates to show your connected company name. The system securely stores OAuth tokens that automatically refresh so you stay connected without repeated logins.'
    ],
    steps: [
      { title: 'Navigate to Settings', description: 'Open Settings from the sidebar and click on the Integrations or QuickBooks section.' },
      { title: 'Click Connect to QuickBooks', description: 'Click the "Connect to QuickBooks" button to begin the OAuth authorization flow.' },
      { title: 'Log in to Intuit', description: 'You will be redirected to Intuit. Log in with your QuickBooks Online admin credentials.' },
      { title: 'Authorize Access', description: 'Review the permissions requested and click "Connect" to authorize ServiceOpsIQ.' },
      { title: 'Verify Connection', description: 'You are redirected back to ServiceOpsIQ. The integration page shows your connected QuickBooks company name.' }
    ],
    tips: [
      'Use a QuickBooks admin account to authorize the connection — limited-access accounts may not have sufficient permissions.',
      'The OAuth tokens refresh automatically every hour. If the connection breaks, simply reconnect from the settings page.',
      'You can disconnect at any time from the settings page. Previously synced data remains in both systems.'
    ],
    relatedArticleIds: ['qbo-accounts', 'qbo-customer-sync', 'qbo-invoice-sync', 'set-qbo'],
    keywords: ['QuickBooks', 'connect', 'OAuth', 'authorize', 'Intuit', 'QBO setup', 'integration', 'link accounts']
  },
  {
    id: 'qbo-accounts',
    categoryId: 'qbo-integration',
    title: 'Account Mapping',
    summary: 'Map ServiceOpsIQ revenue categories to your QuickBooks chart of accounts for accurate financial reporting.',
    content: [
      'Account mapping is a prerequisite for syncing financial data to QuickBooks. You must map five revenue categories — Service Revenue, Material Revenue, Labor Revenue, Expense Revenue, and Discount — to the corresponding income and expense accounts in your QuickBooks chart of accounts.',
      'Navigate to Settings > QuickBooks > Account Mapping to configure the mappings. The system loads your QuickBooks accounts automatically. Select the appropriate QBO account for each ServiceOpsIQ category. Financial syncs (invoices, payments) are blocked until all required mappings are configured.',
      'Once mapped, every invoice line item synced to QuickBooks is categorized under the correct account. This ensures your profit-and-loss reports, tax filings, and financial statements accurately reflect your service business revenue streams.'
    ],
    steps: [
      { title: 'Navigate to Account Mapping', description: 'Go to Settings > QuickBooks > Account Mapping to see the mapping configuration.' },
      { title: 'Review Required Categories', description: 'The page shows five categories that need mapping: Service, Material, Labor, Expense, and Discount.' },
      { title: 'Select QBO Accounts', description: 'For each category, select the matching income or expense account from your QuickBooks chart of accounts.' },
      { title: 'Save Mappings', description: 'Click Save. The system validates all required mappings are complete.' },
      { title: 'Verify with Test Sync', description: 'Sync a test invoice to confirm line items land in the correct QuickBooks accounts.' }
    ],
    tips: [
      'Create dedicated income accounts in QuickBooks (e.g., "Service Revenue", "Parts Revenue") before mapping for the cleanest financial reports.',
      'Account mapping must be completed before any financial syncs will work — the system blocks sync attempts until all five categories are mapped.',
      'Review your mappings quarterly to ensure they still align with your accounting practices and any new QBO accounts.'
    ],
    relatedArticleIds: ['qbo-connect', 'qbo-invoice-sync', 'qbo-dashboard'],
    keywords: ['account mapping', 'chart of accounts', 'revenue categories', 'QBO accounts', 'financial mapping', 'income accounts']
  },
  {
    id: 'qbo-customer-sync',
    categoryId: 'qbo-integration',
    title: 'Customer Synchronization',
    summary: 'Sync customers between ServiceOpsIQ and QuickBooks to eliminate duplicate data entry.',
    content: [
      'Customer sync ensures your customer records exist in both ServiceOpsIQ and QuickBooks without manual duplicate entry. When you sync a customer, their name, address, email, and phone are pushed to QuickBooks where they become available for invoicing and payment processing.',
      'The system uses intelligent matching to avoid creating duplicates. When syncing a customer, it checks QuickBooks for existing records by email address and company name. If a match is found, the records are linked. If no match exists, a new QuickBooks customer is created.',
      'Customer sync is typically one-directional: ServiceOpsIQ pushes to QuickBooks. Changes made in QuickBooks are pulled back during the Change Data Capture (CDC) sync that runs every four hours, keeping both systems aligned.'
    ],
    steps: [
      { title: 'Open the Customer', description: 'Navigate to a customer record in ServiceOpsIQ that you want to sync.' },
      { title: 'Click Sync to QuickBooks', description: 'Click the QBO sync button on the customer detail page.' },
      { title: 'Review Match Results', description: 'If a matching QuickBooks customer is found, confirm the link. If not, a new record will be created.' },
      { title: 'Verify in QuickBooks', description: 'Log into QuickBooks to confirm the customer appears with correct details.' }
    ],
    tips: [
      'Sync all active customers before syncing any invoices to ensure clean linkages.',
      'Use consistent company names in both systems to help the automatic matching algorithm.',
      'If a customer name collision occurs in QuickBooks, the system appends "(SvcOps)" to the DisplayName to avoid conflicts.'
    ],
    relatedArticleIds: ['qbo-connect', 'qbo-invoice-sync', 'cust-create'],
    keywords: ['customer sync', 'sync customers', 'QBO customers', 'duplicate prevention', 'customer matching', 'push to QuickBooks']
  },
  {
    id: 'qbo-invoice-sync',
    categoryId: 'qbo-integration',
    title: 'Invoice & Payment Sync',
    summary: 'Push invoices and payments from ServiceOpsIQ to QuickBooks for seamless accounting.',
    content: [
      'Invoice sync transfers your ServiceOpsIQ invoices to QuickBooks with all line items, quantities, amounts, tax, and customer details mapped to the correct accounts. This eliminates manual invoice creation in QuickBooks and ensures your books stay current with field operations.',
      'To sync an invoice, open it in ServiceOpsIQ and click the Sync to QuickBooks button. The system validates that the customer is already synced and that account mappings are configured, then pushes the invoice to QuickBooks. The QBO invoice number is stored for cross-reference.',
      'Payments recorded in ServiceOpsIQ can also be synced to QuickBooks. When a payment is applied to a synced invoice, clicking Sync Payment creates a corresponding payment record in QuickBooks that applies to the same invoice, keeping your accounts receivable balanced in both systems.'
    ],
    steps: [
      { title: 'Verify Prerequisites', description: 'Ensure the customer is synced and account mappings are configured before syncing an invoice.' },
      { title: 'Open the Invoice', description: 'Navigate to the invoice you want to sync to QuickBooks.' },
      { title: 'Click Sync to QuickBooks', description: 'Click the sync button. The system validates and pushes the invoice to QBO.' },
      { title: 'Check Sync Status', description: 'The invoice shows a QBO badge with the QuickBooks invoice number once synced.' },
      { title: 'Sync Payments', description: 'After recording a payment, click Sync Payment to push the payment to QuickBooks as well.' }
    ],
    tips: [
      'Sync invoices before sending them to customers so both systems have the record simultaneously.',
      'If an invoice sync fails, check the sync log for the specific error — common causes are unmapped accounts or unsynced customers.',
      'Materials on invoices are synced as Non-Inventory items in QuickBooks for simplicity.'
    ],
    relatedArticleIds: ['qbo-accounts', 'qbo-customer-sync', 'qbo-dashboard', 'inv-from-wo'],
    keywords: ['invoice sync', 'payment sync', 'push invoice', 'QBO invoice', 'accounting', 'AR sync', 'payment recording']
  },
  {
    id: 'qbo-cdc',
    categoryId: 'qbo-integration',
    title: 'Inbound Sync (CDC)',
    summary: 'Automatic Change Data Capture pulls updates from QuickBooks every 4 hours to keep ServiceOpsIQ current.',
    content: [
      'Change Data Capture (CDC) is an automated process that polls QuickBooks every four hours for changes made directly in QuickBooks. This catches payments received through QuickBooks payment channels, customer address updates, and other changes that originate outside ServiceOpsIQ.',
      'The CDC cron job runs on a 4-hour schedule and tracks a per-organization cursor so it only processes changes since the last successful poll. This is efficient and avoids re-processing historical data. Changes are applied automatically to the matching ServiceOpsIQ records.',
      'Common inbound syncs include payment status updates (when customers pay through QuickBooks payment links), customer contact changes, and invoice void/delete actions performed in QuickBooks. These changes appear in ServiceOpsIQ within four hours without any manual action.'
    ],
    steps: [
      { title: 'Verify CDC is Active', description: 'Check the QBO dashboard in Settings to see the last CDC run timestamp and status.' },
      { title: 'Review Inbound Changes', description: 'The sync log shows all changes pulled from QuickBooks with timestamps and affected records.' },
      { title: 'Resolve Conflicts', description: 'If a record was modified in both systems, the sync log flags it for manual review.' }
    ],
    tips: [
      'CDC runs every 4 hours automatically — there is no manual trigger needed.',
      'If a payment was made in QuickBooks and is not reflecting in ServiceOpsIQ, check the next CDC cycle time.',
      'The CDC cursor is per-organization, so multi-tenant deployments each have independent sync windows.'
    ],
    relatedArticleIds: ['qbo-connect', 'qbo-invoice-sync', 'qbo-dashboard'],
    keywords: ['CDC', 'change data capture', 'inbound sync', 'automatic sync', 'QuickBooks changes', 'payment sync', 'polling']
  },
  {
    id: 'qbo-items-vendors',
    categoryId: 'qbo-integration',
    title: 'Items, Vendors & Classes',
    summary: 'Sync materials as QBO items, manage vendor records, and use class/location tracking for departmental reporting.',
    content: [
      'Materials from your ServiceOpsIQ catalog can be synced to QuickBooks as Non-Inventory items. This ensures that invoice line items reference proper QBO items for consistent financial categorization. Items are auto-created on first sync if they do not already exist in QuickBooks.',
      'Vendor sync allows you to maintain supplier records in both systems. When you create a vendor in ServiceOpsIQ, it can be pushed to QuickBooks for purchase order and bill management. The system checks for existing QBO vendors by name to avoid duplicates.',
      'If your QuickBooks company has Class and Location tracking enabled, ServiceOpsIQ will map service categories to QBO Classes and site locations to QBO Locations. These are auto-created when first encountered and set to null if the feature is disabled in your QBO preferences.'
    ],
    steps: [
      { title: 'Sync Materials', description: 'Materials are automatically synced as Non-Inventory items when they appear on a synced invoice.' },
      { title: 'Manage Vendors', description: 'Navigate to the vendor record and click Sync to push it to QuickBooks.' },
      { title: 'Enable Class Tracking', description: 'If using QBO classes, enable class tracking in QuickBooks preferences. ServiceOpsIQ will auto-map.' },
      { title: 'Review in QuickBooks', description: 'Check Products/Services in QBO to verify items are categorized correctly.' }
    ],
    tips: [
      'All materials sync as Non-Inventory type — ServiceOpsIQ does not manage QBO inventory quantities.',
      'If a vendor name already exists in QuickBooks, the system links to the existing record rather than creating a duplicate.',
      'Class and Location tracking in QBO provides powerful departmental P&L reports that break down revenue by service type and job site.'
    ],
    relatedArticleIds: ['qbo-accounts', 'qbo-invoice-sync', 'mat-catalog'],
    keywords: ['items', 'vendors', 'classes', 'locations', 'non-inventory', 'QBO items', 'vendor sync', 'class tracking']
  },
  {
    id: 'qbo-dashboard',
    categoryId: 'qbo-integration',
    title: 'QBO Sync Dashboard & Logs',
    summary: 'Monitor sync health, review sync history, and troubleshoot errors from the QuickBooks dashboard.',
    content: [
      'The QBO dashboard provides a centralized view of your integration health. It shows the connection status, last sync timestamps for each sync type (customer, invoice, CDC), queue depth, and any errors that need attention.',
      'The sync log records every operation — customer syncs, invoice pushes, payment syncs, and CDC polls — with timestamps, status (success/error), and details. Use the log to troubleshoot sync failures and verify that data is flowing correctly between systems.',
      'The sync queue shows pending operations that are waiting to be processed. The queue is flushed every 5 minutes by an automated cron job. Items in the queue can be prioritized (1 = high, 5 = normal, 9 = low) and have a 3-retry limit before moving to the dead letter queue for manual review.'
    ],
    steps: [
      { title: 'Open QBO Dashboard', description: 'Navigate to Settings > QuickBooks to see the sync dashboard overview.' },
      { title: 'Check Connection Status', description: 'Verify the green "Connected" badge and your QuickBooks company name.' },
      { title: 'Review Recent Syncs', description: 'Scroll to the sync log to see the latest operations and their statuses.' },
      { title: 'Investigate Errors', description: 'Click on any failed sync entry to see the error details and recommended fix.' },
      { title: 'Monitor Queue Depth', description: 'Check the pending queue to ensure items are being processed and not backing up.' }
    ],
    tips: [
      'Check the dashboard after initial setup to confirm your first syncs completed successfully.',
      'Sync errors often indicate unmapped accounts, unsynced customers, or expired OAuth tokens — the error detail tells you which.',
      'The dead letter queue captures items that failed 3 times. Review these periodically to catch persistent issues.',
      'Token health is monitored by a daily cron at 2 AM UTC that alerts if tokens are near expiration.'
    ],
    relatedArticleIds: ['qbo-connect', 'qbo-accounts', 'qbo-cdc', 'qbo-invoice-sync'],
    keywords: ['QBO dashboard', 'sync log', 'sync errors', 'queue', 'troubleshooting', 'sync status', 'dead letter', 'monitoring']
  }
];

// ============================================================================
// CATEGORY 21: AI Features (7 articles)
// ============================================================================

const AI_FEATURES_ARTICLES: HelpArticle[] = [
  {
    id: 'ai-overview',
    categoryId: 'ai-features',
    title: 'AI Features Overview',
    summary: 'How ServiceOpsIQ uses AI to generate insights, predict failures, and help you make better decisions.',
    content: [
      'ServiceOpsIQ includes an AI engine powered by Claude that analyzes your operational data to generate insights, predict equipment failures, suggest optimal technician assignments, and draft work summaries. AI features work automatically in the background as your team creates and updates records.',
      'The AI pipeline is event-driven: when you complete a work order, update an asset, or change a schedule, the system automatically queues an AI analysis job. A background cron processes these jobs every 2 minutes, sending relevant context to Claude for analysis and storing the resulting insights.',
      'AI insights appear throughout the application — on asset detail pages as risk badges, on the dashboard as alert widgets, on work orders as technician suggestions, and in the AI Copilot chat for interactive Q&A. All AI features are designed to augment your team\'s expertise, not replace it.'
    ],
    steps: [
      { title: 'Review Dashboard Alerts', description: 'Check the AI Alerts widget on your dashboard for high-priority insights requiring attention.' },
      { title: 'Check Asset Risk Badges', description: 'Visit asset detail pages to see AI-generated risk assessments based on service history.' },
      { title: 'Use the Copilot', description: 'Click the AI Copilot icon to open the chat sidebar and ask questions about your data.' },
      { title: 'Review AI Suggestions', description: 'When creating work orders, check for AI-suggested technician assignments based on skills and availability.' }
    ],
    tips: [
      'AI insights improve over time as more data enters the system — the more work orders and visits you complete, the better the predictions become.',
      'You can acknowledge insights to clear them from the alert widget while preserving them in the history.',
      'AI processing runs on a 2-minute cycle, so new insights may take a few minutes to appear after a triggering event.'
    ],
    relatedArticleIds: ['ai-insights', 'ai-copilot', 'ai-risk', 'ai-tech-suggest'],
    keywords: ['AI', 'artificial intelligence', 'insights', 'predictions', 'machine learning', 'smart features', 'automation']
  },
  {
    id: 'ai-insights',
    categoryId: 'ai-features',
    title: 'AI Insights & Alerts',
    summary: 'View, filter, and manage AI-generated insights about your assets, work orders, and operations.',
    content: [
      'AI Insights are actionable recommendations generated by analyzing patterns in your operational data. Each insight includes a severity level (LOW, MEDIUM, HIGH, CRITICAL), a description of the finding, and a recommended action. Insights are tied to specific entities like assets, work orders, or scheduling patterns.',
      'The AI Alerts widget on your dashboard highlights the most urgent insights requiring attention. HIGH and CRITICAL severity insights appear here and are also tracked in your notification system. You can click any alert to navigate directly to the related entity.',
      'Manage insights from the AI Insights page accessible from the sidebar. Filter by severity, entity type, or date range. Acknowledge insights after taking action to remove them from the active alerts while preserving the full history for compliance and analysis.'
    ],
    steps: [
      { title: 'Check Dashboard Alerts', description: 'The AI Alerts widget shows HIGH and CRITICAL insights that need immediate attention.' },
      { title: 'Open AI Insights Page', description: 'Navigate to the AI Insights page to see all insights with filtering options.' },
      { title: 'Filter by Severity', description: 'Use the severity filter to focus on the most critical findings first.' },
      { title: 'Take Action', description: 'Read the recommendation and take the suggested corrective action.' },
      { title: 'Acknowledge', description: 'Click Acknowledge to mark the insight as reviewed and clear it from active alerts.' }
    ],
    tips: [
      'Review AI insights during your daily planning to proactively address equipment risks before failures occur.',
      'CRITICAL insights indicate imminent failure risk — schedule maintenance or inspection immediately.',
      'Acknowledged insights are not deleted — they remain in history for auditing and trend analysis.'
    ],
    relatedArticleIds: ['ai-overview', 'ai-risk', 'ai-copilot', 'rpt-dashboard'],
    keywords: ['AI insights', 'alerts', 'severity', 'CRITICAL', 'HIGH', 'acknowledge', 'recommendations', 'predictions']
  },
  {
    id: 'ai-copilot',
    categoryId: 'ai-features',
    title: 'AI Copilot Chat',
    summary: 'Ask the AI copilot questions about your data using natural language and get instant answers.',
    content: [
      'The AI Copilot is an interactive chat assistant that can query your organization\'s data in real time. Click the copilot icon in the bottom-right corner to open the chat sidebar, then ask questions in plain English like "What assets have the most work orders this month?" or "Show me overdue invoices for Kiewit."',
      'The copilot uses tool-calling to search your database on demand. It can look up assets, work orders, customers, invoices, sites, and more. Each conversation maintains context so you can ask follow-up questions without repeating information.',
      'Conversations are saved and can be resumed later. Access your conversation history from the copilot sidebar. Each conversation tracks token usage for cost monitoring. The copilot has a built-in token budget to prevent excessive API usage in long conversations.'
    ],
    steps: [
      { title: 'Open the Copilot', description: 'Click the AI Copilot icon (bottom-right) to open the chat sidebar.' },
      { title: 'Ask a Question', description: 'Type your question in natural language. For example: "Which technicians are available this week?"' },
      { title: 'Review the Response', description: 'The copilot queries your data and responds with relevant information, often including specific records and numbers.' },
      { title: 'Ask Follow-ups', description: 'Continue the conversation with follow-up questions. Context is maintained throughout the session.' },
      { title: 'View History', description: 'Access previous conversations from the history list in the copilot sidebar.' }
    ],
    tips: [
      'Be specific in your questions for the best results — "What are the open work orders for ABC Company at their Main Plant?" is better than "Show me work orders."',
      'The copilot can query 10 different data types: assets, work orders, customers, invoices, quotes, visits, sites, materials, contacts, and schedules.',
      'Long conversations are automatically trimmed to stay within token budgets. Start a new conversation for unrelated topics.'
    ],
    relatedArticleIds: ['ai-overview', 'ai-insights', 'gs-search'],
    keywords: ['copilot', 'chat', 'assistant', 'natural language', 'query', 'ask', 'AI chat', 'conversation', 'tool calling']
  },
  {
    id: 'ai-risk',
    categoryId: 'ai-features',
    title: 'AI Risk Assessment',
    summary: 'Understand the color-coded risk badges on assets that indicate predicted failure probability.',
    content: [
      'AI Risk Badges appear on asset cards and detail pages showing the AI\'s assessment of failure risk based on the asset\'s service history, age, criticality, and work order patterns. Badges are color-coded: green (low risk), yellow (medium), orange (high), and red (critical).',
      'Risk assessments are generated automatically when significant events occur — work order completion, new failure reports, or PM schedule compliance changes. The AI considers factors like time since last service, frequency of reactive repairs, and whether preventive maintenance is being performed on schedule.',
      'Use risk badges to prioritize your maintenance efforts. Assets with HIGH or CRITICAL risk should be inspected promptly, while LOW risk assets are operating within expected parameters. Risk levels update dynamically as new data enters the system.'
    ],
    steps: [
      { title: 'View Risk Badges', description: 'Navigate to the Assets list to see risk badges displayed on each asset card.' },
      { title: 'Click for Details', description: 'Click the risk badge on an asset to see the detailed risk assessment and contributing factors.' },
      { title: 'Filter by Risk Level', description: 'Use the filter options to show only HIGH or CRITICAL risk assets for priority attention.' },
      { title: 'Take Action', description: 'Schedule inspections or maintenance for high-risk assets to prevent unplanned failures.' }
    ],
    tips: [
      'Risk badges update after each work order completion or maintenance event — check them after completing major repairs.',
      'A rising risk level on a recently serviced asset may indicate a recurring or underlying problem that needs root cause analysis.',
      'Use risk data during customer conversations to proactively recommend maintenance and build trust.'
    ],
    relatedArticleIds: ['ai-overview', 'ai-insights', 'asset-detail', 'pm-create'],
    keywords: ['risk badge', 'risk assessment', 'failure prediction', 'asset risk', 'color coded', 'maintenance priority']
  },
  {
    id: 'ai-tech-suggest',
    categoryId: 'ai-features',
    title: 'AI Technician Suggestions',
    summary: 'See AI-recommended technician assignments based on skills, proximity, workload, and past performance.',
    content: [
      'When assigning a technician to a work order, the AI Suggested Tech Badge shows the AI\'s recommended assignment. The recommendation considers the technician\'s skills and certifications, their current workload, proximity to the job site, and their past performance on similar equipment.',
      'The suggestion appears as an orange badge on the work order assignment section. Click the badge to see why the AI recommended this technician and view alternative options ranked by suitability. You can accept the suggestion with one click or choose a different technician.',
      'AI tech suggestions are generated as part of the insight pipeline when work orders are created or reassigned. The more work orders your team completes, the better the AI learns about each technician\'s strengths and the types of equipment they handle most effectively.'
    ],
    steps: [
      { title: 'Create or Open a Work Order', description: 'Navigate to a work order that needs technician assignment.' },
      { title: 'Check the AI Suggestion', description: 'Look for the AI Suggested Tech badge near the assignment field.' },
      { title: 'Review the Reasoning', description: 'Click the badge to see why this technician was recommended.' },
      { title: 'Accept or Override', description: 'Click to accept the suggestion or manually select a different technician.' }
    ],
    tips: [
      'AI suggestions improve as you complete more work orders — the system learns from outcomes.',
      'If you consistently override a suggestion, the AI adjusts its model based on your actual assignments.',
      'Dismissed suggestions can be restored if you change your mind before saving the work order.'
    ],
    relatedArticleIds: ['ai-overview', 'wo-assign', 'ai-risk'],
    keywords: ['technician suggestion', 'AI assignment', 'recommended tech', 'smart assignment', 'tech matching', 'workload balancing']
  },
  {
    id: 'ai-drafts',
    categoryId: 'ai-features',
    title: 'AI Draft Summaries',
    summary: 'Get AI-generated work summaries and report drafts based on completed work order data.',
    content: [
      'When a work order is completed, the AI can generate a professional draft summary of the work performed. The draft pulls from visit notes, time entries, materials used, photos captured, and procedure completion data to create a comprehensive narrative suitable for customer reports.',
      'AI Draft Summaries appear on the work order detail page after completion. They can be reviewed, edited, and included in customer-facing reports and PDF documents. The drafts save significant time compared to writing summaries from scratch.',
      'The quality of the draft depends on the data captured during the work order. Detailed visit notes, complete time entries, and thorough procedure step documentation produce better summaries. Encourage technicians to document thoroughly for the best AI-generated output.'
    ],
    steps: [
      { title: 'Complete a Work Order', description: 'Ensure the work order has been marked as Completed with visit notes and time entries.' },
      { title: 'View the Draft', description: 'Open the completed work order and look for the AI Draft Summary section.' },
      { title: 'Review and Edit', description: 'Read the generated summary and make any corrections or additions.' },
      { title: 'Include in Reports', description: 'Use the summary in customer reports or PDF generation for professional documentation.' }
    ],
    tips: [
      'Thorough visit notes produce much better AI summaries — encourage techs to describe findings, actions, and recommendations.',
      'AI drafts are suggestions and should always be reviewed before sharing with customers.',
      'Use the draft as a starting point and add your own professional assessment and recommendations.'
    ],
    relatedArticleIds: ['ai-overview', 'wo-complete', 'visit-notes', 'inv-pdf'],
    keywords: ['AI draft', 'summary', 'work summary', 'auto-generate', 'report draft', 'narrative', 'documentation']
  },
  {
    id: 'ai-quote-suggest',
    categoryId: 'ai-features',
    title: 'AI Quote Suggestions',
    summary: 'Get AI-recommended line items and pricing when creating quotes based on historical data.',
    content: [
      'The AI Quote Suggestions panel appears when you create or edit a quote. It analyzes the asset, work type, and customer history to suggest line items with estimated quantities and pricing based on your historical quoting patterns.',
      'Suggestions include common materials, labor estimates, and service charges that are typically included on similar quotes. Each suggestion shows the confidence level and the historical data it was based on. You can add suggestions to the quote with one click.',
      'This feature is particularly useful for new team members who may not know your standard pricing or for complex jobs where it is easy to forget a line item. The suggestions serve as a checklist to ensure comprehensive quoting.'
    ],
    steps: [
      { title: 'Create or Edit a Quote', description: 'Open a quote that is linked to an asset or work order.' },
      { title: 'View Suggestions Panel', description: 'The AI suggestions panel appears alongside the line items section.' },
      { title: 'Review Suggestions', description: 'Browse the suggested materials, labor, and services with estimated pricing.' },
      { title: 'Add to Quote', description: 'Click the add button on any suggestion to include it as a line item.' },
      { title: 'Adjust as Needed', description: 'Modify quantities and pricing after adding to match the specific job requirements.' }
    ],
    tips: [
      'AI quote suggestions get more accurate as you create more quotes — the system learns from your pricing patterns.',
      'Always review and adjust suggested prices to match current material costs and labor rates.',
      'Suggestions for rarely quoted items may be less accurate — use your expertise to validate unusual recommendations.'
    ],
    relatedArticleIds: ['ai-overview', 'quote-create', 'quote-lines'],
    keywords: ['quote suggestions', 'AI pricing', 'line item suggestions', 'smart quoting', 'estimate', 'pricing recommendation']
  }
];

// ============================================================================
// CATEGORY 22: CRM & Sales (8 articles)
// ============================================================================

const CRM_SALES_ARTICLES: HelpArticle[] = [
  {
    id: 'crm-overview',
    categoryId: 'crm-sales',
    title: 'CRM & Sales Overview',
    summary: 'Manage your sales pipeline from first call through closed deal with integrated CRM tools.',
    content: [
      'The CRM & Sales module gives your sales team tools to manage the complete customer lifecycle — from initial contact and call logging through opportunity tracking and deal closure. Access the CRM from the Sales section in the sidebar navigation.',
      'The Sales Dashboard provides a snapshot of your pipeline including total opportunity value, win rate, overdue follow-ups, and recent call activity. Use it to start your day with a clear picture of what needs attention and where your biggest opportunities are.',
      'CRM features include Call Logs for tracking customer interactions, Follow-Ups for scheduling next actions, Opportunities for pipeline management, and Service Tickets for post-sale support. All data is scoped by role — Sales users see only their own records by default.'
    ],
    steps: [
      { title: 'Navigate to Sales', description: 'Click "Sales" in the sidebar to access the CRM dashboard and sub-modules.' },
      { title: 'Review the Dashboard', description: 'Check pipeline value, win rate, upcoming follow-ups, and recent activity.' },
      { title: 'Log a Call', description: 'Go to Call Logs to record customer interactions as they happen.' },
      { title: 'Manage Opportunities', description: 'Track deals through stages from Lead to Closed Won/Lost.' }
    ],
    tips: [
      'Start each day by reviewing the Sales Dashboard to prioritize your calls and follow-ups.',
      'The SALES role restricts visibility to your own data — Admins and Dispatchers can see all CRM data.',
      'CRM data integrates with the service side — customers in CRM are the same records used for work orders and invoicing.'
    ],
    relatedArticleIds: ['crm-calls', 'crm-followups', 'crm-opportunities', 'crm-dashboard'],
    keywords: ['CRM', 'sales', 'pipeline', 'sales management', 'customer relationship', 'overview']
  },
  {
    id: 'crm-calls',
    categoryId: 'crm-sales',
    title: 'Call Logs',
    summary: 'Record customer calls with outcomes, notes, and automatic follow-up and opportunity prompts.',
    content: [
      'Call Logs capture every customer interaction with the date, time, duration, outcome, and notes. Recording calls creates an auditable timeline of your relationship with each customer and ensures nothing falls through the cracks.',
      'Each call has an outcome: Connected, Voicemail, No Answer, or Busy. Certain outcomes automatically trigger follow-up prompts — for example, leaving a voicemail triggers a "Schedule Follow-Up" modal so you do not forget to call back.',
      'Calls that result in interest or a potential opportunity trigger an "Create Opportunity" prompt. This seamless workflow means your pipeline is built naturally from call activity rather than requiring separate data entry.'
    ],
    steps: [
      { title: 'Navigate to Call Logs', description: 'Click "Call Logs" under the Sales section in the sidebar.' },
      { title: 'Click Log Call', description: 'Click the "Log Call" button to open the new call form.' },
      { title: 'Select Customer & Contact', description: 'Choose the customer and specific contact you spoke with.' },
      { title: 'Enter Call Details', description: 'Set the outcome, duration, and add detailed notes about the conversation.' },
      { title: 'Handle Prompts', description: 'If prompted, schedule a follow-up or create an opportunity based on the call outcome.' }
    ],
    tips: [
      'Log calls immediately after hanging up while the details are fresh in your memory.',
      'Use detailed notes — they help other team members understand the customer context if they need to take over.',
      'The "Connected + Interest Shown" outcome triggers an opportunity prompt — use it when a customer expresses buying intent.'
    ],
    relatedArticleIds: ['crm-overview', 'crm-followups', 'crm-opportunities', 'cust-contacts'],
    keywords: ['call log', 'phone call', 'customer call', 'interaction', 'outcome', 'voicemail', 'follow-up prompt']
  },
  {
    id: 'crm-followups',
    categoryId: 'crm-sales',
    title: 'Follow-Ups',
    summary: 'Schedule and track follow-up actions to ensure no customer interaction goes unattended.',
    content: [
      'Follow-ups are scheduled tasks that remind you to reach out to a customer on a specific date. They can be created manually or generated automatically from call outcomes. Each follow-up includes the customer, due date, priority, and notes about what action to take.',
      'The Follow-Up list shows all your scheduled actions sorted by due date with overdue items highlighted. Filter by priority, status, or date range to focus on what needs attention today. Completing a follow-up removes it from the active list.',
      'Follow-ups integrate with the dashboard — overdue follow-up counts appear on the Sales Dashboard so you never lose track of pending customer commitments. This ensures your sales process maintains consistent customer contact.'
    ],
    steps: [
      { title: 'Navigate to Follow-Ups', description: 'Click "Follow-Ups" under the Sales section.' },
      { title: 'Create a Follow-Up', description: 'Click "New Follow-Up" and select the customer, due date, and priority.' },
      { title: 'Add Action Notes', description: 'Describe what needs to be done — call back, send proposal, schedule meeting, etc.' },
      { title: 'Complete When Done', description: 'After taking the action, mark the follow-up as complete.' }
    ],
    tips: [
      'Set follow-ups for specific dates rather than "next week" — concrete dates are more actionable.',
      'Use HIGH priority for follow-ups tied to active opportunities with near-term deadlines.',
      'Review overdue follow-ups first thing each morning to catch anything that slipped through.'
    ],
    relatedArticleIds: ['crm-calls', 'crm-overview', 'crm-opportunities'],
    keywords: ['follow-up', 'follow up', 'reminder', 'schedule', 'callback', 'overdue', 'pending', 'action item']
  },
  {
    id: 'crm-opportunities',
    categoryId: 'crm-sales',
    title: 'Opportunities & Pipeline',
    summary: 'Track deals through stages from lead to close and manage your sales pipeline value.',
    content: [
      'Opportunities represent potential deals in your sales pipeline. Each opportunity has a customer, estimated value, expected close date, and a stage that tracks its progress: Lead, Qualified, Proposal Sent, Negotiation, Closed Won, or Closed Lost.',
      'The pipeline view gives you a clear picture of your total opportunity value by stage. This helps forecast revenue and identify bottlenecks where deals are stalling. Move opportunities through stages as they progress by updating the stage field.',
      'Opportunities are separate from Quotes — an opportunity represents the business deal while quotes are the specific pricing documents. A single opportunity may have multiple quotes as you iterate on scope and pricing with the customer.'
    ],
    steps: [
      { title: 'Navigate to Opportunities', description: 'Click "Opportunities" under the Sales section.' },
      { title: 'Create an Opportunity', description: 'Click "New Opportunity" and enter the customer, estimated value, and expected close date.' },
      { title: 'Set the Stage', description: 'Choose the current pipeline stage from Lead through Closed.' },
      { title: 'Update as Progress Occurs', description: 'Move the opportunity through stages as conversations and proposals advance.' },
      { title: 'Close the Deal', description: 'Mark as Closed Won when the deal is signed or Closed Lost with a reason.' }
    ],
    tips: [
      'Keep estimated values realistic — inflated pipeline numbers lead to poor forecasting.',
      'Move opportunities to Closed Lost promptly with a loss reason to track why deals fail.',
      'Review your pipeline weekly to identify opportunities that have been in the same stage too long.'
    ],
    relatedArticleIds: ['crm-overview', 'crm-calls', 'crm-reports', 'quote-create'],
    keywords: ['opportunity', 'pipeline', 'deal', 'prospect', 'stage', 'forecast', 'close', 'win rate', 'sales funnel']
  },
  {
    id: 'crm-tickets',
    categoryId: 'crm-sales',
    title: 'Service Tickets',
    summary: 'Track post-sale support requests and customer issues through to resolution.',
    content: [
      'Service Tickets capture customer issues and support requests after the sale. Each ticket has a subject, description, priority, status, and assigned owner. Tickets flow from Open through In Progress to Resolved, providing a clear lifecycle for issue management.',
      'Create tickets from the Service Tickets page or from a customer record. Tickets are linked to the customer and can reference specific assets or work orders. This linkage provides full context when investigating and resolving the issue.',
      'Service ticket history builds a valuable knowledge base of common issues and resolutions. Over time, this helps your team resolve recurring problems faster and identify patterns that may indicate product or service quality issues.'
    ],
    steps: [
      { title: 'Navigate to Service Tickets', description: 'Click "Service Tickets" under the Sales section.' },
      { title: 'Create a Ticket', description: 'Click "New Ticket" and enter the customer, subject, description, and priority.' },
      { title: 'Assign an Owner', description: 'Assign the ticket to a team member responsible for resolution.' },
      { title: 'Update Progress', description: 'Move the ticket through statuses as work progresses.' },
      { title: 'Resolve', description: 'Mark the ticket as Resolved with a resolution description.' }
    ],
    tips: [
      'Include as much detail as possible in the ticket description to avoid back-and-forth with the customer.',
      'Link tickets to specific assets when the issue relates to equipment — this builds the asset\'s service history.',
      'Review open tickets weekly in team meetings to ensure nothing is stalled.'
    ],
    relatedArticleIds: ['crm-overview', 'wo-create', 'cust-history'],
    keywords: ['service ticket', 'support', 'issue', 'customer issue', 'resolution', 'help desk', 'ticket tracking']
  },
  {
    id: 'crm-reports',
    categoryId: 'crm-sales',
    title: 'Sales Reports',
    summary: 'Analyze pipeline performance, win rates, call activity, and revenue forecasts with built-in charts.',
    content: [
      'Sales Reports provide visual analytics on your CRM data. The reports page includes charts for pipeline value by stage, win/loss ratios, call activity trends, follow-up compliance, and revenue forecasts based on your opportunity pipeline.',
      'Reports update in real time as your team logs calls, updates opportunities, and closes deals. Use the date range filter to compare performance across months or quarters. Export reports for team meetings and management reviews.',
      'Key metrics to monitor include total pipeline value, average deal size, sales cycle length (days from Lead to Close), and win rate percentage. These metrics help identify trends and areas for improvement in your sales process.'
    ],
    steps: [
      { title: 'Navigate to Sales Reports', description: 'Click "Reports" under the Sales section.' },
      { title: 'Select Report Type', description: 'Choose from Pipeline, Activity, Conversion, or Forecast reports.' },
      { title: 'Set Date Range', description: 'Use the date picker to define the reporting period.' },
      { title: 'Analyze the Charts', description: 'Review the visualizations for trends, bottlenecks, and opportunities.' },
      { title: 'Export if Needed', description: 'Click Export to download report data for presentations or further analysis.' }
    ],
    tips: [
      'Compare month-over-month pipeline value to spot growth or decline trends early.',
      'A declining win rate may indicate pricing issues or a shift in customer needs — investigate promptly.',
      'Share reports with your team regularly to maintain visibility and accountability.'
    ],
    relatedArticleIds: ['crm-overview', 'crm-opportunities', 'rpt-dashboard'],
    keywords: ['sales reports', 'pipeline report', 'win rate', 'analytics', 'forecast', 'CRM analytics', 'charts']
  },
  {
    id: 'crm-custom-fields',
    categoryId: 'crm-sales',
    title: 'Custom Fields',
    summary: 'Add custom data fields to customers, contacts, and opportunities to capture industry-specific information.',
    content: [
      'Custom Fields let you extend the standard data model with fields specific to your business and industry. Add fields to Customers, Contacts, or Opportunities to capture information like industry vertical, contract type, preferred communication method, or any other data point relevant to your sales process.',
      'Navigate to Sales > Settings to create and manage custom fields. Each field has a name, type (text, number, date, dropdown, checkbox), and the entity it applies to. Dropdown fields support predefined options so your team enters consistent data.',
      'Custom field values appear on the respective entity detail pages and can be filtered in list views. Industry-specific templates provide pre-configured field sets for common service business verticals — select your industry to get a head start.'
    ],
    steps: [
      { title: 'Navigate to Sales Settings', description: 'Go to Sales > Settings to access the Custom Fields configuration.' },
      { title: 'Click Add Field', description: 'Click "Add Custom Field" and select the entity type (Customer, Contact, or Opportunity).' },
      { title: 'Configure the Field', description: 'Enter the field name, select the data type, and add dropdown options if applicable.' },
      { title: 'Save and Use', description: 'Save the field. It immediately appears on the entity forms for data entry.' },
      { title: 'Select Industry Template', description: 'Optionally select an industry template to auto-create common fields for your vertical.' }
    ],
    tips: [
      'Start with a few essential custom fields rather than creating dozens — too many fields slow down data entry.',
      'Use dropdown type for fields with a fixed set of options to ensure data consistency.',
      'Custom fields are organization-wide, so coordinate with your team before adding new ones.'
    ],
    relatedArticleIds: ['crm-overview', 'crm-opportunities', 'set-general'],
    keywords: ['custom fields', 'custom data', 'industry fields', 'field configuration', 'dropdown', 'entity fields', 'templates']
  },
  {
    id: 'crm-dashboard',
    categoryId: 'crm-sales',
    title: 'Sales Dashboard',
    summary: 'Your daily command center for pipeline health, activity metrics, and upcoming actions.',
    content: [
      'The Sales Dashboard is your daily starting point for CRM activity. It displays key metrics at the top: total pipeline value, number of open opportunities, win rate percentage, overdue follow-ups count, and calls logged this week.',
      'Below the metrics, the dashboard shows recent activity including the latest call logs, newly created opportunities, and upcoming follow-ups. Charts visualize your pipeline by stage, call activity trends, and conversion funnel.',
      'The dashboard is role-aware — Sales users see only their own metrics while Admins see the full team view. Use the team toggle (Admin only) to switch between individual and team-wide views for management oversight.'
    ],
    steps: [
      { title: 'Open the Sales Dashboard', description: 'Click "Sales" in the sidebar to land on the dashboard.' },
      { title: 'Review Key Metrics', description: 'Check pipeline value, open opportunities, and overdue follow-ups at the top.' },
      { title: 'Scan Recent Activity', description: 'Review recent calls and opportunities for anything that needs attention.' },
      { title: 'Act on Overdue Items', description: 'Click the overdue follow-ups count to see what needs immediate action.' }
    ],
    tips: [
      'Check the dashboard first thing each morning to plan your day around the most impactful activities.',
      'An increasing overdue follow-up count is a red flag — address it before it impacts customer relationships.',
      'Use the pipeline chart to identify stages where deals are getting stuck and need extra attention.'
    ],
    relatedArticleIds: ['crm-overview', 'crm-followups', 'crm-opportunities', 'crm-reports'],
    keywords: ['sales dashboard', 'CRM dashboard', 'pipeline overview', 'metrics', 'KPIs', 'daily view']
  }
];

// ============================================================================
// CATEGORY 23: Custom Reports & Forms (5 articles)
// ============================================================================

const CUSTOM_REPORTS_ARTICLES: HelpArticle[] = [
  {
    id: 'forms-overview',
    categoryId: 'custom-reports',
    title: 'Custom Reports & Forms Overview',
    summary: 'Build custom report templates and data capture forms tailored to your specific service workflows.',
    content: [
      'The Custom Reports & Forms system lets you create tailored data collection templates for field work that goes beyond the standard work order and visit forms. Common uses include pump startup reports, vibration analysis checklists, commissioning forms, and safety inspection documents.',
      'The system supports 13 field types including text, number, date, dropdown, checkbox, photo, signature, GPS coordinates, calculated fields, and more. Templates are built with a drag-and-drop builder on the web and filled out by technicians on mobile or desktop.',
      'Completed forms include tamper-proof calculated fields that are recomputed on the server to prevent manipulation. Forms can be exported to professional PDF documents that match your company branding for customer deliverables.'
    ],
    steps: [
      { title: 'Navigate to Custom Reports', description: 'Access Custom Reports from the sidebar to see existing templates and create new ones.' },
      { title: 'Create a Template', description: 'Click "New Template" to open the drag-and-drop form builder.' },
      { title: 'Add Fields', description: 'Drag field types from the palette onto the form canvas to build your template.' },
      { title: 'Fill Out Forms', description: 'Technicians access the form from a work order or visit and fill in the fields.' },
      { title: 'Export to PDF', description: 'Generate a branded PDF from any completed form submission for customer delivery.' }
    ],
    tips: [
      'Start with your most-used paper forms and digitize those first for the biggest efficiency gains.',
      'Use calculated fields for automatic computations like total runtime hours or cost calculations.',
      'Auto-save drafts protect against data loss if a technician loses connectivity during field entry.'
    ],
    relatedArticleIds: ['forms-builder', 'forms-fields', 'forms-fill', 'forms-pdf'],
    keywords: ['custom reports', 'forms', 'templates', 'data capture', 'field forms', 'custom forms', 'report builder']
  },
  {
    id: 'forms-builder',
    categoryId: 'custom-reports',
    title: 'Form Builder',
    summary: 'Use the drag-and-drop builder to design custom form templates with sections, fields, and logic.',
    content: [
      'The Form Builder provides a visual drag-and-drop interface for designing your form templates. The left panel shows available field types that you can drag onto the canvas. The canvas represents the form layout as it will appear to technicians.',
      'Organize fields into sections with headings to create logical groupings. For example, a pump startup form might have sections for Nameplate Data, Pre-Start Checks, Operating Parameters, and Signatures. Sections help technicians navigate long forms efficiently.',
      'Each field can be configured with a label, placeholder text, required flag, validation rules, and help text. Dropdown fields support custom option lists. Calculated fields use formulas that reference other fields for automatic computation.'
    ],
    steps: [
      { title: 'Open the Builder', description: 'Navigate to Custom Reports > New Template to open the form builder.' },
      { title: 'Name the Template', description: 'Enter a descriptive template name like "Pump Commissioning Report" or "Safety Inspection Checklist."' },
      { title: 'Add Sections', description: 'Create logical sections by dragging a Section Header onto the canvas.' },
      { title: 'Drag Fields', description: 'Drag field types from the palette onto the canvas within each section.' },
      { title: 'Configure Each Field', description: 'Click a field to edit its label, validation, required status, and options.' },
      { title: 'Save the Template', description: 'Click Save to publish the template for use by your team.' }
    ],
    tips: [
      'Preview the form on mobile view to ensure it is usable on phones and tablets in the field.',
      'Keep forms as short as practical — long forms lead to incomplete data. Focus on what matters most.',
      'Use required fields sparingly for only the truly essential data points to avoid frustrating technicians.'
    ],
    relatedArticleIds: ['forms-overview', 'forms-fields', 'forms-fill'],
    keywords: ['form builder', 'drag and drop', 'template designer', 'build form', 'create template', 'form layout']
  },
  {
    id: 'forms-fields',
    categoryId: 'custom-reports',
    title: 'Field Types Reference',
    summary: 'Understand all 13 available field types and when to use each one in your form templates.',
    content: [
      'ServiceOpsIQ supports 13 field types for custom forms: Text (short and long), Number, Date, Time, Dropdown (single select), Multi-Select, Checkbox, Photo Capture, Signature, GPS Coordinates, File Upload, Calculated, and Section Header.',
      'Text fields capture free-form input and come in short (single line) and long (multi-line) variants. Number fields validate numeric input and support decimal precision, min/max ranges, and unit labels. Date and Time fields use native pickers for consistent formatting.',
      'Calculated fields are the most powerful type — they reference other fields using formulas and automatically compute results. For example, a "Total Cost" field could multiply a "Quantity" field by a "Unit Price" field. Calculated values are recomputed on the server to prevent tampering.'
    ],
    steps: [
      { title: 'Open the Field Palette', description: 'In the form builder, the left panel shows all 13 field types available for use.' },
      { title: 'Choose the Right Type', description: 'Select the field type that matches the data you need to capture.' },
      { title: 'Configure Field Settings', description: 'After placing a field, click it to configure validation, required status, and display options.' },
      { title: 'Set Up Calculations', description: 'For calculated fields, define the formula referencing other fields by their field ID.' }
    ],
    tips: [
      'Use Number fields instead of Text when you need to perform calculations or enforce numeric input.',
      'Photo Capture fields automatically compress images (1920px max, JPEG 80%) to manage storage.',
      'GPS fields capture coordinates automatically from the device — useful for documenting equipment locations.',
      'Signature fields capture touch-based signatures as PNG images for legal documentation.'
    ],
    relatedArticleIds: ['forms-builder', 'forms-overview', 'forms-fill'],
    keywords: ['field types', 'text', 'number', 'dropdown', 'photo', 'signature', 'calculated', 'GPS', 'form fields']
  },
  {
    id: 'forms-fill',
    categoryId: 'custom-reports',
    title: 'Filling Out Forms',
    summary: 'How technicians complete custom forms in the field with auto-save and offline support.',
    content: [
      'Technicians access custom forms from work order or visit detail pages. Available form templates are listed based on the work type and asset. Tap a template to start a new form submission or resume a saved draft.',
      'As the technician fills in fields, the form auto-saves drafts to prevent data loss from connectivity issues or accidental navigation. Draft submissions can be resumed later from where they left off. A draft indicator shows the last save time.',
      'Required fields are marked with an asterisk and must be completed before the form can be submitted. Calculated fields update in real time as dependent values are entered. Photo and signature fields open native device interfaces for capture.'
    ],
    steps: [
      { title: 'Open the Work Order or Visit', description: 'Navigate to the work order or visit where you need to fill out a form.' },
      { title: 'Select a Form Template', description: 'Choose the appropriate template from the available list.' },
      { title: 'Fill in Fields', description: 'Enter data in each field. The form auto-saves as you go.' },
      { title: 'Capture Photos and Signatures', description: 'Tap photo or signature fields to use your device camera or touchscreen.' },
      { title: 'Submit', description: 'Once all required fields are complete, tap Submit to finalize the form.' }
    ],
    tips: [
      'Auto-save drafts protect your work — if you lose connectivity, your data is preserved locally.',
      'Take photos with good lighting and clear focus — blurry images are not useful for documentation.',
      'Review calculated fields before submitting to verify the formulas produced expected results.'
    ],
    relatedArticleIds: ['forms-overview', 'forms-fields', 'forms-pdf', 'visit-workflow'],
    keywords: ['fill form', 'complete form', 'field entry', 'auto-save', 'draft', 'submit', 'technician form']
  },
  {
    id: 'forms-pdf',
    categoryId: 'custom-reports',
    title: 'Form PDF Export',
    summary: 'Generate professional branded PDF documents from completed custom form submissions.',
    content: [
      'Completed form submissions can be exported to professional PDF documents suitable for customer deliverables, compliance records, or internal documentation. The PDF includes your company header, the form title, all field values organized by section, photos, and signatures.',
      'PDF generation uses the same branding engine as invoices and quotes — your company logo, name, and address appear in the header. The layout is optimized for readability with clear section breaks, labeled fields, and properly scaled images.',
      'Export PDFs from the form submission detail page. You can download the PDF locally, email it to the customer, or attach it to the work order record for the permanent service history.'
    ],
    steps: [
      { title: 'Open the Completed Form', description: 'Navigate to the work order or visit and click on the completed form submission.' },
      { title: 'Click Export PDF', description: 'Click the "Export PDF" or "Download PDF" button to generate the document.' },
      { title: 'Preview', description: 'Review the PDF preview to ensure all data, photos, and signatures are included.' },
      { title: 'Download or Share', description: 'Download the PDF locally or email it directly to the customer.' }
    ],
    tips: [
      'Ensure your organization logo is uploaded in Settings for professional PDF headers.',
      'PDFs include calculated field results as displayed — server-recomputed values ensure accuracy.',
      'Keep a PDF copy of critical forms (safety inspections, compliance checklists) for your records.'
    ],
    relatedArticleIds: ['forms-overview', 'forms-fill', 'inv-pdf', 'gs-org-setup'],
    keywords: ['PDF export', 'form PDF', 'report export', 'print form', 'document generation', 'branded PDF']
  }
];

// ============================================================================
// CATEGORY 24: Training Videos (23 articles)
// ============================================================================

export const TRAINING_VIDEO_ARTICLES: HelpArticle[] = [
  {
    id: 'video-01',
    categoryId: 'training-videos',
    title: 'Video 1: Getting Started with ServiceOpsIQ',
    summary: 'An overview of the platform, sidebar navigation, and core modules.',
    content: ['Watch this introductory video to learn how ServiceOpsIQ is organized, navigate the sidebar modules, and understand the overall workflow from customers to invoicing.'],
    keywords: ['getting started', 'overview', 'introduction', 'video', 'tutorial', 'navigation'],
    videoUrl: '/videos/01-getting-started',
  },
  {
    id: 'video-02',
    categoryId: 'training-videos',
    title: 'Video 2: Setting Up Your Organization & Team',
    summary: 'Configure your company profile, invite team members, and assign roles.',
    content: ['Learn how to set up your organization profile with logo and address, invite dispatchers and technicians, and configure role-based permissions for your team.'],
    keywords: ['organization', 'setup', 'team', 'invite', 'roles', 'permissions', 'video', 'tutorial'],
    videoUrl: '/videos/02-organization-setup',
  },
  {
    id: 'video-03',
    categoryId: 'training-videos',
    title: 'Video 3: Navigating the Dashboard & Global Search',
    summary: 'Use the dashboard KPIs, activity feed, and global search to find any record.',
    content: ['Explore the main dashboard with revenue trends, active work orders, and recent activity. Learn to use global search (Ctrl+K) to jump to any record instantly.'],
    keywords: ['dashboard', 'search', 'KPIs', 'activity', 'navigation', 'video', 'tutorial'],
    videoUrl: '/videos/03-dashboard-search',
  },
  {
    id: 'video-04',
    categoryId: 'training-videos',
    title: 'Video 4: Customer Management',
    summary: 'Create customer records, manage contacts, and view service history.',
    content: ['Learn how to create and manage customer accounts, add contacts, track service history, and link customers to sites, assets, and work orders.'],
    keywords: ['customers', 'contacts', 'service history', 'accounts', 'video', 'tutorial'],
    videoUrl: '/videos/04-customer-management',
  },
  {
    id: 'video-05',
    categoryId: 'training-videos',
    title: 'Video 5: Sites & Access Notes',
    summary: 'Manage job sites with addresses, access instructions, and site-specific assets.',
    content: ['Set up job sites under customers with detailed addresses, access notes for field technicians, and link site-specific equipment for streamlined dispatching.'],
    keywords: ['sites', 'access notes', 'locations', 'addresses', 'video', 'tutorial'],
    videoUrl: '/videos/05-sites-access-notes',
  },
  {
    id: 'video-06',
    categoryId: 'training-videos',
    title: 'Video 6: Asset Management & Classification',
    summary: 'Track equipment with classification, criticality, manufacturer details, and service history.',
    content: ['Register assets with serial numbers, manufacturers, and model details. Classify by type and criticality level. Track full service history and link assets to work orders.'],
    keywords: ['assets', 'equipment', 'classification', 'criticality', 'service history', 'video', 'tutorial'],
    videoUrl: '/videos/06-asset-management',
  },
  {
    id: 'video-07',
    categoryId: 'training-videos',
    title: 'Video 7: Procedures & Standards Packs',
    summary: 'Build reusable procedure templates and group them into standards packs.',
    content: ['Create step-by-step procedure templates for common field tasks. Group procedures into standards packs that can be assigned to work orders for consistent execution.'],
    keywords: ['procedures', 'templates', 'standards', 'packs', 'tasks', 'video', 'tutorial'],
    videoUrl: '/videos/07-procedures-standards',
  },
  {
    id: 'video-08',
    categoryId: 'training-videos',
    title: 'Video 8: Work Order Lifecycle',
    summary: 'Create, assign, schedule, and track work orders from draft to completion.',
    content: ['Walk through the full work order lifecycle: create a work order, assign a technician, schedule visits, track progress through status changes, and close out completed work.'],
    keywords: ['work orders', 'lifecycle', 'assign', 'schedule', 'status', 'dispatch', 'video', 'tutorial'],
    videoUrl: '/videos/08-work-order-lifecycle',
  },
  {
    id: 'video-09',
    categoryId: 'training-videos',
    title: 'Video 9: Visit Execution & Field Documentation',
    summary: 'Execute visits with time tracking, photo capture, and digital signatures.',
    content: ['See how technicians execute field visits with time logging, task completion, photo capture with GPS coordinates, and digital signature collection for job verification.'],
    keywords: ['visits', 'execution', 'time tracking', 'photos', 'signatures', 'field', 'video', 'tutorial'],
    videoUrl: '/videos/09-visit-execution',
  },
  {
    id: 'video-10',
    categoryId: 'training-videos',
    title: 'Video 10: Quoting & Approvals',
    summary: 'Create quotes with line items, send for approval, and convert to work orders.',
    content: ['Build professional quotes with itemized line items, send them to customers for review, track approval status, and convert accepted quotes into work orders automatically.'],
    keywords: ['quotes', 'quoting', 'approvals', 'line items', 'pricing', 'video', 'tutorial'],
    videoUrl: '/videos/10-quoting-approvals',
  },
  {
    id: 'video-11',
    categoryId: 'training-videos',
    title: 'Video 11: Invoicing & Payments',
    summary: 'Generate invoices from work orders, record payments, and track aging.',
    content: ['Generate invoices from completed work orders, add line items, send to customers, record partial and full payments, and monitor outstanding balances with aging reports.'],
    keywords: ['invoices', 'invoicing', 'payments', 'billing', 'aging', 'video', 'tutorial'],
    videoUrl: '/videos/11-invoicing-payments',
  },
  {
    id: 'video-12',
    categoryId: 'training-videos',
    title: 'Video 12: PDF Generation (Quotes, Invoices, Reports)',
    summary: 'Export branded PDFs for quotes, invoices, and service reports.',
    content: ['Generate professional branded PDF documents for quotes, invoices, and service reports with your company logo, formatted line items, signatures, and payment terms.'],
    keywords: ['PDF', 'export', 'print', 'quotes', 'invoices', 'reports', 'branded', 'video', 'tutorial'],
    videoUrl: '/videos/12-pdf-generation',
  },
  {
    id: 'video-13',
    categoryId: 'training-videos',
    title: 'Video 13: Connecting QuickBooks Online',
    summary: 'Set up the QuickBooks Online integration with OAuth, account mapping, and sync.',
    content: ['Connect your QuickBooks Online account via OAuth, configure account mapping for revenue categories, and enable automatic sync of customers, invoices, and payments.'],
    keywords: ['QuickBooks', 'QBO', 'integration', 'OAuth', 'connect', 'accounting', 'video', 'tutorial'],
    videoUrl: '/videos/13-quickbooks-connect',
  },
  {
    id: 'video-14',
    categoryId: 'training-videos',
    title: 'Video 14: QBO Sync: Customers, Invoices, Payments & CDC',
    summary: 'Manage bidirectional sync, queue processing, and change data capture.',
    content: ['Deep dive into QuickBooks sync: outbound sync of customers, invoices, and payments, inbound CDC polling for changes made in QBO, queue monitoring, and troubleshooting sync issues.'],
    keywords: ['QuickBooks', 'QBO', 'sync', 'CDC', 'queue', 'invoices', 'payments', 'video', 'tutorial'],
    videoUrl: '/videos/14-qbo-sync',
  },
  {
    id: 'video-15',
    categoryId: 'training-videos',
    title: 'Video 15: AI Insights, Risk Badges & Alerts',
    summary: 'AI-powered asset risk assessment, predictive insights, and alert notifications.',
    content: ['See how ServiceOpsIQ uses AI to analyze asset health, assign risk badges, generate predictive maintenance insights, and surface critical alerts on your dashboard.'],
    keywords: ['AI', 'insights', 'risk', 'badges', 'alerts', 'predictions', 'machine learning', 'video', 'tutorial'],
    videoUrl: '/videos/15-ai-insights',
  },
  {
    id: 'video-16',
    categoryId: 'training-videos',
    title: 'Video 16: AI Copilot Chat & Draft Summaries',
    summary: 'Chat with the AI copilot to query data and generate work order summaries.',
    content: ['Use the AI copilot chat sidebar to ask questions about your data, get work order draft summaries, receive quote suggestions, and interact with your organization database using natural language.'],
    keywords: ['AI', 'copilot', 'chat', 'summaries', 'assistant', 'natural language', 'video', 'tutorial'],
    videoUrl: '/videos/16-ai-copilot',
  },
  {
    id: 'video-17',
    categoryId: 'training-videos',
    title: 'Video 17: CRM Overview: Calls, Follow-Ups & Pipeline',
    summary: 'Manage your sales pipeline with call logging, follow-ups, and opportunities.',
    content: ['Overview of the CRM module: log sales calls with outcomes, create follow-ups with due dates, manage opportunities through pipeline stages, and track service tickets from your sales dashboard.'],
    keywords: ['CRM', 'sales', 'calls', 'follow-ups', 'pipeline', 'opportunities', 'video', 'tutorial'],
    videoUrl: '/videos/17-crm-overview',
  },
  {
    id: 'video-18',
    categoryId: 'training-videos',
    title: 'Video 18: Sales Reports & Custom Fields',
    summary: 'CRM reports for pipeline, call activity, win/loss, and custom field configuration.',
    content: ['Explore five CRM report types: pipeline summary, call activity, win/loss analysis, follow-up performance, and customer coverage. Configure custom fields for contacts, customers, and opportunities.'],
    keywords: ['CRM', 'sales', 'reports', 'custom fields', 'pipeline', 'analytics', 'video', 'tutorial'],
    videoUrl: '/videos/18-sales-reports',
  },
  {
    id: 'video-19',
    categoryId: 'training-videos',
    title: 'Video 19: PM Schedules & Auto-Generated Work Orders',
    summary: 'Set up preventive maintenance schedules that automatically create work orders.',
    content: ['Configure PM schedules with daily, weekly, monthly, or yearly frequency. ServiceOpsIQ automatically generates work orders when schedules come due, tracks compliance, and integrates with AI insights for predictive recommendations.'],
    keywords: ['PM', 'preventive maintenance', 'schedules', 'auto-generate', 'work orders', 'compliance', 'video', 'tutorial'],
    videoUrl: '/videos/19-pm-schedules',
  },
  {
    id: 'video-20',
    categoryId: 'training-videos',
    title: 'Video 20: Materials & Inventory Management',
    summary: 'Manage your parts catalog, track stock levels, and log material usage on work orders.',
    content: ['Set up your materials catalog with categories, part numbers, and vendor details. Track stock levels with automatic deductions when materials are used on work orders. Monitor low stock alerts and generate purchase orders.'],
    keywords: ['materials', 'inventory', 'parts', 'stock', 'catalog', 'purchase orders', 'video', 'tutorial'],
    videoUrl: '/videos/20-materials-inventory',
  },
  {
    id: 'video-21',
    categoryId: 'training-videos',
    title: 'Video 21: Custom Reports & Form Builder',
    summary: 'Design custom report templates with 13 field types and tamper-proof calculations.',
    content: ['Build custom inspection forms with the drag-and-drop form builder. Choose from 13 field types including text, numeric, photo capture, signature, GPS, and calculated fields. Submitted forms are tamper-proof with server-side calculation verification and export to branded PDFs.'],
    keywords: ['custom reports', 'forms', 'form builder', 'fields', 'calculations', 'tamper-proof', 'PDF', 'video', 'tutorial'],
    videoUrl: '/videos/21-custom-reports',
  },
  {
    id: 'video-22',
    categoryId: 'training-videos',
    title: 'Video 22: Customer Portal & Tech Portal',
    summary: 'Self-service portals for customers and technicians with offline PWA support.',
    content: ['Give customers a self-service portal to view work orders, review and accept quotes, and download invoice PDFs. Equip technicians with a mobile-optimized portal for task management, time logging, photo capture, and digital signatures — all with offline PWA support.'],
    keywords: ['portal', 'customer portal', 'tech portal', 'PWA', 'offline', 'mobile', 'self-service', 'video', 'tutorial'],
    videoUrl: '/videos/22-portals',
  },
  {
    id: 'video-23',
    categoryId: 'training-videos',
    title: 'Video 23: Reports, Analytics & Data Export',
    summary: 'Dashboard KPIs, interactive charts, CRM sales reports, and CSV/PDF export.',
    content: ['Explore the analytics suite with 40+ KPIs, six interactive Recharts charts, five CRM sales reports, and data export to CSV and branded PDF. Filter by date range, compare periods, and track revenue trends, technician performance, and quote conversion rates.'],
    keywords: ['reports', 'analytics', 'dashboard', 'charts', 'KPIs', 'CSV', 'export', 'PDF', 'video', 'tutorial'],
    videoUrl: '/videos/23-reports-analytics',
  },
];

// ============================================================================
// Combined Articles Array & Search Function
// ============================================================================

export const HELP_ARTICLES: HelpArticle[] = [
  ...TRAINING_VIDEO_ARTICLES,
  ...GETTING_STARTED_ARTICLES,
  ...CUSTOMER_ARTICLES,
  ...SITE_ARTICLES,
  ...ASSET_ARTICLES,
  ...PROCEDURE_ARTICLES,
  ...STANDARDS_ARTICLES,
  ...WORK_ORDER_ARTICLES,
  ...VISIT_ARTICLES,
  ...QUOTE_ARTICLES,
  ...INVOICE_ARTICLES,
  ...PM_SCHEDULE_ARTICLES,
  ...MATERIAL_ARTICLES,
  ...REPORT_ARTICLES,
  ...KB_ARTICLES,
  ...PORTAL_CUSTOMER_ARTICLES,
  ...PORTAL_TECH_ARTICLES,
  ...SETTINGS_ARTICLES,
  ...SEARCH_ARTICLES,
  ...TIPS_ARTICLES,
  ...QBO_INTEGRATION_ARTICLES,
  ...AI_FEATURES_ARTICLES,
  ...CRM_SALES_ARTICLES,
  ...CUSTOM_REPORTS_ARTICLES,
];

export function searchArticles(query: string): HelpArticle[] {
  const q = query.toLowerCase().trim();
  if (q.length < 2) return [];

  const scored = HELP_ARTICLES.map((article) => {
    let score = 0;
    const titleLower = article.title.toLowerCase();
    const summaryLower = article.summary.toLowerCase();
    const keywordsStr = article.keywords.join(" ").toLowerCase();
    const contentStr = article.content.join(" ").toLowerCase();

    if (titleLower.includes(q)) score += 10;
    if (keywordsStr.includes(q)) score += 6;
    if (summaryLower.includes(q)) score += 5;
    if (contentStr.includes(q)) score += 3;

    return { article, score };
  });

  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((s) => s.article);
}
