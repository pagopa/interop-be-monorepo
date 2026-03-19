/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { z } from "zod";
import { IMain, ITask } from "pg-promise";
import { genericInternalError } from "pagopa-interop-models";
import { DBConnection } from "../db/db.js";
import { DeletingDbTable, DomainDbTable } from "../model/db/index.js";
import { config } from "../config/config.js";
import {
  buildColumnSet,
  generateMergeDeleteQuery,
  generateMergeQuery,
  generateStagingDeleteQuery,
} from "../utils/sqlQueryHelper.js";

interface DeletingConfig<TDeletingSchema extends z.ZodRawShape> {
  deletingTableName: DeletingDbTable;
  deletingSchema: z.ZodObject<TDeletingSchema>;
  /** Key columns for the mergeDeleting query. Defaults to the main keyColumns if omitted. */
  deletingKeyColumns?: string[];
  useIdAsSourceDeleteKey?: boolean;
  physicalDelete?: boolean;
  additionalKeysToUpdate?: string[];
}

interface RepositoryConfig<TSchema extends z.ZodRawShape> {
  tableName: DomainDbTable;
  schema: z.ZodObject<TSchema>;
  keyColumns: string[];
}

export interface BaseRepository<TSchema> {
  insert(t: ITask<unknown>, pgp: IMain, records: TSchema[]): Promise<void>;
  merge(t: ITask<unknown>): Promise<void>;
  clean(): Promise<void>;
}

export interface DeletingRepository<TDeletingSchema> {
  insertDeleting(
    t: ITask<unknown>,
    pgp: IMain,
    records: TDeletingSchema[]
  ): Promise<void>;
  mergeDeleting(t: ITask<unknown>): Promise<void>;
  cleanDeleting(): Promise<void>;
}

// Overload: with deleting config
export function createRepository<
  TSchema extends z.ZodRawShape,
  TDeletingSchema extends z.ZodRawShape,
>(
  conn: DBConnection,
  repoCfg: RepositoryConfig<TSchema> & {
    deleting: DeletingConfig<TDeletingSchema>;
  }
): BaseRepository<z.infer<z.ZodObject<TSchema>>> &
  DeletingRepository<z.infer<z.ZodObject<TDeletingSchema>>>;

// Overload: without deleting config
export function createRepository<TSchema extends z.ZodRawShape>(
  conn: DBConnection,
  repoCfg: RepositoryConfig<TSchema>
): BaseRepository<z.infer<z.ZodObject<TSchema>>>;

// Implementation
export function createRepository<
  TSchema extends z.ZodRawShape,
  TDeletingSchema extends z.ZodRawShape,
>(
  conn: DBConnection,
  repoCfg: RepositoryConfig<TSchema> & {
    deleting?: DeletingConfig<TDeletingSchema>;
  }
): BaseRepository<z.infer<z.ZodObject<TSchema>>> &
  Partial<DeletingRepository<z.infer<z.ZodObject<TDeletingSchema>>>> {
  const { tableName, schema, keyColumns } = repoCfg;
  const schemaName = config.dbSchemaName;
  const stagingTableName = `${tableName}_${config.mergeTableSuffix}`;

  const base: BaseRepository<z.infer<z.ZodObject<TSchema>>> = {
    async insert(t, pgp, records) {
      try {
        const cs = buildColumnSet(pgp, tableName, schema);
        await t.none(pgp.helpers.insert(records, cs));
        await t.none(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          generateStagingDeleteQuery(tableName, keyColumns as any)
        );
      } catch (error: unknown) {
        throw genericInternalError(
          `Error inserting into staging table ${stagingTableName}: ${error}`
        );
      }
    },

    async merge(t) {
      try {
        const mergeQuery = generateMergeQuery(
          schema,
          schemaName,
          tableName,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          keyColumns as any
        );
        await t.none(mergeQuery);
      } catch (error: unknown) {
        throw genericInternalError(
          `Error merging staging table ${stagingTableName} into ${schemaName}.${tableName}: ${error}`
        );
      }
    },

    async clean() {
      try {
        await conn.none(`TRUNCATE TABLE ${stagingTableName};`);
      } catch (error: unknown) {
        throw genericInternalError(
          `Error cleaning staging table ${stagingTableName}: ${error}`
        );
      }
    },
  };

  if (!repoCfg.deleting) {
    return base;
  }

  const {
    deletingTableName,
    deletingSchema,
    deletingKeyColumns,
    useIdAsSourceDeleteKey,
    physicalDelete,
    additionalKeysToUpdate,
  } = repoCfg.deleting;
  const stagingDeletingTableName = `${deletingTableName}_${config.mergeTableSuffix}`;
  const effectiveDeletingKeyColumns = deletingKeyColumns ?? keyColumns;

  return {
    ...base,

    async insertDeleting(t, pgp, records) {
      try {
        const cs = buildColumnSet(pgp, deletingTableName, deletingSchema);
        await t.none(pgp.helpers.insert(records, cs));
      } catch (error: unknown) {
        throw genericInternalError(
          `Error inserting into deleting table ${stagingDeletingTableName}: ${error}`
        );
      }
    },

    async mergeDeleting(t) {
      try {
        const mergeQuery = generateMergeDeleteQuery(
          schemaName,
          tableName,
          deletingTableName,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          effectiveDeletingKeyColumns as any,
          useIdAsSourceDeleteKey,
          physicalDelete,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          additionalKeysToUpdate as any
        );
        await t.none(mergeQuery);
      } catch (error: unknown) {
        throw genericInternalError(
          `Error merging deleting table ${stagingDeletingTableName} into ${schemaName}.${tableName}: ${error}`
        );
      }
    },

    async cleanDeleting() {
      try {
        await conn.none(`TRUNCATE TABLE ${stagingDeletingTableName};`);
      } catch (error: unknown) {
        throw genericInternalError(
          `Error cleaning deleting staging table ${stagingDeletingTableName}: ${error}`
        );
      }
    },
  };
}
