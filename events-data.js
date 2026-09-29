// Calendar dates are compared as YYYY-MM-DD strings, never parsed as UTC instants.
export function validDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return false;
  const [y, m, d] = value.split('-').map(Number);
  const date = new Date(y, m - 1, d, 12);
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d;
}
export function calendarDate(date = new Date(), timeZone) {
  if (timeZone) {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
    return ['year', 'month', 'day'].map(type => parts.find(p => p.type === type).value).join('-');
  }
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
export function addDays(value, count) {
  const [y, m, d] = value.split('-').map(Number);
  return calendarDate(new Date(y, m - 1, d + count, 12));
}
export function normalizeEvent(show) {
  return { ...show, date: show.date || show.startDate, endDate: show.endDate || show.date || show.startDate };
}
export function eventToday(event, now = new Date()) { return calendarDate(now, event.timeZone || undefined); }
export function hasEventEnded(event, now = new Date()) { return event.endDate < eventToday(event, now); }
export function partitionEvents(shows, now = new Date()) {
  const events = shows.map(normalizeEvent).filter(e => validDate(e.date) && validDate(e.endDate));
  const compare = (a, b) => `${a.date}T${a.time || ''}`.localeCompare(`${b.date}T${b.time || ''}`);
  return { upcoming: events.filter(e => !hasEventEnded(e, now)).sort(compare), past: events.filter(e => hasEventEnded(e, now)).sort((a, b) => compare(b, a)) };
}
export function announcementEvents(shows, now = new Date()) {
  return partitionEvents(shows, now).upcoming.filter(event => {
    const today = eventToday(event, now);
    return event.date >= today && event.date <= addDays(today, 30);
  });
}
export function dateLabel(event) {
  const format = value => { const [y, m, d] = value.split('-').map(Number); return new Date(y, m - 1, d, 12).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }); };
  return event.endDate !== event.date ? `${format(event.date)} – ${format(event.endDate)}` : format(event.date);
}
export function safeWebUrl(value) { try { const url = new URL(value); return ['http:', 'https:'].includes(url.protocol) ? url.href : ''; } catch { return ''; } }
export function calendarFile(event) {
  const escape = value => String(value || '').replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
  // All-day dates deliberately avoid guessing a venue timezone or performance end time.
  const lines = ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Holud Panjabi//Events//EN','CALSCALE:GREGORIAN','BEGIN:VEVENT',`UID:${escape(event.id || event.date)}@holud-panjabi.com`,`DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')}`,`DTSTART;VALUE=DATE:${event.date.replaceAll('-', '')}`,`DTEND;VALUE=DATE:${addDays(event.endDate, 1).replaceAll('-', '')}`,`SUMMARY:${escape(event.name)}`,`LOCATION:${escape([event.venue, event.address || event.location].filter(Boolean).join(', '))}`,`DESCRIPTION:${escape([event.time ? `Performance time: ${event.time} (venue local time)` : '', event.performance, event.description].filter(Boolean).join('\n'))}`,'END:VEVENT','END:VCALENDAR'];
  // Fold by UTF-8 bytes so Bengali text remains valid in calendar clients.
  return lines.map(line => { let out = '', bytes = 0; for (const char of line) { const size = new TextEncoder().encode(char).length; if (bytes + size > 74) { out += '\r\n '; bytes = 1; } out += char; bytes += size; } return out; }).join('\r\n') + '\r\n';
}
