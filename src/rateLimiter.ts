export class TokenBucketLimiter {
  private capacity: number;
  private tokens: number;
  private refillIntervalMs: number;
  private lastRefill: number;
  private queue: Array<() => void> = [];

  constructor(tokensPerInterval: number, intervalMs: number) {
    this.capacity = Math.max(1, tokensPerInterval);
    this.tokens = this.capacity;
    this.refillIntervalMs = Math.max(1, intervalMs);
    this.lastRefill = Date.now();
  }

  private refill(): void {
    const now = Date.now();
    const elapsed = now - this.lastRefill;
    if (elapsed <= 0) return;
    const tokensToAdd = (elapsed / this.refillIntervalMs) * this.capacity;
    if (tokensToAdd >= 1) {
      this.tokens = Math.min(this.capacity, this.tokens + Math.floor(tokensToAdd));
      this.lastRefill = now;
    }
  }

  async acquire(): Promise<void> {
    this.refill();
    if (this.tokens > 0) {
      this.tokens -= 1;
      return;
    }
    return new Promise((resolve) => {
      this.queue.push(resolve);
      this.schedule();
    });
  }

  private schedule(): void {
    // Use a single timer tick to attempt to drain the queue
    setTimeout(() => {
      this.refill();
      while (this.tokens > 0 && this.queue.length > 0) {
        const next = this.queue.shift();
        if (!next) break;
        this.tokens -= 1;
        next();
      }
      if (this.queue.length > 0) {
        this.schedule();
      }
    }, Math.ceil(this.refillIntervalMs / this.capacity));
  }
}

