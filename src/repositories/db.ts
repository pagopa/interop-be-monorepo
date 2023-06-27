import { ConnectionString } from "connection-string";
import pgPromise, { IDatabase, IInitOptions } from "pg-promise";
import {
  IClient,
  IConnectionParameters,
} from "pg-promise/typescript/pg-subset.js";
import { config } from "../utilities/config.js";
import { EventRepository } from "./events.js";

export type DB = IDatabase<IExtensions> & IExtensions;

export interface IExtensions {
  events: EventRepository;
}

const queries: IInitOptions<IExtensions> = {
  extend: (db: DB) => {
    /* eslint-disable functional/immutable-data */
    db.events = new EventRepository(db);
  },
};

const pgp = pgPromise(queries);

const conData = new ConnectionString(config.dbURL);

export const dbConfig: IConnectionParameters<IClient> = {
  database: conData.path !== undefined ? conData.path[0] : "",
  host: conData.hostname,
  password: conData.password,
  port: conData.port,
  ssl: false,
  user: conData.user,
};

export const db = pgp(dbConfig) as DB;
export const events = db.events;
