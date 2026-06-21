import { Hono } from 'hono'
import { spawnSync } from 'child_process'
import { existsSync, readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname } from 'node:path'

const HOME = homedir()
const CONFIG_DIR = `${HOME}/.hapi-shell`
const CONFIG_PATH = `${CONFIG_DIR}/config.json`

interface DetectedObsidian {
  found: boolean
  vaults: Array<{ name: string; path: string }>
}

interface DetectedGit {
  found: boolean
  user?: string
  url?: string
  token?: string
  error?: string
}

interface DetectedMachine {
  host: string
  ip?: string
  hasKey: boolean
  hasConfig: boolean
}

interface DetectedSkill {
  name: string
  path: string
}

interface DetectedFanFiles {
  installed: boolean
  indexedFiles?: number
  servers?: Array<{ name: string; files: number }>
}

interface DetectionResult {
  obsidian: DetectedObsidian
  github: DetectedGit
  gitlab: DetectedGit
  machines: DetectedMachine[]
  skills: DetectedSkill[]
  fanFiles: DetectedFanFiles
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

  const userMatch = out.match(new RegExp(`${hostnameMap.userKey}\\s+(\\S+)`))
  const user = userMatch ? userMatch[1] : undefined

  const urlMatch = out.match(new RegExp(`${hostnameMap.urlKey}\\s+(\\S+)`))
  const url = urlMatch ? urlMatch[1] : undefined

  // Extract token + url from glab config file
  let token: string | undefined
  let configUrl: string | undefined
  try {
    const configPath = `${HOME}/Library/Application Support/glab-cli/config.yml`
    if (existsSync(configPath)) {
      const yml = readFileSync(configPath, 'utf8')
      // Find all token lines — skip empty ones and comments, take first real token
      const matches = yml.matchAll(/^\s*?token:\s*(\S+)/gm)
      for (const m of matches) {
        const val = (m[1] || '').trim()
        if (val && !val.startsWith('#') && val.length > 5) {
          token = val
          break
        }
      }
      // Extract non-gitlab.com host URL
      const hostMatch = yml.match(/^\s{4}(\d+\.\d+\.\d+\.\d+:\d+):/m)
      if (hostMatch) configUrl = `http://${hostMatch[1]}`
    }
  } catch { /* ignore */ }

  return { found: true, user, url: url || configUrl, token }
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

  // Parse SSH config for Host aliases + HostName (IP)
  const configHosts = new Set<string>()
  const hostToIp: Record<string, string> = {}
  if (existsSync(sshConfig)) {
    try {
      const lines = readFileSync(sshConfig, 'utf8').split('\n')
      let currentHost = ''
      for (const line of lines) {
        const hostMatch = line.trim().match(/^Host\s+(.+)/i)
        if (hostMatch && !hostMatch[1].includes('*')) {
          currentHost = hostMatch[1].split(/\s+/)[0]
          configHosts.add(currentHost)
        }
        const hnMatch = line.trim().match(/^HostName\s+(.+)/i)
        if (hnMatch && currentHost) {
          hostToIp[currentHost] = hnMatch[1]
        }
      }
    } catch { /* ignore */ }
  }

  // Check for SSH keys
  const hasKeys = existsSync(`${HOME}/.ssh/id_ed25519`) || existsSync(`${HOME}/.ssh/id_rsa`)

  // Merge hosts
  for (const host of hosts) {
    machines.push({ host, ip: hostToIp[host], hasKey: hasKeys, hasConfig: configHosts.has(host) })
  }
  // Add config-only hosts not in known_hosts
  for (const host of configHosts) {
    if (!hosts.has(host)) {
      machines.push({ host, ip: hostToIp[host], hasKey: hasKeys, hasConfig: true })
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

  function detectFanFiles(): DetectedFanFiles {
    const candidates = ['/usr/local/bin/fan-files', `${HOME}/.cargo/bin/fan-files`, 'fan-files']
    for (const bin of candidates) {
      const r = spawnSync(bin, ['--version'], { timeout: 3000 })
      if (r.status === 0) {
        try {
          const s = spawnSync(bin, ['status'], { timeout: 5000 })
          const raw = new TextDecoder().decode(s.stdout)
          const files = raw.match(/Indexed files:\s+(\d+)/)
          const servers: Array<{ name: string; files: number }> = []
          const serverRe = /^\s{2}(\S+)\s+(\d+)\s+files/gm
          let m
          while ((m = serverRe.exec(raw)) !== null) servers.push({ name: m[1], files: parseInt(m[2]) })
          return { installed: true, indexedFiles: files ? parseInt(files[1]) : 0, servers }
        } catch { return { installed: true } }
      }
    }
    return { installed: false }
  }

  app.get('/shell/setup/detect', async (c) => {
    const result: DetectionResult = {
      obsidian: detectObsidian(),
      github: detectCli('gh', ['auth', 'status'], { userKey: 'Logged in to github.com as', urlKey: 'github.com' }),
      gitlab: detectCli('glab', ['auth', 'status'], { userKey: 'Logged in to', urlKey: 'gitlab.com' }),
      machines: detectSshMachines(),
      skills: detectSkills(),
      fanFiles: detectFanFiles()
    }
    return c.json(result)
  })

  // --- Compute resource management ---
  const COMPUTE_PATH = `${CONFIG_DIR}/compute.json`

  app.get('/shell/compute', async (c) => {
    if (!existsSync(COMPUTE_PATH)) return c.json({ machines: [] })
    try {
      return c.json(JSON.parse(readFileSync(COMPUTE_PATH, 'utf8')))
    } catch {
      return c.json({ machines: [] })
    }
  })

  app.post('/shell/compute/save', async (c) => {
    try {
      const body = await c.req.json()
      if (!existsSync(CONFIG_DIR)) mkdirSync(CONFIG_DIR, { recursive: true })
      writeFileSync(COMPUTE_PATH, JSON.stringify(body, null, 2), 'utf8')
      return c.json({ success: true })
    } catch (err) {
      return c.json({ success: false, error: err instanceof Error ? err.message : 'Save failed' }, 500)
    }
  })

  // Save confirmed config
  app.post('/shell/setup/save', async (c) => {
    try {
      const body = await c.req.json()
      if (!existsSync(CONFIG_DIR)) {
        mkdirSync(CONFIG_DIR, { recursive: true })
      }
      writeFileSync(CONFIG_PATH, JSON.stringify(body, null, 2), 'utf8')
      return c.json({ success: true, path: CONFIG_PATH })
    } catch (err) {
      return c.json({ success: false, error: err instanceof Error ? err.message : 'Save failed' }, 500)
    }
  })

  // Read saved config
  app.get('/shell/config', async (c) => {
    if (!existsSync(CONFIG_PATH)) {
      return c.json({ configured: false })
    }
    try {
      const data = JSON.parse(readFileSync(CONFIG_PATH, 'utf8'))
      return c.json({ configured: true, ...data })
    } catch {
      return c.json({ configured: false })
    }
  })

  return app
}
