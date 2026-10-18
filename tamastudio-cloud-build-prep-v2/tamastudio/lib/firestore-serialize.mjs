/** Convert Firestore values into stable JSON-safe values for browser consumers. */
export function serializeFirestoreValue(value) {
  if (value === null || value === undefined) return value ?? null;
  if (value instanceof Date) return { __date: value.toISOString() };
  if (typeof value?.toDate === 'function' && Number.isFinite(value.seconds)) {
    return { __timestamp: true, seconds: value.seconds, nanoseconds: value.nanoseconds || 0 };
  }
  if (Array.isArray(value)) return value.map(serializeFirestoreValue);
  if (typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, serializeFirestoreValue(child)]));
  }
  return value;
}
