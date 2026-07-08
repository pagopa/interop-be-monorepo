/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { z } from "zod";
import { IMain, ITask } from "pg-promise";
import { genericInternalError } from "pagopa-interop-models";
import { DBConnection } from "../db/db.js";
import {
  DeletingDbTable,
  DomainDbTable,
  DomainDbTableSchemas,
} from "../model/db/index.js";
import { config } from "../config/config.js";
import {
  buildColumnSet,
  generateMergeDeleteQuery,
  generateMergeQuery,
  generateStagingDeleteQuery,
} from "../utils/sqlQueryHelper.js";

type TableKey<TTable extends DomainDbTable> = Extract<
  keyof z.infer<DomainDbTableSchemas[TTable]>,
  string
>;
type RepositoryKey<
  TTable extends DomainDbTable,
  TSchema extends z.ZodRawShape,
> = Extract<keyof TSchema, TableKey<TTable>>;

interface DeletingConfig<
  TTable extends DomainDbTable,
  TSchema extends z.ZodRawShape,
  TDeletingSchema extends z.ZodRawShape,
> {
  deletingTableName: DeletingDbTable;
  deletingSchema: z.ZodObject<TDeletingSchema>;
  /** Key columns for the mergeDeleting query. Defaults to the main keyColumns if omitted. */
  deletingKeyColumns?: Array<RepositoryKey<TTable, TSchema>>;
  useIdAsSourceDeleteKey?: boolean;
  physicalDelete?: boolean;
  additionalKeysToUpdate?: Array<RepositoryKey<TTable, TSchema>>;
}

interface RepositoryConfig<
  TTable extends DomainDbTable,
  TSchema extends z.ZodRawShape,
> {
  tableName: TTable;
  schema: z.ZodObject<TSchema>;
  keyColumns: Array<RepositoryKey<TTable, TSchema>>;
}

interface BaseRepository<TSchema> {
  insert(t: ITask<unknown>, pgp: IMain, records: TSchema[]): Promise<void>;
  merge(t: ITask<unknown>): Promise<void>;
  clean(): Promise<void>;
}

interface DeletingRepository<TDeletingSchema> {
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
  TTable extends DomainDbTable,
  TSchema extends z.ZodRawShape,
  TDeletingSchema extends z.ZodRawShape,
>(
  conn: DBConnection,
  repoCfg: RepositoryConfig<TTable, TSchema> & {
    deleting: DeletingConfig<TTable, TSchema, TDeletingSchema>;
  }
): BaseRepository<z.infer<z.ZodObject<TSchema>>> &
  DeletingRepository<z.infer<z.ZodObject<TDeletingSchema>>>;

// Overload: without deleting config
export function createRepository<
  TTable extends DomainDbTable,
  TSchema extends z.ZodRawShape,
>(
  conn: DBConnection,
  repoCfg: RepositoryConfig<TTable, TSchema>
): BaseRepository<z.infer<z.ZodObject<TSchema>>>;

// Implementation
export function createRepository<
  TTable extends DomainDbTable,
  TSchema extends z.ZodRawShape,
  TDeletingSchema extends z.ZodRawShape,
>(
  conn: DBConnection,
  repoCfg: RepositoryConfig<TTable, TSchema> & {
    deleting?: DeletingConfig<TTable, TSchema, TDeletingSchema>;
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
        await t.none(generateStagingDeleteQuery(tableName, keyColumns));
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
          keyColumns
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
          effectiveDeletingKeyColumns,
          useIdAsSourceDeleteKey,
          physicalDelete,
          additionalKeysToUpdate
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
