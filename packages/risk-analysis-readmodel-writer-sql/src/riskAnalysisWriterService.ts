import { and, eq, lte } from "drizzle-orm";
import { RiskAnalysisId, StandaloneRiskAnalysis } from "pagopa-interop-models";
import { checkMetadataVersion, splitStandaloneRiskAnalysisIntoObjectsSQL } from "pagopa-interop-readmodel";
import {
  DrizzleReturnType,
  DrizzleTransactionType,
  riskAnalysisAnswerInReadmodelRiskAnalysis,
  riskAnalysisInReadmodelRiskAnalysis,
} from "pagopa-interop-readmodel-models";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function riskAnalysisWriterServiceBuilder(db: DrizzleReturnType) {
  const updateMetadataVersionInRiskAnalysisTables = async (
    tx: DrizzleTransactionType,
    riskAnalysisId: RiskAnalysisId,
    newMetadataVersion: number
  ): Promise<void> => {
    const tables = [
      riskAnalysisInReadmodelRiskAnalysis,
      riskAnalysisAnswerInReadmodelRiskAnalysis,
    ];

    for (const table of tables) {
      await tx
        .update(table)
        .set({ metadataVersion: newMetadataVersion })
        .where(
          and(
            eq(
              "riskAnalysisId" in table ? table.riskAnalysisId : table.id,
              riskAnalysisId
            ),
            lte(table.metadataVersion, newMetadataVersion)
          )
        );
    }
  };

  return {
    async upsertRiskAnalysis(
      riskAnalysis: StandaloneRiskAnalysis,
      metadataVersion: number
    ): Promise<void> {
      await db.transaction(async (tx) => {
        const shouldUpsert = await checkMetadataVersion(
          tx,
          riskAnalysisInReadmodelRiskAnalysis,
          metadataVersion,
          riskAnalysis.id
        );

        if (!shouldUpsert) {
          return;
        }

        await tx
          .delete(riskAnalysisInReadmodelRiskAnalysis)
          .where(eq(riskAnalysisInReadmodelRiskAnalysis.id, riskAnalysis.id));

        const { riskAnalysisSQL, riskAnalysisAnswersSQL } =
          splitStandaloneRiskAnalysisIntoObjectsSQL(
            riskAnalysis,
            metadataVersion
          );

        await tx
          .insert(riskAnalysisInReadmodelRiskAnalysis)
          .values(riskAnalysisSQL);

        for (const answerSQL of riskAnalysisAnswersSQL) {
          await tx
            .insert(riskAnalysisAnswerInReadmodelRiskAnalysis)
            .values(answerSQL);
        }
      });
    },

    async deleteRiskAnalysisById(
      riskAnalysisId: RiskAnalysisId,
      version: number
    ): Promise<void> {
      await db
        .delete(riskAnalysisInReadmodelRiskAnalysis)
        .where(
          and(
            eq(riskAnalysisInReadmodelRiskAnalysis.id, riskAnalysisId),
            lte(riskAnalysisInReadmodelRiskAnalysis.metadataVersion, version)
          )
        );
    },
  };
}

export type RiskAnalysisWriterService = ReturnType<
  typeof riskAnalysisWriterServiceBuilder
>;
