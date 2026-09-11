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
document.querySelector('#booking-form').addEventListener('submit', event => {
  event.preventDefault();
  const data = new FormData(event.target);
  const result = document.querySelector('#form-result');
  result.textContent = `Inquiry preview — nothing has been sent.\n\nName: ${data.get('name')}\nEmail: ${data.get('email')}\nEvent date: ${data.get('date')}\nLocation: ${data.get('location')}\n\n${data.get('message')}\n\nLive booking will be available once the band’s contact service is connected.`;
  result.hidden = false;
});

const lightbox = document.querySelector('#photo-lightbox');
let lightboxItems = []; let lightboxIndex = 0; let lightboxOpener;
function renderLightbox() {
  const item = lightboxItems[lightboxIndex];
  const image = document.querySelector('#lightbox-image');
  document.querySelector('#lightbox-error').hidden = true;
  image.alt = item.name || item.title; image.src = item.url;
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
    members.forEach((item, index) => {
      const article = document.createElement('article'); article.className = 'member-card';
      const portrait = document.createElement('button'); portrait.type = 'button'; portrait.className = 'member-portrait';
      const noteId = `member-note-${index}`;
      portrait.setAttribute('aria-expanded', 'false'); portrait.setAttribute('aria-controls', noteId); portrait.setAttribute('aria-label', `About ${item.name}`);
      portrait.setAttribute('aria-haspopup', 'dialog');
      const img = document.createElement('img'); img.src = item.url; img.alt = item.name; img.loading = 'lazy';
      const overlay = document.createElement('span'); overlay.className = 'member-note'; overlay.id = noteId; overlay.textContent = item.note; overlay.hidden = true;
      const hint = document.createElement('span'); hint.className = 'member-hint'; hint.textContent = 'View portrait ↗';
      const reveal = open => { overlay.hidden = !open; portrait.setAttribute('aria-expanded', String(open)); portrait.classList.toggle('revealed', open); hint.textContent = 'View portrait ↗'; };
      portrait.addEventListener('pointerenter', event => { if (event.pointerType === 'mouse') reveal(true); });
      portrait.addEventListener('pointerleave', event => { if (event.pointerType === 'mouse') reveal(false); });
      portrait.addEventListener('click', () => openLightbox(members, index, portrait));
      portrait.addEventListener('keydown', event => { if (event.key === 'Escape') { reveal(false); event.stopPropagation(); } });
      portrait.addEventListener('blur', () => reveal(false));
      const name = document.createElement('h3'); name.textContent = item.name;
      const role = document.createElement('p'); role.className = 'member-role'; role.textContent = item.role;
      portrait.append(img, overlay, hint); article.append(portrait, name, role); memberGrid.append(article);
    });
    const albums = document.querySelector('.album-grid');
    const videoGrid = document.querySelector('.video-grid');
    if (photos.length) albums.replaceChildren();
    if (videos.length) videoGrid.replaceChildren();
    photos.forEach((item, index) => {
      const article = document.createElement('article'); article.className = 'album';
      const link = document.createElement('button'); link.type = 'button'; link.className = 'published-photo'; link.setAttribute('aria-label', `View ${item.title} full size`); link.setAttribute('aria-haspopup', 'dialog');
      link.addEventListener('click', () => openLightbox(photos, index, link));
      const img = document.createElement('img'); img.src = item.url; img.alt = item.title; img.loading = 'lazy';
      const heading = document.createElement('h3'); heading.textContent = item.title;
      link.append(img); article.append(link, heading); albums.append(article);
    });
    videos.forEach(item => {
      const article = document.createElement('article'); article.className = 'video-card';
      if (item.kind === 'clips') {
        const video = document.createElement('video'); video.src = item.url; video.controls = true; video.playsInline = true; video.preload = 'metadata'; video.setAttribute('aria-label', item.title);
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
  } catch { /* Keep the existing gallery placeholders when storage is unavailable. */ }
}
loadMedia();
