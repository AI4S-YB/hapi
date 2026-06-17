import { Hono } from 'hono'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { spawnSync } from 'child_process'
import { homedir, platform } from 'node:os'

const HOME = homedir()
const IS_MACOS = platform() === 'darwin'
const LAUNCH_AGENTS_DIR = `${HOME}/Library/LaunchAgents`

// System-level labels to always filter out (Apple/Google/OS internals)
const SYSTEM_LABEL_PREFIXES = [
  'com.apple.',
  'com.google.keystone.',
  'com.microsoft.',
  'com.adobe.',
  'com.oracle.',
  'com.cisco.',
  'org.cups.',
  'org.pqrs.',
  'net.java.',
  'abnerworks.',
  'unity.',
  'jetbrains.',
]

function isSystemService(label: string): boolean {
  return SYSTEM_LABEL_PREFIXES.some(p => label.startsWith(p))
}

interface CronTask {
  source: 'claude-code' | 'launchd' | 'crontab'
  id: string
  label: string
  schedule: string
  command: string
  enabled: boolean
}

interface CronResult {
  tasks: CronTask[]
  platform: string
  sources: {
    claudeCode: { found: boolean; available: boolean }
    launchd: { found: boolean; count: number; available: boolean }
    crontab: { found: boolean; count: number; available: boolean }
  }
}

function parseLaunchdPlist(path: string, fileName: string): CronTask | null {
  try {
    const raw = readFileSync(path, 'utf8')

    // Extract Label
    const labelMatch = raw.match(/<key>Label<\/key>\s*<string>([^<]+)<\/string>/)
    const label = labelMatch ? labelMatch[1] : fileName.replace('.plist', '')

    // Filter system services
    if (isSystemService(label)) return null

    // Extract ProgramArguments
    const args: string[] = []
    const argsMatch = raw.match(/<key>ProgramArguments<\/key>\s*<array>([\s\S]*?)<\/array>/)
    if (argsMatch) {
      const matches = argsMatch[1].matchAll(/<string>([^<]+)<\/string>/g)
      for (const m of matches) args.push(m[1])
    }

    // Determine schedule type
    let schedule = '按需/常驻'
    if (raw.includes('StartCalendarInterval')) {
      const weekday = raw.match(/<key>Weekday<\/key>\s*<integer>(\d+)<\/integer>/)
      const hour = raw.match(/<key>Hour<\/key>\s*<integer>(\d+)<\/integer>/)
      const minute = raw.match(/<key>Minute<\/key>\s*<integer>(\d+)<\/integer>/)
      const days = ['日', '一', '二', '三', '四', '五', '六']
      const w = weekday ? days[parseInt(weekday[1])] || '' : ''
      const h = hour ? String(parseInt(hour[1])).padStart(2, '0') : '00'
      const m = minute ? String(parseInt(minute[1])).padStart(2, '0') : '00'
      schedule = w ? `每${w} ${h}:${m}` : `${h}:${m}`
    } else if (raw.includes('RunAtLoad')) {
      schedule = '启动时运行'
    } else if (raw.includes('KeepAlive')) {
      schedule = '常驻守护'
    }

    // Check if loaded
    const launchctl = spawnSync('launchctl', ['list'], { timeout: 3000 })
    const loaded = launchctl.stdout
      ? new TextDecoder().decode(launchctl.stdout).includes(label)
      : false

    return {
      source: 'launchd',
      id: `launchd:${fileName}`,
      label,
      schedule,
      command: args.join(' ') || '(系统服务)',
      enabled: loaded
    }
  } catch {
    return null
  }
}

function getLaunchdTasks(): CronTask[] {
  const tasks: CronTask[] = []
  if (!IS_MACOS || !existsSync(LAUNCH_AGENTS_DIR)) return tasks

  try {
    const files = readdirSync(LAUNCH_AGENTS_DIR).filter(f => f.endsWith('.plist'))
    for (const file of files) {
      const task = parseLaunchdPlist(`${LAUNCH_AGENTS_DIR}/${file}`, file)
      if (task) tasks.push(task)
    }
  } catch { /* ignore */ }

  return tasks
}

function getClaudeCodeCronTasks(): CronTask[] {
  const tasks: CronTask[] = []
  const path = `${HOME}/.claude/scheduled_tasks.json`

  if (!existsSync(path)) return tasks

  try {
    const raw = readFileSync(path, 'utf8')
    const items = JSON.parse(raw)
    if (!Array.isArray(items)) return tasks

    for (const item of items) {
      tasks.push({
        source: 'claude-code' as const,
        id: item.id || `cc-${Math.random().toString(36).slice(2, 8)}`,
        label: item.prompt?.slice(0, 60) || item.cron || '(未命名)',
        schedule: item.cron || '按需',
        command: item.prompt || '',
        enabled: true
      })
    }
  } catch { /* ignore */ }

  return tasks
}

function getCrontabTasks(): CronTask[] {
  const tasks: CronTask[] = []
  const crontab = spawnSync('crontab', ['-l'], { timeout: 3000 })

  if (crontab.status !== 0 || !crontab.stdout) return tasks

  const lines = new TextDecoder().decode(crontab.stdout).trim().split('\n')
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    // Filter out common environment variable lines
    if (trimmed.match(/^\w+=\w+/)) continue
    const parts = trimmed.split(/\s+/)
    if (parts.length < 6) continue

    tasks.push({
      source: 'crontab' as const,
      id: `cron:${tasks.length}`,
      label: parts.slice(5).join(' ').slice(0, 60),
      schedule: `${parts[0]} ${parts[1]} ${parts[2]} ${parts[3]} ${parts[4]}`,
      command: parts.slice(5).join(' '),
      enabled: true
    })
  }

  return tasks
}

export function createCronRoutes(): Hono {
  const app = new Hono()

  app.get('/api/cron', async (c) => {
    const ccTasks = getClaudeCodeCronTasks()
    const launchdTasks = getLaunchdTasks()
    const cronTasks = getCrontabTasks()

    return c.json({
      platform: platform(),
      tasks: [...ccTasks, ...launchdTasks, ...cronTasks],
      sources: {
        claudeCode: { found: ccTasks.length > 0, available: true },
        launchd: { found: launchdTasks.length > 0, count: launchdTasks.length, available: IS_MACOS },
        crontab: { found: cronTasks.length > 0, count: cronTasks.length, available: true }
      }
    } satisfies CronResult)
  })

  return app
}
