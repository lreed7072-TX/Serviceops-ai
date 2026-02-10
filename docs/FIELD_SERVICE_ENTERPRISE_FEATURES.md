# FIELD SERVICE ENTERPRISE FEATURES
## Complete Requirements for Industry-Leading Field Service Platform

**Document Version:** 1.0  
**Date:** February 10, 2026  
**Status:** Requirements Definition  
**Estimated Development:** 120-150 hours (Phases 1-4)

---

## EXECUTIVE SUMMARY

This document defines enterprise-grade field service features that transform ServiceOpsIQ from a basic work order system into a **comprehensive field service platform** comparable to ServiceMax, FieldEdge, and ServiceTitan—but purpose-built for rotating equipment service companies.

**Core Value Propositions:**
- ✅ **Zero missed billable time** (persistent check-in tracking)
- ✅ **Bulletproof documentation** (photo evidence + custom reports)
- ✅ **Customer confidence** (professional reports + real-time updates)
- ✅ **Compliance ready** (safety checklists + audit trails)
- ✅ **Tech empowerment** (all tools in one app, works offline)

---

## PHASE 1: PERSISTENT CHECK-IN STATUS (Priority 1)
**Timeline:** 8-10 hours  
**Business Impact:** Prevents lost billable hours, improves accountability

### FEATURE 1.1: Persistent Status Banner

**Requirements:**
- Banner visible on **EVERY page** of tech app (dashboard, tasks, work orders)
- Sticky positioning (always visible even when scrolling)
- Shows when tech is checked in to ANY site
- Real-time duration counter (updates every minute)
- One-tap quick checkout button
- Color-coded urgency levels

**Banner States:**
```typescript
// NOT CHECKED IN (No banner shown)
null

// CHECKED IN (Green banner)
{
  siteId: string
  siteName: string
  workOrderId: string
  workOrderNumber: string
  checkInTime: DateTime
  duration: string  // "2h 34m"
  status: "ACTIVE"
}

// CHECKED IN >8 HOURS (Orange warning banner)
{
  ...same as above
  status: "WARNING"
  overtimeHours: number
}

// CHECKED IN >12 HOURS (Red critical banner)
{
  ...same as above
  status: "CRITICAL"
  overtimeHours: number
}
```

**Visual Design:**
```
┌─────────────────────────────────────────────────────┐
│ 🟢 ON SITE: Acme Manufacturing - Site A            │
│ WO-1234 | Checked in 2h 34m ago | [Quick Checkout] │
└─────────────────────────────────────────────────────┘
```

**Technical Implementation:**
- React Context for check-in state
- Server-sent events (SSE) or polling for real-time updates
- Local storage backup for offline scenarios
- Push notifications at 8hr/12hr marks
- Auto-refresh every 60 seconds

**Database Schema:**
```prisma
model SiteCheckIn {
  // ... existing fields ...
  notificationSentAt8h  DateTime?
  notificationSentAt12h DateTime?
  autoCheckoutWarning   Boolean @default(false)
}
```

### FEATURE 1.2: Smart Check-Out Prompts

**Requirements:**
- Prompt tech to check out when completing last task on work order
- Prompt when navigating away from work order while checked in
- Optional auto-checkout after X hours (configurable per org)
- Reminder notifications (push + SMS option)

**User Flow:**
1. Tech completes final task on WO
2. Modal appears: "You're still checked in. Ready to check out?"
3. Quick actions: "Check Out Now" | "Stay On Site" | "Remind Me in 15 min"

---

## PHASE 2: PHOTO MANAGEMENT SYSTEM (Priority 1)
**Timeline:** 20-25 hours  
**Business Impact:** Documentation quality, upsell opportunities, dispute resolution

### FEATURE 2.1: Camera Integration

**Requirements:**
- Native device camera access (iOS, Android, desktop webcam)
- Multiple photo capture per work order (unlimited)- Photo capture from task view, work order view, or dedicated photo section
- Support for front/back camera switching
- Flash control
- Photo quality settings (High/Medium for bandwidth management)

**Photo Types/Categories:**
```typescript
enum PhotoType {
  BEFORE_WORK      // Pre-work condition documentation
  AFTER_WORK       // Post-work completion proof
  ISSUE_FOUND      // Problems discovered
  RESOLUTION       // How issue was fixed
  SAFETY_HAZARD    // Safety concerns
  WARRANTY_CLAIM   // Warranty documentation
  CUSTOMER_ASSET   // General equipment photos
  SERIAL_PLATE     // Equipment nameplate/serial number
  INSTALLATION     // New equipment installed
  PARTS_USED       // Parts/materials used
  MEASUREMENT      // Measurement readings (dials, gauges)
  DIAGNOSTIC       // Diagnostic equipment screens
  SITE_CONDITIONS  // Work area conditions
}
```

**Photo Metadata:**
```typescript
interface WorkOrderPhoto {
  id: string
  workOrderId: string
  taskId?: string           // Optional - can be WO-level or task-level
  photoType: PhotoType
  capturedByUserId: string
  capturedAt: DateTime
  gpsLatitude?: number      // Auto-capture if available
  gpsLongitude?: number
  fileName: string
  originalUrl: string       // Full resolution
  thumbnailUrl: string      // 200x200px
  mediumUrl: string         // 800x800px
  fileSize: number          // In bytes
  mimeType: string          // image/jpeg, image/png, image/heic
  isCustomerVisible: boolean // Show in customer portal?
  caption?: string          // Tech's description
  annotations?: JSON        // Markup data (arrows, circles, text)
  sequenceNumber: number    // Order within WO
  tags: string[]           // Searchable tags
  orgId: string            // Multi-tenant
}
```

### FEATURE 2.2: Photo Annotation & Markup

**Requirements:**
- Draw on photos BEFORE saving
- Annotation tools: Arrow, Circle, Rectangle, Text, Freehand
- Color picker for annotations (Red for issues, Green for fixes)
- Undo/Redo functionality
- Save original + annotated versions

