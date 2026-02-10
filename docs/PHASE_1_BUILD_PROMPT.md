# PHASE 1: PERSISTENT CHECK-IN STATUS + PHOTO MANAGEMENT SYSTEM
## Claude Code Autonomous Build Instructions

**Project:** ServiceOpsIQ Field Service Platform  
**Phase:** 1 of 4  
**Timeline:** Complete autonomous build (30-35 hours of development)  
**Quality Standard:** Enterprise-grade, production-ready code

---

## CONTEXT & BACKGROUND

You are building Phase 1 of an enterprise field service management platform for rotating equipment service companies (pumps, motors, VFDs). This is a $50,000 professional product that must compete with ServiceMax and FieldEdge.

**Existing Tech Stack:**
- Next.js 14+ with App Router
- TypeScript (strict mode)
- Prisma ORM with PostgreSQL (Supabase)
- Tailwind CSS
- React Hook Form + Zod validation
- Supabase Storage for file uploads
- Multi-tenant architecture (org-scoped everything)

**Current State:**
- Tech app exists at `/tech` route with basic work order and task viewing
- Check-in/out functionality exists but NO persistent status banner
- NO photo management system exists yet
- SignaturePad component exists and working
- Authentication via Supabase (getAuthContextFromSupabase)

**Your Mission:**
Build a complete persistent check-in tracking system + professional photo management system that prevents lost billable time and enables proper documentation.

---

## FEATURE 1: PERSISTENT CHECK-IN STATUS BANNER

### Business Requirement
Technicians frequently forget to check out from sites, resulting in lost billable time ($25K-40K annually). The check-in status must be ALWAYS VISIBLE across every page of the tech app.

### Technical Requirements

**Banner Visibility:**
- Appears on EVERY page when tech has an active check-in
- Sticky positioning at top of viewport (always visible when scrolling)
- Shows site name, work order number, duration, quick checkout button
- Color-coded by duration: Green (<8hrs), Orange (8-12hrs), Red (>12hrs)
- Real-time duration counter (updates every minute)

**Banner States:**
```typescript
interface ActiveCheckIn {
  checkInId: string
  workOrderId: string
  workOrderNumber: string
  siteId: string
  siteName: string
  checkInTime: Date
  duration: string  // "2h 34m"
  gpsLatitude?: number
  gpsLongitude?: number
  status: "ACTIVE" | "WARNING" | "CRITICAL"
}
```

**Duration Calculation:**
- ACTIVE (Green): 0-8 hours
- WARNING (Orange): 8-12 hours  
- CRITICAL (Red): 12+ hours

**UI Layout:**
```tsx
// Green banner (< 8 hours)
┌─────────────────────────────────────────────────────┐
│ 🟢 ON SITE: Acme Manufacturing - Site A            │
│ WO-1234 | Checked in 2h 34m ago | [Quick Checkout] │
└─────────────────────────────────────────────────────┘

// Orange banner (8-12 hours)
┌─────────────────────────────────────────────────────┐
│ ⚠️  LONG SHIFT: Acme Manufacturing - Site A        │
│ WO-1234 | Checked in 9h 15m ago | [Quick Checkout] │
└─────────────────────────────────────────────────────┘

// Red banner (12+ hours)
┌─────────────────────────────────────────────────────┐
│ 🚨 CRITICAL: Acme Manufacturing - Site A           │
│ WO-1234 | Checked in 13h 42m ago | [CHECKOUT NOW]  │
└─────────────────────────────────────────────────────┘
```

### Implementation Steps

**STEP 1: Create Check-In Context Provider**

File: `src/contexts/CheckInContext.tsx`

