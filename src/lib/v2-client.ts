import { db } from '@/lib/db';
import { integrationLogs } from '@/lib/db/schema';
import type { V2OrderDetail } from '@/lib/types';
import { createRequestId } from './request-id';

const V2_TIMEOUT_MS = 8000;
const V2_MAX_ATTEMPTS = 2;

interface V2Response<T> {
  requestId: string;
  data?: T;
  valid?: boolean;
  order?: unknown;
  item?: unknown;
  error?: { code: string; message: string };
}

async function callV2<T>(method: string, path: string, body?: unknown): Promise<V2Response<T>> {
  const baseUrl = process.env.V2_API_BASE_URL;
  const apiKey = process.env.V2_API_KEY;
  if (!baseUrl || !apiKey) {
    throw new Error('V2 API is not configured');
  }

  const requestId = createRequestId('v2');
  const url = `${baseUrl.replace(/\/$/, '')}${path}`;
  let statusCode = 0;
  let errorMessage: string | undefined;

  for (let attempt = 1; attempt <= V2_MAX_ATTEMPTS; attempt++) {
    const startedAt = performance.now();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), V2_TIMEOUT_MS);
    try {
      const response = await fetch(url, {
        method,
        headers: {
          'content-type': 'application/json',
          'x-api-key': apiKey,
          'x-request-id': requestId,
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal,
        cache: 'no-store',
      });
      statusCode = response.status;
      const json = (await response.json()) as V2Response<T>;
      if (!response.ok) {
        errorMessage = json.error?.message || `V2 request failed with status ${response.status}`;
        if (response.status < 500 || attempt === V2_MAX_ATTEMPTS) throw new Error(errorMessage);
      } else {
        await db.insert(integrationLogs).values({
          requestId,
          endpoint: path,
          method,
          statusCode,
          success: true,
          durationMs: Math.round(performance.now() - startedAt),
          paramsDigest: body ? JSON.stringify({ attempt, body }).slice(0, 500) : JSON.stringify({ attempt, path }),
        });
        return json;
      }
    } catch (error) {
      errorMessage = error instanceof Error
        ? error.name === 'AbortError' ? `V2 request timed out after ${V2_TIMEOUT_MS}ms` : error.message
        : 'Unknown V2 error';
      if (attempt === V2_MAX_ATTEMPTS) {
        await db.insert(integrationLogs).values({
          requestId,
          endpoint: path,
          method,
          statusCode,
          success: false,
          durationMs: Math.round(performance.now() - startedAt),
          errorMessage,
          paramsDigest: body ? JSON.stringify({ attempt, body }).slice(0, 500) : JSON.stringify({ attempt, path }),
        });
        throw new Error(errorMessage);
      }
    } finally {
      clearTimeout(timer);
    }

    await db.insert(integrationLogs).values({
      requestId,
      endpoint: path,
      method,
      statusCode,
      success: false,
      durationMs: Math.round(performance.now() - startedAt),
      errorMessage,
      paramsDigest: body ? JSON.stringify({ attempt, body }).slice(0, 500) : JSON.stringify({ attempt, path }),
    });
  }

  throw new Error(errorMessage || 'V2 request failed');
}

export async function fetchV2Order(externalCode: string) {
  const json = await callV2<V2OrderDetail>('GET', `/api/v1/integration/orders/${encodeURIComponent(externalCode)}`);
  if (!json.data) throw new Error('V2 did not return order data');
  return json.data;
}

export async function validateV2Sku(externalCode: string, skuCode: string) {
  return callV2('POST', '/api/v1/integration/orders/validate-sku', { externalCode, skuCode });
}
