import { genericInternalError } from "pagopa-interop-models";
import { ITask } from "../../db/db.js";
import { generateMergeDeleteQuery } from "../../utils/sqlQueryHelper.js";
import { CatalogDbTable } from "../../model/db.js";
import { config } from "../../config/config.js";

export async function mergeDeletingById(
  t: ITask<unknown>,
  id: string,
  deletingTableNames: string[]
): Promise<void> {
  try {
    for (const deletingTableName of deletingTableNames) {
      const mergeQuery = generateMergeDeleteQuery(
        config.dbSchemaName,
        deletingTableName,
        CatalogDbTable.deleting_by_id_table,
        id
      );
      await t.none(mergeQuery);
    }
  } catch (error: unknown) {
    throw genericInternalError(
      `Error merging staging tabasdasdle ${CatalogDbTable.deleting_by_id_table}: ${error}`
    );
  }
}
