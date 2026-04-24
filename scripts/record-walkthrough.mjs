/**
 * Record a walkthrough video of the live demo via Playwright.
 *
 * Usage:
 *   node scripts/record-walkthrough.mjs [url]
 *
 * Default URL: https://stem-player-demo.vercel.app
 *
 * The recording captures: page load → load demo set → click "Festival drop"
 * chip → wait for agent (streams text + tools, schedules arrangement) →
 * arrangement auto-plays → render-to-WAV.
 *
 * Output: docs/walkthrough.webm
 */

import { chromium } from 'playwright'
import { mkdir, rename, readdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DOCS_DIR = join(__dirname, '..', 'docs')
const VIDEO_DIR = join(DOCS_DIR, '_video-tmp')
const FINAL_PATH = join(DOCS_DIR, 'walkthrough.webm')

const URL = process.argv[2] ?? 'https://stem-player-demo.vercel.app'

await mkdir(DOCS_DIR, { recursive: true })
await mkdir(VIDEO_DIR, { recursive: true })

const browser = await chromium.launch({ headless: true })
const context = await browser.newContext({
  viewport: { width: 1280, height: 800 },
  recordVideo: { dir: VIDEO_DIR, size: { width: 1280, height: 800 } },
  deviceScaleFactor: 2,
})

const page = await context.newPage()

console.log(`navigating to ${URL}…`)
await page.goto(URL, { waitUntil: 'networkidle' })

// Clear any stale localStorage so we get the empty state
await page.evaluate(() => {
  Object.keys(localStorage).filter(k => k.startsWith('procreate-dryrun')).forEach(k => localStorage.removeItem(k))
})
await page.reload({ waitUntil: 'networkidle' })

// 1. Load the procedural demo set
console.log('loading demo set…')
await page.click('button:has-text("Load procedural demo set")')
await page.waitForSelector('.stem-row', { timeout: 10_000 })
await page.waitForTimeout(2000) // let waveforms render

// 2. Click the "Festival drop" chip
console.log('clicking Festival drop chip…')
await page.click('button.agent-prompt-chip:has-text("Festival drop")')

// 3. Wait for the agent to finish (look for tool-use trace + final assistant message)
console.log('waiting for agent…')
// Wait until the schedule_arrangement tool has been called and message_complete fires
await page.waitForFunction(() => {
  const tools = Array.from(document.querySelectorAll('.agent-tool'))
  return tools.some(t => t.textContent?.includes('schedule_arrangement'))
}, { timeout: 60_000 })

// Wait for auto-play to start (the play button changes to Pause)
await page.waitForSelector('button:has-text("Pause")', { timeout: 10_000 })
console.log('agent finished — playback started')

// Let the playhead run for a bit
await page.waitForTimeout(8000)

// 4. Click Render mix → WAV (don't actually wait for the download to finish for the video)
console.log('clicking render…')
const renderBtn = page.locator('button:has-text("Render mix")')
if (await renderBtn.isVisible()) {
  await renderBtn.click()
  await page.waitForTimeout(2000)
}

// Final pause so the video has a clean ending
await page.waitForTimeout(2000)

await context.close()
await browser.close()

// Find the recorded video and move to final path
const files = await readdir(VIDEO_DIR)
const webm = files.find(f => f.endsWith('.webm'))
if (!webm) {
  console.error('no .webm produced')
  process.exit(1)
}
await rename(join(VIDEO_DIR, webm), FINAL_PATH)
console.log(`saved → ${FINAL_PATH}`)
