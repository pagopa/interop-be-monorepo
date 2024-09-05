import { ListResult, genericError } from "pagopa-interop-models";

export async function getAllFromPaginated<A>(
  getPaginatedCall: (offset: number, limit: number) => Promise<ListResult<A>>
): Promise<A[]> {
  const getAllFromOffset = async (offset: number): Promise<A[]> => {
    const limit = 50;
    const { results } = await getPaginatedCall(offset, limit);

    return results.length < limit
      ? results
      : results.concat(await getAllFromOffset(offset + limit));
  };

  return await getAllFromOffset(0);
}

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
