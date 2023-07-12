import { z } from "zod";
import { Kafka, KafkaMessage } from "kafkajs";
import { MongoClient } from "mongodb";

const mongoUri = "mongodb://root:example@localhost:27017";
const client = new MongoClient(mongoUri);

const db = client.db("readmodel");
const catalog = db.collection("catalog");

const kafka = new Kafka({
  clientId: "my-app",
  brokers: ["localhost:9092"],
});

const consumer = kafka.consumer({ groupId: "my-group" });
await consumer.connect();

// process.on("SIGINT", function () {
//   consumer.disconnect().then(
//     () => console.log("Disconnected"),
//     (err) => console.log(err)
//   );
// });

await consumer.subscribe({
  topics: ["dbserver1.public.event"],
  fromBeginning: true, // used now for testing, but I don't understand if it works, anyway should be false in real usage
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
      data: parsed.data.value.payload.after.data,
      metadata: {
        stream_id: parsed.data.value.payload.after.stream_id,
        version: parsed.data.value.payload.after.version,
      },
    });
    console.log("Read model was updated");
  } else {
    console.log(parsed.error);
  }
}

await consumer.run({
  eachMessage: ({ message }) => processMessage(message),
});