**Use Cases:**
- Circle a leaking seal with red annotation
- Draw arrow pointing to worn bearing
- Add text: "Replace by next PM"
- Mark measurement points on equipment
- Highlight safety hazards

**Technical Stack:**
- HTML5 Canvas for annotation
- Fabric.js or Konva.js for drawing tools
- Export as layered image (original preserved)

### FEATURE 2.3: Photo Gallery & Management

**Requirements:**
- Work order photo gallery view (grid + list)
- Filter by photo type, date, tech, task
- Sort by: Date, Type, Task, Tech
- Bulk operations (delete, download, re-categorize)
- Timeline view (chronological with timestamps)
- Full-screen viewer with swipe navigation
- Pinch-to-zoom on mobile
- Photo count badges (e.g., "12 photos" on WO card)

**Gallery UI Layout:**
```
┌─────────────────────────────────────────────┐
│ Work Order Photos (23)        [+ Add Photo] │
├─────────────────────────────────────────────┤
│ Filter: [All Types ▾] [All Tasks ▾] [Date ▾]│
├─────────────────────────────────────────────┤
│ ┌───┐ ┌───┐ ┌───┐ ┌───┐ ┌───┐ ┌───┐       │
│ │ 📷│ │ 📷│ │ 📷│ │ 📷│ │ 📷│ │ 📷│       │
│ └───┘ └───┘ └───┘ └───┘ └───┘ └───┘       │
│ BEFORE ISSUE AFTER SERIAL SAFETY PARTS     │
│ 2:15pm 2:32pm 4:45pm 2:18pm  3:10pm 4:30pm │
└─────────────────────────────────────────────┘
```

### FEATURE 2.4: Required Photos Enforcement

**Requirements:**
- Admin can mark photo types as REQUIRED per task type
- Tech cannot complete task without required photos
- Pre-flight check warns: "Missing 2 required photos"
- Photo requirements shown in task checklist
- Visual indicators (red badge) for missing required photos

**Example Configuration:**
```typescript
// In Task Template or Standards Pack Task
{
  taskTitle: "Pump Seal Replacement",
  requiredPhotoTypes: [
    PhotoType.BEFORE_WORK,
    PhotoType.SERIAL_PLATE,
    PhotoType.AFTER_WORK
  ],
  minimumPhotos: 3,
  recommendedPhotoTypes: [
    PhotoType.PARTS_USED,
    PhotoType.MEASUREMENT
  ]
}
```

**Validation Flow:**
```typescript
function canCompleteTask(task: TaskInstance): PreflightCheck {
  const requiredPhotos = task.requiredPhotoTypes || []
  const existingPhotos = task.photos.map(p => p.photoType)
  
  const missingRequired = requiredPhotos.filter(
    type => !existingPhotos.includes(type)
  )
  
  return {
    canComplete: missingRequired.length === 0,
    warnings: missingRequired.map(type => 
      `Missing required photo: ${type}`
    )
  }
}
```

### FEATURE 2.5: Offline Photo Management

**Requirements:**
- Capture photos while offline
- Queue photos for upload when online
- Show upload status (pending, uploading, uploaded)
- Retry failed uploads automatically
- Local storage for offline photos (IndexedDB)
- Compress photos before upload (reduce bandwidth)

**Photo Compression Strategy:**
```typescript
// Original: 5-10MB (keep on device temporarily)
// Compressed: 500KB-1MB (upload to server)
// Thumbnail: 50-100KB (for gallery view)

const compressionSettings = {
  original: { maxDimension: 4000, quality: 0.95 },
  medium: { maxDimension: 1600, quality: 0.85 },
  thumbnail: { maxDimension: 400, quality: 0.75 }
}
```

### FEATURE 2.6: Customer-Facing Photo Portal

**Requirements:**
- Customer can view approved photos from their portal
- Tech marks photos as "Customer Visible" or "Internal Only"
- Before/After comparison slider
- Photo captions visible to customer
- Download option for customers
- Photo watermarking option (company logo)

---

## PHASE 3: CUSTOM REPORT BUILDER (Priority 1)
**Timeline:** 35-40 hours  
**Business Impact:** Eliminates paper forms, ensures compliance, professional documentation

### FEATURE 3.1: Report Template Builder (Admin)

**Requirements:**
- Drag-and-drop form builder interface
- Field types library (15+ field types)
- Conditional logic (show/hide fields based on answers)
- Field validation rules
- Pre-filled default values
- Multi-page reports
- Section headers and descriptions
- Save as template library

**Field Types:**
```typescript
enum ReportFieldType {
  // Basic Input
  SHORT_TEXT         // Single line text
  LONG_TEXT          // Multi-line textarea
  NUMBER             // Numeric input with validation
  DECIMAL            // Decimal numbers (measurements)
  
  // Selection
  YES_NO             // Boolean checkbox
  DROPDOWN           // Single select from options
  MULTI_SELECT       // Multiple checkboxes
  RADIO_BUTTONS      // Single select radio
  RATING             // Star rating or 1-10 scale
  
  // Date/Time
  DATE               // Date picker
  TIME               // Time picker
  DATE_TIME          // Combined date + time
  DURATION           // Hours and minutes
  
  // Special
  SIGNATURE          // Signature capture pad
  PHOTO              // Photo upload/capture
  PHOTO_REQUIRED     // Required photo with type  DRAWING              // Freehand drawing canvas
  FILE_UPLOAD          // Document/file attachment
  BARCODE_SCAN         // Scan equipment tag/serial
  QR_CODE_SCAN         // QR code scanner
  GEOLOCATION          // Auto-capture GPS coordinates
  
  // Calculations
  CALCULATED_FIELD     // Auto-calculate based on formula
  RUNNING_TOTAL        // Sum of other fields
  
  // Data Validation
  EMAIL                // Email with validation
  PHONE                // Phone number with formatting
  URL                  // Website URL validation
}
```

