# ServiceOpsIQ - Quote System Enhancement Roadmap
## Post-Launch Feature Additions

This document outlines additional features to enhance the quote system beyond the core MVP implementation.

---

## ✅ COMPLETED FEATURES (Build 16-17)

### Core Quote Functionality
- [x] Professional quote list page with search and filters
- [x] Create quote with line items modal
- [x] Quote detail page with all sections
- [x] Print quote (browser print with optimized layout)
- [x] Export to PDF (via browser print-to-PDF)
- [x] Email quote to customer (with timestamp tracking)
- [x] Duplicate quote (create copy with all line items)
- [x] Status management (Draft, Sent, Approved, Rejected, Expired, Converted, Canceled)
- [x] Convert quote to work order

---

## 🎯 PHASE 1: ATTACHMENTS & DOCUMENTS (HIGH PRIORITY)

### 1.1 Quote Attachments
**Business Value:** Allow users to attach supporting documents (specs, photos, diagrams) to quotes

**Implementation Details:**
- File upload component on quote detail page
- Support for PDF, images (JPG, PNG), Word docs, Excel
- File size limit: 10MB per file, 50MB total per quote
- Store in cloud storage (AWS S3, Azure Blob, or Supabase Storage)
- Display attachments list with download links
- Include attachments when emailing quote

**Database Schema:**
```prisma
model QuoteAttachment {
  id             String   @id @default(cuid())
  quoteId        String
  quote          Quote    @relation(fields: [quoteId], references: [id], onDelete: Cascade)
  fileName       String
  fileSize       Int
  fileType       String
  storageUrl     String
  uploadedById   String
  uploadedBy     User     @relation(fields: [uploadedById], references: [id])
  uploadedAt     DateTime @default(now())
  organizationId String
  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
}
```

**API Endpoints:**
- `POST /api/quotes/[id]/attachments` - Upload file
- `GET /api/quotes/[id]/attachments` - List attachments
- `DELETE /api/quotes/[id]/attachments/[attachmentId]` - Delete attachment
- `GET /api/quotes/[id]/attachments/[attachmentId]/download` - Download file

**UI Components:**
- Drag-and-drop upload zone
- Attachment list with file icons, sizes, dates
- Delete button (with confirmation)
- Download button
- Preview for images/PDFs

**Estimated Time:** 8-12 hours

---

## 🎯 PHASE 2: COLLABORATION FEATURES (HIGH PRIORITY)

### 2.1 Internal Comments
**Business Value:** Allow team members to add internal notes without customer visibility

**Implementation Details:**
- Comments section on quote detail page (collapsed by default)
- Real-time updates when other users add comments
- @mentions to notify specific team members
- Comment editing (within 5 minutes) and deletion (admin only)
- Filter by user or date range

**Database Schema:**
```prisma
model QuoteComment {
  id             String   @id @default(cuid())
  quoteId        String
  quote          Quote    @relation(fields: [quoteId], references: [id], onDelete: Cascade)
  content        String   @db.Text
  authorId       String
  author         User     @relation(fields: [authorId], references: [id])
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
  organizationId String
  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
}
```

**API Endpoints:**
- `POST /api/quotes/[id]/comments` - Add comment
- `GET /api/quotes/[id]/comments` - List comments
- `PATCH /api/quotes/[id]/comments/[commentId]` - Edit comment
- `DELETE /api/quotes/[id]/comments/[commentId]` - Delete comment

**UI Components:**
- Collapsible comments section
- Comment input with @mention autocomplete
- Comment list with timestamps and authors
- Edit/delete buttons for own comments

**Estimated Time:** 6-8 hours

---

### 2.2 Activity Log / Audit Trail
**Business Value:** Track all changes to quotes for compliance and transparency

**Implementation Details:**
- Automatic logging of all quote changes
- Track: status changes, line item edits, price changes, emails sent, conversions
- Display in timeline format on quote detail page
- Export to CSV for auditing

**Database Schema:**
```prisma
model QuoteActivityLog {
  id             String   @id @default(cuid())
  quoteId        String
  quote          Quote    @relation(fields: [quoteId], references: [id], onDelete: Cascade)
  action         String   // "created", "status_changed", "emailed", "approved", etc.
  changes        Json?    // Structured change data
  performedById  String?
  performedBy    User?    @relation(fields: [performedById], references: [id])
  createdAt      DateTime @default(now())
  organizationId String
  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
}
```

**API Endpoints:**
- `GET /api/quotes/[id]/activity` - Get activity log
- Auto-triggered on quote mutations (no direct POST)

**UI Components:**
- Timeline view with icons for different actions
- Filter by action type or date range
- Export to CSV button

