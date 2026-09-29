import { partitionEvents, announcementEvents, dateLabel, safeWebUrl, calendarFile } from './events-data.js';

const el = (tag, className, text) => { const node = document.createElement(tag); if (className) node.className = className; if (text) node.textContent = text; return node; };
const button = (text, action, className = 'performance-action') => { const node = el('button', className, text); node.type = 'button'; node.addEventListener('click', action); return node; };
const link = (text, href, className = 'performance-action') => { const node = el('a', className, text); node.href = href; return node; };
let events = [];
let stopAnnouncement = () => {};
let detailOpener;
const details = el('dialog', 'performance-dialog'); details.id = 'event-details'; details.setAttribute('aria-labelledby', 'event-detail-title');
const detailToolbar = el('div', 'performance-toolbar'); detailToolbar.append(el('span', '', 'HOLUD PANJABI / LIVE'), button('Close ×', () => details.close(), 'performance-close'));
const detailBody = el('div', 'performance-detail-body'); details.append(detailToolbar, detailBody); document.body.append(details);
const zoom = el('dialog', 'performance-zoom'); zoom.setAttribute('aria-label', 'Enlarged event flyer');
const zoomClose = button('Close flyer ×', () => zoom.close(), 'performance-close'); const zoomImage = el('img'); zoom.append(zoomClose, zoomImage); document.body.append(zoom);
for (const dialog of [details, zoom]) dialog.addEventListener('click', event => { if (event.target === dialog) { const bounds = dialog.getBoundingClientRect(); if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) dialog.close(); } });
details.addEventListener('close', () => { if (zoom.open) zoom.close(); document.body.classList.remove('performance-dialog-open'); detailOpener?.focus({ preventScroll: true }); });
zoom.addEventListener('close', () => zoomImage.removeAttribute('src'));

