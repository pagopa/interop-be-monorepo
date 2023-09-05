import { z } from "zod";
import { Kafka, KafkaMessage } from "kafkajs";
import { MongoClient } from "mongodb";
import { logger } from "pagopa-interop-commons";
import { EServiceAddedV1 } from "pagopa-interop-models";
import { config } from "./utilities/config.js";

const defaultMongoUri = "mongodb://root:example@localhost:27017";
const client = new MongoClient(config.mongoUri || defaultMongoUri);

const db = client.db("readmodel");
const eservices = db.collection("eservices");

const kafka = new Kafka({
  clientId: config.kafkaClientId || "my-app",
  brokers: [config.kafkaBrokers || "localhost:9092"],
});

const consumer = kafka.consumer({ groupId: config.kafkaGroupId || "my-group" });
await consumer.connect();

function exitGracefully(): void {
  consumer.disconnect().finally(() => {
    logger.info("Consumer disconnected");
    process.exit(0);
  });
}

process.on("SIGINT", exitGracefully);
process.on("SIGTERM", exitGracefully);

await consumer.subscribe({
  topics: ["catalog.public.event"],
});

const Event = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("EServiceAdded"),
    data: z
      .any()
      .transform((v) => EServiceAddedV1.fromBinary(Buffer.from(v, "hex"))),
  }),
]);

const EventEnvelope = z.intersection(
  z.object({
    sequence_num: z.number(),
    stream_id: z.string().uuid(),
    version: z.number(),
  }),
  Event
);

const DebeziumCreatePayload = z.object({
  op: z.literal("c"),
  after: EventEnvelope,
});

const Message = z.object({
  value: z.preprocess(
    (v) => (v != null ? JSON.parse(v.toString()) : null),
    z.object({ payload: DebeziumCreatePayload })
  ),
});

async function processMessage(message: KafkaMessage): Promise<void> {
  const parsed = Message.safeParse(message);
  if (parsed.success) {
    await eservices.insertOne({
      data: parsed.data.value.payload.after.data,
      metadata: {
        version: parsed.data.value.payload.after.version,
      },
    });
    logger.info("Read model was updated");
  } else {
    logger.error(parsed.error);
  }
}

await consumer.run({
  eachMessage: ({ message }) => processMessage(message),
});