**Estimated Time:** 6-8 hours

---

## 🎯 PHASE 3: CUSTOMER PORTAL (MEDIUM PRIORITY)

### 3.1 Public Quote View Link
**Business Value:** Allow customers to view quotes without login

**Implementation Details:**
- Generate secure, time-limited view links (e.g., expires in 30 days)
- Public page with read-only quote details
- Customer can approve/reject directly from link
- Optional: Request changes via comment

**Database Schema:**
```prisma
model QuoteShareLink {
  id             String    @id @default(cuid())
  quoteId        String
  quote          Quote     @relation(fields: [quoteId], references: [id], onDelete: Cascade)
  token          String    @unique @default(cuid())
  expiresAt      DateTime
  viewCount      Int       @default(0)
  lastViewedAt   DateTime?
  createdAt      DateTime  @default(now())
  organizationId String
  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
}
```

**API Endpoints:**
- `POST /api/quotes/[id]/share` - Generate share link
- `GET /api/public/quotes/[token]` - View quote (public)
- `POST /api/public/quotes/[token]/approve` - Approve (public)
- `POST /api/public/quotes/[token]/reject` - Reject (public)

**UI Components:**
- "Generate Share Link" button
- Copy link to clipboard
- Public quote view page (simplified design)
- Approve/Reject buttons (public)
- View count display

**Estimated Time:** 10-12 hours

---

### 3.2 Customer Signature Capture
**Business Value:** Digital signature for quote approval

**Implementation Details:**
- Signature pad on public quote page
- Save signature as image
- Store with timestamp and IP address
- Display on quote detail page when signed

**Database Schema:**
```prisma
model QuoteSignature {
  id             String   @id @default(cuid())
  quoteId        String   @unique
  quote          Quote    @relation(fields: [quoteId], references: [id], onDelete: Cascade)
  signatureData  String   @db.Text // Base64 image
  signerName     String
  signerEmail    String?
  signedAt       DateTime @default(now())
  ipAddress      String?
  organizationId String
  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
}
```

**Libraries:**
- `react-signature-canvas` or `signature_pad`

**Estimated Time:** 6-8 hours

---

## 🎯 PHASE 4: ADVANCED FEATURES (LOWER PRIORITY)

### 4.1 Quote Templates
**Business Value:** Speed up quote creation with pre-configured templates

**Implementation Details:**
- Save quote as template
- Include line items, terms, notes
- Quick "Create from Template" button
- Template library page

**Database Schema:**
```prisma
model QuoteTemplate {
  id             String   @id @default(cuid())
  name           String
  description    String?
  lineItems      Json     // Array of line item templates
  terms          String?
  notes          String?
  taxRate        Decimal  @default(0)
  createdById    String
  createdBy      User     @relation(fields: [createdById], references: [id])
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
  organizationId String
  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
}
```

**Estimated Time:** 8-10 hours

---

### 4.2 Quote Versioning / Revisions
**Business Value:** Track quote revisions and maintain history

**Implementation Details:**
- Create new version when quote is edited after being sent
- Version number: v1, v2, v3
- View previous versions
- Compare versions side-by-side

**Database Schema:**
```prisma
model QuoteVersion {
  id             String   @id @default(cuid())
  quoteId        String
  quote          Quote    @relation(fields: [quoteId], references: [id], onDelete: Cascade)
  versionNumber  Int
  snapshot       Json     // Full quote data at this version
  createdAt      DateTime @default(now())
  createdById    String
  createdBy      User     @relation(fields: [createdById], references: [id])
  organizationId String
  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  
  @@unique([quoteId, versionNumber])
}
```

**Estimated Time:** 12-16 hours

---

### 4.3 Bulk Quote Operations
**Business Value:** Manage multiple quotes efficiently

**Implementation Details:**
- Select multiple quotes on list page
- Bulk actions: Email, Change Status, Delete, Export
- Progress indicator for bulk operations

**UI Components:**
- Checkbox on each quote card
- "Select All" checkbox
- Bulk action toolbar (appears when items selected)

**Estimated Time:** 6-8 hours

---

### 4.4 Quote Analytics Dashboard
**Business Value:** Track quote performance and conversion rates

**Implementation Details:**
- Total quotes by status
- Conversion rate (quotes to work orders)
- Average quote value
- Time to approval metrics
- Top customers by quote volume
- Monthly quote trends

**UI Components:**
- Chart.js or Recharts for visualizations
- Date range filter
- Export to Excel/PDF

**Estimated Time:** 12-16 hours

---

### 4.5 Advanced PDF Customization
**Business Value:** Brand quotes with company logo and custom layouts

