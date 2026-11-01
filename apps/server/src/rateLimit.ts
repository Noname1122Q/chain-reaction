export class TokenBucket {
  private tokens: number;
  private last = Date.now();

  constructor(
    private capacity: number,
    private refillPerSec: number,
  ) {
    this.tokens = capacity;
  }

  take(): boolean {
    const now = Date.now();
    const refill = ((now - this.last) / 1000) * this.refillPerSec;

    this.tokens = Math.min(this.capacity, this.tokens + refill);
    this.last = now;

    if (this.tokens < 1) return false;

    this.tokens -= 1;

    return true;
  }
}
