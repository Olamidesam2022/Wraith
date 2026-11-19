import { scanConfig } from '../config';

interface Bucket { startedAt: number; count: number }
export interface RateLimitStore {
  allow(key: string, now: number, windowMs: number, max: number): Promise<boolean> | boolean;
}

// In-memory buckets are process-local and do not persist across serverless instances.
class InMemoryRateLimitStore implements RateLimitStore {
  private readonly buckets = new Map<string, Bucket>();

  allow(key: string, now: number, windowMs: number, max: number): boolean {
    const bucket = this.buckets.get(key);
    if (!bucket || now - bucket.startedAt >= windowMs) {
      this.buckets.set(key, { startedAt: now, count: 1 });
      return true;
    }
    if (bucket.count >= max) return false;
    bucket.count += 1;
    return true;
  }
}

let rateLimitStore: RateLimitStore = new InMemoryRateLimitStore();

// Deployments can inject a Vercel KV or Upstash Redis adapter implementing RateLimitStore.
export function setRateLimitStore(store: RateLimitStore): void { rateLimitStore = store; }

export function allowScan(ip: string, now = Date.now()): Promise<boolean> | boolean {
  return rateLimitStore.allow(ip, now, scanConfig.rateLimitWindowMs, scanConfig.anonymousRequestsPerWindow);
}
