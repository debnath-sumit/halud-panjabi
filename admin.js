const $ = selector => document.querySelector(selector);
let previewUrl;
function notice(message = '', type = '') { $('#notice').textContent = message; $('#notice').className = type; }
function signedIn(value) {
  $('#login-panel').hidden = value;
  $('#studio').hidden = !value;
  $('#logout').hidden = !value;
  if (!value) { $('#library').replaceChildren(); $('#login-form input').focus(); }
}
async function request(path, options = {}) {
  const response = await fetch(path, { credentials: 'same-origin', ...options, headers: { 'Content-Type': 'application/json', ...options.headers } });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401) signedIn(false);
    throw new Error(body.error || 'Unable to connect. Please try again.');
  }
  return body;
}
async function busy(form, task, pending, success) {
  const button = form.querySelector('button[type="submit"]');
  button.disabled = true; notice(pending);
  try { await task(); notice(success, 'success'); }
  catch (error) { notice(error.message, 'error'); }
  finally { button.disabled = false; }
}
function clearPreview() {
  if (previewUrl) URL.revokeObjectURL(previewUrl);
  previewUrl = undefined; $('#photo-preview').hidden = true; $('#photo-preview').removeAttribute('src');
}
$('#photo-file').addEventListener('change', () => {
  clearPreview();
  const file = $('#photo-file').files[0];
  if (!file) return;
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 20 * 1024 * 1024) {
    $('#photo-file').value = ''; notice('Choose a JPEG, PNG, or WebP photo under 20 MB.', 'error'); return;
  }
  previewUrl = URL.createObjectURL(file); $('#photo-preview').src = previewUrl; $('#photo-preview').hidden = false; notice();
});
async function preparePhoto(file) {
  if (!file || file.size > 20 * 1024 * 1024 || !['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('Choose a JPEG, PNG, or WebP photo under 20 MB.');
  let bitmap;
  try { bitmap = await createImageBitmap(file); } catch { throw new Error('This image could not be opened. Please try another photo.'); }
  try {
    const scale = Math.min(1, 1800 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale)); canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext('2d');
    context.fillStyle = '#faf7ef'; context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const data = canvas.toDataURL('image/jpeg', .85).split(',')[1];
    if (!data || data.length > 4_000_000) throw new Error('This image is too large. Please choose a smaller photo.');
    return data;
  } finally { bitmap.close(); }
}
async function refresh() {
  const { items } = await request('/api/media');
  $('#library').replaceChildren();
  $('#item-count').textContent = `(${items.length})`; $('#empty').hidden = items.length > 0;
  for (const item of items) {
    const article = document.createElement('article'); article.className = 'media-card';
    const img = document.createElement('img'); img.src = item.kind === 'photos' ? item.url : `https://i.ytimg.com/vi/${item.videoId}/hqdefault.jpg`; img.alt = item.title; img.loading = 'lazy';
    const content = document.createElement('div'); content.className = 'media-card-body';
    const type = document.createElement('span'); type.className = 'media-type'; type.textContent = item.kind === 'photos' ? 'PHOTO' : 'YOUTUBE VIDEO';
    const heading = document.createElement('h3'); heading.textContent = item.title;
    const remove = document.createElement('button'); remove.className = 'quiet remove'; remove.textContent = 'Remove'; remove.setAttribute('aria-label', `Remove ${item.title}`);
    remove.addEventListener('click', async () => {
      if (!confirm(`Remove “${item.title}” from the website?`)) return;
      remove.disabled = true;
      try { await request('/api/media', { method: 'DELETE', body: JSON.stringify({ id: item.id }) }); await refresh(); notice('Removed from the website.', 'success'); }
      catch (error) { notice(error.message, 'error'); remove.disabled = false; }
    });
    content.append(type, heading, remove); article.append(img, content); $('#library').append(article);
  }
}
$('#login-form').addEventListener('submit', event => {
  event.preventDefault(); const form = event.currentTarget;
  busy(form, async () => {
    await request('/api/session', { method: 'POST', body: JSON.stringify(Object.fromEntries(new FormData(form))) });
    form.reset(); signedIn(true); await refresh();
  }, 'Signing in…', 'Welcome back. Your studio is ready.');
});
$('#photo-form').addEventListener('submit', event => {
  event.preventDefault(); const form = event.currentTarget;
  busy(form, async () => {
    const title = form.elements.title.value;
    const data = await preparePhoto(form.elements.photo.files[0]);
    await request('/api/media', { method: 'POST', body: JSON.stringify({ kind: 'photos', title, data }) });
    form.reset(); clearPreview(); await refresh();
  }, 'Preparing and uploading your photo…', 'Photo published. It is now on the website.');
});
$('#video-form').addEventListener('submit', event => {
  event.preventDefault(); const form = event.currentTarget;
  busy(form, async () => {
    await request('/api/media', { method: 'POST', body: JSON.stringify({ kind: 'videos', ...Object.fromEntries(new FormData(form)) }) });
    form.reset(); await refresh();
  }, 'Publishing your video…', 'Video published. It is now on the website.');
});
$('#logout').addEventListener('click', async () => {
  try { await request('/api/session', { method: 'DELETE' }); signedIn(false); $('#photo-form').reset(); $('#video-form').reset(); clearPreview(); notice('You have signed out.'); }
  catch (error) { notice(error.message, 'error'); }
});
$('#refresh').addEventListener('click', async () => { try { await refresh(); notice('Collection is up to date.', 'success'); } catch (error) { notice(error.message, 'error'); } });
(async () => {
  try { const session = await request('/api/session'); signedIn(session.authenticated); if (session.authenticated) await refresh(); notice(); }
  catch (error) { signedIn(false); notice(error.message, 'error'); }
})();