```typescript
"use client"

import { createContext, useContext, useState, useEffect, ReactNode } from "react"
import { useRouter } from "next/navigation"

interface ActiveCheckIn {
  checkInId: string
  workOrderId: string
  workOrderNumber: string
  siteId: string
  siteName: string
  checkInTime: Date
  duration: string
  gpsLatitude?: number
  gpsLongitude?: number
  status: "ACTIVE" | "WARNING" | "CRITICAL"
}

interface CheckInContextType {
  activeCheckIn: ActiveCheckIn | null
  refreshCheckIn: () => Promise<void>
  checkOut: () => Promise<void>
  isLoading: boolean
}

const CheckInContext = createContext<CheckInContextType | undefined>(undefined)

export function CheckInProvider({ children }: { children: ReactNode }) {
  const [activeCheckIn, setActiveCheckIn] = useState<ActiveCheckIn | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const router = useRouter()

  // Calculate duration and status from check-in time
  const calculateCheckInStatus = (checkInTime: Date): ActiveCheckIn["status"] => {
    const hours = (Date.now() - checkInTime.getTime()) / (1000 * 60 * 60)
    if (hours >= 12) return "CRITICAL"
    if (hours >= 8) return "WARNING"
    return "ACTIVE"
  }

  const formatDuration = (checkInTime: Date): string => {
    const diff = Date.now() - checkInTime.getTime()
    const hours = Math.floor(diff / (1000 * 60 * 60))
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
    return `${hours}h ${minutes}m`
  }

  // Fetch active check-in
  const refreshCheckIn = async () => {
    try {
      const response = await fetch("/api/me/active-check-in")
      if (response.ok) {
        const data = await response.json()
        if (data.checkIn) {
          const checkInTime = new Date(data.checkIn.checkInAt)
          setActiveCheckIn({
            checkInId: data.checkIn.id,
            workOrderId: data.checkIn.workOrderId,
            workOrderNumber: data.checkIn.workOrderNumber,
            siteId: data.checkIn.siteId,
            siteName: data.checkIn.siteName,
            checkInTime,
            duration: formatDuration(checkInTime),
            gpsLatitude: data.checkIn.gpsLatitude,
            gpsLongitude: data.checkIn.gpsLongitude,
            status: calculateCheckInStatus(checkInTime)
          })
        } else {
          setActiveCheckIn(null)
        }
      }
    } catch (error) {
      console.error("Failed to fetch active check-in:", error)
    } finally {
      setIsLoading(false)
    }
  }

  // Quick checkout
  const checkOut = async () => {
    if (!activeCheckIn) return
    
    try {
      const response = await fetch(
        `/api/work-orders/${activeCheckIn.workOrderId}/check-out`,
        { method: "POST" }
      )
      
      if (response.ok) {
        setActiveCheckIn(null)
        router.refresh()
      }
    } catch (error) {
      console.error("Quick checkout failed:", error)
      alert("Failed to check out. Please try again.")
    }
  }

  // Fetch on mount
  useEffect(() => {
    refreshCheckIn()
  }, [])

  // Update duration every minute
  useEffect(() => {
    if (!activeCheckIn) return

    const interval = setInterval(() => {
      const checkInTime = activeCheckIn.checkInTime
      setActiveCheckIn(prev => prev ? {
        ...prev,
        duration: formatDuration(checkInTime),
        status: calculateCheckInStatus(checkInTime)
      } : null)
    }, 60000) // Every 60 seconds

    return () => clearInterval(interval)
  }, [activeCheckIn])

  return (
    <CheckInContext.Provider value={{ activeCheckIn, refreshCheckIn, checkOut, isLoading }}>
      {children}
    </CheckInContext.Provider>
  )
}

export function useCheckIn() {
  const context = useContext(CheckInContext)
  if (!context) {
    throw new Error("useCheckIn must be used within CheckInProvider")
  }
  return context
}
```

**STEP 2: Create Check-In Status Banner Component**

File: `src/components/CheckInBanner.tsx`

```typescript
"use client"

import { useCheckIn } from "@/contexts/CheckInContext"
import Link from "next/link"

export function CheckInBanner() {
  const { activeCheckIn, checkOut, isLoading } = useCheckIn()

  if (isLoading || !activeCheckIn) return null

  const { status, siteName, workOrderNumber, workOrderId, duration } = activeCheckIn

  // Color scheme based on status
  const colorClasses = {
    ACTIVE: "bg-green-600 text-white",
    WARNING: "bg-orange-500 text-white",
    CRITICAL: "bg-red-600 text-white animate-pulse"
  }

  const icon = {
    ACTIVE: "🟢",
    WARNING: "⚠️",
    CRITICAL: "🚨"
  }

  const label = {
    ACTIVE: "ON SITE",
    WARNING: "LONG SHIFT",
    CRITICAL: "CRITICAL"
  }

  return (
    <div className={`sticky top-0 z-50 ${colorClasses[status]} px-4 py-3 shadow-lg`}>
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <span className="text-2xl flex-shrink-0">{icon[status]}</span>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-sm">
              {label[status]}: {siteName}
            </div>
            <div className="text-xs opacity-90 truncate">
              <Link 
                href={`/tech/work-orders/${workOrderId}`}
                className="hover:underline"
              >
                {workOrderNumber}
              </Link>
              {" | "}
              Checked in {duration} ago
            </div>
          </div>
        </div>

        <button
          onClick={checkOut}
          className={`
            px-4 py-2 rounded font-semibold text-sm whitespace-nowrap
            ${status === "CRITICAL" 
              ? "bg-white text-red-600 hover:bg-gray-100" 
              : "bg-white/20 hover:bg-white/30"
            }
            transition-colors
          `}
        >
          {status === "CRITICAL" ? "CHECKOUT NOW" : "Quick Checkout"}
        </button>
      </div>
    </div>
  )
}
```

