# CLAUDE CODE ORCHESTRATION WORKFLOW
## How to Use Claude.ai as Command Center for Claude Code

---

## THE THREE-PLAYER SYSTEM

```
┌─────────────────────────────────────────────────────────────┐
│                                                               │
│  YOU (Lance) ←→ ME (Claude.ai) ←→ CLAUDE CODE                │
│                                                               │
│  Strategic      Architect          Builder                   │
│  Director       & Translator       & Executor                │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

---

## YOUR ROLE: The Strategic Director

**What you do:**
- Tell me what you want in plain language
- Make business decisions
- Provide domain expertise
- Test completed features
- Give feedback

**What you DON'T do:**
- Write detailed technical specs (I do that)
- Debug code yourself (Claude Code does that)
- Worry about implementation details

**Example:**
```
YOU: "I need techs to be able to get customer signatures"

Not: "Create a SignaturePad component with canvas element 
and base64 encoding..."
```

---

## MY ROLE: The Architect & Translator

**What I do:**
- Analyze your requirements
- Design system architecture
- Create detailed technical specifications
- Generate perfect prompts for Claude Code
- Interpret Claude Code's responses
- Plan next steps
- Debug and problem-solve

**What I provide to Claude Code:**
- Exact file locations
- Database schema changes
- API endpoint specifications
- UI component requirements
- Testing protocols
- Error handling strategies

---

## CLAUDE CODE'S ROLE: The Builder & Executor

**What it does:**
- Reads my detailed specifications
- Writes production code
- Creates database migrations
- Builds UI components
- Tests implementations
- Commits to git
- Reports status back

**What it doesn't do:**
- Make strategic decisions
- Guess at requirements
- Skip steps
- Deploy without verification

---

## THE WORKFLOW

### STEP 1: You Tell Me What You Want

**Good Request Examples:**
```
✅ "I need techs to sign off on work orders"
✅ "The tech app needs to work offline"
✅ "Add a findings section where techs document problems"
✅ "Build the complete tech app we discussed"
```

**What I Do:**
- Ask clarifying questions if needed
- Design the complete solution
- Break into logical components
- Create detailed technical specs

---

### STEP 2: I Create Claude Code Instructions

**I generate:**
- Complete technical specifications
- Database schema changes
- API endpoint designs
- UI component requirements
- Testing checklists
- File locations
- Code patterns to follow

**Example Output:**
```markdown
# TECH APP SIGNATURE SYSTEM

## Database Migration
```prisma
model WorkOrderSignature {
  id String @id @default(cuid())
  workOrderId String
  signatureType String
  signatureData String @db.Text
  ...
}
```

## Component: /src/components/SignaturePad.tsx
- Canvas-based drawing
- Touch and mouse support
- Export as base64 PNG
- Clear/retry functionality

## API: POST /api/work-orders/[id]/signatures
...
```

---

### STEP 3: You Copy & Paste to Claude Code

**I tell you:**
```
"Copy this prompt and paste it into Claude Code:"

[Detailed technical prompt here]
```

**You do:**
1. Copy the entire prompt
2. Open Claude Code in terminal
3. Paste and run
4. Let it work (don't interrupt)
5. Come back when it says "DONE" or asks questions

---

### STEP 4: Claude Code Reports Back

**Claude Code will tell you:**
```
✅ COMPLETED: Signature Capture System
- Created: /src/components/SignaturePad.tsx (150 lines)
- Created: /src/app/api/work-orders/[id]/signatures/route.ts (80 lines)
- Database: Added WorkOrderSignature model
- Migration: Ran npx prisma migrate dev
- Testing: Verified signature capture and save
- Commit: feat: Add signature capture system

🚧 READY FOR: Customer signature integration in work order completion flow
```

---

### STEP 5: You Tell Me Claude Code's Response

**You copy/paste to me:**
```
"Claude Code says:

✅ COMPLETED: Signature Capture System
- Created: /src/components/SignaturePad.tsx
..."
```

---

### STEP 6: I Analyze & Plan Next Steps

**I do:**
- Verify completion
- Check for issues
- Plan next component
- Generate next prompt OR
- Ask you for decisions if needed

**I tell you:**
```
"Perfect! Signature system complete.

Next up: Work Order Completion Flow

This requires:
- Modal with signature verification
- Email generation
- PDF attachment

