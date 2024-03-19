/* Common Readmodel query type's definitions */

export type WithMetadata<T> = { data: T; metadata: { version: number } };

export type ListResult<T> = { results: T[]; totalCount: number };
export const emptyListResult = { results: [], totalCount: 0 };