**STEP 3: Add API Endpoint for Active Check-In**

File: `src/app/api/me/active-check-in/route.ts`

```typescript
import { NextResponse } from "next/server"
import { getAuthContextFromSupabase } from "@/lib/auth"
import prisma from "@/lib/prisma"

export async function GET() {
  const auth = await getAuthContextFromSupabase()
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    // Find active check-in for this user (no checkOutAt)
    const activeCheckIn = await prisma.siteCheckIn.findFirst({
      where: {
        userId: auth.userId,
        checkOutAt: null,
        orgId: auth.orgId
      },
      include: {
        workOrder: {
          include: {
            site: true
          }
        }
      },
      orderBy: {
        checkInAt: "desc"
      }
    })

    if (!activeCheckIn) {
      return NextResponse.json({ checkIn: null })
    }

    return NextResponse.json({
      checkIn: {
        id: activeCheckIn.id,
        workOrderId: activeCheckIn.workOrderId,
        workOrderNumber: activeCheckIn.workOrder.workOrderNumber,
        siteId: activeCheckIn.workOrder.siteId,
        siteName: activeCheckIn.workOrder.site.name,
        checkInAt: activeCheckIn.checkInAt,
        gpsLatitude: activeCheckIn.gpsLatitude,
        gpsLongitude: activeCheckIn.gpsLongitude
      }
    })
  } catch (error) {
    console.error("Failed to get active check-in:", error)
    return NextResponse.json(
      { error: "Failed to get active check-in" },
      { status: 500 }
    )
  }
}
```

**STEP 4: Wrap Tech App Layout with Check-In Provider**

File: `src/app/(tech)/layout.tsx`

Modify existing layout to add CheckInProvider and CheckInBanner:

```typescript
import Link from "next/link"
import { redirect } from "next/navigation"
import { Role } from "@prisma/client"
import { getAuthContextFromSupabase } from "@/lib/auth"
import { LogoutButton } from "@/components/LogoutButton"
import { CheckInProvider } from "@/contexts/CheckInContext"
import { CheckInBanner } from "@/components/CheckInBanner"

type NavLink = { href: string; label: string }

const navLinks: NavLink[] = [{ href: "/tech", label: "My Work" }]

export default async function TechLayout({ children }: { children: React.ReactNode }) {
  const auth = await getAuthContextFromSupabase()
  if (!auth) redirect("/login")

  // Allow TECH and ADMIN to access tech UI
  if (auth.role !== Role.TECH && auth.role !== Role.ADMIN) redirect("/dashboard")

  return (
    <CheckInProvider>
      <div className="shell">
        <CheckInBanner />
        
        <aside className="sidebar">
          <h1>Tech</h1>
          <nav className="nav">
            {navLinks.map((link) => (
              <Link key={link.href} href={link.href}>
                {link.label}
              </Link>
            ))}
          </nav>

          <div style={{ marginTop: "auto" }}>
            <LogoutButton />
          </div>
        </aside>

        <main className="main">{children}</main>
      </div>
    </CheckInProvider>
  )
}
```

**STEP 5: Update Check-In/Out Pages to Refresh Context**

Modify existing check-in/out functionality to call `refreshCheckIn()` after state changes.

In work order detail page, after successful check-in/out:

```typescript
import { useCheckIn } from "@/contexts/CheckInContext"

// Inside component
const { refreshCheckIn } = useCheckIn()

// After check-in success
await refreshCheckIn()

// After check-out success  
await refreshCheckIn()
```

---

## FEATURE 2: PHOTO MANAGEMENT SYSTEM

### Business Requirement
Professional field service requires visual documentation. Techs must be able to capture unlimited photos with proper categorization, work offline, and have photos automatically organized and accessible.

### Technical Requirements

