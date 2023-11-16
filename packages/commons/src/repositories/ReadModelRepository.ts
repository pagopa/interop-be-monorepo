import {
  Agreement,
  Attribute,
  EService,
  ErrorTypes,
  Tenant,
} from "pagopa-interop-models";
import { Collection, Db, MongoClient } from "mongodb";
import { z } from "zod";
import { ReadModelDbConfig, logger } from "../index.js";

type GenericCollection<T> = Collection<{
  data: T;
  metadata: { version: number };
}>;

export type EServiceCollection = GenericCollection<EService | undefined>;
export type AgreementCollection = GenericCollection<Agreement>;
export type TenantCollection = GenericCollection<Tenant>;
export type AttributeCollection = GenericCollection<Attribute>;

export type Collections =
  | EServiceCollection
  | AgreementCollection
  | TenantCollection
  | AttributeCollection;

export class ReadModelRepository {
  private static instance: ReadModelRepository;

  public eservices: EServiceCollection;

  public agreements: AgreementCollection;

  public tenants: TenantCollection;

  public attributes: AttributeCollection;

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
  }

  public static init(config: ReadModelDbConfig): ReadModelRepository {
    if (!ReadModelRepository.instance) {
      // eslint-disable-next-line functional/immutable-data
      ReadModelRepository.instance = new ReadModelRepository(config);
    }

    return ReadModelRepository.instance;
  }

  public static arrayToFilter<T, F extends object>(
    array: T[],
    f: (array: T[]) => F
  ): F | undefined {
    return array.length > 0 ? f(array) : undefined;
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
