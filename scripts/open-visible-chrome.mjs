import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import os from 'node:os'
import path from 'node:path'
import fs from 'node:fs'

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const focusScript = path.join(process.cwd(), 'scripts', 'focus-chrome.ps1')
const port = Number(process.env.CHROME_CDP_PORT || 9222)
const url = process.argv[2] || 'https://www.kuaidianyuedu.com/'
const profile = process.env.CHROME_VISIBLE_PROFILE ||
  path.join(os.tmpdir(), 'ai-life-sandbox-visible-chrome')

if (!fs.existsSync(chromePath)) {
  throw new Error(`C盘 Chrome 不存在: ${chromePath}`)
}

async function cdpReady() {
  try {
    const response = await fetch(`http://127.0.0.1:${port}/json/version`)
    return response.ok
  } catch {
    return false
  }
}

if (!(await cdpReady())) {
  fs.mkdirSync(profile, { recursive: true })
  const child = spawn(chromePath, [
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${profile}`,
    '--no-first-run',
    '--no-default-browser-check',
    'about:blank',
  ], { detached: true, stdio: 'ignore', windowsHide: false })
  child.unref()

  const deadline = Date.now() + 15_000
  while (!(await cdpReady())) {
    if (Date.now() > deadline) {
      throw new Error(`Chrome CDP ${port} 端口在 15 秒内未就绪`)
    }
    await new Promise(resolve => setTimeout(resolve, 250))
  }
}

const browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`)
const context = browser.contexts()[0]
const page = context.pages().find(candidate => candidate.url() === 'about:blank') ||
  context.pages()[0] || await context.newPage()

await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 })
await page.bringToFront()
const title = await page.title()

const focusProcess = spawn('powershell.exe', [
  '-NoProfile',
  '-ExecutionPolicy', 'Bypass',
  '-File', focusScript,
  '-Title', title,
  '-DelayMilliseconds', '1200',
], { detached: true, stdio: 'ignore', windowsHide: false })
focusProcess.unref()

console.log(JSON.stringify({
  browser: browser.version(),
  executable: chromePath,
  cdpPort: port,
  profile,
  url: page.url(),
  title,
  visible: true,
}))
