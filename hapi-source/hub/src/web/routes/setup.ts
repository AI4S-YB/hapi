import { Hono } from 'hono'
import { spawnSync } from 'child_process'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { homedir } from 'node:os'

const HOME = homedir()

interface DetectedObsidian {
  found: boolean
  vaults: Array<{ name: string; path: string }>
}

interface DetectedGit {
  found: boolean
  user?: string
  url?: string
  error?: string
}

interface DetectedMachine {
  host: string
  hasKey: boolean
  hasConfig: boolean
}

interface DetectedSkill {
  name: string
  path: string
}

interface DetectionResult {
  obsidian: DetectedObsidian
  github: DetectedGit
  gitlab: DetectedGit
  machines: DetectedMachine[]
  skills: DetectedSkill[]
}

function detectObsidian(): DetectedObsidian {
  // macOS: check Obsidian's app config for vault list
  const obsidianJson = `${HOME}/Library/Application Support/obsidian/obsidian.json`
  if (existsSync(obsidianJson)) {
    try {
      const raw = readFileSync(obsidianJson, 'utf8')
      const cfg = JSON.parse(raw)
      const vaults = (cfg.vaults || []).map((v: any) => ({
        name: v.name || 'Unnamed',
        path: v.path || ''
      })).filter((v: { path: string }) => v.path && existsSync(v.path))
      return { found: vaults.length > 0, vaults }
    } catch { /* JSON parse failed */ }
  }

  // Fallback: check iCloud path
  const icloudPath = `${HOME}/Library/Mobile Documents/iCloud~md~obsidian/Documents/ObsidianVault`
  if (existsSync(icloudPath)) {
    return { found: true, vaults: [{ name: 'iCloud Obsidian', path: icloudPath }] }
  }

  return { found: false, vaults: [] }
}

function detectCli(prog: string, args: string[], hostnameMap: { userKey: string; urlKey: string }): DetectedGit {
  const r = spawnSync(prog, args, { timeout: 5000 })
  if (r.status !== 0) {
    return { found: false, error: `${prog} not authenticated` }
  }
  const out = new TextDecoder().decode(r.stdout).trim()

  // Try to extract username
  const userMatch = out.match(new RegExp(`${hostnameMap.userKey}\\s+(\\S+)`))
  const user = userMatch ? userMatch[1] : undefined

  // Try to extract URL
  const urlMatch = out.match(new RegExp(`${hostnameMap.urlKey}\\s+(\\S+)`))
  const url = urlMatch ? urlMatch[1] : undefined

  return { found: true, user, url }
}

function detectSshMachines(): DetectedMachine[] {
  const machines: DetectedMachine[] = []
  const knownHosts = `${HOME}/.ssh/known_hosts`
  const sshConfig = `${HOME}/.ssh/config`

  const hosts = new Set<string>()

  // Parse known_hosts
  if (existsSync(knownHosts)) {
    try {
      const lines = readFileSync(knownHosts, 'utf8').split('\n')
      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('|')) continue
        // known_hosts format: hostname,ip ssh-rsa AAA...
        const hostPart = trimmed.split(/\s+/)[0]
        if (hostPart) {
          // Split comma-separated hosts
          for (const h of hostPart.split(',')) {
            const clean = h.replace(/\[([^\]]+)\]:\d+/, '$1') // Remove bracketed IPs
            if (clean && !clean.match(/^\d+\.\d+\.\d+\.\d+$/) && clean !== 'localhost') {
              hosts.add(clean)
            }
          }
        }
      }
    } catch { /* ignore */ }
  }

  // Parse SSH config for Host aliases
  const configHosts = new Set<string>()
  if (existsSync(sshConfig)) {
    try {
      const lines = readFileSync(sshConfig, 'utf8').split('\n')
      for (const line of lines) {
        const m = line.trim().match(/^Host\s+(.+)/i)
        if (m && !m[1].includes('*')) {
          for (const h of m[1].split(/\s+/)) {
            configHosts.add(h)
          }
        }
      }
    } catch { /* ignore */ }
  }

  // Check for SSH keys
  const hasKeys = existsSync(`${HOME}/.ssh/id_ed25519`) || existsSync(`${HOME}/.ssh/id_rsa`)

  // Merge hosts
  for (const host of hosts) {
    machines.push({ host, hasKey: hasKeys, hasConfig: configHosts.has(host) })
  }
  // Add config-only hosts not in known_hosts
  for (const host of configHosts) {
    if (!hosts.has(host)) {
      machines.push({ host, hasKey: hasKeys, hasConfig: true })
    }
  }

  return machines
}

function detectSkills(): DetectedSkill[] {
  const skills: DetectedSkill[] = []
  const pluginsDir = `${HOME}/.claude/plugins/`

  if (!existsSync(pluginsDir)) return skills

  try {
    const entries = readdirSync(pluginsDir, { withFileTypes: true })
    for (const entry of entries) {
      if (!entry.isDirectory()) continue
      const skillPath = `${pluginsDir}${entry.name}`
      // Check for package.json or manifest
      const pkgPath = `${skillPath}/package.json`
      if (existsSync(pkgPath)) {
        try {
          const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'))
          skills.push({ name: pkg.name || entry.name, path: skillPath })
        } catch {
          skills.push({ name: entry.name, path: skillPath })
        }
      } else {
        skills.push({ name: entry.name, path: skillPath })
      }
    }
  } catch { /* ignore */ }

  return skills
}

export function createSetupRoutes(): Hono {
  const app = new Hono()

  app.get('/api/setup/detect', async (c) => {
    const result: DetectionResult = {
      obsidian: detectObsidian(),
      github: detectCli('gh', ['auth', 'status'], { userKey: 'Logged in to github.com as', urlKey: 'github.com' }),
      gitlab: detectCli('glab', ['auth', 'status'], { userKey: 'Logged in to', urlKey: 'gitlab.com' }),
      machines: detectSshMachines(),
      skills: detectSkills()
    }
    return c.json(result)
  })

  return app
}
