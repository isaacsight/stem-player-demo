# Interview Prep

> Reading order for interview prep on the Stem Player demo.

This folder pulls together two streams of work:
- **Stem-Player-specific docs** — written for the actual deployed demo
- **Suno-tech & engineering thesis docs** — pulled from the parallel research session on `claude/interview-full-stack-demo-yeMn4`

---

## Read order

### Night before (full read, ~45 min)

1. [`TALKING_POINTS.md`](./TALKING_POINTS.md) — 12 things to internalize
2. [`ELEVATOR_PITCHES.md`](./ELEVATOR_PITCHES.md) — 30s / 2min / 5min versions
3. [`TRADEOFFS.md`](./TRADEOFFS.md) — every decision, what gave, flip conditions
4. [`TOKENIZATION_THESIS.md`](./TOKENIZATION_THESIS.md) — how Suno's tech actually works (audio codecs, residual VQ, transformer-on-tokens)
5. [`DESIGN_ENGINEERING.md`](./DESIGN_ENGINEERING.md) — aesthetic + function in parallel doctrine

### Hour before (skim)

1. [`TALKING_POINTS.md`](./TALKING_POINTS.md) — re-read the big three
2. [`ANTICIPATED_QUESTIONS.md`](./ANTICIPATED_QUESTIONS.md) — scan section A (product judgment) only
3. [`STACK_QA.md`](./STACK_QA.md) — scan stack questions only

### 5 min before (paper anchor)

- [`../DEMO_SCRIPT.md`](../DEMO_SCRIPT.md) — 30-second flash demo flow

---

## What's adapted vs as-pulled

| File | Source | Adapted to Stem Player? |
|---|---|---|
| `TALKING_POINTS.md` | Written fresh | ✅ Stem-Player-specific |
| `ELEVATOR_PITCHES.md` | Written fresh | ✅ Stem-Player-specific |
| `TRADEOFFS.md` | Written fresh | ✅ Stem-Player decisions |
| `TOKENIZATION_THESIS.md` | Pulled from remote | As-is (Suno-tech, agnostic) |
| `DESIGN_ENGINEERING.md` | Pulled from remote | As-is (general doctrine) |
| `ANTICIPATED_QUESTIONS.md` | Pulled from remote | Mostly as-is — ignore Setlist-specific examples |
| `STACK_QA.md` | Pulled from remote | Mostly as-is — your stack happens to match |

---

## Important notes

- The remote sandbox session (`claude/interview-full-stack-demo-yeMn4`) built docs for a hypothetical "Setlist" project that **doesn't exist as code**. When that project is referenced in pulled docs, mentally substitute "Stem Player" — but the underlying engineering principles transfer cleanly.
- The remote session also dual-tracked between Suno (music) and Procreate (illustration app) because the original prompt was ambiguous. **Your interview is Suno** (per `SUNO_PREP.md`, recruiter Mary Urum-Eke). Ignore the Procreate-illustration-app docs entirely.
- The doctrine in [`../../.claude/SUNO_PREP.md`](../../.claude/SUNO_PREP.md) is still the master prep doc. This folder *complements* it with the demo specifics.

---

## The single sentence

> **AI listens, AI rearranges, you take the result home.**

Everything else is supporting evidence.