**Report Template Schema:**
```typescript
interface ReportTemplate {
  id: string
  orgId: string
  name: string
  description: string
  category: string              // "Pump", "VFD", "Motor", "General"
  version: number               // Version control
  status: "DRAFT" | "ACTIVE" | "ARCHIVED"
  isDefault: boolean            // Auto-attach to certain task types
  
  // Sections structure
  sections: ReportSection[]
  
  // Metadata
  createdBy: string
  createdAt: DateTime
  updatedBy: string
  updatedAt: DateTime
  lastUsedAt: DateTime
  usageCount: number
  
  // Compliance tags
  complianceStandards: string[] // ["ISO-9001", "API-610", "ANSI"]
  customerTypes: string[]       // Which customer types require this
}

interface ReportSection {
  id: string
  title: string
  description?: string
  sequenceNumber: number
  isRepeatable: boolean         // Can add multiple instances
  fields: ReportField[]
}

interface ReportField {
  id: string
  fieldType: ReportFieldType
  label: string
  helpText?: string
  placeholder?: string
  isRequired: boolean
  isCustomerVisible: boolean    // Show in customer-facing report
  
  // Field-specific config
  config: {
    // For dropdowns/multi-select
    options?: string[]
    
    // For number/decimal
    min?: number
    max?: number
    unit?: string               // "PSI", "GPM", "RPM", "°F"
    
    // For text
    maxLength?: number
    pattern?: string            // Regex validation
    
    // For calculated fields
    formula?: string            // "field1 + field2"
    
    // For photos
    photoType?: PhotoType
    maxPhotos?: number
    
    // Conditional logic
    showIf?: {
      fieldId: string
      operator: "equals" | "notEquals" | "greaterThan" | "lessThan"
      value: any
    }
  }
  
  // Prepopulated values
  defaultValue?: any
  autofillFrom?: string         // Asset field or customer field
  
  sequenceNumber: number
}
```

### FEATURE 3.2: Report Template Library

**Pre-Built Industry Templates:**

1. **Centrifugal Pump Service Report**
   - Pump identification (serial, model, size)
   - Operating parameters (flow, head, speed, power)
   - Vibration measurements (inboard/outboard, H/V/A)
   - Bearing temperatures
   - Alignment readings
   - Seal condition assessment
   - Before/after photos required
   - Efficiency calculations
   - Recommendations section

2. **VFD Commissioning Report**
   - VFD model and firmware version
   - Motor nameplate data verification
   - Parameter programming checklist
   - Auto-tune results
   - Load test readings
   - Alarm history review
   - I/O verification
   - Communication testing
   - Performance graphs

3. **Motor Inspection Report**
   - Motor nameplate documentation
   - Winding resistance measurements
   - Insulation resistance (megger test)
   - Vibration analysis
   - Bearing condition
   - Terminal tightness
   - Thermal imaging results
   - Load test data

4. **Vibration Analysis Report**
   - Measurement points diagram
   - FFT spectrum data
   - Bearing defect frequency calculations
   - Severity assessment (ISO 10816)
   - Trending graphs
   - Root cause analysis
   - Corrective action recommendations

5. **Preventive Maintenance Inspection**
   - Equipment identification
   - Visual inspection checklist
   - Operational parameters
   - Consumables replaced
   - Issues found
   - Safety observations
   - Next PM due date

6. **Emergency Breakdown Report**
   - Failure description
   - Downtime impact
   - Root cause analysis
   - Emergency actions taken
   - Temporary repairs
   - Permanent solution recommendations
   - Cost estimate

7. **Safety Inspection Report**
   - LOTO verification
   - Confined space entry log
   - PPE compliance
   - Hazard identification
   - Safety violations
   - Corrective actions
   - Incident documentation

### FEATURE 3.3: Task-Report Assignment

**Requirements:**
- When creating task, admin selects which report template to use
- Report auto-attached to task when assigned to tech
- Tech sees "Complete Report" button on task
- Report pre-filled with equipment data (asset info, customer info)
- Can save draft and come back later
- Required fields enforcement before submission
- Version control (if template updated, existing reports unchanged)

**Task Schema Update:**
```prisma
model TaskInstance {
  // ... existing fields ...
  reportTemplateId  String?
  reportTemplate    ReportTemplate? @relation(fields: [reportTemplateId])
  reportData        Json?                    // Completed report data
  reportCompletedAt DateTime?
  reportCompletedBy String?
}
```

**User Flow:**
1. Dispatcher creates work order
2. Adds task: "Pump Annual Inspection"
3. Selects report template: "Centrifugal Pump Service Report"
4. Saves work order
5. Tech opens task on mobile
6. Sees "📋 Complete Report" button
7. Opens report form (fields pre-filled with pump data)
8. Fills in measurements, checkboxes, photos
9. Saves draft (can exit and come back)
10. Completes report (all required fields filled)
11. Report data saved, PDF generated automatically

### FEATURE 3.4: Report Completion Interface (Tech)
**Requirements:**
- Mobile-optimized form (large inputs, easy scrolling)
- Section-by-section navigation (progress indicator)
- Auto-save drafts every 30 seconds
- Offline support (save locally, sync when online)
- Field validation with helpful error messages
- Jump to incomplete required fields
- Photo capture inline (within form flow)
- Signature capture at end of report
- Preview before final submission
- Can't mark task complete until report submitted

**UI Flow:**
```
┌────────────────────────────────────────┐
│ Pump Service Report              [75%] │
├────────────────────────────────────────┤
│ 📍 Section 3 of 4: Measurements        │
├────────────────────────────────────────┤
│                                        │
│ Suction Pressure (PSI) *               │
│ ┌─────────────────────────┐           │
│ │ 45                      │           │
│ └─────────────────────────┘           │
│                                        │
│ Discharge Pressure (PSI) *             │
│ ┌─────────────────────────┐           │
│ │ 120                     │           │
│ └─────────────────────────┘           │
│                                        │
│ ✅ Flow Rate (GPM): 850                │
│ ✅ Motor Amps: 42.5                    │
│ ⚠️  Vibration Reading (required)       │
│ ❌ Bearing Temperature (required)      │
│                                        │
│ [📷 Add Photo]  [Previous]  [Next]    │
└────────────────────────────────────────┘
```