**Photo Categories:**
```typescript
enum PhotoType {
  BEFORE_WORK = "BEFORE_WORK"
  AFTER_WORK = "AFTER_WORK"
  ISSUE_FOUND = "ISSUE_FOUND"
  RESOLUTION = "RESOLUTION"
  SAFETY_HAZARD = "SAFETY_HAZARD"
  WARRANTY_CLAIM = "WARRANTY_CLAIM"
  CUSTOMER_ASSET = "CUSTOMER_ASSET"
  SERIAL_PLATE = "SERIAL_PLATE"
  INSTALLATION = "INSTALLATION"
  PARTS_USED = "PARTS_USED"
  MEASUREMENT = "MEASUREMENT"
  DIAGNOSTIC = "DIAGNOSTIC"
  SITE_CONDITIONS = "SITE_CONDITIONS"
}
```

**Photo Metadata:**
- File name, size, MIME type
- Capture timestamp
- GPS coordinates (if available)
- Photo type/category
- Optional caption
- Customer-visible flag
- Link to work order and optionally task
- Sequence number for ordering

**Storage Strategy:**
- Original: Supabase Storage (full resolution)
- Thumbnail: Auto-generated 400x400px
- Medium: Auto-generated 1200x1200px

### Implementation Steps

**STEP 1: Add Photo Schema to Prisma**

File: `prisma/schema.prisma`

Add to existing schema:

```prisma
model WorkOrderPhoto {
  id                 String    @id @default(cuid())
  workOrderId        String
  workOrder          WorkOrder @relation(fields: [workOrderId], references: [id], onDelete: Cascade)
  taskId             String?
  task               TaskInstance? @relation(fields: [taskId], references: [id], onDelete: SetNull)
  
  photoType          PhotoType
  capturedByUserId   String
  capturedBy         User @relation(fields: [capturedByUserId], references: [id])
  capturedAt         DateTime @default(now())
  
  gpsLatitude        Float?
  gpsLongitude       Float?
  
  fileName           String
  originalUrl        String
  thumbnailUrl       String?
  mediumUrl          String?
  fileSize           Int
  mimeType           String
  
  isCustomerVisible  Boolean @default(false)
  caption            String?
  sequenceNumber     Int
  tags               String[]
  
  orgId              String
  org                Org @relation(fields: [orgId], references: [id], onDelete: Cascade)
  
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

**STEP 2: Create Photo Upload Utility**

File: `src/lib/photo-upload.ts`

```typescript
import { createClient } from "@/lib/supabase/client"

export async function uploadPhoto(file: File, workOrderId: string) {
  const supabase = createClient()
  
  // Generate unique filename
  const fileExt = file.name.split('.').pop()
  const fileName = `${workOrderId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`
  const filePath = `work-order-photos/${fileName}`

  // Upload to Supabase Storage
  const { data, error } = await supabase.storage
    .from('work-order-photos')
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: false
    })

  if (error) {
    throw new Error(`Upload failed: ${error.message}`)
  }

  // Get public URL
  const { data: { publicUrl } } = supabase.storage
    .from('work-order-photos')
    .getPublicUrl(filePath)

  return {
    fileName: file.name,
    storagePath: filePath,
    publicUrl,
    fileSize: file.size,
    mimeType: file.type
  }
}

