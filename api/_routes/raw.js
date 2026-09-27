import { handler, HttpError, param } from '../_lib/http.js'
import { rawFile, repoContext } from '../_lib/repo.js'
import { imageType } from '../../shared/files.js'

export default handler({
  GET: async (req, res) => {
    const path = param(req, 'path')
    if (!path) throw new HttpError(400, 'path_required', 'A path is required')
    const upstream = await rawFile(await repoContext(), path)
    const data = Buffer.from(await upstream.arrayBuffer())
    res.statusCode = 200
    res.setHeader('Content-Type', imageType(path) ?? 'application/octet-stream')
    res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; sandbox")
    res.setHeader('X-Content-Type-Options', 'nosniff')
    res.setHeader('Cache-Control', 'private, max-age=60')
    res.end(data)
  },
})
