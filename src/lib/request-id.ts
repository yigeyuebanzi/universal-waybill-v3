export function createRequestId(prefix = 'req') {
  return `${prefix}_${crypto.randomUUID()}`;
}

export function requestIdFromHeaders(headers: Headers) {
  return headers.get('x-request-id') || createRequestId();
}
