# Day-Of Interview Walkthrough — Suno Pro-Create Technical Round

> **Print this. Have it on a second screen or printed at your elbow.**
> This is choreography. Read it like a flight checklist.
> Total time: ~45-60 min for the round.

---

## ☑️ T-30 minutes — Setup checklist

Open and verify, in order:

- [ ] **Live demo:** https://stem-player-demo.vercel.app — load it, click "Load procedural demo set", verify stems load, verify Play works
- [ ] **Repo:** https://github.com/isaacsight/stem-player-demo — open in second tab
- [ ] **Claude.ai:** logged in, fresh chat ready, cleared sidebar
- [ ] **Terminal with kbot:** `kbot doctor` should show ✓ Anthropic active. Have one prompt rehearsed: `kbot --pipe --model sonnet "what's the best AudioWorklet pattern for sample-perfect playback"` should produce a clean answer
- [ ] **DEMO_SCRIPT.md** open on second screen
- [ ] **TALKING_POINTS.md** open on second screen
- [ ] **This file** open on second screen
- [ ] **Water** (not coffee — coffee makes you talk faster than you should)
- [ ] **Phone silenced**, Slack/Discord/iMessage closed
- [ ] **Browser tab closed** that says anything personal
- [ ] **Headphones with mic** — not laptop speakers
- [ ] One deep breath before clicking Join

---

## ☑️ T-5 minutes — Final check

- [ ] Re-read this file's "Phase 1 opening" section
- [ ] Re-read TALKING_POINTS.md "The big three"
- [ ] Stretch your shoulders. Yawn. Drink water.
- [ ] Click Join 30 seconds early so you're already there when they arrive

---

## 🎬 Phase 1 — Opening (first 2 minutes)

### When they say hi
- Match their energy
- Smile. Genuine, not forced.
- *"Thanks for having me — really excited."*
- Don't over-prepare the small talk. Let them lead.

### Within the first 90 seconds — drop the AI-tools setup line

Verbatim works. Land this line early:

> *"Quick housekeeping — I use Claude and kbot throughout my day, including for technical thinking. Mind if I use them here too? I'll narrate so you can see how I work with them."*

**They'll say yes.** It's an AI-product company. If they hesitate, you say:

> *"I'm happy to do it either way — wanted to flag the workflow upfront so it's not a surprise."*

### What this opening line does
- Removes the "is he cheating?" anxiety before it forms
- Signals you treat AI as workflow, not crutch
- Invites them into your process — they're observers, not police
- **Most importantly:** the doctrine you've been preparing — "the tools type, I decide" — is now the agreed frame for the rest of the round

---

## 📖 Phase 2 — "Tell me about yourself" (next 3-5 min)

When they ask the open-ended background question, deliver the 2-minute pitch from `interview-prep/ELEVATOR_PITCHES.md`.

**Key moves:**
- One breath per sentence
- End on **Pro-Create-specific framing** — make it land that you're here for THEIR team, not for "a job at Suno"
- **Stop talking** when you're done. Don't fill silence. Let them pull on whatever's interesting.

**The closing line of the pitch:**

> *"…the reason I built Stem Player as my interview project is because I think Pro-Create is the most strategically important surface Suno has — generation is converging across providers, the producer-tools layer is where the moat compounds. I want to be in that room."*

That single sentence puts you in their roadmap conversation. They go from "interviewing a candidate" to "talking shop with a peer."

---

## 🖥️ Phase 3 — Live demo (next 5-10 min)

When they invite you to share your screen / show what you built:

