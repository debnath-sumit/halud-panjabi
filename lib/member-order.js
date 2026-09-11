import { HttpError } from './http.js';
import { isMemberPath } from './media.js';

export function validateMemberOrder(ids, items) {
  if (!Array.isArray(ids) || ids.length > 500 || ids.some(id => !isMemberPath(id)) || new Set(ids).size !== ids.length) throw new HttpError(400, 'Send a valid order without duplicate members.');
  const current = items.filter(item => item.kind === 'members').map(item => item.id);
  if (ids.length !== current.length || current.some(id => !ids.includes(id))) throw new HttpError(409, 'The band member list changed. Refresh and try again.');
  return ids;
}

export function applyMemberOrder(items, ids = []) {
  const members = items.filter(item => item.kind === 'members');
  const byId = new Map(members.map(item => [item.id, item]));
  const ordered = [];
  for (const id of ids) {
    if (byId.has(id)) { ordered.push(byId.get(id)); byId.delete(id); }
  }
  // New members follow the saved line-up; removed members are ignored.
  return [...items.filter(item => item.kind !== 'members'), ...ordered, ...byId.values()];
}
