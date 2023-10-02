import { ConnectionString } from "connection-string";
import pgPromise, { IDatabase } from "pg-promise";
import {
  IClient,
  IConnectionParameters,
} from "pg-promise/typescript/pg-subset.js";
import { config } from "../utilities/config.js";

export type DB = IDatabase<unknown>;

const pgp = pgPromise();

const {
  eventStoreDbUsername: username,
  eventStoreDbPassword: password,
  eventStoreDbHost: host,
  eventStoreDbPort: port,
  eventStoreDbName: database,
  eventStoreDbUseSSL: useSSL,
} = config;

const conData = new ConnectionString(
  `postgresql://${username}:${password}@${host}:${port}/${database}`
);

export const dbConfig: IConnectionParameters<IClient> = {
  database: conData.path !== undefined ? conData.path[0] : "",
  host: conData.hostname,
  password: conData.password,
  port: conData.port,
  user: conData.user,
  ssl: useSSL ? { rejectUnauthorized: false } : undefined,
};

export const db = pgp(dbConfig);
