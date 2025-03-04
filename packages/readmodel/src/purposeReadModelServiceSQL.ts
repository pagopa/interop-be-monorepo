import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Purpose, PurposeId, WithMetadata } from "pagopa-interop-models";
import {
  purposeInReadmodelPurpose,
  purposeRiskAnalysisAnswerInReadmodelPurpose,
  purposeRiskAnalysisFormInReadmodelPurpose,
  purposeVersionDocumentInReadmodelPurpose,
  purposeVersionInReadmodelPurpose,
} from "pagopa-interop-readmodel-models";
import { splitPurposeIntoObjectsSQL } from "./purpose/splitters.js";
import {
  aggregatePurpose,
  aggregatePurposeArray,
  toPurposeAggregator,
  toPurposeAggregatorArray,
} from "./purpose/aggregators.js";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function purposeReadModelServiceBuilder(db: ReturnType<typeof drizzle>) {
  return {
    async upsertPurpose(purpose: WithMetadata<Purpose>): Promise<void> {
      const {
        purposeSQL,
        riskAnalysisFormSQL,
        riskAnalysisAnswersSQL,
        versionsSQL,
        versionDocumentsSQL,
      } = splitPurposeIntoObjectsSQL(purpose.data, purpose.metadata.version);

      await db.transaction(async (tx) => {
        await tx
          .delete(purposeInReadmodelPurpose)
          .where(eq(purposeInReadmodelPurpose.id, purpose.data.id));

        await tx.insert(purposeInReadmodelPurpose).values(purposeSQL);

        if (riskAnalysisFormSQL) {
          await tx
            .insert(purposeRiskAnalysisFormInReadmodelPurpose)
            .values(riskAnalysisFormSQL);
        }

        if (riskAnalysisAnswersSQL) {
          for (const riskAnalysisAnswerSQL of riskAnalysisAnswersSQL) {
            await tx
              .insert(purposeRiskAnalysisAnswerInReadmodelPurpose)
              .values(riskAnalysisAnswerSQL);
          }
        }

        for (const versionSQL of versionsSQL) {
          await tx.insert(purposeVersionInReadmodelPurpose).values(versionSQL);
        }

        for (const versionDocumentSQL of versionDocumentsSQL) {
          await tx
            .insert(purposeVersionDocumentInReadmodelPurpose)
            .values(versionDocumentSQL);
        }
      });
    },
    async getPurposeById(
      purposeId: PurposeId
    ): Promise<WithMetadata<Purpose> | undefined> {
      /*
        purpose -> 1 purpose_risk_analysis_form -> 2 purpose_risk_analysis_answer
                -> 3 purpose_version -> 4 purpose_version_document
      */
      const queryResult = await db
        .select({
          purpose: purposeInReadmodelPurpose,
          purposeRiskAnalysisForm: purposeRiskAnalysisFormInReadmodelPurpose,
          purposeRiskAnalysisAnswer:
            purposeRiskAnalysisAnswerInReadmodelPurpose,
          purposeVersion: purposeVersionInReadmodelPurpose,
          purposeVersionDocument: purposeVersionDocumentInReadmodelPurpose,
        })
        .from(purposeInReadmodelPurpose)
        .where(eq(purposeInReadmodelPurpose.id, purposeId))
        .leftJoin(
          // 1
          purposeRiskAnalysisFormInReadmodelPurpose,
          eq(
            purposeInReadmodelPurpose.id,
            purposeRiskAnalysisFormInReadmodelPurpose.purposeId
          )
        )
        .leftJoin(
          // 2
          purposeRiskAnalysisAnswerInReadmodelPurpose,
          eq(
            purposeRiskAnalysisFormInReadmodelPurpose.id,
            purposeRiskAnalysisAnswerInReadmodelPurpose.riskAnalysisFormId
          )
        )
        .leftJoin(
          // 3
          purposeVersionInReadmodelPurpose,
          eq(
            purposeInReadmodelPurpose.id,
            purposeVersionInReadmodelPurpose.purposeId
          )
        )
        .leftJoin(
          // 4
          purposeVersionDocumentInReadmodelPurpose,
          eq(
            purposeVersionInReadmodelPurpose.id,
            purposeVersionDocumentInReadmodelPurpose.purposeVersionId
          )
        );

      if (queryResult.length === 0) {
        return undefined;
      }

      return aggregatePurpose(toPurposeAggregator(queryResult));
    },
    async deletePurposeById(purposeId: PurposeId): Promise<void> {
      await db
        .delete(purposeInReadmodelPurpose)
        .where(eq(purposeInReadmodelPurpose.id, purposeId));
    },
    async getAllPurposes(): Promise<Array<WithMetadata<Purpose>>> {
      const queryResult = await db
        .select({
          purpose: purposeInReadmodelPurpose,
          purposeRiskAnalysisForm: purposeRiskAnalysisFormInReadmodelPurpose,
          purposeRiskAnalysisAnswer:
            purposeRiskAnalysisAnswerInReadmodelPurpose,
          purposeVersion: purposeVersionInReadmodelPurpose,
          purposeVersionDocument: purposeVersionDocumentInReadmodelPurpose,
        })
        .from(purposeInReadmodelPurpose)
        .leftJoin(
          // 1
          purposeRiskAnalysisFormInReadmodelPurpose,
          eq(
            purposeInReadmodelPurpose.id,
            purposeRiskAnalysisFormInReadmodelPurpose.purposeId
          )
        )
        .leftJoin(
          // 2
          purposeRiskAnalysisAnswerInReadmodelPurpose,
          eq(
            purposeRiskAnalysisFormInReadmodelPurpose.id,
            purposeRiskAnalysisAnswerInReadmodelPurpose.riskAnalysisFormId
          )
        )
        .leftJoin(
          // 3
          purposeVersionInReadmodelPurpose,
          eq(
            purposeInReadmodelPurpose.id,
            purposeVersionInReadmodelPurpose.purposeId
          )
        )
        .leftJoin(
          // 4
          purposeVersionDocumentInReadmodelPurpose,
          eq(
            purposeVersionInReadmodelPurpose.id,
            purposeVersionDocumentInReadmodelPurpose.purposeVersionId
          )
        );

      return aggregatePurposeArray(toPurposeAggregatorArray(queryResult));
    },
  };
}

export type PurposeReadModelService = ReturnType<
  typeof purposeReadModelServiceBuilder
>;
