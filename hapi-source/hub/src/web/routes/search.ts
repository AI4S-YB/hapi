import { Hono } from 'hono'
import { spawnSync } from 'child_process'

const OBSIDIAN_VAULT = `${process.env.HOME || '/tmp'}/Library/Mobile Documents/iCloud~md~obsidian/Documents/ObsidianVault`

interface SearchResults {
  obsidian: Array<{ path: string; title: string }>
  gitlab: Array<{ iid: string; title: string }>
}

export function createSearchRoutes(): Hono {
  const app = new Hono()

  app.get('/api/search', async (c) => {
    const q = c.req.query('q') || ''
    const results: SearchResults = { obsidian: [], gitlab: [] }

    if (!q) {
      return c.json(results)
    }

    // Search Obsidian vault
    try {
      const grep = spawnSync('grep', [
        '-rli', q, OBSIDIAN_VAULT,
        '--include=*.md'
      ], { timeout: 5000 })
      if (grep.stdout) {
        const lines = new TextDecoder().decode(grep.stdout).trim().split('\n').filter(Boolean)
        results.obsidian = lines.slice(0, 10).map((p: string) => {
          const rel = p.replace(OBSIDIAN_VAULT + '/', '')
          return { path: rel, title: rel.replace('.md', '').split('/').pop() || rel }
        })
      }
    } catch {
      // grep not found or timeout
    }

    // Search GitLab via glab
    try {
      const glab = spawnSync('glab', [
        'search', 'issues', q,
        '--search-scope=all',
        '--per-page=5'
      ], { timeout: 8000 })
      if (glab.stdout) {
        const lines = new TextDecoder().decode(glab.stdout).trim().split('\n').filter(Boolean)
        results.gitlab = lines
          .filter((l: string) => /^\d+/.test(l))
          .map((l: string) => {
            const parts = l.split(/\s+/)
            return { iid: parts[0], title: parts.slice(1).join(' ') }
          })
      }
    } catch {
      // glab not found or error
    }

    return c.json(results)
  })

  return app
}
