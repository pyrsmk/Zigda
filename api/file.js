import { handler, HttpError, param, send } from './_lib/http.js'
import { readFile, repoContext } from './_lib/repo.js'

export default handler({
  GET: async (req, res) => {
    const path = param(req, 'path')
    if (!path) throw new HttpError(400, 'path_required', 'A path is required')
    const file = await readFile(await repoContext(), path)
    if (!file) throw new HttpError(404, 'file_not_found', 'File not found')
    send(res, 200, file)
  },
})
