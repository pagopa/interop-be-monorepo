import { z } from "zod";
import { Kafka, KafkaMessage } from "kafkajs";
import { MongoClient } from "mongodb";
import { logger } from "pagopa-interop-commons";

const mongoUri = "mongodb://root:example@localhost:27017";
const client = new MongoClient(mongoUri);

const db = client.db("readmodel");
const catalog = db.collection("eservices");

const kafka = new Kafka({
  clientId: "my-app",
  brokers: ["localhost:9092"],
});

const consumer = kafka.consumer({ groupId: "my-group" });
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

const EServiceTechnology = z.enum(["REST", "SOAP"]);

const Event = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("CatalogItemAdded"),
    data: z.preprocess(
      (v) => (typeof v === "string" ? JSON.parse(v) : null),
      z.object({
        name: z.string().min(5).max(60),
        description: z.string().min(10).max(250),
        technology: EServiceTechnology,
        producerId: z.string(),
      })
    ),
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
    await catalog.insertOne({
      data: {
        ...parsed.data.value.payload.after.data,
        id: parsed.data.value.payload.after.stream_id,
        descriptors: [],
        createdAt: new Date(), // TODO: fix me, this data should arrive from the event
      },
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