**Implementation Details:**
- Upload company logo
- Choose from multiple PDF templates
- Custom header/footer text
- Color scheme customization
- Terms & conditions library

**Libraries:**
- Consider using `puppeteer` or `jsPDF` for more control
- Or `@react-pdf/renderer` for React-based PDFs

**Estimated Time:** 16-20 hours

---

### 4.6 Mobile App for Quote Approval
**Business Value:** Allow customers to approve quotes from mobile devices

**Implementation Details:**
- React Native or PWA
- Push notifications for new quotes
- Mobile-optimized quote view
- Quick approve/reject buttons
- Signature capture

**Estimated Time:** 40-60 hours (full mobile app)

---

## 🔧 TECHNICAL DEBT & IMPROVEMENTS

### Email Service Integration
**Current State:** Email endpoint is stubbed - updates sentAt timestamp only
**Required:** Integrate with SendGrid, AWS SES, or Mailgun
**Estimated Time:** 4-6 hours

**Implementation Steps:**
1. Choose email service (recommend SendGrid for ease of use)
2. Set up account and get API keys
3. Create email templates (HTML + plain text)
4. Implement sending logic in `/api/quotes/[id]/email/route.ts`
5. Add email tracking (opens, clicks)
6. Handle bounces and failures

**Code Example:**
```typescript
import sgMail from '@sendgrid/mail';

sgMail.setApiKey(process.env.SENDGRID_API_KEY!);

const msg = {
  to: email,
  from: 'quotes@globalpumpsolutions.com',
  subject: `Quote ${quote.quoteNumber} from Global Pump Solutions`,
  text: `Please review your quote...`,
  html: generateQuoteEmailHTML(quote),
  attachments: [{
    content: pdfBase64,
    filename: `${quote.quoteNumber}.pdf`,
    type: 'application/pdf',
    disposition: 'attachment'
  }]
};

await sgMail.send(msg);
```

---

### PDF Generation Service
**Current State:** Using browser print-to-PDF
**Limitation:** Requires user interaction, not suitable for automated emails
**Required:** Server-side PDF generation
**Estimated Time:** 8-12 hours

**Options:**
1. **Puppeteer** (Chromium-based)
   - Pros: Perfect rendering, uses same CSS
   - Cons: Resource intensive, requires headless browser
   
2. **react-pdf/renderer**
   - Pros: Pure JavaScript, no browser needed
   - Cons: Different syntax, must recreate layout
   
3. **PDF Library** (jsPDF, pdfmake)
   - Pros: Lightweight, fast
   - Cons: Manual layout, more code

**Recommendation:** Start with Puppeteer for consistency, optimize later if needed

---

### Real-time Updates
**Feature:** Live updates when other users modify quotes
**Technology:** WebSockets or Server-Sent Events (SSE)
**Library:** Pusher, Ably, or Socket.io
**Estimated Time:** 12-16 hours

---

## 📊 PRIORITIZATION FRAMEWORK

### Critical Path (Do First)
1. Email Service Integration (unblocks email feature)
2. PDF Generation Service (required for email attachments)
3. Quote Attachments (high customer value)

### High Value (Do Next)
4. Internal Comments (team collaboration)
5. Activity Log (compliance, transparency)
6. Public Quote Links (customer convenience)

### Nice to Have (Future)
7. Quote Templates
8. Quote Versioning
9. Bulk Operations
10. Analytics Dashboard
11. Advanced PDF Customization
12. Mobile App

---

## 💡 IMPLEMENTATION NOTES

### Testing Strategy
- Unit tests for all API endpoints
- Integration tests for email sending
- E2E tests for critical flows (create, email, approve, convert)
- Load testing for PDF generation under high volume

### Security Considerations
- Rate limiting on public endpoints (quote view, approve/reject)
- Token expiration for share links
- File upload validation (size, type, virus scanning)
- XSS protection in comments
- SQL injection prevention (already handled by Prisma)

### Performance Optimization
- Cache generated PDFs (24 hours)
- Lazy load attachments list
- Paginate activity logs
- Index frequently queried fields (status, createdAt, customerId)

---

## 📞 SUPPORT & MAINTENANCE

### Monitoring
- Email delivery rates
- PDF generation success rates
- API endpoint response times
- Error logs for failed operations

### Customer Support Runbook
- How to resend quotes
- How to regenerate share links
- How to recover deleted quotes (soft delete?)
- How to update customer email addresses

---

**Document Version:** 1.0
**Last Updated:** January 30, 2026
**Owner:** Lance Reed
**Next Review:** After Phase 1 completion
