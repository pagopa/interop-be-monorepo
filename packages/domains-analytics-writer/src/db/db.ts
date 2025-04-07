import { ConnectionString } from "connection-string";
import pgPromise, {
  ColumnSet,
  IColumnDescriptor,
  IDatabase,
  IMain,
  ITask,
  IConnected,
} from "pg-promise";
import {
  IClient,
  IConnectionParameters,
} from "pg-promise/typescript/pg-subset.js";

export type DB = IDatabase<unknown>;
export type DBConnection = IConnected<unknown, IClient>;
export type DBContext = {
  conn: DBConnection;
  pgp: IMain;
};
export type { IMain, IClient, ColumnSet, IColumnDescriptor, ITask };

export function initDB({
  username,
  password,
  host,
  port,
  database,
  useSSL,
  maxConnectionPool,
}: {
  username: string;
  password: string;
  host: string;
  port: number;
  database: string;
  useSSL: boolean;
  maxConnectionPool: number;
}): DB {
  const pgp = pgPromise();

  const encodedUsername = encodeURIComponent(username);
  const encodedPassword = encodeURIComponent(password);
  const encodedHost = encodeURIComponent(host);
  const encodedDatabase = encodeURIComponent(database);

  const conData = new ConnectionString(
    `postgresql://${encodedUsername}:${encodedPassword}@${encodedHost}:${port}/${encodedDatabase}`
  );

  const dbConfig: IConnectionParameters<IClient> = {
    database: conData.path !== undefined ? conData.path[0] : "",
    host: conData.hostname,
    password: conData.password,
    port: conData.port,
    user: conData.user,
    max: maxConnectionPool,
    ssl: useSSL ? { rejectUnauthorized: false } : undefined,
  };

  return pgp(dbConfig);
}