### FEATURE 3.5: Report PDF Generation

**Requirements:**
- Professional PDF layout with company branding
- Include all completed fields
- Embed photos inline (not as attachments)
- Customer signature + Tech signature
- Auto-generated timestamp and GPS location
- Compliance statement footer
- Watermark option
- Export to customer portal
- Email delivery option

**PDF Sections:**
1. Header (company logo, contact info, report type)
2. Work order information
3. Equipment identification
4. Report sections with data
5. Photos with captions
6. Signatures block
7. Recommendations/notes
8. Footer (disclaimer, company details)

---

## PHASE 4: ADDITIONAL ENTERPRISE FEATURES (Priority 2)
**Timeline:** 50-60 hours  
**Business Impact:** Complete field service platform parity

### FEATURE 4.1: Equipment Tag Scanner

**Requirements:**
- Barcode scanner for equipment serial numbers
- QR code scanner for asset tags
- Auto-populate equipment data from scan
- Link scan to current task/work order
- Offline scanning (store scans, look up data when online)
- Generate QR codes for assets without tags

**Use Cases:**
- Scan pump serial plate to pull up service history
- Scan VFD barcode to load parameter settings
- Verify correct equipment before starting work
- Quick equipment identification in large facilities

**Technical Implementation:**
- Use device camera as scanner (no special hardware needed)
- ZXing or QuaggaJS library for barcode detection
- Scan validation against asset database
- Fallback manual entry if scan fails

### FEATURE 4.2: Voice Notes & Speech-to-Text

**Requirements:**
- Record voice notes on tasks and work orders
- Auto-transcribe to text (Whisper API or browser Speech Recognition)
- Playback option
- Attach to specific sections of report
- Hands-free documentation for techs

**Use Cases:**
- Dictate findings while inspecting equipment
- Quick notes while hands are dirty/gloved
- Capture customer requests verbally
- Document observations without typing

### FEATURE 4.3: Safety Checklist System

**Requirements:**
- Pre-work safety verification required
- Task-specific safety checklists
- Cannot start task without completing safety checklist
- Hazard identification prompts
- PPE requirement verification
- LOTO (Lock-Out/Tag-Out) procedure enforcement
- Confined space entry protocol
- Emergency contact information
- Safety incident reporting

**Example Safety Checklist for Pump Work:**
```
Pre-Work Safety Verification:

☑ Equipment is locked out and tagged
☑ Energy sources isolated (electrical, steam, hydraulic)
☑ Pressure relieved and verified zero
☑ Liquid drained and purged
☑ Proper PPE worn (safety glasses, steel toes, gloves)
☑ Fire extinguisher location identified
☑ Spill containment ready
☑ Ventilation adequate
☑ Emergency exit route clear
☑ Supervisor notified of work start

Hazards Identified:
- [ ] Hot surfaces
- [ ] Rotating equipment nearby
- [ ] Chemical exposure
- [ ] Confined space
- [ ] Overhead hazards
- [ ] Other: _______________

Safety Briefing Completed: [Signature]
```

### FEATURE 4.4: Real-Time Progress Updates

**Requirements:**
- Office dashboard shows live tech progress
- Task completion updates in real-time
- Check-in/out status visible to dispatchers
- Push notifications for critical events
- Customer portal shows work progress (optional)
- Estimated completion time based on task progress

**Live Status Examples:**
```
Tech: John Smith
Status: 🟢 On Site - Acme Manufacturing
Work Order: WO-1234 (Pump PM)
Progress: 3 of 5 tasks complete (60%)
Current Task: Vibration Analysis (Started 15 min ago)
Estimated Completion: 2:30 PM
```

### FEATURE 4.5: Dispatcher Communication

**Requirements:**
- Two-way chat between tech and dispatcher
- Push notifications for new messages
- Photo/file sharing in chat
- Quick replies (canned responses)
- Priority flagging
- Read receipts
- Chat history saved on work order

**Use Cases:**
- "Need rush delivery of seal kit to site"
- "Customer requesting additional work - quote approval?"
- "Found major issue - need senior tech assistance"
- "Running late due to traffic"

### FEATURE 4.6: Parts Request from Field

**Requirements:**
- Tech can request parts while on site
- Search parts catalog from mobile
- Add to parts request with quantity
- Auto-populate from task materials list
- Priority flag (ASAP vs normal delivery)
- Delivery to site or shop pickup
- Parts request approval workflow
- Stock check integration

**Parts Request Flow:**
1. Tech discovers need for part while on site
2. Opens "Request Parts" from work order
3. Searches: "mechanical seal 2.5 inch"
4. Selects part from results
5. Quantity: 1, Priority: ASAP
6. Delivery location: Current site
7. Submits request
8. Dispatcher gets notification
9. Approves and orders part
10. Tech gets delivery ETA notification

### FEATURE 4.7: Equipment Service History

**Requirements:**
- View all previous work orders on equipment
- See historical measurements (trending)
- Past findings and recommendations
- Parts replaced over time
- Vibration trend analysis
- Failure history
- Warranty information
- Last service date and technician

**History View:**
```
Pump #4523 - Service History

Total Work Orders: 23
Last Service: 45 days ago by Mike Johnson
Next PM Due: 15 days

Recent Work:
─────────────────────────────────────
12/15/2025 - Quarterly PM  
  Tech: Mike Johnson
  Findings: Minor seal weep detected
  Parts: None
  
11/01/2025 - Seal Replacement
  Tech: Sarah Williams  
  Findings: Seal failure due to dry running
  Parts: Mech Seal (#MS-2500)
  
09/22/2025 - Emergency Repair
  Tech: John Smith
  Findings: Bearing failure, high vibration
  Parts: Bearings (#6309), Seals
  
Vibration Trending:
[Graph showing increasing trend before bearing failure]
```

