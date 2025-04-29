import { IConnected, IMain } from "pg-promise";
import { IClient } from "pg-promise/typescript/pg-subset.js";

export type DBConnection = IConnected<unknown, IClient>;
export type DBContext = {
  conn: DBConnection;
  pgp: IMain;
};
