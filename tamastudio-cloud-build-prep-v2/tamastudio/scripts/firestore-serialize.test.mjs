import test from 'node:test';
import assert from 'node:assert/strict';
import { serializeFirestoreValue } from '../lib/firestore-serialize.mjs';

test('preserves JSON-safe primitive values and normalizes nullish values', () => {
  assert.equal(serializeFirestoreValue('text'), 'text');
  assert.equal(serializeFirestoreValue(0), 0);
  assert.equal(serializeFirestoreValue(false), false);
  assert.equal(serializeFirestoreValue(null), null);
  assert.equal(serializeFirestoreValue(undefined), null);
});

test('serializes Date to an explicit ISO representation', () => {
  assert.deepEqual(serializeFirestoreValue(new Date('2026-10-15T12:34:56.000Z')), {
    __date: '2026-10-15T12:34:56.000Z',
  });
});

test('serializes Firestore-like timestamps with seconds and nanoseconds', () => {
  const timestamp = { seconds: 1_797_072_896, nanoseconds: 123_000_000, toDate() { return new Date(0); } };
  assert.deepEqual(serializeFirestoreValue(timestamp), {
    __timestamp: true, seconds: 1_797_072_896, nanoseconds: 123_000_000,
  });
});

test('recursively serializes nested objects and arrays', () => {
  const input = { createdAt: new Date('2026-01-02T03:04:05.000Z'), rows: [1, { at: { seconds: 7, nanoseconds: 0, toDate() {} } }] };
  assert.deepEqual(serializeFirestoreValue(input), {
    createdAt: { __date: '2026-01-02T03:04:05.000Z' },
    rows: [1, { at: { __timestamp: true, seconds: 7, nanoseconds: 0 } }],
  });
});
