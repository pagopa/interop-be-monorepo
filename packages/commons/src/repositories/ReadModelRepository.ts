import {
  AgreementReadModel,
  AttributeReadmodel,
  ClientReadModel,
  EServiceReadModel,
  Purpose,
  TenantReadModel,
  genericError,
  JWKKeyInReadModel,
  PurposeReadModel,
  Tenant,
  genericInternalError,
} from "pagopa-interop-models";
import {
  Collection,
  Db,
  MongoClient,
  WithId,
  RootFilterOperators,
} from "mongodb";
import { z } from "zod";
import { ReadModelDbConfig } from "../index.js";

export const Metadata = z.object({ version: z.number() });
export type Metadata = z.infer<typeof Metadata>;

export type GenericCollection<T> = Collection<{
  data: T;
  metadata: Metadata;
}>;

/*
  After all services will be migrated to TS, we should
  go remove ReadModel models created for dates retro-compatibility.
  Tracked in https://pagopa.atlassian.net/browse/IMN-367
*/
export type EServiceCollection = GenericCollection<EServiceReadModel>;
export type AgreementCollection = GenericCollection<AgreementReadModel>;
export type TenantCollection = GenericCollection<TenantReadModel>;
export type AttributeCollection = GenericCollection<AttributeReadmodel>;
export type PurposeCollection = GenericCollection<PurposeReadModel>;
export type ClientCollection = GenericCollection<ClientReadModel>;
export type KeyCollection = GenericCollection<JWKKeyInReadModel>;

export type Collections =
  | EServiceCollection
  | AgreementCollection
  | TenantCollection
  | AttributeCollection
  | PurposeCollection
  | ClientCollection
  | KeyCollection;

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
 * Extracts all queryable fields without the "data" prefix
 *
 * @example
 * type Test = {
 * a: string;
 *   b: {
 *     c: string;
 *   }
 *   d: {
 *     e: string;
 *   }[]
 * }
 *
 * type DataFields = RemoveDataPrefix<MongoQueryKeys<Test>>;
 * //      ^ "a" | "b" | "b.c" | "d" | "d.e"
 *
 */
export type RemoveDataPrefix<T extends string> = T extends `data.${infer U}`
  ? U
  : never;

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
export type MongoQueryKeys<T, TPrefix extends string = "data"> = NonNullable<
  | TPrefix
  | (T extends unknown[]
      ? MongoQueryKeys<T[number], TPrefix>
      : T extends Record<string, unknown>
      ? ExtractQueryKeysFromRecord<T, TPrefix>
      : never)
>;

/**
 * RootFilterOperators extends the mongodb Document type.
 * The Document type, being { [key: string]: any }, permits the object to have any key.
 * This type is used to narrow the Document type to only the keys that can be used to query the read model.
 */
type NarrowRootFilterOperators<TSchema> = Pick<
  RootFilterOperators<WithId<{ data: TSchema }["data"]>>,
  "$and" | "$nor" | "$or" | "$text" | "$where" | "$comment"
>;

/**
 * Type of the filter that can be used to query the read model.
 * It extends the mongodb filter type by adding all the possible model query keys.
 */

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - ignoring ts ts(2589): Type instantiation is excessively deep and possibly infinite.
export type ReadModelFilter<TSchema> = {
  [P in MongoQueryKeys<WithId<{ data: TSchema }["data"]>>]?: any; // eslint-disable-line @typescript-eslint/no-explicit-any
} & NarrowRootFilterOperators<TSchema>;

export class ReadModelRepository {
  private static instance: ReadModelRepository;

  public eservices: EServiceCollection;

  public agreements: AgreementCollection;

  public tenants: TenantCollection;

  public attributes: AttributeCollection;

  public purposes: PurposeCollection;

  public clients: ClientCollection;

  public keys: KeyCollection;

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
    this.attributes = this.db.collection("attributes", {
      ignoreUndefined: true,
    });
    this.purposes = this.db.collection("purposes", { ignoreUndefined: true });
    this.clients = this.db.collection("clients", { ignoreUndefined: true });
    this.keys = this.db.collection("keys", { ignoreUndefined: true });
  }

  public static init(config: ReadModelDbConfig): ReadModelRepository {
    if (!ReadModelRepository.instance) {
      // eslint-disable-next-line functional/immutable-data
      ReadModelRepository.instance = new ReadModelRepository(config);
    }

    return ReadModelRepository.instance;
  }

  public static arrayToFilter<T>(
    array: unknown[],
    filter: ReadModelFilter<T>
  ): ReadModelFilter<T> {
    return array.length > 0 ? filter : {};
  }

  public static escapeRegExp(str: string): string {
    return str.replace(/[/\-\\^$*+?.()|[\]{}]/g, "\\$&");
  }

  public static async getTotalCount(
    collection: Collections,
    aggregation: object[],
    allowDiskUse: boolean
  ): Promise<number> {
    const query = collection.aggregate([...aggregation, { $count: "count" }], {
      allowDiskUse,
    });

    const data = await query.toArray();
    const result = z.array(z.object({ count: z.number() })).safeParse(data);

    if (result.success) {
      return result.data.length > 0 ? result.data[0].count : 0;
    }

    throw genericInternalError(
      `Unable to get total count from aggregation pipeline: result ${JSON.stringify(
        result
      )} - data ${JSON.stringify(data)} `
    );
  }
}
