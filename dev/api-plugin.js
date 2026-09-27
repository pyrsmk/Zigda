export function apiPlugin({ entry = '/api/index.js' } = {}) {
  return {
    name: 'zigda-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url, 'http://localhost')
        if (!url.pathname.startsWith('/api/')) return next()

        req.query = Object.fromEntries(url.searchParams)
        try {
          const mod = await server.ssrLoadModule(entry)
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
