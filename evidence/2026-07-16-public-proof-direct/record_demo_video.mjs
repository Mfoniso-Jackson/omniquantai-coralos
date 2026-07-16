import playwright from '../../examples/marketplace/web/node_modules/playwright/index.js'
import { existsSync, mkdirSync, copyFileSync, renameSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const outputDir = join(here, 'video-work')
const finalVideo = join(here, 'omniquantai-proof-demo.webm')
mkdirSync(outputDir, { recursive: true })

const { chromium } = playwright
const browser = await chromium.launch({ headless: true })
const context = await browser.newContext({
  viewport: { width: 1280, height: 720 },
  recordVideo: { dir: outputDir, size: { width: 1280, height: 720 } },
})
const page = await context.newPage()
await page.goto(pathToFileURL(join(here, 'demo_video.html')).href)
await page.waitForTimeout(51_000)
await context.close()
await browser.close()

const newest = readdirSync(outputDir)
  .map((name) => join(outputDir, name))
  .filter((path) => path.endsWith('.webm') && existsSync(path))
  .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)[0]

if (!newest) throw new Error('No recorded webm found')
copyFileSync(newest, finalVideo)
console.log(resolve(finalVideo))
