import { runConsumer } from "kafka-iam-auth";
import { makeDrizzleConnection } from "pagopa-interop-readmodel";
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { notificationConfigApi } from "pagopa-interop-api-clients";
import {
  InteropTokenGenerator,
  RefreshableInteropToken,
} from "pagopa-interop-commons";
import { readModelServiceBuilderSQL } from "./services/readModelServiceSQL.js";
import { userServiceBuilderSQL } from "./services/userServiceSQL.js";
import { messageProcessorBuilder } from "./services/messageProcessor.js";
import { config } from "./config/config.js";

// Initialize database connections
const readModelDB = makeDrizzleConnection(config);
const pool = new pg.Pool({
  host: config.userSQLDbHost,
  database: config.userSQLDbName,
  user: config.userSQLDbUsername,
  password: config.userSQLDbPassword,
  port: config.userSQLDbPort,
  ssl: config.userSQLDbUseSSL ? { rejectUnauthorized: false } : undefined,
});
const userDB = drizzle(pool);

const notificationConfigProcessClient =
  notificationConfigApi.createProcessApiClient(
    config.notificationConfigProcessUrl
  );

const readModelServiceSQL = readModelServiceBuilderSQL({ readModelDB });
const userServiceSQL = userServiceBuilderSQL(userDB);
const interopTokenGenerator = new InteropTokenGenerator(config);
const refreshableToken = new RefreshableInteropToken(interopTokenGenerator);

const messageProcessor = messageProcessorBuilder(
  readModelServiceSQL,
  userServiceSQL,
  notificationConfigProcessClient,
  refreshableToken
);

await runConsumer(
  config,
  [config.selfcareTopic],
  messageProcessor.processMessage
);