function flyer(event, enlarge = false) {
  const frame = el('div', 'performance-flyer');
  if (event.image) {
    const image = el('img'); image.src = event.image; image.alt = `${event.name} — event flyer`; image.loading = enlarge ? 'eager' : 'lazy';
    image.addEventListener('error', () => { frame.replaceChildren(el('span', 'performance-flyer-fallback', 'Flyer unavailable · event details below')); });
    if (enlarge) { const control = button('', () => { zoomImage.src = event.image; zoomImage.alt = image.alt; zoom.showModal(); }, 'performance-enlarge'); control.setAttribute('aria-label', `Enlarge flyer for ${event.name}`); control.append(image, el('span', 'flyer-zoom-label', 'View full flyer ↗')); frame.append(control); }
    else frame.append(image);
  } else {
    const art = el('div', 'performance-no-flyer'); art.append(el('span', 'performance-flower', '✺'), el('span', '', 'HOLUD PANJABI'), el('strong', '', 'The rhythm brings us together.'), el('small', '', 'Event flyer coming soon')); frame.append(art);
  }
  return frame;
}
function dateMark(event) {
  const mark = el('div', 'performance-date'); const [year, month, day] = event.date.split('-');
  const sameMonth = event.date.slice(0, 7) === event.endDate.slice(0, 7);
  const monthName = new Date(Number(year), Number(month) - 1, 1).toLocaleDateString('en-US', { month: 'short' });
  mark.setAttribute('aria-label', dateLabel(event));
  mark.append(el('span', '', monthName), el('strong', '', `${Number(day)}${event.endDate !== event.date && sameMonth ? `–${Number(event.endDate.slice(-2))}` : ''}`), el('small', '', !sameMonth ? `through ${dateLabel({ ...event, date: event.endDate })}` : year));
  return mark;
}
function eventIdentity(event, tag = 'h3') {
  const identity = el('div', 'performance-identity'); identity.append(el('p', 'performance-organiser', event.organisedBy), el(tag, '', event.name), el('p', 'performance-location', [event.venue, event.location].filter(Boolean).join(' · '))); return identity;
}
function summary(event) { const text = event.description || event.performance; return text ? text.length > 170 ? `${text.slice(0, 167).trim()}…` : text : ''; }
function card(event, featured = false) {
  const article = el('article', featured ? 'performance-feature' : 'performance-card');
  const poster = flyer(event); article.append(poster);
  const copy = el('div', 'performance-copy'); copy.append(el('p', 'performance-kicker', featured ? 'NEXT PERFORMANCE' : 'ON THE HORIZON'), dateMark(event), eventIdentity(event));
  if (summary(event)) copy.append(el('p', 'performance-summary', summary(event)));
  copy.append(button('Explore event →', e => openDetails(event, e.currentTarget)));
  article.append(copy); return article;
}
function block(label, text) { const node = el('section', 'performance-info-block'); node.append(el('h3', '', label), el('p', '', text)); return node; }
function eventUrl(event) { const url = new URL(location.href); url.hash = `event=${encodeURIComponent(event.id)}`; return url.href; }
function openDetails(event, opener) {
  stopAnnouncement(); detailOpener = opener || document.activeElement; detailBody.replaceChildren();
  const hero = el('header', 'performance-detail-hero'); hero.append(el('p', 'performance-kicker', `${event.organisedBy} / HOLUD PANJABI LIVE`));
  const title = el('h2', '', event.name); title.id = 'event-detail-title'; hero.append(title, el('p', '', `${dateLabel(event)} · ${event.location}`));
  const columns = el('div', 'performance-detail-columns'); columns.append(flyer(event, true));
  const info = el('div', 'performance-info');
  info.append(block('WHEN', [dateLabel(event), event.time ? `${event.time} · venue local time` : 'Performance time to be announced'].join('\n')));
  info.append(block('WHERE', [event.venue, event.address, event.location].filter(Boolean).join('\n')));
  info.append(block('HOLUD PANJABI', event.performance || 'The sound of dhak. The spirit of celebration. Join Holud Panjabi for a live performance.'));
  if (event.description) info.append(block('ABOUT THE EVENT', event.description));
  const actions = el('div', 'performance-actions');
  const destination = [event.venue, event.address || event.location].filter(Boolean).join(', ');
  if (destination) { const directions = link('Get directions ↗', `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(destination)}`); directions.target = '_blank'; directions.rel = 'noopener noreferrer'; actions.append(directions); }
  const website = safeWebUrl(event.website);
  if (website) { const site = link('Event website ↗', website, 'performance-action secondary'); site.target = '_blank'; site.rel = 'noopener noreferrer'; actions.append(site); }
  const feedback = el('p', 'performance-feedback'); feedback.setAttribute('role', 'status');
  actions.append(button('Share event ↗', async () => {
    const url = eventUrl(event);
    try {
      if (navigator.share) { await navigator.share({ title: event.name, text: `${dateLabel(event)} · ${event.location}`, url }); return; }
      if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(url); feedback.textContent = 'Event link copied.'; return; }
    } catch (error) { if (error.name === 'AbortError') return; }
    feedback.replaceChildren(el('span', '', 'Copy this event link: ')); const input = el('input'); input.value = url; input.readOnly = true; input.setAttribute('aria-label', 'Event link'); feedback.append(input); input.focus(); input.select();
  }, 'performance-action secondary'));
  actions.append(button('Add to calendar ↓', () => { const url = URL.createObjectURL(new Blob([calendarFile(event)], { type: 'text/calendar;charset=utf-8' })); const download = link('', url); download.download = 'holud-panjabi-event.ics'; document.body.append(download); download.click(); download.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000); }, 'performance-action secondary'));
  info.append(actions, el('p', 'performance-calendar-note', 'Calendar download saves the event dates. Performance times are included in the notes.'), feedback); columns.append(info); detailBody.append(hero, columns);
  if (!details.open) details.showModal(); details.scrollTop = 0; document.body.classList.add('performance-dialog-open'); detailToolbar.querySelector('button').focus();
}
function render(shows) {
  const { upcoming, past } = partitionEvents(shows); events = [...upcoming, ...past];
  const root = document.querySelector('#performances'); root.replaceChildren();
  if (upcoming.length) {
    root.append(card(upcoming[0], true));
    if (upcoming.length > 1) { const heading = el('h3', 'performance-more-heading', 'More moments to look forward to.'); const grid = el('div', 'performance-grid'); upcoming.slice(1).forEach(event => grid.append(card(event))); root.append(heading, grid); }
  } else {
    const empty = el('div', 'performance-empty'); empty.append(el('span', 'performance-flower', '✺'), el('p', 'performance-kicker', 'NEXT CELEBRATION'), el('h3', '', 'The dhak will sound again.'), el('p', '', 'New performance dates coming soon.'), link('Invite Holud Panjabi ↗', '#contact')); root.append(empty);
  }
  const archive = document.querySelector('#past-performances'); archive.hidden = !past.length; archive.replaceChildren();
  if (past.length) { archive.append(el('p', 'performance-kicker', 'OUR JOURNEY'), el('h3', 'performance-more-heading', 'Past performances.')); past.forEach(event => { const row = el('div', 'performance-past-row'); row.append(el('span', '', dateLabel(event)), eventIdentity(event), button('Revisit event →', e => openDetails(event, e.currentTarget), 'performance-action secondary')); archive.append(row); }); }
  if (!openSharedEvent()) announce(announcementEvents(shows));
}
function openSharedEvent() { if (!location.hash.startsWith('#event=')) return false; let id; try { id = decodeURIComponent(location.hash.slice(7)); } catch { return false; } const event = events.find(e => e.id === id); if (!event) return false; openDetails(event); return true; }
window.addEventListener('hashchange', openSharedEvent);
function announce(upcoming) {
  if (!upcoming.length || document.querySelector('dialog[open]')) return;
  const notice = el('aside', 'performance-announcement'); notice.setAttribute('aria-label', 'Upcoming Holud Panjabi performance');
  const close = button('×', () => stopAnnouncement(), 'performance-notice-close'); close.setAttribute('aria-label', 'Dismiss event announcement');
  const slide = el('div', 'performance-notice-slide'); const footer = el('div', 'performance-notice-footer');
  let index = 0; let rotation; let expiry; const deadline = Date.now() + 8000;
  const view = button('View event →', e => { const event = upcoming[index]; stopAnnouncement(); openDetails(event, document.querySelector('#performances button') || e.currentTarget); }, 'performance-notice-view');
  footer.append(view); notice.append(close, slide, footer); document.body.append(notice);
  const draw = () => { const event = upcoming[index]; slide.replaceChildren(); if (event.image) { const image = el('img'); image.src = event.image; image.alt = `${event.name} flyer`; image.addEventListener('error', () => image.remove()); slide.append(image); } else { slide.append(el('p', 'performance-flyer-fallback', 'Event flyer unavailable')); } };
  const visibility = () => { if (Date.now() >= deadline) stopAnnouncement(); };
  const escape = event => { if (event.key === 'Escape') stopAnnouncement(); };
  stopAnnouncement = () => { clearInterval(rotation); clearTimeout(expiry); document.removeEventListener('visibilitychange', visibility); document.removeEventListener('keydown', escape); const hadFocus = notice.contains(document.activeElement); notice.remove(); if (hadFocus) document.querySelector('#performances button, #performances a')?.focus({ preventScroll: true }); };
  draw(); if (upcoming.length > 1) rotation = setInterval(() => { if (Date.now() >= deadline) { stopAnnouncement(); return; } index = (index + 1) % upcoming.length; draw(); }, 4000);
  expiry = setTimeout(() => stopAnnouncement(), 8000); document.addEventListener('visibilitychange', visibility); document.addEventListener('keydown', escape);
}
fetch('/api/content').then(response => { if (!response.ok) throw new Error('Unable to load events'); return response.json(); }).then(content => render(content.shows || [])).catch(() => {
  const root = document.querySelector('#performances'); root.replaceChildren(el('p', 'events-loading', 'Our show schedule is temporarily unavailable. Please check back shortly.'), link('Contact the band ↗', '#contact'));
});
