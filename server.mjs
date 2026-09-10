import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
if (process.loadEnvFile) { try { process.loadEnvFile('.env.local'); } catch (error) { if (error.code !== 'ENOENT') throw error; } }
const { default: session } = await import('./api/session.js');
const { default: media } = await import('./api/media.js');
const files = { '/assets/dhak.png': ['assets/dhak.png', 'image/png'], '/assets/dhak.jpg': ['assets/dhak.jpg', 'image/jpeg'], '/': ['index.html', 'text/html'], '/index.html': ['index.html', 'text/html'], '/style.css': ['style.css', 'text/css'], '/script.js': ['script.js', 'text/javascript'] };
const server = createServer(async (req, res) => {
  const pathname = new URL(req.url, 'http://localhost').pathname;
  if (pathname === '/api/session') return session(req, res);
  if (pathname === '/api/media') return media(req, res);
  const adminFiles = { '/band-manager': ['admin.html', 'text/html'], '/admin.html': ['admin.html', 'text/html'], '/admin.css': ['admin.css', 'text/css'], '/admin.js': ['admin.js', 'text/javascript'] };
  const file = files[pathname] || adminFiles[pathname];
  if (!file) { res.writeHead(404); res.end('Not found'); return; }
  try { const content = await readFile(new URL(file[0], import.meta.url)); res.writeHead(200, { 'Content-Type': file[1] + '; charset=utf-8', 'Cache-Control': 'no-cache' }); res.end(content); }
  catch { res.writeHead(500); res.end('Unable to load page'); }
});
server.listen(Number(process.env.PORT || 3000), '127.0.0.1', () => console.log(`Halud Panjabi preview: http://localhost:${server.address().port}`));
