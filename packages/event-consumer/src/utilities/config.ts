import { z } from "zod";

const MongoConfig = z
  .object({
    READMODEL_DB_HOST: z.string(),
    READMODEL_DB_NAME: z.string(),
    READMODEL_DB_USERNAME: z.string(),
    READMODEL_DB_PASSWORD: z.string(),
    READMODEL_DB_PORT: z.coerce.number().min(1001),
  })
  .transform((c) => ({
    readModelDbHost: c.READMODEL_DB_HOST,
    readModelDbName: c.READMODEL_DB_NAME,
    readModelDbUsername: c.READMODEL_DB_USERNAME,
    readModelDbPassword: c.READMODEL_DB_PASSWORD,
    readModelDbPort: c.READMODEL_DB_PORT,
  }));
export type MongoConfig = z.infer<typeof MongoConfig>;

const KafkaConfig = z
  .object({
    KAFKA_BROKERS: z.string(),
    KAFKA_CLIENT_ID: z.string(),
    KAFKA_GROUP_ID: z.string(),
    KAFKA_DISABLE_AWS_IAM_AUTH: z.literal("true").optional(),
  })
  .transform((c) => ({
    kafkaBrokers: c.KAFKA_BROKERS,
    kafkaClientId: c.KAFKA_CLIENT_ID,
    kafkaGroupId: c.KAFKA_GROUP_ID,
    kafkaDisableAwsIamAuth: c.KAFKA_DISABLE_AWS_IAM_AUTH === "true",
  }));
export type KafkaConfig = z.infer<typeof KafkaConfig>;

const AWSConfig = z
  .object({
    AWS_REGION: z.string(),
  })
  .transform((c) => ({
    awsRegion: c.AWS_REGION,
  }));

export type AWSConfig = z.infer<typeof AWSConfig>;

export const Config = MongoConfig.and(KafkaConfig).and(AWSConfig);
export type Config = z.infer<typeof Config>;

export const config: Config = Config.parse(process.env);
