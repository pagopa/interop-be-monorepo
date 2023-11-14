import { Agreement, EService, ErrorTypes, Tenant } from "pagopa-interop-models";
import { Collection, Db, MongoClient, Document, Filter, WithId } from "mongodb";
import { z } from "zod";
import { ReadModelDbConfig, logger } from "../index.js";

type GenericCollection<T> = Collection<{
  data: T;
  metadata: { version: number };
}>;

export type EServiceCollection = GenericCollection<EService | undefined>;
export type AgreementCollection = GenericCollection<Agreement>;
export type TenantCollection = GenericCollection<Tenant>;

export type Collections =
  | EServiceCollection
  | AgreementCollection
  | TenantCollection;

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
 * Extracts recursively all the possible document db query keys from an object
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

/**
 * Type of the filter that can be used to query the read model.
 * It extends the mongodb filter type by adding all the possible model query keys.
 */
export type ReadModelFilter<TSchema> = {
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

export class ReadModelRepository {
  private static instance: ReadModelRepository;

  public eservices: EServiceCollection;

  public agreements: AgreementCollection;

  public tenants: TenantCollection;

  private client: MongoClient;
  private db: Db;

  private constructor({
    readModelDbHost: host,
    readModelDbPort: port,
    readModelDbUsername: username,
    readModelDbPassword: password,
    readModelDbName: database,
  }: ReadModelDbConfig) {
    const mongoDBConnectionURI = `mongodb://${username}:${password}@${host}:${port}`;
    this.client = new MongoClient(mongoDBConnectionURI, {
      retryWrites: false,
    });
    this.db = this.client.db(database);
    this.eservices = this.db.collection("eservices", { ignoreUndefined: true });
    this.agreements = this.db.collection("agreements", {
      ignoreUndefined: true,
    });
    this.tenants = this.db.collection("tenants", { ignoreUndefined: true });
  }

  public static init(config: ReadModelDbConfig): ReadModelRepository {
    if (!ReadModelRepository.instance) {
      // eslint-disable-next-line functional/immutable-data
      ReadModelRepository.instance = new ReadModelRepository(config);
    }

    return ReadModelRepository.instance;
  }

  public static async getTotalCount(
    collection: Collections,
    aggregation: object[]
  ): Promise<number> {
    const query = collection.aggregate([...aggregation, { $count: "count" }]);

    const data = await query.toArray();
    const result = z.array(z.object({ count: z.number() })).safeParse(data);

    if (result.success) {
      return result.data.length > 0 ? result.data[0].count : 0;
    }

    logger.error(
      `Unable to get total count from aggregation pipeline: result ${JSON.stringify(
        result
      )} - data ${JSON.stringify(data)} `
    );
    throw ErrorTypes.GenericError;
  }
}
