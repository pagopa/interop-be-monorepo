export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export const retry = async <T>(
  fn: () => Promise<T>,
  { retries, delay }: { retries: number; delay: number }
): Promise<T> => {
  try {
    return await fn();
  } catch (error) {
    if (retries <= 1) throw error;
    await new Promise((resolve) => setTimeout(resolve, delay));
    return retry(fn, { retries: retries - 1, delay });
  }
};
