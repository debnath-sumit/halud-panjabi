const $ = selector => document.querySelector(selector);
const previewUrls = new Map();
let videoUploading = false;
let clipPreviewUrl;
function notice(message = '', type = '') { $('#notice').textContent = message; $('#notice').className = type; }
function signedIn(value) {
  $('#login-panel').hidden = value;
  $('#studio').hidden = !value;
  $('#logout').hidden = !value;
  if (!value) { $('#library').replaceChildren(); $('#member-library').replaceChildren(); $('#login-form input').focus(); }
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
async function contentRequest(options = {}) { return request('/api/content', options); }
async function encodeFile(file) { return file ? preparePhoto(file) : ''; }
let contentState = { intro: {}, shows: [], overrides: {} };
async function loadContentAdmin() {
  contentState = await contentRequest();
  const intro = contentState.intro || {};
  for (const field of ['bengaliTitle', 'englishTitle', 'description']) if (intro[field]) $('#intro-form').elements[field].value = intro[field];
  renderShows();
}
function renderShows() {
  const shows = contentState.shows || []; $('#show-library').replaceChildren(); $('#show-count').textContent = `(${shows.length})`; $('#shows-empty').hidden = shows.length > 0;
  shows.forEach(show => {
    const card = document.createElement('article'); card.className = 'show-admin-card';
    if (show.image) { const image = document.createElement('img'); image.src = show.image; image.alt = `${show.name} flyer`; card.append(image); }
    const body = document.createElement('div'); const heading = document.createElement('h3'); heading.textContent = show.name; const details = document.createElement('p'); details.textContent = `${show.date} · ${show.location}\nOrganised by ${show.organisedBy}`; const actions = document.createElement('div'); actions.className = 'show-actions';
    const edit = document.createElement('button'); edit.className = 'quiet'; edit.textContent = 'Edit'; edit.addEventListener('click', () => fillShow(show));
    const remove = document.createElement('button'); remove.className = 'quiet remove'; remove.textContent = 'Delete'; remove.addEventListener('click', async () => { if (!confirm(`Delete “${show.name}”?`)) return; await saveContent({ method: 'POST', body: JSON.stringify({ kind: 'shows', id: show.id }) }); await loadContentAdmin(); notice('Show deleted.', 'success'); });
    actions.append(edit, remove); body.append(heading, details, actions); card.append(body); $('#show-library').append(card);
  });
}
function fillShow(show) { const form = $('#show-form'); form.elements.id.value = show.id; for (const field of ['name','date','location','organisedBy']) form.elements[field].value = show[field]; $('#show-form-title').textContent = 'Edit upcoming show'; $('#show-cancel').hidden = false; form.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
function resetShow() { const form = $('#show-form'); form.reset(); form.elements.id.value = ''; $('#show-form-title').textContent = 'Add an upcoming show'; $('#show-cancel').hidden = true; }
async function saveContent(options) { return contentRequest(options); }
async function busy(form, task, pending, success) {
  const button = form.querySelector('button[type="submit"]');
  button.disabled = true; notice(pending);
  try { await task(); notice(success, 'success'); }
  catch (error) { notice(error.message, 'error'); }
  finally { button.disabled = false; }
}
function clearPreview(kind = 'photo') {
  if (previewUrls.has(kind)) URL.revokeObjectURL(previewUrls.get(kind));
  previewUrls.delete(kind); $(`#${kind}-preview`).hidden = true; $(`#${kind}-preview`).removeAttribute('src');
}
for (const kind of ['photo', 'member']) {
  $(`#${kind}-file`).addEventListener('change', () => {
    clearPreview(kind);
    const file = $(`#${kind}-file`).files[0];
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 20 * 1024 * 1024) {
      $(`#${kind}-file`).value = ''; notice('Choose a JPEG, PNG, or WebP photo under 20 MB.', 'error'); return;
    }
    const url = URL.createObjectURL(file); previewUrls.set(kind, url);
    $(`#${kind}-preview`).src = url; $(`#${kind}-preview`).hidden = false; notice();
  });
}
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
  $('#library').replaceChildren(); $('#member-library').replaceChildren();
  const members = items.filter(item => item.kind === 'members');
  const mediaCount = items.length - members.length;
  $('#item-count').textContent = `(${mediaCount})`; $('#empty').hidden = mediaCount > 0;
  $('#member-count').textContent = `(${members.length})`; $('#members-empty').hidden = members.length > 0;
  for (const item of items) {
    const article = document.createElement('article'); article.className = 'media-card'; article.dataset.id = item.id;
    const img = document.createElement(item.kind === 'clips' ? 'video' : 'img');
    img.src = item.kind !== 'videos' ? item.url : `https://i.ytimg.com/vi/${item.videoId}/hqdefault.jpg`;
    if (item.kind === 'clips') { img.controls = true; img.playsInline = true; img.preload = 'metadata'; img.setAttribute('aria-label', item.title); }
    else { img.alt = item.title; img.loading = 'lazy'; }
    const content = document.createElement('div'); content.className = 'media-card-body';
    const type = document.createElement('span'); type.className = 'media-type'; type.textContent = item.kind === 'members' ? item.role : item.kind === 'photos' ? 'PHOTO' : item.kind === 'clips' ? 'UPLOADED VIDEO' : 'YOUTUBE VIDEO';
    const heading = document.createElement('h3'); heading.textContent = item.title;
    const remove = document.createElement('button'); remove.className = 'quiet remove'; remove.textContent = 'Remove'; remove.setAttribute('aria-label', `Remove ${item.title}`);
    remove.addEventListener('click', async () => {
      if (!confirm(`Remove “${item.title}” from the website?`)) return;
      remove.disabled = true;
      try { await request('/api/media', { method: 'DELETE', body: JSON.stringify({ id: item.id }) }); await refresh(); notice('Removed from the website.', 'success'); }
      catch (error) { notice(error.message, 'error'); remove.disabled = false; }
    });
    content.append(type, heading);
    if (item.kind === 'members') {
      const note = document.createElement('p'); note.className = 'member-summary'; note.textContent = item.note; content.append(note);
      const index = members.findIndex(member => member.id === item.id);
      const order = document.createElement('div'); order.className = 'member-order-controls';
      const position = document.createElement('span'); position.textContent = `Position ${index + 1}`; order.append(position);
      for (const [offset, label, text] of [[-1, 'earlier', '↑ Earlier'], [1, 'later', '↓ Later']]) {
        const button = document.createElement('button'); button.type = 'button'; button.className = 'quiet'; button.textContent = text; button.setAttribute('aria-label', `Move ${item.title} ${label}`); button.disabled = index + offset < 0 || index + offset >= members.length;
        button.addEventListener('click', async () => {
          const ids = members.map(member => member.id); [ids[index], ids[index + offset]] = [ids[index + offset], ids[index]];
          $('#member-library').querySelectorAll('button').forEach(control => { control.disabled = true; });
          notice('Saving band member order…');
          try {
            await request('/api/media', { method: 'PATCH', body: JSON.stringify({ kind: 'members', ids }) });
            await refresh(); notice('Member order saved. The website now uses this order.', 'success');
            const moved = [...$('#member-library').children].find(card => card.dataset.id === item.id);
            moved?.querySelector('button:not(:disabled)')?.focus({ preventScroll: true });
          } catch (error) { notice(error.message, 'error'); await refresh().catch(() => {}); }
        });
        order.append(button);
      }
      content.append(order);
    }
    if (item.kind !== 'clips') { const edit = document.createElement('button'); edit.className = 'quiet'; edit.textContent = 'Edit'; edit.addEventListener('click', async () => {
      if (item.kind === 'members') { const form = $('#member-form'); form.elements.id.value = item.id; form.elements.name.value = item.name; form.elements.role.value = item.role; form.elements.note.value = item.note; form.elements.photo.required = false; $('#member-form-title').textContent = 'Edit band member'; form.scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
      if (item.kind === 'photos') {
        const picker = document.createElement('input'); picker.type = 'file'; picker.accept = 'image/jpeg,image/png,image/webp';
        picker.addEventListener('change', async () => { const file = picker.files[0]; if (!file) return; try { notice('Uploading the replacement photo…'); const imageData = await preparePhoto(file); await saveContent({ method: 'PATCH', body: JSON.stringify({ kind: 'media-edit', id: item.id, title: item.title, imageData }) }); await refresh(); notice('Photo updated.', 'success'); } catch (error) { notice(error.message, 'error'); } });
        picker.click(); return;
      }
      const next = prompt('Title', item.title); if (next === null || !next.trim()) return;
      try { await saveContent({ method: 'PATCH', body: JSON.stringify({ kind: 'media-edit', id: item.id, title: next }) }); await refresh(); notice('Title updated.', 'success'); } catch (error) { notice(error.message, 'error'); }
    }); content.append(edit); }
    content.append(remove); article.append(img, content); $(item.kind === 'members' ? '#member-library' : '#library').append(article);
  }
}
$('#intro-form').addEventListener('submit', event => { event.preventDefault(); const form = event.currentTarget; busy(form, async () => { const image = await encodeFile(form.elements.image.files[0]); await saveContent({ method: 'PATCH', body: JSON.stringify({ kind: 'intro', bengaliTitle: form.elements.bengaliTitle.value, englishTitle: form.elements.englishTitle.value, description: form.elements.description.value, imageData: image }) }); await loadContentAdmin(); }, 'Saving homepage introduction…', 'Homepage introduction saved.'); });
$('#show-form').addEventListener('submit', event => { event.preventDefault(); const form = event.currentTarget; busy(form, async () => { const imageData = await encodeFile(form.elements.image.files[0]); const body = { kind: 'shows', id: form.elements.id.value, name: form.elements.name.value, date: form.elements.date.value, location: form.elements.location.value, organisedBy: form.elements.organisedBy.value, imageData }; await saveContent({ method: form.elements.id.value ? 'PATCH' : 'POST', body: JSON.stringify(body) }); resetShow(); await loadContentAdmin(); }, 'Saving show…', 'Upcoming show saved.'); });
$('#show-cancel').addEventListener('click', resetShow);
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

function clearVideoPreview() {
  const preview = $('#clip-preview'); preview.pause(); preview.removeAttribute('src'); preview.load(); preview.hidden = true;
  if (clipPreviewUrl) URL.revokeObjectURL(clipPreviewUrl);
  clipPreviewUrl = undefined;
}
function checkVideoFile(file) {
  if (!file || !/\.mp4$/i.test(file.name) || (file.type && file.type !== 'video/mp4')) throw new Error('Choose an MP4 video.');
  if (!file.size || file.size > 100_000_000) throw new Error('Choose a video up to 100 MB.');
}
$('#clip-file').addEventListener('change', () => {
  clearVideoPreview(); $('#clip-progress-wrap').hidden = true;
  const file = $('#clip-file').files[0];
  if (!file) return;
  try {
    checkVideoFile(file); clipPreviewUrl = URL.createObjectURL(file);
    $('#clip-preview').src = clipPreviewUrl; $('#clip-preview').hidden = false; notice();
  } catch (error) { $('#clip-file').value = ''; notice(error.message, 'error'); }
});
async function validateVideo(file) {
  checkVideoFile(file);
  const header = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  if (String.fromCharCode(...header.slice(4, 8)) !== 'ftyp') throw new Error('This file is not a valid MP4 video.');
  const preview = document.createElement('video');
  const url = URL.createObjectURL(file);
  try {
    await new Promise((resolve, reject) => {
      const finish = error => { clearTimeout(timer); preview.onloadeddata = null; preview.onerror = null; error ? reject(error) : resolve(); };
      const timer = setTimeout(() => finish(new Error('Could not preview this video. Please export it as an H.264 MP4 and try again.')), 15000);
      preview.onloadeddata = () => finish(preview.videoWidth && preview.videoHeight ? null : new Error('Choose an MP4 containing video.'));
      preview.onerror = () => finish(new Error('This video cannot play in your browser. Please export it as an H.264 MP4.'));
      preview.preload = 'auto'; preview.muted = true; preview.src = url;
    });
  } finally { preview.removeAttribute('src'); preview.load(); URL.revokeObjectURL(url); }
}
function uploadVideo(url, file) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url); xhr.setRequestHeader('Content-Type', 'video/mp4'); xhr.timeout = 30 * 60 * 1000;
    xhr.upload.onprogress = event => {
      if (!event.lengthComputable) return;
      const percent = Math.round(event.loaded / event.total * 100);
      $('#clip-progress').value = percent; $('#clip-percent').textContent = percent === 100 ? 'Finishing…' : `${percent}%`;
    };
    xhr.onload = () => xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error('Video upload failed. Check the file is under 100 MB, then try again.'));
    xhr.onerror = () => reject(new Error('The upload connection was interrupted. Your selected video is still here; please try again.'));
    xhr.ontimeout = () => reject(new Error('The upload timed out. Please try again on a faster connection.'));
    xhr.send(file);
  });
}
window.addEventListener('beforeunload', event => { if (videoUploading) { event.preventDefault(); event.returnValue = ''; } });
$('#clip-form').addEventListener('submit', event => {
  event.preventDefault(); const form = event.currentTarget;
  busy(form, async () => {
    const file = form.elements.video.files[0]; const title = form.elements.title.value;
    videoUploading = true; $('#logout').disabled = true;
    for (const input of form.querySelectorAll('input')) input.disabled = true;
    try {
      await validateVideo(file);
      const { uploadUrl } = await request('/api/video-upload', { method: 'POST', body: JSON.stringify({ title, size: file.size, contentType: 'video/mp4' }) });
      $('#clip-progress').value = 0; $('#clip-percent').textContent = '0%'; $('#clip-progress-wrap').hidden = false;
      notice('Uploading your video. Please keep this page open…');
      await uploadVideo(uploadUrl, file);
      form.reset(); clearVideoPreview(); $('#clip-percent').textContent = 'Published'; $('#clip-progress').value = 100;
      await refresh();
    } finally {
      videoUploading = false; $('#logout').disabled = false;
      for (const input of form.querySelectorAll('input')) input.disabled = false;
    }
  }, 'Checking your video…', 'Video published. Visitors can now play it on the website.');
});
$('#member-form').addEventListener('submit', event => {
  event.preventDefault(); const form = event.currentTarget;
  busy(form, async () => {
    const profile = { name: form.elements.name.value, role: form.elements.role.value, note: form.elements.note.value };
    const file = form.elements.photo.files[0];
    const data = file ? await preparePhoto(file) : '';
    const body = { kind: form.elements.id.value ? 'member-edit' : 'members', ...profile, data };
    if (form.elements.id.value) { body.id = form.elements.id.value; await saveContent({ method: 'PATCH', body: JSON.stringify({ ...body, imageData: data }) }); }
    else await request('/api/media', { method: 'POST', body: JSON.stringify({ ...body, data }) });
    form.reset(); form.elements.photo.required = true; form.elements.id.value = ''; $('#member-form-title').textContent = 'Add a band member'; clearPreview('member'); await refresh();
  }, 'Saving band member…', 'Band member saved.');
});
$('#logout').addEventListener('click', async () => {
  try { await request('/api/session', { method: 'DELETE' }); signedIn(false); $('#photo-form').reset(); $('#video-form').reset(); $('#member-form').reset(); $('#clip-form').reset(); clearVideoPreview(); clearPreview(); clearPreview('member'); notice('You have signed out.'); }
  catch (error) { notice(error.message, 'error'); }
});
$('#refresh').addEventListener('click', async () => { try { await refresh(); notice('Collection is up to date.', 'success'); } catch (error) { notice(error.message, 'error'); } });
(async () => {
  try { const session = await request('/api/session'); signedIn(session.authenticated); if (session.authenticated) { await refresh(); await loadContentAdmin(); } notice(); }
  catch (error) { signedIn(false); notice(error.message, 'error'); }
})();