export async function compressImage(file: File, maxWidth: number = 1200): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    
    reader.onload = (e) => {
      const img = new Image()
      
      img.onload = () => {
        const canvas = document.createElement('canvas')
        let width = img.width
        let height = img.height
        
        // Calculate new dimensions
        if (width > maxWidth) {
          height = (height * maxWidth) / width
          width = maxWidth
        }
        
        canvas.width = width
        canvas.height = height
        
        const ctx = canvas.getContext('2d')!
        ctx.drawImage(img, 0, 0, width, height)
        
        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(blob)
            } else {
              reject(new Error('Canvas to Blob conversion failed'))
            }
          },
          'image/jpeg',
          0.85
        )
      }
      
      img.onerror = reject
      img.src = e.target?.result as string
    }
    
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}
```

**STEP 3: Create Photo Upload API Endpoint**

File: `src/app/api/work-orders/[id]/photos/route.ts`

```typescript
import { NextRequest, NextResponse } from "next/server"
import { getAuthContextFromSupabase } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { uploadPhoto } from "@/lib/photo-upload"
import { PhotoType } from "@prisma/client"

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await getAuthContextFromSupabase()
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const workOrderId = params.id

  try {
    const formData = await request.formData()
    const file = formData.get("file") as File
    const photoType = formData.get("photoType") as PhotoType
    const taskId = formData.get("taskId") as string | null
    const caption = formData.get("caption") as string | null
    const isCustomerVisible = formData.get("isCustomerVisible") === "true"
    const gpsLatitude = formData.get("gpsLatitude") ? parseFloat(formData.get("gpsLatitude") as string) : null
    const gpsLongitude = formData.get("gpsLongitude") ? parseFloat(formData.get("gpsLongitude") as string) : null

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 })
    }

    // Verify work order exists and user has access
    const workOrder = await prisma.workOrder.findUnique({
      where: { id: workOrderId, orgId: auth.orgId },
      select: { id: true }
    })

    if (!workOrder) {
      return NextResponse.json({ error: "Work order not found" }, { status: 404 })
    }

    // Upload file to storage
    const uploadResult = await uploadPhoto(file, workOrderId)

    // Get next sequence number
    const maxSeq = await prisma.workOrderPhoto.aggregate({
      where: { workOrderId, orgId: auth.orgId },
      _max: { sequenceNumber: true }
    })
    const sequenceNumber = (maxSeq._max.sequenceNumber || 0) + 1

    // Create photo record
    const photo = await prisma.workOrderPhoto.create({
      data: {
        workOrderId,
        taskId: taskId || undefined,
        photoType,
        capturedByUserId: auth.userId,
        fileName: uploadResult.fileName,
        originalUrl: uploadResult.publicUrl,
        fileSize: uploadResult.fileSize,
        mimeType: uploadResult.mimeType,
        isCustomerVisible,
        caption,
        gpsLatitude,
        gpsLongitude,
        sequenceNumber,
        orgId: auth.orgId
      },
      include: {
        capturedBy: {
          select: {
            firstName: true,
            lastName: true
          }
        }
      }
    })

    return NextResponse.json({ photo })
  } catch (error) {
    console.error("Photo upload failed:", error)
    return NextResponse.json(
      { error: "Failed to upload photo" },
      { status: 500 }
    )
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await getAuthContextFromSupabase()
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const workOrderId = params.id
  const { searchParams } = new URL(request.url)
  const photoType = searchParams.get("photoType") as PhotoType | null
  const taskId = searchParams.get("taskId")

  try {
    const where: any = {
      workOrderId,
      orgId: auth.orgId
    }

    if (photoType) where.photoType = photoType
    if (taskId) where.taskId = taskId

    const photos = await prisma.workOrderPhoto.findMany({
      where,
      include: {
        capturedBy: {
          select: {
            firstName: true,
            lastName: true
          }
        },
        task: {
          select: {
            title: true
          }
        }
      },
      orderBy: {
        sequenceNumber: "asc"
      }
    })

    return NextResponse.json({ photos })
  } catch (error) {
    console.error("Failed to fetch photos:", error)
    return NextResponse.json(
      { error: "Failed to fetch photos" },
      { status: 500 }
    )
  }
}
```

**STEP 4: Create Photo Capture Component**

File: `src/components/PhotoCapture.tsx`

```typescript
"use client"

import { useState, useRef } from "react"
import { PhotoType } from "@prisma/client"

interface PhotoCaptureProps {
  workOrderId: string
  taskId?: string
  onPhotoUploaded: () => void
}

const PHOTO_TYPE_LABELS: Record<PhotoType, string> = {
  BEFORE_WORK: "Before Work",
  AFTER_WORK: "After Work",
  ISSUE_FOUND: "Issue Found",
  RESOLUTION: "Resolution/Fix",
  SAFETY_HAZARD: "Safety Hazard",
  WARRANTY_CLAIM: "Warranty Claim",
  CUSTOMER_ASSET: "Customer Asset",
  SERIAL_PLATE: "Serial/Nameplate",
  INSTALLATION: "Installation",
  PARTS_USED: "Parts Used",
  MEASUREMENT: "Measurement",
  DIAGNOSTIC: "Diagnostic",
  SITE_CONDITIONS: "Site Conditions"
}

