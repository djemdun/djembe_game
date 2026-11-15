import { test } from 'node:test';
import assert from 'node:assert/strict';
import { APP_VERSION } from '../src/version.js';

test('APP_VERSION: YYYYMMDD + 同日の2回目以降は英小文字', () => {
  assert.match(APP_VERSION, /^\d{8}[a-z]?$/);
});
