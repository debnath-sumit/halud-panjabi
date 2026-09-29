const toggle = document.querySelector('.menu-toggle');
const navigation = document.querySelector('#navigation');
function closeMenu() { navigation.classList.remove('open'); toggle.setAttribute('aria-expanded', 'false'); }
toggle.addEventListener('click', () => { const open = navigation.classList.toggle('open'); toggle.setAttribute('aria-expanded', String(open)); });
navigation.querySelectorAll('a').forEach(link => link.addEventListener('click', closeMenu));
document.addEventListener('keydown', event => { if (event.key === 'Escape') { closeMenu(); } });
const links = [...navigation.querySelectorAll('a')];
const observer = new IntersectionObserver(entries => { entries.forEach(entry => { if (entry.isIntersecting) { links.forEach(link => { const active = link.hash === '#' + entry.target.id; link.classList.toggle('active', active); if (active) link.setAttribute('aria-current', 'location'); else link.removeAttribute('aria-current'); }); } }); }, { rootMargin: '-15% 0px -60% 0px' });
document.querySelectorAll('main section[id]').forEach(section => observer.observe(section));
document.querySelector('#year').textContent = new Date().getFullYear();
const chatToggle = document.querySelector('#chat-toggle'); const chatPanel = document.querySelector('#chat-panel'); const chatClose = document.querySelector('#chat-close'); const chatMessages = document.querySelector('#chat-messages');
function setChat(open) { chatPanel.hidden = !open; chatToggle.setAttribute('aria-expanded', String(open)); if (open) chatPanel.querySelector('input').focus(); }
chatToggle.addEventListener('click', () => setChat(chatPanel.hidden)); chatClose.addEventListener('click', () => setChat(false));
document.querySelector('#chat-form').addEventListener('submit', async event => { event.preventDefault(); const form = event.target; const input = form.elements.message; const question = input.value.trim(); if (!question) return; const bubble = document.createElement('p'); bubble.className = 'chat-bubble visitor'; bubble.textContent = question; chatMessages.append(bubble); input.value = ''; input.disabled = true; const reply = document.createElement('p'); reply.className = 'chat-bubble assistant'; reply.textContent = 'Thinking…'; chatMessages.append(reply); chatMessages.scrollTop = chatMessages.scrollHeight; try { const response = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: question }) }); const payload = await response.json(); if (!response.ok) throw new Error(payload.error || 'The assistant is unavailable.'); reply.textContent = payload.answer; } catch (error) { reply.textContent = error.message; } input.disabled = false; input.focus(); chatMessages.scrollTop = chatMessages.scrollHeight; });
const dhakAudio = document.querySelector('#dhak-audio'); let dhakStarted = false; let dhakSettings = null; let dhakGestureArmed = false;
const DHAK_DEFAULTS = { playSeconds: 15, fadeSeconds: 0 };
function armDhakGesture() {
  if (dhakGestureArmed || dhakStarted) return;
  dhakGestureArmed = true;
  const start = () => { dhakGestureArmed = false; playDhak(dhakSettings || DHAK_DEFAULTS); };
  for (const type of ['pointerdown', 'touchstart', 'keydown']) document.addEventListener(type, start, { once: true, passive: true });
}
async function playDhak(settings = DHAK_DEFAULTS) {
  if (dhakStarted) return; dhakStarted = true;
  dhakAudio.pause(); dhakAudio.currentTime = 0; dhakAudio.volume = 0;
  const playSeconds = Number.isInteger(Number(settings.playSeconds)) ? Math.max(0, Math.min(1800, Number(settings.playSeconds))) : DHAK_DEFAULTS.playSeconds;
  const fadeSeconds = Number.isInteger(Number(settings.fadeSeconds)) ? Math.max(0, Math.min(1800, Number(settings.fadeSeconds))) : DHAK_DEFAULTS.fadeSeconds;
  try {
    await dhakAudio.play();
    const started = performance.now();
    const timer = setInterval(() => {
      const elapsed = (performance.now() - started) / 1000;
      if (elapsed >= playSeconds + fadeSeconds) {
        clearInterval(timer); dhakAudio.pause(); dhakAudio.currentTime = 0; dhakAudio.volume = 0; return;
      }
      dhakAudio.volume = elapsed < playSeconds || fadeSeconds === 0 ? 1 : Math.max(0, 1 - ((elapsed - playSeconds) / fadeSeconds));
    }, 100);
  } catch { dhakStarted = false; armDhakGesture(); }
}
dhakAudio.volume = 0;
fetch('/api/content').then(response => response.ok ? response.json() : Promise.reject(new Error('content unavailable')))
  .then(content => { dhakSettings = { ...DHAK_DEFAULTS, ...(content.audio || {}) }; return playDhak(dhakSettings); })
  .catch(() => playDhak(DHAK_DEFAULTS));
