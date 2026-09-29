import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validDate, calendarDate, addDays, partitionEvents, announcementEvents, calendarFile, normalizeEvent, safeWebUrl } from '../events-data.js';
const event = (date, extra = {}) => ({ id: date, name: 'Dhak celebration', date, ...extra });
const now = new Date(2026, 8, 22, 12);
test('calendar window includes today and day 30, excludes yesterday and day 31, nearest first', () => {
 const shows = [event('2026-10-22'), event('2026-10-23'), event('2026-09-21'), event('2026-09-22')];
 assert.deepEqual(announcementEvents(shows, now).map(e => e.date), ['2026-09-22','2026-10-22']);
});
test('multi-day events remain upcoming through the end date but already-started events do not announce', () => {
 const shows = [event('2026-09-20', { endDate: '2026-09-22' }),event('2026-09-19', { endDate: '2026-09-21' })];
 assert.equal(partitionEvents(shows, now).upcoming.length, 1);
 assert.equal(partitionEvents(shows, now).past.length, 1);
 assert.equal(announcementEvents(shows, now).length, 0);
});
test('calendar arithmetic crosses DST, leap days, month and year boundaries without UTC shifts', () => {
 assert.equal(addDays('2026-10-22',30),'2026-11-21'); assert.equal(addDays('2026-12-20',30),'2027-01-19');
 assert.equal(addDays('2028-02-28',1),'2028-02-29'); assert.equal(validDate('2026-02-30'),false);
 assert.equal(calendarDate(new Date('2026-09-22T01:00:00Z'),'America/Los_Angeles'),'2026-09-21');
 assert.equal(announcementEvents([event('2026-09-21',{ timeZone:'America/Los_Angeles' })],new Date('2026-09-22T01:00:00Z')).length,1);
});
test('calendar export uses exclusive end dates, escapes text, and folds UTF-8 lines', () => {
 const text = calendarFile(normalizeEvent(event('2026-10-17',{endDate:'2026-10-18',name:'Music, dance; joy',description:'বাংলা'.repeat(50)+'\nNext line'})));
 assert.match(text,/DTSTART;VALUE=DATE:20261017/);assert.match(text,/DTEND;VALUE=DATE:20261019/);assert.match(text,/Music\\, dance\\; joy/);
 assert.ok(text.split('\r\n').every(line=>Buffer.byteLength(line)<=75));
});
test('external action URLs reject unsafe protocols',()=>{assert.equal(safeWebUrl('javascript:alert(1)'),'');assert.equal(safeWebUrl('https://example.com'),'https://example.com/');});
