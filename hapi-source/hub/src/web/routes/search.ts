import { Hono } from 'hono'
import { spawnSync } from 'child_process'

const OBSIDIAN_VAULT = `${process.env.HOME || '/tmp'}/Library/Mobile Documents/iCloud~md~obsidian/Documents/ObsidianVault`

interface SearchResults {
  obsidian: Array<{ path: string; title: string }>
  gitlab: Array<{ iid: string; title: string }>
}

function sanitizeQuery(raw: string): string {
  // Strip any characters that could be used for command injection
  // Allow: alphanumeric, CJK, spaces, basic punctuation
  return raw.trim().replace(/[^\w\s一-鿿぀-ゟ가-힯\-_.@/]/g, '').slice(0, 100)
}

export function createSearchRoutes(): Hono {
  const app = new Hono()

  app.get('/api/search', async (c) => {
    const rawQ = c.req.query('q') || ''
    const results: SearchResults = { obsidian: [], gitlab: [] }

    const q = sanitizeQuery(rawQ)
    if (!q || q.length < 2) {
      return c.json(results)
    }

    // Search Obsidian vault with grep
    // '--' prevents the query from being interpreted as a flag
    try {
      const grep = spawnSync('grep', [
        '-rli', '--', q, OBSIDIAN_VAULT,
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

    // Search GitLab issues via glab API
    // glab api proxies GitLab REST API with existing auth
    try {
      const glab = spawnSync('glab', [
        'api',
        `search?scope=issues&search=${encodeURIComponent(q)}&per_page=5`
      ], { timeout: 8000 })
      if (glab.stdout) {
        try {
          const data = JSON.parse(new TextDecoder().decode(glab.stdout))
          if (Array.isArray(data)) {
            results.gitlab = data.slice(0, 5).map((item: any) => ({
              iid: String(item.iid || ''),
              title: item.title || ''
            }))
          }
        } catch {
          // JSON parse failed — fall back to empty results
        }
      }
    } catch {
      // glab not found, not authenticated, or API error
    }

    return c.json(results)
  })

  return app
}
