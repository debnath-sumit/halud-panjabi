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

async function loadMedia() {
  try {
    const response = await fetch('/api/media');
    if (!response.ok) return;
    const { items } = await response.json();
    const photos = items.filter(item => item.kind === 'photos');
    const videos = items.filter(item => item.kind === 'videos');
    const albums = document.querySelector('.album-grid');
    const videoGrid = document.querySelector('.video-grid');
    if (photos.length) albums.replaceChildren();
    if (videos.length) videoGrid.replaceChildren();
    photos.forEach(item => {
      const article = document.createElement('article'); article.className = 'album';
      const link = document.createElement('a'); link.className = 'published-photo'; link.href = item.url; link.target = '_blank'; link.rel = 'noopener'; link.setAttribute('aria-label', `View ${item.title} full size`);
      const img = document.createElement('img'); img.src = item.url; img.alt = item.title; img.loading = 'lazy';
      const heading = document.createElement('h3'); heading.textContent = item.title;
      link.append(img); article.append(link, heading); albums.append(article);
    });
    videos.forEach(item => {
      const article = document.createElement('article'); article.className = 'video-card';
      const iframe = document.createElement('iframe'); iframe.src = `https://www.youtube-nocookie.com/embed/${item.videoId}`; iframe.title = item.title; iframe.loading = 'lazy'; iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share'; iframe.allowFullscreen = true; iframe.referrerPolicy = 'strict-origin-when-cross-origin';
      const heading = document.createElement('h3'); heading.textContent = item.title;
      const fallback = document.createElement('a'); fallback.className = 'text-link'; fallback.href = `https://www.youtube.com/watch?v=${item.videoId}`; fallback.target = '_blank'; fallback.rel = 'noopener'; fallback.textContent = 'Watch on YouTube ↗';
      article.append(iframe, heading, fallback); videoGrid.append(article);
    });
  } catch { /* Keep the existing gallery placeholders when storage is unavailable. */ }
}
loadMedia();
