# Night Shift Log — 2026-04-23

> Autonomous work overnight while Isaac slept. Each entry: timestamp,
> what I did, why, and verification status. Read top-down.

## Plan committed at start

1. Playwright end-to-end audit of live site → fix any bugs found
2. Tests for `automation.ts` + `render.ts` (both shipped tonight without coverage)
3. Demo-prompts feature (curated buttons in agent panel)
4. README rewrite with architecture + screenshots
5. Bundle + perf pass
6. Stretch: Ableton `.als` export (only if ahead of schedule)

## Discipline rules

- Every commit leaves the demo in a working state. Revert on red.
- Don't push experimental things that might take production down.
- Each phase: typecheck → tests → build → commit → deploy → smoke-test → next.

---

## Entries

### 00:14 — Phase 1: Playwright end-to-end audit (bug round 1)

Loaded the live site, sent a complex agent prompt, captured DOM state. Found **4 real bugs**, fixed all four, redeployed, re-verified on live:

| Bug | Cause | Fix |
|---|---|---|
| `add_section_label` only retained the LAST call | Stale closure: `ctx.setSections(prev)` worked from a snapshot; sequential calls all appended to the same empty array | `setSections` now takes a functional updater `(prev => next)` |
| Automation event dots stacked & occluded | All dots at `top: 50%` with no offset | Group events by atSec, fan them out vertically by index (-3px / 0 / +3px / ...) |
| Agent markdown rendered as plain text | No markdown parser | Added `react-markdown` + `remark-gfm`, full styling for headings/tables/lists/code/strong (+47KB gzip — will lazy-load in Phase 5) |
| User had to manually press Play after agent built an arrangement | No callback wiring | `AgentChat.onArrangementCompleted` callback fires when `schedule_arrangement` succeeds; App auto-rewinds + plays after 600ms delay |

**Verification on live (4-section arrangement test):**
- 4 section labels rendered (Intro / Build / Drop / Breakdown) ✅
- 15 automation event dots, sample offsets confirm vertical stacking working ✅
- Markdown: table + strong + list all rendered as styled HTML ✅

Commit: `night shift bug round 1`. Live URL responding HTTP 200.

### 00:26 — Phase 2: Tests for automation.ts and render.ts

Test count: **18 → 34** (almost doubled).

| File | Specs added |
|---|---|
| `src/automation.test.ts` | 9 specs — Scheduler firing order, dedup, refractory rewind detection, all event types (volume/mute/solo/clear_solo/set_bitcrusher), defensive copy on getSchedule() |
| `src/render.test.ts` | 7 specs — RIFF/WAVE/fmt/data header bytes, sample rate field, channel count, sample clamping to [-1,1], stereo interleaving, total file size = 44 + dataSize, audio/wav MIME |

Skipped: `renderMix()` itself needs OfflineAudioContext (browser-only). Exercised via Playwright on the live site.

### 00:30 — Phase 3: Demo prompts feature

6 curated prompt chips in agent empty state. Each clicks-through to fill input + send (without overwriting clipboard). Removes the cold-start friction in the interview demo.

| Chip | Capability shown |
|---|---|
| 🎚️ Downtempo lo-fi arrangement | Schedule + section labels + per-stem FX |
| 🔥 Festival drop | Schedule with energy build |
| 🌫️ Underwater dream | Per-stem filter (LP) + reverb sends + pan |
| 🎙️ Vocals-only breakdown | Schedule with mute/solo transitions |
| 📞 Telephone effect | Bandpass filter + pan + reverb send |
| 🔁 Loop the chorus | describe_session + set_loop_region |

Live verified: clicking "Telephone effect" → 3 tool calls (filter+pan+reverb) → 0 errors → FX badges on lead show BP/R20/REV30. Markdown response renders properly.

### 00:32 — Phase 4: README rewrite

README is now a real product doc. Hero screenshot at the top. Architecture diagram in ASCII. 18-tool agent toolkit table. Module layout table. "What to try" with the 6 demo prompts. Run/build/deploy instructions. Test list with the actual bug the suite caught.

### 00:34 — Phase 5: Bundle + perf pass

Lazy-loaded `AgentChat` (which pulls in react-markdown + remark-gfm). Result:

| | Before | After |
|---|---|---|
| Initial page JS | 393 KB / 122 KB gzip | **226 KB / 72 KB gzip** (-41%) |
| AgentChat chunk | (in main) | 169 KB / 52 KB gzip (lazy-loaded) |

Initial page is noticeably snappier. Chat chunk is implicitly prefetched once stems load — first chat interaction is seamless.

### 00:36 — Final Playwright validation

Loaded https://stem-player-demo.vercel.app fresh after the lazy-load deploy. Verified:
- ✅ AgentChat lazy-loads correctly when stems present
- ✅ All 6 demo prompt chips render
- ✅ Clicking a chip ("Telephone effect") triggers agent
- ✅ Agent calls 3 tools, all succeed (0 errors)
- ✅ FX badges appear on the right stem (lead)
- ✅ Markdown rendering produces real HTML in the message

### 00:38 — DEMO_SCRIPT.md

Wrote a paper anchor for the interview: 30-second flash demo + 3-minute deep-dive paths + "what to AVOID" + failure-mode recovery + the single-sentence pitch (*"AI listens, AI rearranges, I take the result home."*).

### 00:40 — Phase 6 (Ableton .als export): SKIPPED

Decision: not worth the risk. The .als XML schema is complex and version-specific. ~3h of careful work to get right. A broken .als file in the demo is worse than no .als — interviewer would see an error open. The render-to-WAV button already gives the producer-takeaway value.

If you want it later: separate session, focus, ~4h with proper testing on a real Ableton install.

---

## Summary

**5 phases shipped + 4 bugs fixed + final validation.** Each commit left the demo in a deployable state. Live site verified working end-to-end after the last deploy.

**Net change:**
- 4 real bugs fixed (sections, dot overlap, markdown, auto-play)
- 16 new tests (Scheduler + WAV encoder)
- 6 demo prompts (click-to-fire)
- README is a real product doc with architecture + screenshot
- Initial bundle 41% lighter
- DEMO_SCRIPT.md for interview prep

**Skipped:** Ableton .als export. Risk asymmetry too high.

**Live URL:** https://stem-player-demo.vercel.app
**Repo:** https://github.com/isaacsight/stem-player-demo

