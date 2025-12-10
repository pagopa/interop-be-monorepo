import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { DigestTrackingDbConfig } from "../config/config.js";
import { DigestTrackingDb } from "../services/digestTrackingService.js";

export const makeDigestTrackingDbConnection = (
  config: DigestTrackingDbConfig
): DigestTrackingDb => {
  const pool = new pg.Pool({
    host: config.digestTrackingDbHost,
    port: config.digestTrackingDbPort,
    database: config.digestTrackingDbName,
    user: config.digestTrackingDbUsername,
    password: config.digestTrackingDbPassword,
    ssl: config.digestTrackingDbUseSSL
      ? { rejectUnauthorized: false }
      : undefined,
  });
  return drizzle({ client: pool });
};
