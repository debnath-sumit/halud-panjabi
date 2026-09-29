import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';

test('signing in loads existing events as well as media', async () => {
  const source = await readFile(new URL('../admin.js', import.meta.url), 'utf8');
  const start = source.indexOf("$('#login-form').addEventListener('submit'");
  const end = source.indexOf("$('#photo-form').addEventListener", start);
  let submit, pending;
  const calls = [];
  runInNewContext(source.slice(start, end), {
    $: () => ({ addEventListener: (_type, handler) => { submit = handler; } }),
    busy: (_form, task) => { pending = task(); },
    request: async () => { calls.push('authenticated'); },
    FormData: class { *[Symbol.iterator]() { yield ['username', 'admin']; } },
    signedIn: value => { assert.equal(value, true); calls.push('studio'); },
    refresh: async () => { calls.push('media'); },
    loadContentAdmin: async () => { calls.push('events'); },
  });
  submit({ preventDefault() {}, currentTarget: { reset() {} } });
  await pending;
  assert.equal(calls[0], 'authenticated');
  assert.ok(calls.includes('events'), 'Existing event cards must load immediately after login');
  assert.ok(calls.includes('media'));
});
