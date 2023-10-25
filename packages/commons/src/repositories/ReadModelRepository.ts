import { EService, PersistentAgreement } from "pagopa-interop-models";
import { Collection, MongoClient } from "mongodb";
import { ReadModelDbConfig } from "../index.js";

export type ReadModelRepository = {
  eservices: Collection<{
    data: EService | undefined;
    metadata: { version: number };
  }>;
  agreements: Collection<{
    data: PersistentAgreement;
    metadata: { version: number };
  }>;
};

export function readModelRepository({
  readModelDbHost: host,
  readModelDbPort: port,
  readModelDbUsername: username,
  readModelDbPassword: password,
  readModelDbName: database,
}: ReadModelDbConfig): ReadModelRepository {
  const mongoDBConnectionURI = `mongodb://${username}:${password}@${host}:${port}`;
  const client = new MongoClient(mongoDBConnectionURI, {
    retryWrites: true,
  });
  const db = client.db(database);
  return {
    eservices: db.collection("eservices", { ignoreUndefined: true }),
    agreements: db.collection("agreements", { ignoreUndefined: true }),
  };
}