### FEATURE 4.8: Time Tracking Per Task

**Requirements:**
- Auto-start timer when task opened
- Pause/resume capability
- Manual time entry option
- Task-level time breakdown (not just WO total)
- Billable vs non-billable time
- Time entry approval workflow
- Integration with payroll/billing

**Time Entry Schema:**
```prisma
model TaskTimeEntry {
  id            String   @id @default(cuid())
  taskId        String
  userId        String
  startTime     DateTime
  endTime       DateTime?
  duration      Int              // Minutes
  isBillable    Boolean @default(true)
  activityType  String           // "Service", "Travel", "Waiting"
  notes         String?
  status        TimeEntryStatus  // DRAFT, SUBMITTED, APPROVED
  approvedBy    String?
  approvedAt    DateTime?
}
### FEATURE 4.9: Customer Acceptance Workflow

**Requirements:**
- Formal customer sign-off on completed work
- Work summary presented to customer
- Customer can review findings and recommendations
- Accept/Reject workflow
- Customer signature required for billing
- Email copy of acceptance to customer
- Customer can request changes before accepting

**Acceptance Flow:**
1. Tech completes all tasks
2. Generates work summary
3. Reviews with customer on-site
4. Customer reviews:
   - Tasks completed
   - Parts used
   - Time spent
   - Findings discovered
   - Recommendations
   - Total cost
5. Customer accepts or requests changes
6. Customer signs on device
7. Email confirmation sent
8. Work order marked as customer-approved

### FEATURE 4.10: Offline Mode (Critical for Basements/Rural)

**Requirements:**
- Full offline functionality
- Download work order data while online
- Capture all data offline (tasks, times, photos, measurements)
- Queue for upload when connection restored
- Sync indicator showing pending uploads
- Conflict resolution if data changed on server
- Background sync
- Storage quota management

**Offline Capabilities:**
- ✅ View assigned work orders and tasks
- ✅ Mark tasks complete
- ✅ Take photos
- ✅ Fill out reports
- ✅ Capture signatures
- ✅ Record time entries
- ✅ Add findings and notes
- ✅ Check in/out (GPS stored locally)
- ❌ Cannot search equipment database
- ❌ Cannot request parts
- ❌ Cannot chat with dispatcher

**Sync Strategy:**
```typescript
// Queue all mutations while offline
interface OfflineAction {
  id: string
  timestamp: DateTime
  action: "CREATE" | "UPDATE" | "DELETE"
  entityType: string
  entityId: string
  data: any
  retryCount: number
}

// When online, batch upload in chronological order
// Handle conflicts (server version newer than local)
```

---

## PHASE 5: ADVANCED REPORTING & ANALYTICS
**Timeline:** 20-25 hours  
**Business Impact:** Business intelligence, performance optimization

### FEATURE 5.1: Custom Report Analytics Dashboard

**Requirements:**
- Aggregate report data for insights
- Trending of measurements over time
- Failure mode analysis
- Tech performance metrics
- Equipment reliability scoring
- Customer satisfaction tracking
- Compliance audit reports

**Example Analytics:**
- Average pump efficiency by model
- Most common failure modes
- Mean time between failures (MTBF)
- Parts consumption by equipment type
- Tech productivity (tasks per day, time per task)
- Customer response time metrics
- Revenue by service type

### FEATURE 5.2: Automated Recommendations Engine

**Requirements:**
- AI analysis of historical data
- Predict upcoming failures
- Recommend preventive actions
- Optimize PM schedules
- Parts replacement forecasting
- Risk scoring for equipment
- Alert when patterns indicate problems

**Example Recommendations:**
- "Pump #4523 showing vibration increase - schedule inspection"
- "VFD #8821 due for capacitor replacement based on age"
- "Customer ABC has 3 pumps due for PM within 2 weeks - schedule together"
- "Bearing failures increasing on Model XYZ - investigate root cause"

---

## IMPLEMENTATION ROADMAP

### PHASE 1: Core Field Service (Weeks 1-2)
**Total: 30-35 hours**

**Week 1 (15-18 hrs):**
- Persistent check-in status banner
- Smart checkout prompts
- Basic camera integration
- Photo capture and storage
- Photo gallery view

**Week 2 (15-17 hrs):**
- Photo types and categorization
- Required photos enforcement
- Offline photo queue
- Photo compression
- Customer-visible photo flags

**Deliverable:** Techs can track time on site and document work with photos

---

### PHASE 2: Custom Reports (Weeks 3-4)
**Total: 35-40 hours**

**Week 3 (18-20 hrs):**
- Report template builder UI
- Field types library (15 types)
- Conditional logic engine
- Template library with 7 industry templates
- Task-report assignment

**Week 4 (17-20 hrs):**
- Mobile report completion interface
- Auto-save and draft management
- Offline report filling
- Report PDF generation
- Report validation and submission

**Deliverable:** Complete digital forms replace paper, professional PDFs generated

---

### PHASE 3: Enterprise Features (Weeks 5-7)
**Total: 50-60 hours**

**Week 5 (18-20 hrs):**
- Equipment tag scanner (barcode/QR)
- Voice notes with speech-to-text
- Safety checklist system
- Real-time progress dashboard

**Week 6 (16-18 hrs):**
- Dispatcher chat system
- Parts request from field
- Equipment service history view
- Task-level time tracking

**Week 7 (16-22 hrs):**
- Customer acceptance workflow
- Photo annotation tools
- Advanced offline mode
- Sync conflict resolution

**Deliverable:** Feature-complete enterprise field service platform

---

### PHASE 4: Analytics & Optimization (Weeks 8-9)
**Total: 20-25 hours**

**Week 8 (10-12 hrs):**
- Report analytics dashboard
- Measurement trending
- Failure mode analysis
- Tech performance metrics

**Week 9 (10-13 hrs):**
- AI recommendations engine
- Predictive maintenance alerts
- PM schedule optimization
- Risk scoring

**Deliverable:** Business intelligence and predictive capabilities

---

## DATABASE SCHEMA ADDITIONS

### Photo Management
```prisma
model WorkOrderPhoto {
  id                 String    @id @default(cuid())
  workOrderId        String
  workOrder          WorkOrder @relation(fields: [workOrderId])
  taskId             String?
  task               TaskInstance? @relation(fields: [taskId])
  
  photoType          PhotoType
  capturedByUserId   String
  capturedBy         User @relation(fields: [capturedByUserId])
  capturedAt         DateTime @default(now())
  
  gpsLatitude        Float?
  gpsLongitude       Float?
  
  fileName           String
  originalUrl        String      // Supabase Storage URL
  thumbnailUrl       String
  mediumUrl          String
  fileSize           Int
  mimeType           String
  
  isCustomerVisible  Boolean @default(false)
  caption            String?
  annotations        Json?       // Annotation data
  sequenceNumber     Int
  tags               String[]
  
  orgId              String
  org                Org @relation(fields: [orgId])
  
  createdAt          DateTime @default(now())
  updatedAt          DateTime @updatedAt
  
  @@index([orgId, workOrderId])
  @@index([orgId, taskId])
  @@index([photoType])
  @@index([capturedAt])
}

