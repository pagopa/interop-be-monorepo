import { z } from "zod";
import { ReadModelDbConfig } from "./readmodelDbConfig.js";
import { KafkaConfig } from "./kafkaConfig.js";
import { AWSConfig } from "./awsConfig.js";

export const ConsumerConfig = ReadModelDbConfig.and(KafkaConfig).and(AWSConfig);
export type ConsumerConfig = z.infer<typeof ConsumerConfig>;

export const consumerConfig: () => ConsumerConfig = () =>
  ConsumerConfig.parse(process.env);
