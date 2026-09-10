import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
const files = { '/assets/dhak.png': ['assets/dhak.png', 'image/png'], '/assets/dhak.jpg': ['assets/dhak.jpg', 'image/jpeg'], '/': ['index.html', 'text/html'], '/index.html': ['index.html', 'text/html'], '/style.css': ['style.css', 'text/css'], '/script.js': ['script.js', 'text/javascript'] };
const server = createServer(async (req, res) => {
  const file = files[new URL(req.url, 'http://localhost').pathname];
  if (!file) { res.writeHead(404); res.end('Not found'); return; }
  try { const content = await readFile(new URL(file[0], import.meta.url)); res.writeHead(200, { 'Content-Type': file[1] + '; charset=utf-8', 'Cache-Control': 'no-cache' }); res.end(content); }
  catch { res.writeHead(500); res.end('Unable to load page'); }
});
server.listen(Number(process.env.PORT || 3000), '127.0.0.1', () => console.log(`Halud Panjabi preview: http://localhost:${server.address().port}`));
