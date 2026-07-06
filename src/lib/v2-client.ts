import { db } from '@/lib/db';
import { integrationLogs } from '@/lib/db/schema';
import type { V2OrderDetail } from '@/lib/types';
import { createRequestId } from './request-id';

const V2_TIMEOUT_MS = 8000;

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
  const startedAt = performance.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), V2_TIMEOUT_MS);
  let statusCode = 0;
  let errorMessage: string | undefined;

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
      throw new Error(errorMessage);
    }
    return json;
  } catch (error) {
    errorMessage = error instanceof Error ? error.message : 'Unknown V2 error';
    throw error;
  } finally {
    clearTimeout(timer);
    await db.insert(integrationLogs).values({
      requestId,
      endpoint: path,
      method,
      statusCode,
      success: statusCode >= 200 && statusCode < 300,
      durationMs: Math.round(performance.now() - startedAt),
      errorMessage,
      paramsDigest: body ? JSON.stringify(body).slice(0, 500) : path,
    });
  }
}

export async function fetchV2Order(externalCode: string) {
  const json = await callV2<V2OrderDetail>('GET', `/api/v1/integration/orders/${encodeURIComponent(externalCode)}`);
  if (!json.data) throw new Error('V2 did not return order data');
  return json.data;
}

export async function validateV2Sku(externalCode: string, skuCode: string) {
  return callV2('POST', '/api/v1/integration/orders/validate-sku', { externalCode, skuCode });
}
