import { Hono } from 'hono'
import { spawnSync } from 'child_process'

// Find fan-files binary
function findFanFiles(): string | null {
  const candidates = ['/usr/local/bin/fan-files', (process.env.HOME || '/tmp') + '/.cargo/bin/fan-files']
  for (const c of candidates) {
    const r = spawnSync(c, ['--version'], { timeout: 3000 })
    if (r.status === 0) return c
  }
  // Try plain "fan-files" in PATH
  const r = spawnSync('fan-files', ['--version'], { timeout: 3000 })
  if (r.status === 0) return 'fan-files'
  return null
}

export function createDataRoutes(): Hono {
  const app = new Hono()

  app.get('/shell/data/status', async (c) => {
    const bin = findFanFiles()
    if (!bin) return c.json({ installed: false })

    try {
      const r = spawnSync(bin, ['status'], { timeout: 5000 })
      const raw = new TextDecoder().decode(r.stdout)

      // Parse: "Indexed files:   636853" etc.
      const files = raw.match(/Indexed files:\s+(\d+)/)
      const total = raw.match(/Total tracked:\s+(\d+)/)
      const deleted = raw.match(/Deleted \(soft\):\s+(\d+)/)
      const coverage = raw.match(/Metadata coverage:\s+(\d+)%/)
      const lastScan = raw.match(/Last scan:\s+(.+)/)
      const lastChange = raw.match(/Last change:\s+(.+)/)

      // Parse server lines: "  dev-server     636853 files  (last scan: ...)"
      const servers: Array<{ name: string; files: number; lastScan: string }> = []
      const serverRe = /^\s{2}(\S+)\s+(\d+)\s+files\s+\(last scan:\s+(.+)\)/gm
      let m
      while ((m = serverRe.exec(raw)) !== null) {
        servers.push({ name: m[1], files: parseInt(m[2]), lastScan: m[3].trim() })
      }

      return c.json({
        installed: true,
        indexedFiles: files ? parseInt(files[1]) : 0,
        totalFiles: total ? parseInt(total[1]) : 0,
        deletedFiles: deleted ? parseInt(deleted[1]) : 0,
        metadataCoverage: coverage ? parseInt(coverage[1]) : 0,
        lastScan: lastScan ? lastScan[1].trim() : '',
        lastChange: lastChange ? lastChange[1].trim() : '',
        servers
      })
    } catch {
      return c.json({ installed: true, error: 'Failed to read status' })
    }
  })

  app.get('/shell/data/servers', async (c) => {
    const bin = findFanFiles()
    if (!bin) return c.json({ servers: [] })

    try {
      const r = spawnSync(bin, ['servers', 'list'], { timeout: 5000 })
      return c.json({ raw: new TextDecoder().decode(r.stdout) })
    } catch {
      return c.json({ servers: [] })
    }
  })

  return app
}