Ready to build? I'll give you the prompt."
```

---

### STEP 7: Repeat Until Complete

The cycle continues:
```
You → Me → Prompt → Claude Code → Result → You → Me → Next Prompt
```

---

## HANDLING QUESTIONS

### When Claude Code Asks Questions

**Claude Code might say:**
```
❓ QUESTION: Should findings automatically create follow-up work orders,
or require manual conversion?
```

**You tell me:** "Claude Code is asking about findings..."

**I respond:** "Tell Claude Code: Manual conversion with checkbox"

**You tell Claude Code:** (paste my exact answer)

---

### When I Need Clarification

**I might ask:**
```
"Should customer signatures be required before work order completion,
or optional?"
```

**You answer:** "Required"

**I respond:** "Got it. Updated the spec. Ready for the prompt?"

---

## EXAMPLE COMPLETE CYCLE

### **Cycle Start:**

**YOU:** "I want the tech app to be field-ready"

**ME:** "I've analyzed the gaps. Here are the 7 critical components:
1. Work Order Detail
2. Signatures
3. Completion Flow
4. Navigation
5. Findings
6. PDF Reports
7. Mobile Polish

Should I build all of them?"

**YOU:** "Yes, build it all"

**ME:** "Perfect. Here's the prompt for Claude Code..."

[I provide massive detailed prompt]

---

### **You Run Claude Code:**

```bash
$ claude code
> [paste my prompt]
```

---

### **Claude Code Works:**

```
🚧 Building Component 1: Work Order Detail Page
✅ Created /src/app/(tech)/tech/work-orders/[id]/page.tsx
✅ Created API /src/app/api/tech/work-orders/[id]/route.ts
✅ Added customer tap-to-call functionality
✅ Added directions button
✅ Testing: Verified mobile responsiveness

🚧 Building Component 2: Signature System
...
```

---

### **Claude Code Reports:**

```
✅ COMPLETED ALL 7 COMPONENTS

Summary:
- 12 files created
- 3 database models added
- 8 API endpoints created
- All tests passing
- Committed: feat: Complete field technician app

⚠️ NEEDS TESTING:
- PDF generation on work order completion
- Signature capture on touch devices
- Offline mode (Phase 2)
```

---

### **You Tell Me:**

"Claude Code finished! Says it completed all 7 components.
It's asking me to test PDF and signatures."

---

### **I Respond:**

"Excellent! The core tech app is complete.

**Test These Now:**
1. Open /tech/work-orders/[id] on your phone
2. Tap customer phone number (should dial)
3. Tap Get Directions (should open maps)
4. Open a task, add a finding
5. Complete work order, capture signatures
6. Verify email sent with PDF

**Then come back and tell me:**
- What works ✅
- What's broken ❌
- What feels off ⚠️

We'll fix any issues before moving to Phase 2 (offline mode)."

---

## WHEN THINGS GO WRONG

### Error: "TypeScript compilation failed"

**Claude Code says:** "❌ ERROR: Type 'string | undefined' not assignable..."

**You tell me:** "Claude Code hit a TypeScript error: [paste error]"

**I analyze** and respond: "Tell Claude Code to add this fix..."

---

### Error: "Migration failed"

**Claude Code says:** "❌ ERROR: Migration failed due to constraint..."

**YOU tell me:** "Migration error: [paste error]"

**I respond:** "Tell Claude Code to rollback and use this approach instead..."

---

### Error: "Cannot find module"

**Claude Code says:** "❌ ERROR: Cannot find module '@/components/...'"

**You tell me:** "Import error: [paste error]"

**I respond:** "Tell Claude Code the path should be..."

---

## ADVANCED: PARALLEL WORKFLOWS

You can run multiple Claude Code instances for different tasks:

**Terminal 1: Frontend**
```
Building UI components...
```

**Terminal 2: Backend**
```
Building API endpoints...
```

**I coordinate both** through you:
- Give you Prompt A for Terminal 1
- Give you Prompt B for Terminal 2
- They work simultaneously
- Both report back to me through you

---

## QUALITY CONTROL CHECKPOINTS

### After Each Major Component:

**I ask you:**
```
"Component X is complete. Before moving on:

1. Test the feature
2. Check it works on mobile
3. Verify the UI looks professional
4. Confirm it meets your expectations

Then tell me: Ship it or fix it?"
```

**You test** and report back

**I adjust** and we proceed

---

## BENEFITS OF THIS WORKFLOW

### ✅ For You:
- Speak plain English, not code
- Focus on business decisions
- No technical details to worry about
- Clear status updates
- Quality control at every step

### ✅ For Me (Claude.ai):
- Full context about your business
- Can plan holistically
- Design complete systems
- Catch issues early
- Optimize across components

### ✅ For Claude Code:
- Crystal-clear instructions
- No ambiguity
- Autonomous execution
- Focus on building, not deciding

---

## THE PERFECT SETUP CHECKLIST

- [x] Created `.claudecode/instructions.md` with your project standards
- [ ] Claude Code has access to your project folder
- [ ] You have this workflow doc open
- [ ] I (Claude.ai) am ready in another tab/window
- [ ] You're ready to relay messages between us

---

## START NOW

**Say to me:**

"Ready for orchestrated workflow. What should Claude Code build first?"

**I'll respond with:**

A perfectly scoped, detailed prompt for Claude Code to execute.

---

**LET'S BUILD SOMETHING INSANELY GREAT.** 🚀
