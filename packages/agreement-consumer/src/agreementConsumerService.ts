import { match } from "ts-pattern";
import { Collection, MongoClient } from "mongodb";
import { logger, consumerConfig } from "pagopa-interop-commons";
import { PersistentAgreement } from "pagopa-interop-models";
import { EventEnvelope } from "./model/models.js";
import { fromAgreementV1 } from "./model/converter.js";

const {
  readModelDbUsername: username,
  readModelDbPassword: password,
  readModelDbHost: host,
  readModelDbPort: port,
  readModelDbName: database,
} = consumerConfig();

const mongoDBConectionURI = `mongodb://${username}:${password}@${host}:${port}`;
const client = new MongoClient(mongoDBConectionURI, {
  retryWrites: false,
});

const db = client.db(database);
const agreements: Collection<{
  data: PersistentAgreement | undefined;
  metadata: { version: number };
}> = db.collection("agreements", { ignoreUndefined: true });

export async function handleMessage(message: EventEnvelope): Promise<void> {
  logger.info(message);
  await match(message)
    .with({ type: "AgreementAdded" }, async (msg) => {
      await agreements.updateOne(
        {
          "data.id": msg.stream_id,
        },
        {
          $setOnInsert: {
            data: msg.data.agreement
              ? fromAgreementV1(msg.data.agreement)
              : undefined,
            metadata: {
              version: msg.version,
            },
          },
        },
        { upsert: true }
      );
    })
    .with({ type: "AgreementDeleted" }, async (msg) => {
      await agreements.deleteOne({
        "data.id": msg.stream_id,
        "metadata.version": { $lt: msg.version },
      });
    })
    .exhaustive();
}