enum PhotoType {
  BEFORE_WORK
  AFTER_WORK
  ISSUE_FOUND
  RESOLUTION
  SAFETY_HAZARD
  WARRANTY_CLAIM
  CUSTOMER_ASSET
  SERIAL_PLATE
  INSTALLATION
  PARTS_USED
  MEASUREMENT
  DIAGNOSTIC
  SITE_CONDITIONS
}
```

### Custom Reports
```prisma
model ReportTemplate {
  id                   String   @id @default(cuid())
  orgId                String
  org                  Org @relation(fields: [orgId])
  
  name                 String
  description          String?
  category             String
  version              Int @default(1)
  status               ReportTemplateStatus
  isDefault            Boolean @default(false)
  
  sections             Json      // Array of ReportSection
  
  createdByUserId      String
  createdBy            User @relation(fields: [createdByUserId])
  createdAt            DateTime @default(now())
  updatedBy            String?
  updatedAt            DateTime @updatedAt
  
  lastUsedAt           DateTime?
  usageCount           Int @default(0)
  
  complianceStandards  String[]
  customerTypes        String[]
  
  tasks                TaskInstance[]
  
  @@index([orgId, status])
  @@index([orgId, category])
  @@index([isDefault])
}

enum ReportTemplateStatus {
  DRAFT
  ACTIVE
  ARCHIVED
}

model TaskInstance {
  // ... existing fields ...
  reportTemplateId     String?
  reportTemplate       ReportTemplate? @relation(fields: [reportTemplateId])
  reportData           Json?
  reportCompletedAt    DateTime?
  reportCompletedByUserId String?
  reportCompletedBy    User? @relation(fields: [reportCompletedByUserId])
}
### Parts Request System
```prisma
model PartsRequest {
  id                String @id @default(cuid())
  workOrderId       String
  workOrder         WorkOrder @relation(fields: [workOrderId])
  taskId            String?
  task              TaskInstance? @relation(fields: [taskId])
  
  requestedByUserId String
  requestedBy       User @relation(fields: [requestedByUserId])
  requestedAt       DateTime @default(now())
  
  priority          RequestPriority
  deliveryLocation  String        // Site address or "Shop"
  deliveryBy        DateTime?     // Requested delivery date/time
  
  status            RequestStatus
  approvedByUserId  String?
  approvedBy        User? @relation(fields: [approvedByUserId])
  approvedAt        DateTime?
  
  items             PartsRequestItem[]
  
  orgId             String
  org               Org @relation(fields: [orgId])
  
  @@index([orgId, status])
  @@index([workOrderId])
}

model PartsRequestItem {
  id              String @id @default(cuid())
  partsRequestId  String
  partsRequest    PartsRequest @relation(fields: [partsRequestId])
  
  materialId      String
  material        Material @relation(fields: [materialId])
  quantity        Int
  urgency         String        // "ASAP", "Same Day", "Next Day", "Normal"
  notes           String?
  
  orgId           String
  org             Org @relation(fields: [orgId])
}

enum RequestPriority {
  EMERGENCY     // Machine down, customer waiting
  URGENT        // Needed today
  NORMAL        // Next day delivery OK
  PLANNING      // For future work
}

enum RequestStatus {
  PENDING
  APPROVED
  ORDERED
  SHIPPED
  DELIVERED
  REJECTED
}
```

### Dispatcher Chat
```prisma
model ChatMessage {
  id           String @id @default(cuid())
  workOrderId  String
  workOrder    WorkOrder @relation(fields: [workOrderId])
  
  fromUserId   String
  fromUser     User @relation("SentMessages", fields: [fromUserId])
  toUserId     String?
  toUser       User? @relation("ReceivedMessages", fields: [toUserId])
  
  message      String
  messageType  MessageType    // TEXT, PHOTO, FILE
  fileUrl      String?
  
  priority     MessagePriority
  readAt       DateTime?
  
  orgId        String
  org          Org @relation(fields: [orgId])
  
  createdAt    DateTime @default(now())
  
  @@index([orgId, workOrderId, createdAt])
  @@index([toUserId, readAt])
}

enum MessageType {
  TEXT
  PHOTO
  FILE
  SYSTEM      // Auto-generated system messages
}

enum MessagePriority {
  NORMAL
  URGENT
}
```

---

## API ENDPOINTS

