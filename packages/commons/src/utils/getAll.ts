import { ListResult } from "pagopa-interop-models";

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
