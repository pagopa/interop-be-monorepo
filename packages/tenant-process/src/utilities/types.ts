import { Document, Filter, WithId } from "mongodb";

type BuildQueryKey<TPrefix extends string, TKey> = `${TPrefix}.${TKey &
  string}`;
type BuilIndexedQueryKey<TPrefix extends string, TKey> = `${TPrefix}.${TKey &
  string}.${number}`;

type ExtractQueryKeysFromRecord<
  T extends Record<string, unknown>,
  TPrefix extends string
> = {
  [TKey in keyof T]: T[TKey] extends Record<string, unknown>
    ? MongoQueryKeys<T[TKey], BuildQueryKey<TPrefix, TKey>>
    : T[TKey] extends unknown[]
    ? MongoQueryKeys<
        T[TKey],
        BuildQueryKey<TPrefix, TKey> | BuilIndexedQueryKey<TPrefix, TKey>
      >
    : BuildQueryKey<TPrefix, TKey>;
}[keyof T];

/**
 * Extracts recursively all the possible mongo query keys from an object
 *
 * @example
 * type Test = {
 *   a: string;
 *   b: {
 *     c: string;
 *   }
 *   d: {
 *     e: string;
 *   }[]
 * }
 *
 * type Result = MongoQueryKeys<Test>;
 * //      ^ "data.a" | "data.b" | "data.b.c" | "data.d" | "data.d.e"
 */
type MongoQueryKeys<T, TPrefix extends string = "data"> = NonNullable<
  | TPrefix
  | (T extends unknown[]
      ? MongoQueryKeys<T[number], TPrefix>
      : T extends Record<string, unknown>
      ? ExtractQueryKeysFromRecord<T, TPrefix>
      : never)
>;

export type MongoDBFilter<TSchema> = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [P in MongoQueryKeys<WithId<{ data: TSchema }["data"]>>]?: any; // We should find a better typing here!
} & {
  $and?: Array<Filter<{ data: TSchema }>>;
  $nor?: Array<Filter<{ data: TSchema }>>;
  $or?: Array<Filter<{ data: TSchema }>>;
  $text?: {
    $search: string;
    $language?: string;
    $caseSensitive?: boolean;
    $diacriticSensitive?: boolean;
  };
  $where?: string | ((this: { data: TSchema }) => boolean);
  $comment?: string | Document;
};