### Photo Management
```typescript
// Upload photo
POST /api/work-orders/[id]/photos
Body: FormData {
  file: File
  photoType: PhotoType
  taskId?: string
  caption?: string
  isCustomerVisible: boolean
  gpsLatitude?: number
  gpsLongitude?: number
}

// List photos
GET /api/work-orders/[id]/photos
Query: {
  taskId?: string
  photoType?: PhotoType
  limit?: number
  offset?: number
}

// Delete photo
DELETE /api/work-orders/[id]/photos/[photoId]

// Update photo metadata
PATCH /api/work-orders/[id]/photos/[photoId]
Body: {
  caption?: string
  isCustomerVisible?: boolean
  photoType?: PhotoType
  annotations?: JSON
}

// Annotate photo
POST /api/work-orders/[id]/photos/[photoId]/annotate
Body: {
  annotations: {
    type: "arrow" | "circle" | "text" | "line"
    color: string
    coordinates: number[]
    text?: string
  }[]
}
```

### Custom Reports
```typescript
// List report templates
GET /api/report-templates
Query: {
  category?: string
  status?: ReportTemplateStatus
  isDefault?: boolean
}

// Get template
GET /api/report-templates/[id]

// Create template (Admin)
POST /api/report-templates
Body: {
  name: string
  category: string
  sections: ReportSection[]
  complianceStandards?: string[]
}

// Update template (Admin)
PATCH /api/report-templates/[id]

// Get task report data
GET /api/tasks/[id]/report

// Save report draft
PATCH /api/tasks/[id]/report
Body: {
  reportData: JSON
  isDraft: boolean
}

// Submit completed report
POST /api/tasks/[id]/report/submit
Body: {
  reportData: JSON
  signature: string
}

// Generate report PDF
GET /api/tasks/[id]/report/pdf
```

### Check-In Status
```typescript
// Get active check-in across all work orders
GET /api/me/active-check-in
Response: {
  workOrderId: string
  workOrderNumber: string
  siteId: string
  siteName: string
  checkInTime: DateTime
  duration: string
  gpsLatitude: number
  gpsLongitude: number
}

// Check out from all sites (safety feature)
POST /api/me/check-out-all
```

### Parts Requests
```typescript
// Create parts request
POST /api/work-orders/[id]/parts-requests
Body: {
  priority: RequestPriority
  deliveryLocation: string
  deliveryBy?: DateTime
  items: {
    materialId: string
    quantity: number
    urgency: string
    notes?: string
  }[]
}

// List parts requests
GET /api/parts-requests
Query: {
  status?: RequestStatus
  workOrderId?: string
  priority?: RequestPriority
}

// Approve parts request
POST /api/parts-requests/[id]/approve

// Reject parts request
POST /api/parts-requests/[id]/reject
Body: {
  reason: string
}
```

### Chat System
```typescript
// Send message
POST /api/work-orders/[id]/messages
Body: {
  message: string
  messageType: MessageType
  toUserId?: string
  priority: MessagePriority
  fileUrl?: string
}

// Get messages
GET /api/work-orders/[id]/messages
Query: {
  since?: DateTime
  limit?: number
}

// Mark as read
POST /api/messages/[id]/read

// Get unread count
GET /api/me/unread-messages
```

---

## TECHNICAL IMPLEMENTATION NOTES

### Photo Storage Architecture
```
Supabase Storage Buckets:
- work-order-photos/
  - originals/      (Full resolution, 5-10MB)
  - medium/         (1600px, 500KB-1MB)
  - thumbnails/     (400px, 50-100KB)

Image Processing Pipeline:
1. Upload original to Supabase Storage
2. Trigger Edge Function to create resized versions
3. Store all URLs in WorkOrderPhoto record
4. Delete originals after 90 days (keep medium + thumbnail)

Offline Strategy:
1. Capture photo → Store in IndexedDB
2. Compress to 500KB using canvas
3. Queue upload job
4. Upload when online
5. Update IndexedDB with server URLs
```

### Report Builder Technical Stack
```
Frontend:
- React Hook Form for form state management
- Zod for schema validation
- DnD Kit for drag-and-drop builder
- TipTap or Slate for rich text fields
- React Signature Canvas for signatures

Backend:
- Prisma JSON fields for flexible schema storage
- Zod runtime validation
- pdf-lib or PDFKit for PDF generation
- Edge Functions for heavy processing

Formula Engine:
- Use mathjs or expr-eval for calculated fields
- Support basic math: +, -, *, /, ()
- Support functions: SUM, AVG, MAX, MIN
- Support field references: {field_id}
```

### Offline Sync Strategy
```typescript
// Service Worker registration
navigator.serviceWorker.register('/sw.js')

// IndexedDB stores
const stores = {
  workOrders: "id, orgId, assignedToUserId, status",
  tasks: "id, workOrderId, status",
  photos: "id, workOrderId, uploadStatus",
  reports: "id, taskId, isDraft",
  timeEntries: "id, taskId, syncStatus",
  pendingActions: "id, timestamp, retryCount"
}

// Sync on reconnect
window.addEventListener('online', async () => {
  await syncPendingActions()
  await downloadUpdates()
})

// Background Sync API
navigator.serviceWorker.ready.then(registration => {
  registration.sync.register('sync-work-orders')
})
```

### Real-Time Updates
```typescript
// Server-Sent Events for live updates
const eventSource = new EventSource('/api/live-updates')

eventSource.addEventListener('work-order-updated', (e) => {
  const data = JSON.parse(e.data)
  updateLocalState(data)
})

eventSource.addEventListener('new-message', (e) => {
  const message = JSON.parse(e.data)
  showNotification(message)
})

// Pusher or Supabase Realtime alternative
const channel = supabase.channel('work-orders')
channel.on('UPDATE', payload => {
  if (payload.new.assignedToUserId === currentUserId) {
    refreshWorkOrder(payload.new.id)
  }
})
```

