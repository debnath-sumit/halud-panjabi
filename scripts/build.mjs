import { mkdir, cp } from 'node:fs/promises';

// Only browser assets belong in the public output. Server code and secrets stay out.
await mkdir('dist', { recursive: true });
for (const file of ['index.html', 'style.css', 'script.js', 'admin.html', 'admin.css', 'admin.js', 'assets']) {
  await cp(file, `dist/${file}`, { recursive: true });
}
