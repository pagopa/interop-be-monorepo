import { and, eq, SQL } from "drizzle-orm";
import {
  genericInternalError,
  RiskAnalysisId,
  StandaloneRiskAnalysis,
  WithMetadata,
} from "pagopa-interop-models";
import {
  DrizzleReturnType,
  riskAnalysisAnswerInReadmodelRiskAnalysis,
  riskAnalysisInReadmodelRiskAnalysis,
} from "pagopa-interop-readmodel-models";
import {
  aggregateStandaloneRiskAnalysis,
  aggregateStandaloneRiskAnalysisArray,
} from "./aggregators.js";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function riskAnalysisReadModelServiceBuilder(db: DrizzleReturnType) {
  return {
    async getRiskAnalysisById(
      riskAnalysisId: RiskAnalysisId
    ): Promise<WithMetadata<StandaloneRiskAnalysis> | undefined> {
      return await this.getRiskAnalysisByFilter(
        eq(riskAnalysisInReadmodelRiskAnalysis.id, riskAnalysisId)
      );
    },

    async getRiskAnalysisByFilter(
      filter: SQL | undefined
    ): Promise<WithMetadata<StandaloneRiskAnalysis> | undefined> {
      if (filter === undefined) {
        throw genericInternalError("Filter cannot be undefined");
      }

      const queryResult = await db
        .select({
          riskAnalysis: riskAnalysisInReadmodelRiskAnalysis,
          riskAnalysisAnswer: riskAnalysisAnswerInReadmodelRiskAnalysis,
        })
        .from(riskAnalysisInReadmodelRiskAnalysis)
        .leftJoin(
          riskAnalysisAnswerInReadmodelRiskAnalysis,
          eq(
            riskAnalysisInReadmodelRiskAnalysis.id,
            riskAnalysisAnswerInReadmodelRiskAnalysis.riskAnalysisId
          )
        )
        .where(filter);

      if (queryResult.length === 0) {
        return undefined;
      }

      const riskAnalysisSQL = queryResult[0].riskAnalysis;
      const answersSQL = queryResult
        .map((r) => r.riskAnalysisAnswer)
        .filter((a) => a !== null);

      return aggregateStandaloneRiskAnalysis(riskAnalysisSQL, answersSQL);
    },

    async getRiskAnalyses(filter?: SQL): Promise<
      Array<WithMetadata<StandaloneRiskAnalysis>>
    > {
      const queryResult = await db
        .select({
          riskAnalysis: riskAnalysisInReadmodelRiskAnalysis,
          riskAnalysisAnswer: riskAnalysisAnswerInReadmodelRiskAnalysis,
        })
        .from(riskAnalysisInReadmodelRiskAnalysis)
        .leftJoin(
          riskAnalysisAnswerInReadmodelRiskAnalysis,
          eq(
            riskAnalysisInReadmodelRiskAnalysis.id,
            riskAnalysisAnswerInReadmodelRiskAnalysis.riskAnalysisId
          )
        )
        .where(filter);

      const riskAnalysesSQL = [
        ...new Map(
          queryResult.map((r) => [r.riskAnalysis.id, r.riskAnalysis])
        ).values(),
      ];
      const answersSQL = queryResult
        .map((r) => r.riskAnalysisAnswer)
        .filter((a) => a !== null);

      return aggregateStandaloneRiskAnalysisArray(riskAnalysesSQL, answersSQL);
    },
  };
}
