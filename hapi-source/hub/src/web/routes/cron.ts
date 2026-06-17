import { Hono } from 'hono'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { spawnSync } from 'child_process'
import { homedir } from 'node:os'

const HOME = homedir()
const LAUNCH_AGENTS_DIR = `${HOME}/Library/LaunchAgents`

interface CronTask {
  source: 'claude-code' | 'launchd' | 'crontab'
  id: string
  label: string
  schedule: string     // human-readable, e.g. "每周四 20:07"
  command: string
  enabled: boolean     // for launchd: Load/Unload state
}

interface CronResult {
  tasks: CronTask[]
  sources: {
    claudeCode: { found: boolean }
    launchd: { found: boolean; count: number }
    crontab: { found: boolean; count: number }
  }
}

function parseLaunchdPlist(path: string, label: string): CronTask | null {
  try {
    // Simple plist parser — extract key values with regex
    const raw = readFileSync(path, 'utf8')

    // Extract Label
    const labelMatch = raw.match(/<key>Label<\/key>\s*<string>([^<]+)<\/string>/)
    const displayLabel = labelMatch ? labelMatch[1] : label

    // Extract ProgramArguments
    const args: string[] = []
    const argsMatch = raw.match(/<key>ProgramArguments<\/key>\s*<array>([\s\S]*?)<\/array>/)
    if (argsMatch) {
      const matches = argsMatch[1].matchAll(/<string>([^<]+)<\/string>/g)
      for (const m of matches) args.push(m[1])
    }

    // Check if it's a schedule or daemon
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
    }

    // Check if loaded
    const launchctl = spawnSync('launchctl', ['list'], { timeout: 3000 })
    const loaded = launchctl.stdout
      ? new TextDecoder().decode(launchctl.stdout).includes(displayLabel)
      : false

    return {
      source: 'launchd',
      id: `launchd:${label}`,
      label: displayLabel,
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
  if (!existsSync(LAUNCH_AGENTS_DIR)) return tasks

  try {
    const files = readdirSync(LAUNCH_AGENTS_DIR).filter(f => f.endsWith('.plist'))
    for (const file of files) {
      const task = parseLaunchdPlist(`${LAUNCH_AGENTS_DIR}/${file}`, file.replace('.plist', ''))
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
        source: 'claude-code',
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
    const parts = trimmed.split(/\s+/)
    if (parts.length < 6) continue

    tasks.push({
      source: 'crontab',
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
      tasks: [...ccTasks, ...launchdTasks, ...cronTasks],
      sources: {
        claudeCode: { found: ccTasks.length > 0 },
        launchd: { found: launchdTasks.length > 0, count: launchdTasks.length },
        crontab: { found: cronTasks.length > 0, count: cronTasks.length }
      }
    } satisfies CronResult)
  })

  return app
}
