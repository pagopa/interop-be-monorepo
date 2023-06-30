import { ConnectionString } from "connection-string";
import * as Context from "@effect/data/Context";
import pgPromise, { IDatabase } from "pg-promise";
import {
  IClient,
  IConnectionParameters,
} from "pg-promise/typescript/pg-subset.js";
import { config } from "../utilities/config.js";

export type DB = IDatabase<unknown>;

export const DB = Context.Tag<DB>();

const pgp = pgPromise();

const conData = new ConnectionString(config.dbURL);

export const dbConfig: IConnectionParameters<IClient> = {
  database: conData.path !== undefined ? conData.path[0] : "",
  host: conData.hostname,
  password: conData.password,
  port: conData.port,
  ssl: false,
  user: conData.user,
};

export const db = pgp(dbConfig);
