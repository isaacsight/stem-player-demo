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