document.querySelector('#booking-form').addEventListener('submit', async event => {
  event.preventDefault();
  const data = new FormData(event.target);
  const result = document.querySelector('#form-result');
  const button = event.target.querySelector('button[type="submit"]'); button.disabled = true; result.textContent = 'Sending your inquiry…';
  try {
    const response = await fetch('/api/contact', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(Object.fromEntries(data)) });
    const payload = await response.json(); if (!response.ok) throw new Error(payload.error || 'Your inquiry could not be sent.');
    result.textContent = 'Your inquiry has been sent. We’ll be in touch soon.'; event.target.reset();
  } catch (error) { result.textContent = error.message; }
  button.disabled = false;
  result.hidden = false;
});

const lightbox = document.querySelector('#photo-lightbox');
let lightboxItems = []; let lightboxIndex = 0; let lightboxOpener;
function renderLightbox() {
  const item = lightboxItems[lightboxIndex];
  const image = document.querySelector('#lightbox-image');
  document.querySelector('#lightbox-error').hidden = true;
  image.alt = item.name || item.title; image.hidden = !item.url;
  if (item.url) image.src = item.url; else image.removeAttribute('src');
  document.querySelector('#lightbox-title').textContent = item.name || item.title;
  for (const field of ['role', 'note']) {
    const element = document.querySelector(`#lightbox-${field}`); element.textContent = item[field] || ''; element.hidden = !item[field];
  }
  document.querySelector('#lightbox-count').textContent = `${lightboxIndex + 1} / ${lightboxItems.length}`;
  document.querySelector('.lightbox-navigation').hidden = lightboxItems.length < 2;
}
function openLightbox(items, index, opener) {
  lightboxItems = items; lightboxIndex = index; lightboxOpener = opener;
  renderLightbox(); lightbox.showModal(); document.body.classList.add('lightbox-open'); document.querySelector('#lightbox-close').focus();
}
function stepLightbox(offset) { lightboxIndex = (lightboxIndex + offset + lightboxItems.length) % lightboxItems.length; renderLightbox(); }
document.querySelector('#lightbox-close').addEventListener('click', () => lightbox.close());
document.querySelector('#lightbox-previous').addEventListener('click', () => stepLightbox(-1));
document.querySelector('#lightbox-next').addEventListener('click', () => stepLightbox(1));
document.querySelector('#lightbox-image').addEventListener('error', () => { document.querySelector('#lightbox-error').hidden = false; });
lightbox.addEventListener('click', event => { if (event.target === lightbox) lightbox.close(); });
lightbox.addEventListener('keydown', event => {
  if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') { event.preventDefault(); stepLightbox(event.key === 'ArrowRight' ? 1 : -1); }
});
lightbox.addEventListener('close', () => {
  document.body.classList.remove('lightbox-open'); document.querySelector('#lightbox-image').removeAttribute('src');
  lightboxOpener?.focus({ preventScroll: true }); lightboxItems = [];
});

