import { genericInternalError } from "pagopa-interop-models";
import { ITask } from "pg-promise";
import { DBConnection } from "../db/db.js";

export async function merge({
  t,
  mergeQuery,
  stagingTableName,
  schemaName,
  tableName,
}: {
  t: ITask<unknown>;
  mergeQuery: string;
  stagingTableName: string;
  schemaName: string;
  tableName: string;
}): Promise<void> {
  try {
    await t.none(mergeQuery);
  } catch (error: unknown) {
    throw genericInternalError(
      `Error merging staging table ${stagingTableName} into ${schemaName}.${tableName}: ${error}`
    );
  }
}

export async function clean(
  conn: DBConnection,
  stagingTableName: string
): Promise<void> {
  try {
    await conn.none(`TRUNCATE TABLE ${stagingTableName};`);
  } catch (error: unknown) {
    throw genericInternalError(
      `Error cleaning staging table ${stagingTableName}: ${error}`
    );
  }
}

export async function mergeDeleting({
  t,
  mergeQuery,
  stagingDeletingTableName,
  schemaName,
  tableName,
}: {
  t: ITask<unknown>;
  mergeQuery: string;
  stagingDeletingTableName: string;
  schemaName: string;
  tableName: string;
}): Promise<void> {
  try {
    await t.none(mergeQuery);
  } catch (error: unknown) {
    throw genericInternalError(
      `Error merging staging table ${stagingDeletingTableName} into ${schemaName}.${tableName}: ${error}`
    );
  }
}

export async function cleanDeleting(
  conn: DBConnection,
  stagingDeletingTableName: string
): Promise<void> {
  try {
    await conn.none(`TRUNCATE TABLE ${stagingDeletingTableName};`);
  } catch (error: unknown) {
    throw genericInternalError(
      `Error cleaning deleting staging table ${stagingDeletingTableName}: ${error}`
    );
  }
}