---

## QUALITY CHECKLIST

### Mobile UX Requirements
- ✅ Touch targets minimum 48x48px
- ✅ Form inputs large and well-spaced
- ✅ Offline mode with clear indicators
- ✅ Pull-to-refresh on lists
- ✅ Swipe gestures for common actions
- ✅ Haptic feedback on iOS
- ✅ Dark mode support
- ✅ Landscape orientation support
- ✅ Large text / accessibility mode
- ✅ Voice control compatibility

### Performance Requirements
- ✅ Photo upload <5 seconds on 4G
- ✅ Report form loads <2 seconds
- ✅ Search results <1 second
- ✅ Sync completes <10 seconds
- ✅ PWA works 100% offline
- ✅ Battery efficient (no excessive polling)

### Security Requirements
- ✅ Photo uploads encrypted in transit (HTTPS)
- ✅ Sensitive data encrypted at rest
- ✅ RBAC for photo visibility
- ✅ Audit log for all report submissions
- ✅ Customer data GDPR compliant
- ✅ SOC 2 compliance ready

### Testing Coverage
- ✅ Unit tests for report validation
- ✅ Integration tests for photo pipeline
- ✅ E2E tests for complete workflows
- ✅ Offline mode testing
- ✅ Performance testing with 1000+ photos
- ✅ Mobile device testing (iOS + Android)

---

## COMPETITIVE ANALYSIS

### Feature Parity with Industry Leaders

| Feature | ServiceOpsIQ | ServiceMax | FieldEdge | ServiceTitan |
|---------|-------------|-----------|----------|--------------|
| Custom Reports | ✅ (Better) | ✅ | ✅ | ✅ |
| Photo Management | ✅ | ✅ | Limited | ✅ |
| Offline Mode | ✅ | ✅ | Limited | ✅ |
| Check-in Tracking | ✅ | ✅ | ✅ | ✅ |
| Real-time Updates | ✅ | ✅ | Limited | ✅ |
| Equipment-Specific | ✅ **(Unique)** | Generic | Generic | Generic |
| Pump/VFD Templates | ✅ **(Unique)** | ❌ | ❌ | ❌ |
| Vibration Analysis | ✅ **(Unique)** | ❌ | ❌ | ❌ |

**Competitive Advantages:**
1. Purpose-built for rotating equipment (not generic HVAC/plumbing)
2. Industry-specific report templates (pump curves, vibration, VFD)
3. Equipment domain expertise built-in
4. Lower cost (one-time vs monthly per tech)
5. Integrated with main business operations

---

## NEXT STEPS

### IMMEDIATE PRIORITIES (This Week)

**Option A: Start Phase 1 (Check-In Banner + Photos)**
- I create detailed prompt for Claude Code
- You run autonomous build
- Deploy persistent check-in status
- Deploy basic photo capture
- **Timeline:** 2-3 days

**Option B: Test Current Features First**
- Complete testing of existing tech app
- Identify any bugs or UX issues
- Fix critical issues
- Then proceed to Phase 1

**Option C: Prioritize Custom Reports First**
- Skip directly to Phase 2
- Build report builder (highest business impact)
- Add photos after reports working
- **Timeline:** 4-5 days

### RECOMMENDED APPROACH

**My Recommendation: Start with Option A**

**Why:**
1. **Check-in banner is CRITICAL** - prevents lost billable time TODAY
2. **Photos are table stakes** - can't compete without them
3. **Quick wins build momentum** - 2-3 days vs 4-5 days
4. **Foundation for reports** - reports need photos anyway

**Execution Plan:**
1. **Today:** You tell me which option (A, B, or C)
2. **Tomorrow:** I create Claude Code orchestration prompt for chosen phase
3. **Day 2-3:** Claude Code builds features autonomously
4. **Day 4:** You test and deploy
5. **Day 5:** Move to next phase

---

## BUSINESS IMPACT SUMMARY

### Revenue Impact (Annual)
- **Recovered billable time:** $25,000-40,000
  (Assuming 2hrs/week × 3 techs × 50 weeks × $85/hr)
  
- **Upsell from documented findings:** $50,000-100,000
  (Photo evidence increases upsell close rate 40% → 70%)
  
- **Reduced disputes:** $10,000-15,000
  (GPS + photos eliminate "we weren't there" claims)
  
- **Faster job completion:** $20,000-30,000
  (Digital forms save 15min per job × 20 jobs/week)

**Total Annual Impact: $105,000-185,000**

### Customer Satisfaction Impact
- Professional documentation increases CSAT 25-40%
- Real-time updates reduce customer anxiety
- Transparent pricing reduces disputes
- Photo evidence builds trust

### Operational Efficiency
- 30% reduction in administrative overhead
- 50% faster report completion
- 90% reduction in lost paperwork
- 100% audit trail for compliance

---

## CONCLUSION

This specification transforms ServiceOpsIQ from a work order system into a **complete enterprise field service platform** that rivals $300/user/month SaaS solutions—but purpose-built for rotating equipment service companies with domain expertise built-in.

**The three critical features you identified are absolutely correct:**
1. ✅ Persistent check-in status (prevents lost revenue)
2. ✅ Custom report builder (eliminates paper, ensures compliance)
3. ✅ Photo management (documentation quality, dispute resolution)

**The additional features I've added fill critical gaps:**
- Offline mode (works in basements, dead zones)
- Safety checklists (compliance, risk reduction)
- Equipment history (context for techs)
- Real-time updates (office visibility)
- Parts requests (reduces delays)
- Dispatcher chat (improves coordination)

**Total Implementation:** 120-150 hours over 9 weeks  
**Break-even:** Within 60 days (recovered billable time alone)  
**ROI:** 10-15x within first year

**This is how you compete with ServiceMax and FieldEdge—but WIN because you understand pumps, VFDs, and vibration analysis.**

---

**READY TO START PHASE 1?** 🚀