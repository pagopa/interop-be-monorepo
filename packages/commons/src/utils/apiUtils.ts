import { genericError } from "pagopa-interop-models";

export const createPollingByCondition =
  <T>(fetch: () => Promise<T>) =>
  async (
    condition: (result: T) => boolean,
    maxRetries: number = 30,
    delay: number = 200,
    errorMsg?: string
  ): Promise<void> => {
    async function poll(attempt: number): Promise<void> {
      if (attempt > maxRetries) {
        throw genericError(`Max retries reached ${errorMsg && ""}`);
      } else {
        try {
          const result = await fetch();
          if (!condition(result)) {
            await new Promise((resolve) => setTimeout(resolve, delay));
            return poll(attempt + 1);
          }
        } catch (error) {
          await new Promise((resolve) => setTimeout(resolve, delay));
          return poll(attempt + 1);
        }
      }
    }
    return poll(1);
  };
