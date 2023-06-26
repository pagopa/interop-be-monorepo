import { ConnectionString } from "connection-string";
import pgPromise, { IDatabase } from "pg-promise";
import {
  IClient,
  IConnectionParameters,
} from "pg-promise/typescript/pg-subset.js";
import { config } from "../utilities/config.js";
import { EventRepository } from "./events.js";

export type DB = IDatabase<IExtensions> & IExtensions;

export interface IExtensions {
  readonly events: EventRepository;
}

const pgp = pgPromise();

const conData = new ConnectionString(config.dbURL);

export const dbConfig: IConnectionParameters<IClient> = {
  database: conData.path != undefined ? conData.path[0] : "",
  host: conData.hostname,
  password: conData.password,
  port: conData.port,
  ssl: false,
  user: conData.user,
};

export const db = pgp(dbConfig) as DB;