async function loadMedia() {
  try {
    const response = await fetch('/api/media');
    if (!response.ok) return;
    const { items } = await response.json();
    const photos = items.filter(item => item.kind === 'photos');
    const videos = items.filter(item => item.kind === 'videos' || item.kind === 'clips');
    const members = items.filter(item => item.kind === 'members');
    const memberGrid = document.querySelector('#member-grid');
    if (members.length) {
      document.querySelector('#band-members').hidden = false;
      document.querySelector('#band').classList.add('has-members');
      memberGrid.replaceChildren();
    }
    const memberMore = document.querySelector('#members-load-more');
    let memberCount = 0;
    const renderMembers = () => {
      members.slice(memberCount, memberCount + 9).forEach((item, index) => {
      const itemIndex = memberCount + index;
      const article = document.createElement('article'); article.className = 'member-card';
      const portrait = document.createElement('button'); portrait.type = 'button'; portrait.className = 'member-portrait';
      const noteId = `member-note-${itemIndex}`;
      portrait.setAttribute('aria-expanded', 'false'); portrait.setAttribute('aria-controls', noteId); portrait.setAttribute('aria-label', `About ${item.name}`); portrait.setAttribute('aria-haspopup', 'dialog');
      const img = document.createElement('img'); img.src = item.url; img.alt = item.name; img.loading = 'lazy';
      const overlay = document.createElement('span'); overlay.className = 'member-note'; overlay.id = noteId; overlay.textContent = item.note; overlay.hidden = true;
      const hint = document.createElement('span'); hint.className = 'member-hint'; hint.textContent = 'View portrait ↗';
      const reveal = open => { overlay.hidden = !open; portrait.setAttribute('aria-expanded', String(open)); portrait.classList.toggle('revealed', open); };
      portrait.addEventListener('pointerenter', event => { if (event.pointerType === 'mouse') reveal(true); }); portrait.addEventListener('pointerleave', event => { if (event.pointerType === 'mouse') reveal(false); });
      portrait.addEventListener('click', () => openLightbox(members, itemIndex, portrait)); portrait.addEventListener('keydown', event => { if (event.key === 'Escape') { reveal(false); event.stopPropagation(); } }); portrait.addEventListener('blur', () => reveal(false));
      const name = document.createElement('h3'); name.textContent = item.name; const role = document.createElement('p'); role.className = 'member-role'; role.textContent = item.role;
      portrait.append(img, overlay, hint); article.append(portrait, name, role); memberGrid.append(article);
      });
      memberCount += Math.min(9, members.length - memberCount); memberMore.hidden = memberCount >= members.length;
    };
    memberMore.addEventListener('click', renderMembers); renderMembers();
    const albums = document.querySelector('.album-grid');
    const videoGrid = document.querySelector('.video-grid');
    const photoMore = document.querySelector('#photos-load-more');
    const videoMore = document.querySelector('#videos-load-more');
    const photoPageSize = 9; const videoPageSize = 6;
    let photoCount = 0; let videoCount = 0;
    if (photos.length) albums.replaceChildren();
    if (videos.length) videoGrid.replaceChildren();
    const renderPhotos = () => {
      photos.slice(photoCount, photoCount + photoPageSize).forEach((item, index) => {
      const article = document.createElement('article'); article.className = 'album';
      const link = document.createElement('button'); link.type = 'button'; link.className = 'published-photo'; link.setAttribute('aria-label', `View ${item.title} full size`); link.setAttribute('aria-haspopup', 'dialog');
      const itemIndex = photoCount + index;
      link.addEventListener('click', () => openLightbox(photos, itemIndex, link));
      const img = document.createElement('img'); img.src = item.url; img.alt = item.title; img.loading = 'lazy';
      const heading = document.createElement('h3'); heading.textContent = item.title;
      link.append(img); article.append(link, heading); albums.append(article);
      });
      photoCount += Math.min(photoPageSize, photos.length - photoCount);
      photoMore.hidden = photoCount >= photos.length;
    };
    photoMore.addEventListener('click', renderPhotos);
    renderPhotos();
    const renderVideos = () => {
    videos.slice(videoCount, videoCount + videoPageSize).forEach(item => {
      const article = document.createElement('article'); article.className = 'video-card';
      if (item.kind === 'clips') {
        const video = document.createElement('video'); video.src = item.url; video.controls = true; video.playsInline = true; video.preload = 'none'; video.setAttribute('aria-label', item.title);
        const message = document.createElement('p'); message.className = 'video-playback-error'; message.hidden = true; message.textContent = 'This video cannot play in this browser. Try opening it below.';
        video.addEventListener('error', () => { message.hidden = false; });
        const heading = document.createElement('h3'); heading.textContent = item.title;
        const link = document.createElement('a'); link.className = 'text-link'; link.href = item.url; link.target = '_blank'; link.rel = 'noopener'; link.textContent = 'Open video ↗';
        article.append(video, heading, message, link); videoGrid.append(article); return;
      }
      const iframe = document.createElement('iframe'); iframe.src = `https://www.youtube-nocookie.com/embed/${item.videoId}`; iframe.title = item.title; iframe.loading = 'lazy'; iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share'; iframe.allowFullscreen = true; iframe.referrerPolicy = 'strict-origin-when-cross-origin';
      const heading = document.createElement('h3'); heading.textContent = item.title;
      const fallback = document.createElement('a'); fallback.className = 'text-link'; fallback.href = `https://www.youtube.com/watch?v=${item.videoId}`; fallback.target = '_blank'; fallback.rel = 'noopener'; fallback.textContent = 'Watch on YouTube ↗';
      article.append(iframe, heading, fallback); videoGrid.append(article);
      });
      videoCount += Math.min(videoPageSize, videos.length - videoCount);
      videoMore.hidden = videoCount >= videos.length;
    };
    videoMore.addEventListener('click', renderVideos);
    renderVideos();
  } catch { /* Keep the existing gallery placeholders when storage is unavailable. */ }
}
loadMedia();

async function loadContent() {
  try {
    const response = await fetch('/api/content'); if (!response.ok) return;
    const content = await response.json(); const intro = content.intro || {};
    if (intro.bengaliTitle) document.querySelector('#intro-bengali').textContent = intro.bengaliTitle;
    if (intro.englishTitle) document.querySelector('#intro-english').textContent = intro.englishTitle;
    if (intro.description) document.querySelector('#intro-description').textContent = intro.description;
    if (intro.image) document.querySelector('#intro-image').src = intro.image;

  } catch { /* Keep the designed defaults when content storage is unavailable. */ }
}
loadContent();
