import { match } from "ts-pattern";
import { Collection, MongoClient } from "mongodb";
import { logger, consumerConfig } from "pagopa-interop-commons";
import { PersistentAttribute } from "pagopa-interop-models";
import { EventEnvelope } from "./model/models.js";
import { fromAttributeV1 } from "./model/converter.js";

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
const attributes: Collection<{
  data: PersistentAttribute | undefined;
  metadata: { version: number };
}> = db.collection("attributes", { ignoreUndefined: true });

export async function handleMessage(message: EventEnvelope): Promise<void> {
  logger.info(message);
  await match(message)
    .with({ type: "AttributeAdded" }, async (msg) => {
      await attributes.updateOne(
        {
          "data.id": msg.stream_id,
        },
        {
          $setOnInsert: {
            data: msg.data.attribute
              ? fromAttributeV1(msg.data.attribute)
              : undefined,
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
