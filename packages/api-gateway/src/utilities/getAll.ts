import { ListResult } from "pagopa-interop-models";

export async function getAllFromPaginated<A>(
  getPaginatedCall: (offset: number, limit: number) => Promise<ListResult<A>>
): Promise<A[]> {
  const getAllFromOffset = async (offset: number): Promise<A[]> => {
    const limit = 50;
    const { results: agreements } = await getPaginatedCall(offset, limit);

    return agreements.length < limit
      ? agreements
      : agreements.concat(await getAllFromOffset(offset + limit));
  };

  return await getAllFromOffset(0);
}
