# PHASE 1 EXECUTION INSTRUCTIONS

**Status:** Ready to build  
**Timeline:** 2-3 days with Claude Code  
**What You're Building:** Persistent check-in banner + Photo management system

---

## 🚀 HOW TO RUN THIS BUILD

### STEP 1: Open Claude Code Terminal

```bash
# In your project directory
cd "C:\Users\LanceReed\OneDrive - Global Pump Solutions\Documents\Lance Projects TechIQ Tech\ServiceOpsIQ program\Serviceops-ai"

# Start Claude Code
code .
```

Then open Claude Code panel (Ctrl+Shift+P → "Claude Code")

---

### STEP 2: Copy The Build Prompt

Open this file:
```
docs/PHASE_1_BUILD_PROMPT.md
```

**Copy the ENTIRE file contents** (all 1,443 lines)

---

### STEP 3: Paste Into Claude Code

In Claude Code terminal, paste the entire prompt and hit Enter.

Claude Code will:
1. Read the instructions
2. Create all files
3. Write all code
4. Run database migration
5. Test the build
6. Report completion status

**Do NOT interrupt while it's building!**

---

### STEP 4: Monitor Progress

Claude Code will output status updates:
```
✅ Created CheckInContext.tsx
✅ Created CheckInBanner.tsx  
✅ Created API endpoint: /api/me/active-check-in
✅ Added PhotoType enum to Prisma schema
✅ Created PhotoCapture component
✅ Created PhotoGallery component
...
```

**Estimated time:** 15-20 minutes for complete build

---

### STEP 5: Run Database Migration

After Claude Code finishes building, you'll need to run migration:

```powershell
npx prisma migrate dev --name add_photo_management_and_check_in_banner
npx prisma generate
```

---

### STEP 6: Test Locally

```powershell
npm run dev
```

Open: `http://localhost:3000/tech`

**Test Checklist:**
- [ ] Check in to a work order
- [ ] Banner appears at top
- [ ] Banner shows duration
- [ ] Quick checkout button works
- [ ] Add a photo
- [ ] Photo appears in gallery
- [ ] Filter photos by type
- [ ] Full-screen photo view works

---

### STEP 7: Deploy

```powershell
git add .
git commit -m "feat(phase1): Persistent check-in banner + photo management"
git push origin main
```

Vercel will auto-deploy (2-3 minutes)

---

## 📱 WHAT YOU'LL GET

### Persistent Check-In Banner
- Always visible when checked in
- Shows site name, work order, duration
- Color changes: Green → Orange (8hr) → Red (12hr)
- Quick checkout button
- Prevents lost billable time

### Photo Management System
- Camera integration (all devices)
- 13 photo categories
- Photo gallery with filters
- Full-screen viewer
- GPS coordinates captured
- Customer-visible flag
- Caption support
- Offline-ready (photos queue)

---

## 🐛 IF SOMETHING GOES WRONG

**Claude Code gets stuck:**
1. Press Ctrl+C to cancel
2. Review error message
3. Fix the specific issue
4. Re-run the build prompt

**Migration fails:**
```powershell
# Reset database to clean state
npx prisma migrate reset
# Then re-run migration
npx prisma migrate dev --name add_photo_management_and_check_in_banner
```

**TypeScript errors:**
```powershell
# Regenerate Prisma client
npx prisma generate
# Restart dev server
npm run dev
```

---

## ✅ SUCCESS CRITERIA

You'll know it worked when:
1. ✅ Tech app shows check-in banner when checked in
2. ✅ Banner disappears after checkout
3. ✅ Can capture photos from camera
4. ✅ Photos appear in gallery
5. ✅ Can filter photos by type
6. ✅ Full-screen photo view works
7. ✅ Zero TypeScript errors
8. ✅ Deployed to production successfully

---

## 📞 REPORT RESULTS

After testing, tell me:

**Format:**
```
✅ WORKING:
- Check-in banner
- Photo capture
- Photo gallery
- etc.

❌ ISSUES:
- [Describe what's broken]
- [Error messages]

⏱️ BUILD TIME:
- [How long did Claude Code take]
```

---

## 🎯 NEXT STEPS AFTER PHASE 1

Once Phase 1 is tested and deployed:

**Option A:** Start Phase 2 (Custom Reports) - 4-5 days
**Option B:** Add refinements to Phase 1 based on testing
**Option C:** Move to Phase 3 (Enterprise Features) - 7-8 days

**We'll decide based on Phase 1 test results.**

---

**Ready to build? Copy PHASE_1_BUILD_PROMPT.md to Claude Code!** 🚀