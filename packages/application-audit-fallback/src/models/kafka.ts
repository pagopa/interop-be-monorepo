import { initProducer } from "kafka-iam-auth";

export type KafkaProducer = Awaited<ReturnType<typeof initProducer>>;
