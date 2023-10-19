import { match } from "ts-pattern";
import { Collection, MongoClient } from "mongodb";
import { logger, consumerConfig } from "pagopa-interop-commons";
import { AgreementV1 } from "pagopa-interop-models";
import { EventEnvelope } from "./model/models.js";

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
const eservices: Collection<{
  data: AgreementV1 | undefined;
  metadata: { version: number };
}> = db.collection("eservices", { ignoreUndefined: true });

export async function handleMessage(message: EventEnvelope): Promise<void> {
  logger.info(message);
  await match(message)
    .with({ type: "AgreementAdded" }, async (msg) => {
      await eservices.updateOne(
        {
          "data.id": msg.stream_id,
        },
        {
          $setOnInsert: {
            data: msg.data.agreement,
            metadata: {
              version: msg.version,
            },
          },
        },
        { upsert: true }
      );
    })
    .exhaustive();
}
