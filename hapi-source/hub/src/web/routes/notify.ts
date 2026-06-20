import { Hono } from 'hono'
import { spawnSync } from 'child_process'
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { homedir } from 'node:os'

const HOME = homedir()
const CONFIG_DIR = `${HOME}/.hapi-shell`
const NOTIFY_STATE = `${CONFIG_DIR}/notify-state.json`
const NOTIFY_CONFIG = `${CONFIG_DIR}/notify-config.json`

interface NotifyState {
  notified: string[]  // "repo/iid" keys
  lastCheck: string
}

interface NotifyConfig {
  enabled: boolean
  intervalMinutes: number
}

function getState(): NotifyState {
  try {
    if (existsSync(NOTIFY_STATE)) return JSON.parse(readFileSync(NOTIFY_STATE, 'utf8'))
  } catch {}
  return { notified: [], lastCheck: '' }
}

function saveState(s: NotifyState) {
  if (!existsSync(CONFIG_DIR)) mkdirSync(CONFIG_DIR, { recursive: true })
  writeFileSync(NOTIFY_STATE, JSON.stringify(s), 'utf8')
}

function getConfig(): NotifyConfig {
  try {
    if (existsSync(NOTIFY_CONFIG)) return JSON.parse(readFileSync(NOTIFY_CONFIG, 'utf8'))
  } catch {}
  return { enabled: true, intervalMinutes: 10 }
}

export function checkNewIssues(): Array<{ iid: string; title: string; repo: string; author: string }> {
  const config = getConfig()
  if (!config.enabled) return []

  const state = getState()
  const newIssues: Array<{ iid: string; title: string; repo: string; author: string }> = []

  try {
    const glab = spawnSync('glab', [
      'api', 'issues?assignee_username=kentnf&state=opened&per_page=20&order_by=updated_at'
    ], { timeout: 10000 })
    if (!glab.stdout) return []

    const data = JSON.parse(new TextDecoder().decode(glab.stdout))
    if (!Array.isArray(data)) return []

    for (const item of data) {
      const webUrl: string = item.web_url || ''
      const repoMatch = webUrl.match(/team-wiki\/(?:projects|members|knowledge)\/[^/]+/)
      const repo = repoMatch ? repoMatch[0] : 'team-wiki'
      const key = `${repo}/${item.iid}`
      const author = item.author?.username || item.assignee?.username || ''

      if (!state.notified.includes(key)) {
        state.notified.push(key)
        newIssues.push({
          iid: String(item.iid || ''),
          title: item.title || '',
          repo,
          author: author || (item.assignee?.name || '')
        })
      }
    }

    state.lastCheck = new Date().toISOString()
    saveState(state)
  } catch { /* glab not available */ }

  return newIssues
}

export function createNotifyRoutes(): Hono {
  const app = new Hono()

  app.get('/shell/notify/config', (c) => c.json(getConfig()))

  app.post('/shell/notify/config', async (c) => {
    try {
      const body = await c.req.json()
      const config: NotifyConfig = {
        enabled: body.enabled !== false,
        intervalMinutes: Math.max(1, Math.min(1440, body.intervalMinutes || 10))
      }
      if (!existsSync(CONFIG_DIR)) mkdirSync(CONFIG_DIR, { recursive: true })
      writeFileSync(NOTIFY_CONFIG, JSON.stringify(config), 'utf8')
      return c.json({ success: true, config })
    } catch (err) {
      return c.json({ success: false, error: err instanceof Error ? err.message : 'Save failed' }, 500)
    }
  })

  app.get('/shell/notify/check', (c) => {
    const issues = checkNewIssues()
    return c.json({ issues })
  })

  return app
}
