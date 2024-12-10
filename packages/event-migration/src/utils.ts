import { MongoClient } from "mongodb";
import { ReadModelDbConfig } from "pagopa-interop-commons";

export function connectToReadModel({
  readModelDbHost: host,
  readModelDbPort: port,
  readModelDbUsername: username,
  readModelDbPassword: password,
}: ReadModelDbConfig): MongoClient {
  const mongoDBConnectionURI = `mongodb://${username}:${password}@${host}:${port}`;
  return new MongoClient(mongoDBConnectionURI, {
    retryWrites: false,
  });
}
