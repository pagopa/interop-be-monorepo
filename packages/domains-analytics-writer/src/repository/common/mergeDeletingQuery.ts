import { genericInternalError } from "pagopa-interop-models";
import { ITask } from "pg-promise";
import { generateMergeDeleteQuery } from "../../utils/sqlQueryHelper.js";
import { config } from "../../config/config.js";

export async function mergeDeletingById(
  t: ITask<unknown>,
  id: string,
  deletingTableNames: string[],
  targetTableDeleting: string,
): Promise<void> {
  try {
    for (const deletingTableName of deletingTableNames) {
      const mergeQuery = generateMergeDeleteQuery(
        config.dbSchemaName,
        deletingTableName,
        targetTableDeleting,
        id,
      );
      await t.none(mergeQuery);
    }
  } catch (error: unknown) {
    throw genericInternalError(
      `Error merging staging tabasdasdle ${targetTableDeleting}: ${error}`,
    );
  }
}
