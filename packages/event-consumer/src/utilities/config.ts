import * as dotenvFlow from "dotenv-flow";
import { z } from "zod";

dotenvFlow.config();

const MongoConfig = z
  .object({
    MONGO_URI: z.string(),
  })
  .transform((c) => ({
    mongoUri: c.MONGO_URI,
  }));
export type MongoConfig = z.infer<typeof MongoConfig>;

const KafkaConfig = z
  .object({
    KAFKA_BROKERS: z.string(),
    KAFKA_CLIENT_ID: z.string(),
    KAFKA_GROUP_ID: z.string(),
  })
  .transform((c) => ({
    kafkaBrokers: c.KAFKA_BROKERS,
    kafkaClientId: c.KAFKA_CLIENT_ID,
    kafkaGroupId: c.KAFKA_GROUP_ID,
  }));
export type KafkaConfig = z.infer<typeof KafkaConfig>;

export const Config = MongoConfig.and(KafkaConfig);
export type Config = z.infer<typeof Config>;

export const config: Config = Config.parse(process.env);