export function PhotoCapture({ workOrderId, taskId, onPhotoUploaded }: PhotoCaptureProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [photoType, setPhotoType] = useState<PhotoType>(PhotoType.CUSTOMER_ASSET)
  const [caption, setCaption] = useState("")
  const [isCustomerVisible, setIsCustomerVisible] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [preview, setPreview] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setSelectedFile(file)
    
    // Create preview
    const reader = new FileReader()
    reader.onload = () => {
      setPreview(reader.result as string)
    }
    reader.readAsDataURL(file)
  }

  const handleUpload = async () => {
    if (!selectedFile) return

    setIsUploading(true)

    try {
      // Get GPS coordinates if available
      let gpsLatitude: number | null = null
      let gpsLongitude: number | null = null

      if (navigator.geolocation) {
        try {
          const position = await new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 })
          })
          gpsLatitude = position.coords.latitude
          gpsLongitude = position.coords.longitude
        } catch (err) {
          // GPS not available, continue without it
          console.log("GPS not available:", err)
        }
      }

      const formData = new FormData()
      formData.append("file", selectedFile)
      formData.append("photoType", photoType)
      formData.append("caption", caption)
      formData.append("isCustomerVisible", isCustomerVisible.toString())
      if (taskId) formData.append("taskId", taskId)
      if (gpsLatitude) formData.append("gpsLatitude", gpsLatitude.toString())
      if (gpsLongitude) formData.append("gpsLongitude", gpsLongitude.toString())

      const response = await fetch(`/api/work-orders/${workOrderId}/photos`, {
        method: "POST",
        body: formData
      })

      if (!response.ok) {
        throw new Error("Upload failed")
      }

      // Success
      setIsOpen(false)
      setPreview(null)
      setSelectedFile(null)
      setCaption("")
      setPhotoType(PhotoType.CUSTOMER_ASSET)
      setIsCustomerVisible(false)
      onPhotoUploaded()
    } catch (error) {
      console.error("Upload failed:", error)
      alert("Failed to upload photo. Please try again.")
    } finally {
      setIsUploading(false)
    }
  }

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="btn btn-primary"
      >
        📷 Add Photo
      </button>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold">Add Photo</h2>
            <button
              onClick={() => setIsOpen(false)}
              className="text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>
          </div>

          {!preview ? (
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleFileSelect}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full py-12 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors"
              >
                <div className="text-center">
                  <div className="text-4xl mb-2">📷</div>
                  <div className="text-lg font-medium text-gray-700">Take Photo</div>
                  <div className="text-sm text-gray-500 mt-1">or select from gallery</div>
                </div>
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <img
                  src={preview}
                  alt="Preview"
                  className="w-full rounded-lg"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Photo Type *
                </label>
                <select
                  value={photoType}
                  onChange={(e) => setPhotoType(e.target.value as PhotoType)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                >
                  {Object.entries(PHOTO_TYPE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Caption (Optional)
                </label>
                <textarea
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  placeholder="Add description..."
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>

              <div>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={isCustomerVisible}
                    onChange={(e) => setIsCustomerVisible(e.target.checked)}
                    className="rounded"
                  />
                  <span className="text-sm text-gray-700">
                    Customer can see this photo
                  </span>
                </label>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => {
                    setPreview(null)
                    setSelectedFile(null)
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Retake
                </button>
                <button
                  onClick={handleUpload}
                  disabled={isUploading}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                >
                  {isUploading ? "Uploading..." : "Save Photo"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
```

**STEP 5: Create Photo Gallery Component**

File: `src/components/PhotoGallery.tsx`

```typescript
"use client"

import { useState, useEffect } from "react"
import { PhotoType } from "@prisma/client"
import Image from "next/image"

interface Photo {
  id: string
  photoType: PhotoType
  fileName: string
  originalUrl: string
  caption: string | null
  capturedAt: string
  capturedBy: {
    firstName: string
    lastName: string
  }
  task: {
    title: string
  } | null
}

interface PhotoGalleryProps {
  workOrderId: string
  refreshTrigger?: number
}

const PHOTO_TYPE_LABELS: Record<PhotoType, string> = {
  BEFORE_WORK: "Before",
  AFTER_WORK: "After",
  ISSUE_FOUND: "Issue",
  RESOLUTION: "Fix",
  SAFETY_HAZARD: "Safety",
  WARRANTY_CLAIM: "Warranty",
  CUSTOMER_ASSET: "Asset",
  SERIAL_PLATE: "Serial",
  INSTALLATION: "Install",
  PARTS_USED: "Parts",
  MEASUREMENT: "Measurement",
  DIAGNOSTIC: "Diagnostic",
  SITE_CONDITIONS: "Site"
}

export function PhotoGallery({ workOrderId, refreshTrigger }: PhotoGalleryProps) {
  const [photos, setPhotos] = useState<Photo[]>([])
  const [filter, setFilter] = useState<PhotoType | "ALL">("ALL")
  const [isLoading, setIsLoading] = useState(true)
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null)

  const fetchPhotos = async () => {
    setIsLoading(true)
    try {
      const url = filter === "ALL"
        ? `/api/work-orders/${workOrderId}/photos`
        : `/api/work-orders/${workOrderId}/photos?photoType=${filter}`
      
      const response = await fetch(url)
      if (response.ok) {
        const data = await response.json()
        setPhotos(data.photos)
      }
    } catch (error) {
      console.error("Failed to fetch photos:", error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchPhotos()
  }, [workOrderId, filter, refreshTrigger])

  if (isLoading) {
    return <div className="text-center py-8 text-gray-500">Loading photos...</div>
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold">
          Photos ({photos.length})
        </h3>
        
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value as PhotoType | "ALL")}
          className="px-3 py-1 border border-gray-300 rounded-md text-sm"
        >
          <option value="ALL">All Types</option>
          {Object.entries(PHOTO_TYPE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {photos.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
          <div className="text-gray-400 text-4xl mb-2">📷</div>
          <div className="text-gray-600">No photos yet</div>
          <div className="text-sm text-gray-500 mt-1">Add photos to document your work</div>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {photos.map((photo) => (
            <div
              key={photo.id}
              onClick={() => setSelectedPhoto(photo)}
              className="cursor-pointer group"
            >
              <div className="relative aspect-square bg-gray-100 rounded-lg overflow-hidden">
                <img
                  src={photo.originalUrl}
                  alt={photo.caption || photo.photoType}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                />
              </div>
              <div className="mt-2 text-xs">
                <div className="font-medium text-gray-700">
                  {PHOTO_TYPE_LABELS[photo.photoType]}
                </div>
                <div className="text-gray-500">
                  {new Date(photo.capturedAt).toLocaleTimeString()}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Full Screen Modal */}
      {selectedPhoto && (
        <div
          className="fixed inset-0 bg-black/90 flex items-center justify-center p-4 z-50"
          onClick={() => setSelectedPhoto(null)}
        >
          <div className="max-w-4xl w-full">
            <button
              onClick={() => setSelectedPhoto(null)}
              className="absolute top-4 right-4 text-white text-3xl hover:text-gray-300"
            >
              ✕
            </button>
            
            <img
              src={selectedPhoto.originalUrl}
              alt={selectedPhoto.caption || selectedPhoto.photoType}
              className="w-full h-auto rounded-lg"
            />
            
            <div className="mt-4 text-white">
              <div className="text-lg font-semibold">
                {PHOTO_TYPE_LABELS[selectedPhoto.photoType]}
              </div>
              {selectedPhoto.caption && (
                <div className="text-gray-300 mt-1">{selectedPhoto.caption}</div>
              )}
              <div className="text-sm text-gray-400 mt-2">
                {selectedPhoto.capturedBy.firstName} {selectedPhoto.capturedBy.lastName} • {' '}
                {new Date(selectedPhoto.capturedAt).toLocaleString()}
              </div>
              {selectedPhoto.task && (
                <div className="text-sm text-gray-400">
                  Task: {selectedPhoto.task.title}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
```

**STEP 6: Add Photos to Work Order Detail Page**

Modify: `src/app/(tech)/tech/work-orders/[id]/page.tsx`

Add photo management section:

```typescript
import { PhotoCapture } from "@/components/PhotoCapture"
import { PhotoGallery } from "@/components/PhotoGallery"

// Inside component
const [photoRefreshTrigger, setPhotoRefreshTrigger] = useState(0)

// Add this section after Site Attendance and before Tasks
<section className="card">
  <div className="flex items-center justify-between mb-4">
    <h2 className="text-xl font-semibold">Photos & Documentation</h2>
    <PhotoCapture
      workOrderId={workOrder.id}
      onPhotoUploaded={() => setPhotoRefreshTrigger(prev => prev + 1)}
    />
  </div>
  
  <PhotoGallery
    workOrderId={workOrder.id}
    refreshTrigger={photoRefreshTrigger}
  />
</section>
```

**STEP 7: Configure Supabase Storage Bucket**

Create storage bucket via Supabase Dashboard or SQL:

```sql
-- Create storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('work-order-photos', 'work-order-photos', true);

-- Set up RLS policies
CREATE POLICY "Users can upload photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'work-order-photos');

CREATE POLICY "Users can view photos"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'work-order-photos');

CREATE POLICY "Users can delete own photos"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'work-order-photos');
```

---

## STEP 8: Run Database Migration

```bash
npx prisma migrate dev --name add_photo_management_and_check_in_banner
npx prisma generate
```

---

## STEP 9: Testing Checklist

**Check-In Banner:**
- [ ] Banner appears when checked in
- [ ] Shows correct work order and site
- [ ] Duration updates every minute
- [ ] Color changes at 8hr (orange) and 12hr (red)
- [ ] Quick checkout button works
- [ ] Banner disappears after checkout
- [ ] Banner persists across page navigation
- [ ] Banner visible on all tech app pages

**Photo Management:**
- [ ] Can capture photo from camera
- [ ] Can select photo from gallery
- [ ] Preview shows before upload
- [ ] Can select photo type
- [ ] Can add caption
- [ ] Customer visible checkbox works
- [ ] GPS coordinates captured (when available)
- [ ] Photo uploads successfully
- [ ] Photo appears in gallery
- [ ] Gallery grid layout works
- [ ] Filter by photo type works
- [ ] Full-screen modal opens on click
- [ ] Mobile camera integration works
- [ ] Works on iOS and Android

---

## QUALITY STANDARDS

**Code Quality:**
- ✅ TypeScript strict mode, no `any` types
- ✅ All components properly typed
- ✅ Error handling on all API calls
- ✅ Loading states for async operations
- ✅ Proper cleanup in useEffect hooks
- ✅ Accessibility (ARIA labels, keyboard navigation)

**Mobile UX:**
- ✅ Touch targets minimum 48x48px
- ✅ Responsive design (works 390px+)
- ✅ Camera access works on iOS/Android
- ✅ File input accepts camera photos
- ✅ Photo preview fits on screen
- ✅ Gallery scrollable and touch-friendly

**Performance:**
- ✅ Photo compression before upload
- ✅ Lazy loading for photo gallery
- ✅ Debounced search/filter
- ✅ Optimistic UI updates
- ✅ Context only re-renders when needed

**Security:**
- ✅ All queries org-scoped
- ✅ File upload validation (size, type)
- ✅ Storage bucket policies configured
- ✅ User authorization checks on all endpoints

---

## DEPLOYMENT CHECKLIST

- [ ] Database migration ran successfully
- [ ] Prisma client regenerated
- [ ] Supabase storage bucket created
- [ ] Storage policies configured
- [ ] All TypeScript errors resolved
- [ ] All files created in correct locations
- [ ] Git commit with descriptive message
- [ ] Push to repository
- [ ] Vercel auto-deploy triggered
- [ ] Test on deployed environment
- [ ] Test on mobile device (iOS + Android)

---

## COMMIT MESSAGE

```
feat(phase1): Add persistent check-in banner + photo management system

PERSISTENT CHECK-IN STATUS:
- Always-visible banner when tech checked in to site
- Color-coded by duration (green/orange/red)
- Real-time duration counter
- Quick checkout button
- Context provider for app-wide state
- Active check-in API endpoint

PHOTO MANAGEMENT:
- Camera integration (iOS, Android, desktop)
- 13 photo categories/types
- Photo gallery with filters
- Full-screen photo viewer
- GPS coordinate capture
- Customer-visible flag
- Caption and metadata
- Supabase Storage integration
- Mobile-optimized upload flow

Database:
- WorkOrderPhoto model with full metadata
- PhotoType enum with 13 categories
- Indexes for performance
- Cascade deletes configured

API Endpoints:
- POST /api/work-orders/[id]/photos (upload)
- GET /api/work-orders/[id]/photos (list with filters)
- GET /api/me/active-check-in (current status)

Components:
- CheckInProvider context
- CheckInBanner sticky header
- PhotoCapture modal with camera
- PhotoGallery grid with filters
- Photo preview and full-screen viewer

Mobile:
- Camera capture from device
- Touch-optimized UI
- Responsive gallery grid
- Works offline (photos queue for upload)

Business Impact:
- Prevents lost billable time ($25K-40K/year)
- Professional photo documentation
- GPS proof of site visits
- Customer-facing photo portal ready
```

---

## SUCCESS CRITERIA

✅ **Tech app has persistent check-in banner**
✅ **Banner updates in real-time**
✅ **Photos can be captured and uploaded**
✅ **Photos organized by type**
✅ **Gallery view works on mobile**
✅ **GPS coordinates captured**
✅ **Works on iOS, Android, desktop**
✅ **Zero TypeScript errors**
✅ **All tests pass**
✅ **Production deployed successfully**

---

**YOU ARE AUTHORIZED TO:**
- Make all technical decisions within the specifications
- Choose optimal implementations
- Add helper functions as needed
- Refactor for clarity and performance
- Fix bugs discovered during implementation
- Add TypeScript types as needed
- Create utility files for shared logic

**DO NOT:**
- Skip error handling
- Use `any` types
- Leave console.logs in production code
- Skip mobile testing
- Deploy without migration

**BUILD WITH PRIDE. THIS IS ENTERPRISE SOFTWARE.** 🚀