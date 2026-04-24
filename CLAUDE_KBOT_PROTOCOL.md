# Claude + kbot — Live Interview Protocol

> How the AI stack works during the Friday round. This is the operating
> model between you, this Claude Code session, and kbot. Print this.

---

## Roles

| | Role |
|---|---|
| **You (Isaac)** | Engineer in the room. Listens, decides, delivers answers. Owns the conversation. |
| **This Claude (Claude Code session)** | Always-on thinking partner. Has full context from prep. Drives kbot when needed. |
| **kbot** | Brand-aligned demo tool. Fired up at strategic moments — not as default. |
| **Claude.ai (web app)** | Backup if Claude Code is laggy or you need a clean second opinion. |

---

## The signal you send me when something happens

To keep the interview moving, you need a tight vocabulary for telling me what you need. Type these short strings — I'll know what to do:

| You type | I do |
|---|---|
| `Q: [question]` | Quick answer, no kbot, fast |
| `Q deep: [question]` | Deeper answer with reasoning |
| `kbot: [question]` | I run kbot live, capture its output, give you the deliverable answer |
| `code: [file]` | I open the file, give you a 30-second walk-through script |
| `tradeoff: [topic]` | I find the relevant tradeoff from `interview-prep/TRADEOFFS.md` |
| `panic` | I give you a calming framing line + reset on what to say next |
| `stall` | I give you something to say while you think — buys 10 seconds |

You can paste raw interviewer questions too — I'll figure out which mode.

---

## When to fire kbot vs use this Claude

### Fire kbot (the brand alignment move)

Use kbot LIVE on screen-share when:

- They ask about **agents specifically** ("how do you think about AI agents?")
- They ask about **MCP / tool ecosystems**
- They ask about **multi-tool fluency**
- They ask **"show me how you use AI tools"**
- They ask about **kbot specifically** (it's in your prep doc, expect it)

For these moments: open a terminal, run kbot live, let them watch. The narrative is *"this is what I built — let me use it to answer that."*

### Use this Claude (default)

Use this Claude Code session for:

- Quick technical Q&A
- Code walk-throughs of stem-player files
- Architecture explanations
- Tradeoff defenses
- Anything where speed matters more than the brand moment

### Don't use either AI

- Behavioral questions ("tell me about a time…") — that's about YOU
- Strategic questions ("why Suno?") — that's about YOU
- Anything where the human moment matters more than the answer

---

## kbot showcase moments (rehearse these)

These are the prepared kbot demos. Each is a one-line invocation that produces a clean answer.

### 1. "How do you think about agents?"

```bash
kbot --pipe --model sonnet --quiet "What's the architectural difference between a one-shot AI feature and a true agent loop with tool use? Reference real audio-engineering tools as examples."
```

While it streams, you say: *"This is kbot — my own agentic CLI that uses Claude. Let me show you what it says about this."*

### 2. "Show me your AI workflow"

```bash
kbot doctor
```

This shows kbot is configured + working. Then:

```bash
kbot --pipe --model sonnet --quiet "Give me three trade-offs in agent design that matter for producer-facing AI tools."
```

### 3. "Walk me through your code with AI assistance"

```bash
kbot --pipe --model sonnet --quiet "Read the file at /Users/isaachernandez/blog design/scratch/stem-player-demo/src/audio.ts and explain the per-stem FX chain in 4 sentences."
```

You narrate while it runs: *"Asking kbot to read my own audio engine and summarize. The interesting move here is that I built kbot specifically to be able to operate on my own codebases without me having to swap between tools."*

---

## What I'll do when you fire kbot

1. You type `kbot: [question]` to me
2. I run the kbot command via Bash
3. I capture the output
4. I give you back: **the synthesized answer** (not the raw kbot output) so you can deliver it cleanly

If kbot misbehaves (garbled output, timeout, error):
- I tell you immediately: *"kbot is having a moment — falling back to Claude"*
- I answer the question myself
- You smoothly transition: *"OK, going with the Claude answer for this one."*

---

## Pre-interview kbot warmup (Thursday night)

Run these BEFORE Friday to make sure kbot is in good shape:

```bash
# Verify provider + connectivity
kbot doctor

# Test 1: agent architecture
kbot --pipe --model sonnet --quiet "Explain the difference between AudioWorklet and ScriptProcessorNode for browser audio in 3 sentences."

# Test 2: code reading
kbot --pipe --model sonnet --quiet "Read /Users/isaachernandez/blog\ design/scratch/stem-player-demo/src/automation.ts and explain what the Scheduler class does."

# Test 3: trade-off explanation
kbot --pipe --model sonnet --quiet "What are 3 trade-offs in real-time AI agent UX design? Be specific."
```

Each should complete in under 30 seconds with clean, readable output.

**If any produce garbage** → flag it to me, we fix or adjust the protocol to lean on Claude only.

---

## Live screen layout (Friday)

You should have these visible (ideally on a second monitor):

| Window | Purpose |
|---|---|
| **Browser tab — live demo** | The actual app you're demoing |
| **Browser tab — repo** | github.com/isaacsight/stem-player-demo |
| **This Claude Code session** | Your thinking partner — paste questions here |
| **Terminal with kbot ready** | For the kbot showcase moments |
| **(Optional) Browser tab — Claude.ai** | Backup if this Claude session is laggy |

The interviewer sees: live demo + repo + you talking. They don't see this Claude session unless you choose to share it.

---

## Sharing this Claude session — yes or no?

**Don't share by default.** Looks like you're being fed answers verbatim.

**Share strategically when it lands the doctrine:**
- *"Want me to actually show you how I think with Claude here? Let me share."*
- Use it when the question is about your workflow specifically
- Don't use it for the whole interview

The kbot showcase moments — DO share screen for those. That's the brand demo.

---

## What happens when an interviewer asks something I can't help with

Some questions I genuinely can't help with from this session:

- "Explain quantum mechanics" — out of scope, but who asks?
- "Show me your GitHub from 5 years ago" — that's you
- Anything requiring real-time access to systems I don't have

If you hit one of these — say so honestly:

> *"That's outside what I have ready to reference — let me think it through out loud."*

Then think out loud. Honest "I'm working through it" beats fake confidence every time.

---

## Latency expectations

| Source | How fast |
|---|---|
| This Claude (Code) — quick answer | ~3-5 sec |
| This Claude (Code) — deep reasoning | ~8-15 sec |
| kbot — clean question | ~10-30 sec |
| kbot — needs file read first | ~30-60 sec |
| Claude.ai web app | ~3-8 sec |

**For real-time interview Q&A, this Claude (Code) is your default.** kbot is for showcase, not speed.

---

## The protocol summary

```
[Interviewer asks question]
       ↓
[You decide]
       ↓
   ┌───────────────────────────────────────┐
   │  Know it? → answer directly           │
   │  Need a quick check? → Q: in chat     │
   │  Brand moment? → kbot: in chat        │
   │  Stuck? → panic in chat               │
   └───────────────────────────────────────┘
       ↓
[I respond / fire kbot / etc]
       ↓
[You deliver in your own words]
```

---

## Most important reminder

**Don't read my output verbatim to the interviewer.** Synthesize. Put it in your voice.

The goal isn't "Claude answered the question" — it's "Isaac answered the question after consulting his thinking partner." The difference is everything.

---

## The single sentence

> **You're the engineer in the room. I'm the AI you direct. kbot is the AI you built. The interviewer is watching how all three of us work together.**

That's the demo. That's the doctrine. That's the round.
