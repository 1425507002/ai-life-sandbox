import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist')
const port = Number(process.env.PORT || 4175)
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' }

const server = http.createServer((request, response) => {
  const pathname = decodeURIComponent((request.url || '/').split('?')[0])
  const file = path.resolve(root, pathname === '/' ? 'index.html' : pathname.slice(1))
  const target = file.startsWith(root) && fs.existsSync(file) && !fs.statSync(file).isDirectory() ? file : path.join(root, 'index.html')
  response.writeHead(200, { 'Content-Type': mime[path.extname(target)] || 'application/octet-stream' })
  fs.createReadStream(target).pipe(response)
})

server.listen(port, '127.0.0.1', () => console.log(`AI Life Worlds static test server: http://127.0.0.1:${port}/`))