### The 30-second flash demo
1. *"Let me share — give me a second to get the right tab up."*
2. Share the live URL tab
3. *"This is Stem Player. The interesting part is the AI engineer — let me ask it to mix this for me."*
4. **Click "Load procedural demo set"** — stems render
5. *"AI mixing engineer panel here. Let me click one of these prompts."*
6. **Click 🔥 Festival drop** chip
7. *(Pause while agent streams text and tools — DON'T fill silence — let them watch)*
8. After ~15 seconds, when text + tool calls are visible: *"Watch — it's calling tools that actually change the audio. Section labels, per-stem FX, scheduled automation events."*
9. Auto-play kicks in (or click Play if it doesn't — autoplay can be browser-flaky)
10. *"And I can take it home."* → click **Render mix → WAV**
11. *"That's the loop: AI listens, AI rearranges, I take the result."*

### Stop. Let them ask.

If silence — paste the chat-ready snippet from `DEMO_HANDOFF.md` so they have the URL/repo/video on their screen too.

---

## 🧠 Phase 4 — Technical questions (15-25 min — the longest phase)

This is where the nerves spike. Read this section carefully.

### Universal framework for every technical question

1. **Hear the question** (don't interrupt)
2. **Paraphrase or acknowledge it** (~3 sec)
   - *"Right, so you're asking about how the agent loop handles tool errors…"*
   - This buys you thinking time AND signals you understood
3. **Decide silently:** do I know this cold?
   - **Yes:** answer directly, look at the code if helpful
   - **No:** *"Let me think through this with Claude — I want to make sure I get it right"*
4. **If using AI:** narrate what you're asking, while typing
   - *"I'm asking Claude for the AudioWorklet `parameterDescriptors` schema because I always forget if `automationRate` is a string or enum…"*
5. **Read the AI's answer** but **deliver it in your own words**
   - Don't read verbatim. Synthesize.
   - *"OK — k-rate vs a-rate. So for the bitcrusher case I went k-rate because the parameters don't need per-sample interpolation."*
6. **Push back on AI when you disagree** (THIS IS THE STRONGEST MOVE)
   - *"Claude suggests X, but I'd actually do Y because Z."*
   - One of these moments wins the interview.

### The questions you'll likely get (with prep)

#### "Walk me through how the agent loop works."

Use these notes (don't read — speak them):

> *"Server-side it's an Anthropic streaming endpoint with 18 tool definitions — `set_volume`, `set_stem_filter`, `schedule_arrangement`, etc. Claude streams tool_use blocks over server-sent events. Client-side, my agent engine receives the blocks, executes each tool against the AudioEngine locally, posts the tool_results back as a new message, and the loop continues until stop_reason isn't 'tool_use'. Multi-turn — agent can call `describe_session` to verify its own state."*

If they want code: open `api/agent.ts` and `src/agent-engine.ts`. Point at the streaming code. Use Claude to walk through any function you don't remember the details of.

#### "Show me the most interesting code in your repo."

Open `src/audio.ts`. Scroll to the `play()` method. Talk through:
- Per-stem source → filter → panner → gain → master chain
- Sample-perfect sync via `ctx.currentTime + 50ms` lookahead
- Loop region handling

If they ask "why 50ms" — *"Scheduling lookahead masks per-source jitter. Lower than 30ms and you start to hear desync; higher than 100ms and the latency is noticeable. 50ms is the sweet spot."*

#### "How does the bitcrusher work?"

Open `public/bitcrusher-processor.js`. Talk through:
- Sample-and-hold for sample-rate reduction
- `step = pow(0.5, bits)` then quantize per sample
- Why it's an AudioWorklet not a ScriptProcessorNode (audio thread, no main-thread starvation)
- k-rate AudioParams (read once per 128-sample render quantum)

If they ask details you don't remember — Claude. *"Let me re-check the exact param descriptor format…"*

#### "Why did you pick X over Y?"

Open `interview-prep/TRADEOFFS.md`. Find the relevant tradeoff. Give the **one-sentence answer + flip condition**:

> *"Vercel over Supabase edge functions for the AI endpoints because single-domain colocation eliminates CORS — flip if I needed multi-region or wanted to consolidate on the Supabase project I already have."*

#### "Can you code without AI?"

This is the moment that requires courage. The honest answer (memorize the shape, not the words):

> *"Not the way I used to. About a year ago I shifted my workflow to direct AI tools — I architect, validate, and ship; the tools type. The result is I produce roughly 10x more shipped work than I did before. The tradeoff: my muscle memory for syntax has atrophied. My judgment about WHAT to build and WHEN it's ready is sharper than ever. I think that's a fair trade for the work I want to do at Pro-Create. If it's not the right fit for your team, that's good information for both of us."*

**Owns the tradeoff. Names it explicitly. Lets them decide.** Most senior engineers respect that more than fake competence.

#### "Walk me through how you'd add [feature X]"

Don't try to write it. Talk through the design out loud:
1. Where in the architecture would it live?
2. What changes to the AudioEngine? Agent tools? UI?
3. What tradeoffs? What's the smallest version that proves it works?

Use Claude as a sketching partner: *"Let me sketch the data flow with Claude…"*

If they want to see actual code: have Claude write a draft, then YOU critique it out loud. *"Claude wrote it as X — I'd actually change Y because…"*

---

## 🤝 Phase 5 — Their questions / reverse interview (last 5-10 min)

### Things they may ask you near the end

- *"Why us?"* → use the Pro-Create-specific WHY framing from your prep
- *"What questions do you have?"* → use your reverse-interview list

### Your questions to ask them (have 4-5, ask 2-3)

Pick from these based on what's already been discussed:

1. **"What does the Pro-Create roadmap look like for the next two quarters? What's the bet that's making you push hardest right now?"**
2. **"How does the team work day-to-day — small focused squads, or broader generalist contributions?"**
3. **"What's been the biggest 'wish we'd done this differently' on Pro-Create so far?"**
4. **"What's the team's framework for evaluating new producer-tool features — user research, internal taste, model-team-driven, or something else?"**
5. **"What's the biggest constraint you're working under right now — model capability, infra, headcount, focus?"**

**Don't ask:** salary, benefits, WFH, vacation. Save those for the recruiter follow-up.

### What NOT to ask

- *"What's a typical day like?"* — too generic, signals low engagement
- *"How big is the team?"* — google it first
- *"What technologies do you use?"* — implies you don't know

---

## 🎯 Phase 6 — Close (last 2 min)

When they wrap:

> *"Really enjoyed this — thanks for the time. The most exciting thing I'm taking away is [specific thing they said]. Looking forward to next steps."*

**Reference one specific thing they said.** Recruiters notice; engineers notice more.

Don't ask "when will I hear back?" — ask the recruiter that. Be confident enough to let it land.

---

## 🆘 What to do when something breaks

| Failure | Action |
|---|---|
| Live demo doesn't load | "Looks like a hiccup — let me try local." Have `npm run dev` ready in terminal. Switch tabs. |
| Browser blocks audio | Click anywhere on the page first to grant gesture. If still blocked, switch to local dev. |
| Agent endpoint timeout | "Vercel cold start." Wait 5s, click chip again. If still failing, narrate: "Let me skip ahead and show the architecture." |
| kbot produces garbled output | Switch to Claude. Don't dwell. *"Going to use Claude for this one — kbot is having a moment."* |
| You blank on a question | Say it: *"Honest answer — let me think about that for a second."* Five seconds of silence is fine. Then either answer or use AI to scaffold. |
| You say something wrong | Correct yourself out loud. *"Actually, scratch that — the right answer is…"* Self-correction is a credibility move, not a weakness. |
| WiFi drops | Hotspot from your phone. Have the credentials ready. |
| You're rambling | Stop mid-sentence. *"Let me get out of my own way — short answer is…"* |

---

## 🧘 Mental anchors for when you're nervous

When the nerves spike, breathe in for 4, out for 6. Then read these silently:

> **They want a peer, not a candidate.**

> **The work shipped. You shipped it.**

> **The tools type. I decide.**

> **AI listens, AI rearranges, you take the result home.**

> **Generation is converging. Personalization is the moat.**

---

## 🔑 The single most important thing

If you can do **one** thing perfectly in this round, make it this:

**Open with the AI-tools framing line in the first 90 seconds.**

Everything downstream of that gets easier:
- AI use becomes normal, not suspicious
- Your "I can't code" moment never happens because AI is in the room with you
- Your doctrine ("the tools type, I decide") becomes the operating frame
- You're the engineer who showed them how AI-native work looks

Say the line. Mean it. The rest of the interview unfolds from there.

---

## After the interview (within 2 hours)

Send a short message to Mary or whoever scheduled it (3 sentences max):

> *"Hi [name] — really enjoyed the conversation with [interviewer name] today. The thing that stuck with me is [specific thing]. Excited for next steps. — Isaac"*

Then close your laptop. Go for a walk. Don't replay the interview in your head — you can't change it now.

---

## You're going to be fine

You've shipped real software. You have a working demo at a live URL. You have prep docs on the architecture, the tradeoffs, the engineering thesis, the talking points. You have a procedure for the call.

The one thing prep can't give you is presence. That comes from breath, water, and the knowledge that you've done the work. Trust the doctrine you've built. Show up like a peer. Listen as much as you talk.

**Go win.**
