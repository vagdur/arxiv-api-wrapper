export interface RetryOptions {
  retries: number;
  timeoutMs: number;
  userAgent?: string;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function computeBackoff(attempt: number): number {
  const base = 200; // 200ms base
  const max = 5000; // 5s cap
  const exp = Math.min(max, base * 2 ** attempt);
  const jitter = Math.random() * 0.2 * exp; // +/-20%
  return Math.floor(exp * 0.9 + jitter);
}

export async function fetchWithRetry(
  url: string,
  init: RequestInit,
  options: RetryOptions
): Promise<Response> {
  const { retries, timeoutMs, userAgent } = options;

  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const headers = new Headers(init.headers || {});
      if (userAgent) headers.set('User-Agent', userAgent);
      const res = await fetch(url, { ...init, headers, signal: controller.signal });
      clearTimeout(timeout);

      if (res.ok) return res;

      // 429 or 5xx -> retry
      if (res.status === 429 || (res.status >= 500 && res.status <= 599)) {
        if (attempt === retries) return res; // give up returning the last response
        const retryAfter = res.headers.get('Retry-After');
        let delay = computeBackoff(attempt);
        if (retryAfter) {
          const retryAfterSeconds = parseInt(retryAfter, 10);
          if (!Number.isNaN(retryAfterSeconds)) {
            delay = Math.max(delay, retryAfterSeconds * 1000);
          }
        }
        await sleep(delay);
        continue;
      }

      // Non-retriable HTTP status
      return res;
    } catch (err) {
      clearTimeout(timeout);
      lastError = err;
      
      // Enhance error message with context
      const isAbortError = err instanceof Error && 
        (err.name === 'AbortError' || err.message.includes('aborted'));
      const isTimeout = isAbortError;
      
      if (attempt === retries) {
        // On final attempt, throw enhanced error
        if (isTimeout) {
          throw new Error(
            `Request to ${url} timed out after ${timeoutMs}ms ` +
            `(attempt ${attempt + 1} of ${retries + 1}). ` +
            `Original error: ${err instanceof Error ? err.message : String(err)}`
          );
        }
        throw err;
      }
      
      // Log retry attempt for debugging
      if (isTimeout) {
        console.warn(
          `Request to ${url} timed out (attempt ${attempt + 1} of ${retries + 1}), ` +
          `retrying after backoff...`
        );
      }
      
      await sleep(computeBackoff(attempt));
      continue;
    }
  }

  // Should not reach here; throw last error if any
  throw lastError instanceof Error ? lastError : new Error('Request failed');
}

