# Claude Code Setup Guide
## Quick Start for ServiceOpsIQ Development

---

## SETUP (One-Time Only)

### Step 1: Install Claude Code
```powershell
npm install -g @anthropic-ai/claude-code
```

### Step 2: Verify Installation
```powershell
claude --version
```

### Step 3: Navigate to Project
```powershell
cd "C:\Users\LanceReed\OneDrive - Global Pump Solutions\Documents\Lance Projects TechIQ Tech\ServiceOpsIQ program\Serviceops-ai"
```

### Step 4: Custom Instructions Already Created! ✅
The file `.claudecode/instructions.md` contains all your project-specific patterns.

Claude Code will automatically read this file and follow your standards.

---

## DAILY USAGE

### Option 1: Interactive Mode (Recommended)
```powershell
# Start Claude Code
claude code

# It will prompt you for instructions
# Paste the prompt from Claude.ai
# Press Enter twice to submit
# Let it run until complete
```

### Option 2: Direct Prompt Mode
```powershell
# For shorter tasks
claude code "Your prompt here"
```

### Option 3: File-Based Prompt
```powershell
# Save prompt to file: prompt.txt
claude code -f prompt.txt
```

---

## THE ORCHESTRATION WORKFLOW

### 1. YOU TALK TO CLAUDE.AI
```
Lance → Claude.ai: "I need the tech app to capture signatures"
```

### 2. CLAUDE.AI GIVES YOU PROMPT
```
Claude.ai → Lance: "Here's the prompt for Claude Code: [long detailed prompt]"
```

### 3. YOU RUN CLAUDE CODE
```powershell
$ claude code
> [paste the prompt]
> [press Enter twice]
```

### 4. CLAUDE CODE BUILDS
```
🚧 Working...
✅ Complete!
[Shows you what it built]
```

### 5. YOU REPORT BACK TO CLAUDE.AI
```
Lance → Claude.ai: "Claude Code says it's done. Created these files..."
```

### 6. CLAUDE.AI ANALYZES & PLANS NEXT
```
Claude.ai → Lance: "Perfect! Next step is... Here's the next prompt..."
```

### 7. REPEAT
The cycle continues until feature is complete!

---

## KEYBOARD SHORTCUTS

- `Ctrl+C` - Stop Claude Code (if needed)
- `Ctrl+Z` then `exit` - Background and exit
- Arrow Up - Recall last prompt (for retry)

---

## COMMON COMMANDS

### Check Status
```powershell
# See what Claude Code is doing
claude code status
```

### View History
```powershell
# See previous commands
claude code history
```

### Clear Cache (if issues)
```powershell
claude code clear
```

---

## TROUBLESHOOTING

### "Command not found"
```powershell
# Reinstall
npm install -g @anthropic-ai/claude-code

# Or use npx
npx @anthropic-ai/claude-code
```

### "Permission denied"
```powershell
# Run PowerShell as Administrator
# Then navigate to project and try again
```

### Claude Code Seems Stuck
```powershell
# Ctrl+C to stop
# Check what it was doing
# Report to Claude.ai
# Claude.ai will give you fix or retry instructions
```

---

## BEST PRACTICES

### ✅ DO:
- Copy entire prompts from Claude.ai
- Let Claude Code run without interruption
- Report back to Claude.ai when complete
- Test features after each component
- Keep Claude.ai window open for coordination

### ❌ DON'T:
- Modify prompts from Claude.ai (they're optimized)
- Interrupt Claude Code mid-execution
- Skip testing steps
- Make changes without telling Claude.ai
- Try to debug yourself (tell Claude.ai the error)

---

## FILE LOCATIONS REFERENCE

### Custom Instructions
`.claudecode/instructions.md` - Your project standards (already created!)

### Orchestration Guide
`docs/CLAUDE_CODE_ORCHESTRATION.md` - The workflow playbook

### Tech App Prompt
Stored in Claude.ai conversation - I'll give you prompts as needed

---

## READY TO GO!

Everything is set up. Now just say to Claude.ai:

**"Ready to start orchestrated workflow. Claude Code is standing by."**

I'll give you the first prompt to run.

🚀 **LET'S BUILD!**
