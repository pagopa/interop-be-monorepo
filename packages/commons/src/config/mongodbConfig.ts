import { z } from "zod";

export const MongoDBConfig = z
  .object({
    MONGODB_REPLICA_SET: z.string().optional(),
    MONGODB_READ_PREFERENCE: z.string(),
    MONGODB_DIRECT_CONNECTION: z
      .enum(["true", "false"])
      .transform((value) => value === "true")
      .optional(),
    MONGODB_RETRY_WRITES: z
      .enum(["true", "false"])
      .transform((value) => value === "true")
      .optional(),
  })
  .transform((c) => ({
    replicaSet: c.MONGODB_REPLICA_SET,
    readPreference: c.MONGODB_READ_PREFERENCE,
    directConnection: c.MONGODB_DIRECT_CONNECTION,
    retryWrites: c.MONGODB_RETRY_WRITES,
  }));

export type MongoDBConfig = z.infer<typeof MongoDBConfig>;
