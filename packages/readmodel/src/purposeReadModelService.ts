import { and, eq, lte, SQL } from "drizzle-orm";
import {
  genericInternalError,
  Purpose,
  PurposeId,
  WithMetadata,
} from "pagopa-interop-models";
import {
  DrizzleReturnType,
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
import { checkMetadataVersion } from "./index.js";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function purposeReadModelServiceBuilder(db: DrizzleReturnType) {
  return {
    async upsertPurpose(
      purpose: Purpose,
      metadataVersion: number
    ): Promise<void> {
      await db.transaction(async (tx) => {
        const shouldUpsert = await checkMetadataVersion(
          tx,
          purposeInReadmodelPurpose,
          metadataVersion,
          purpose.id
        );

        if (!shouldUpsert) {
          return;
        }

        await tx
          .delete(purposeInReadmodelPurpose)
          .where(eq(purposeInReadmodelPurpose.id, purpose.id));

        const {
          purposeSQL,
          riskAnalysisFormSQL,
          riskAnalysisAnswersSQL,
          versionsSQL,
          versionDocumentsSQL,
        } = splitPurposeIntoObjectsSQL(purpose, metadataVersion);

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
      return await this.getPurposeByFilter(
        eq(purposeInReadmodelPurpose.id, purposeId)
      );
    },
    async getPurposeByFilter(
      filter: SQL | undefined
    ): Promise<WithMetadata<Purpose> | undefined> {
      if (filter === undefined) {
        throw genericInternalError("Filter cannot be undefined");
      }

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
        .where(filter)
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
    async getPurposesByFilter(
      filter: SQL | undefined
    ): Promise<Array<WithMetadata<Purpose>>> {
      if (filter === undefined) {
        throw genericInternalError("Filter cannot be undefined");
      }

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
        .where(filter)
        .leftJoin(
          purposeRiskAnalysisFormInReadmodelPurpose,
          eq(
            purposeInReadmodelPurpose.id,
            purposeRiskAnalysisFormInReadmodelPurpose.purposeId
          )
        )
        .leftJoin(
          purposeRiskAnalysisAnswerInReadmodelPurpose,
          eq(
            purposeRiskAnalysisFormInReadmodelPurpose.id,
            purposeRiskAnalysisAnswerInReadmodelPurpose.riskAnalysisFormId
          )
        )
        .leftJoin(
          purposeVersionInReadmodelPurpose,
          eq(
            purposeInReadmodelPurpose.id,
            purposeVersionInReadmodelPurpose.purposeId
          )
        )
        .leftJoin(
          purposeVersionDocumentInReadmodelPurpose,
          eq(
            purposeVersionInReadmodelPurpose.id,
            purposeVersionDocumentInReadmodelPurpose.purposeVersionId
          )
        );

      return aggregatePurposeArray(toPurposeAggregatorArray(queryResult));
    },
    async deletePurposeById(
      purposeId: PurposeId,
      version: number
    ): Promise<void> {
      await db
        .delete(purposeInReadmodelPurpose)
        .where(
          and(
            eq(purposeInReadmodelPurpose.id, purposeId),
            lte(purposeInReadmodelPurpose.metadataVersion, version)
          )
        );
    },
  };
}

export type PurposeReadModelService = ReturnType<
  typeof purposeReadModelServiceBuilder
>;
