import { and, isNotNull, isNull } from "drizzle-orm";
import { PurposeId } from "pagopa-interop-models";
import {
  DrizzleReturnType,
  purposeInReadmodelPurpose,
} from "pagopa-interop-readmodel-models";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function readModelServiceBuilderSQL(readModelDB: DrizzleReturnType) {
  return {
    async getAllReadModelPurposeIdsWithLegacyReviewMode(): Promise<
      PurposeId[]
    > {
      const queryResult = await readModelDB
        .select({ id: purposeInReadmodelPurpose.id })
        .from(purposeInReadmodelPurpose)
        .where(
          and(
            isNotNull(purposeInReadmodelPurpose.reviewerWorkflowReviewMode),
            isNull(purposeInReadmodelPurpose.reviewMode)
          )
        );

      return queryResult.map(({ id }) => id as PurposeId);
    },
  };
}
export type ReadModelServiceSQL = ReturnType<typeof readModelServiceBuilderSQL>;
