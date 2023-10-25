import { EService, PersistentAgreement } from "pagopa-interop-models";
import { Collection, Db, MongoClient } from "mongodb";
import { ReadModelDbConfig } from "../index.js";

export class ReadModelRepository {
  private static instance: ReadModelRepository;

  public eservices: Collection<{
    data: EService | undefined;
    metadata: { version: number };
  }>;

  public agreements: Collection<{
    data: PersistentAgreement;
    metadata: { version: number };
  }>;

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
  }

  public static init(config: ReadModelDbConfig): ReadModelRepository {
    if (!ReadModelRepository.instance) {
      // eslint-disable-next-line functional/immutable-data
      ReadModelRepository.instance = new ReadModelRepository(config);
    }

    return ReadModelRepository.instance;
  }
}
