/**
 * Resolve with `work`, or reject with `message` once `ms` have passed. The
 * work itself is not cancelled; the caller decides what to do next (this app
 * closes the session so the next attempt starts clean).
 */
export async function withTimeout<T>(work: Promise<T>, ms: number, message: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      work,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new TimeoutError(message)), ms);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

export class TimeoutError extends Error {}
