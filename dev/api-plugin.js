import { readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

function collect(dir, base = dir, out = []) {
  for (const entry of readdirSync(dir)) {
    if (entry.startsWith('_')) continue
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) collect(full, base, out)
    else if (entry.endsWith('.js')) out.push(relative(base, full))
  }
  return out
}

function toRoute(file) {
  const parts = file.replace(/\.js$/, '').split('/')
  if (parts.at(-1) === 'index') parts.pop()
  return {
    file,
    segments: parts.map((p) => {
      const dynamic = p.match(/^\[(.+)]$/)
      return dynamic ? { param: dynamic[1] } : { literal: p }
    }),
  }
}

function match(routes, pathname) {
  const parts = pathname.split('/').filter(Boolean)
  for (const route of routes) {
    if (route.segments.length !== parts.length) continue
    const params = {}
    const ok = route.segments.every((seg, i) =>
      seg.literal !== undefined
        ? seg.literal === parts[i]
        : ((params[seg.param] = decodeURIComponent(parts[i])), true),
    )
    if (ok) return { route, params }
  }
  return null
}

export function apiPlugin({ dir = 'api' } = {}) {
  return {
    name: 'zigda-api',
    configureServer(server) {
      let routes = collect(dir).map(toRoute)

      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url, 'http://localhost')
        if (!url.pathname.startsWith('/api/')) return next()

        let found = match(routes, url.pathname.slice(4))
        if (!found) {
          routes = collect(dir).map(toRoute)
          found = match(routes, url.pathname.slice(4))
        }
        if (!found) {
          res.statusCode = 404
          res.setHeader('Content-Type', 'application/json')
          return res.end(JSON.stringify({ code: 'not_found', error: `No route for ${url.pathname}` }))
        }

        req.query = { ...Object.fromEntries(url.searchParams), ...found.params }
        try {
          const mod = await server.ssrLoadModule(`/${dir}/${found.route.file}`)
          await mod.default(req, res)
        } catch (err) {
          server.ssrFixStacktrace(err)
          console.error(err)
          res.statusCode = 500
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ code: 'upstream_error', error: err.message }))
        }
      })
    },
  }
}
