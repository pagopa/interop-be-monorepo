import {
  RiskAnalysisEventEnvelope,
  fromStandaloneRiskAnalysisV2,
  missingKafkaMessageDataError,
  unsafeBrandId,
} from "pagopa-interop-models";
import { match } from "ts-pattern";
import { RiskAnalysisWriterService } from "./riskAnalysisWriterService.js";

export async function handleMessageV2(
  message: RiskAnalysisEventEnvelope,
  riskAnalysisWriterService: RiskAnalysisWriterService
): Promise<void> {
  const riskAnalysisV2 = message.data.riskAnalysis;
  if (!riskAnalysisV2) {
    throw missingKafkaMessageDataError("riskAnalysis", message.type);
  }
  const riskAnalysis = fromStandaloneRiskAnalysisV2(riskAnalysisV2);

  await match(message)
    .with({ type: "RiskAnalysisDeleted" }, async (message) => {
      await riskAnalysisWriterService.deleteRiskAnalysisById(
        unsafeBrandId(message.stream_id),
        message.version
      );
    })
    .with(
      { type: "RiskAnalysisCreated" },
      { type: "RiskAnalysisUpdated" },
      async (message) => {
        await riskAnalysisWriterService.upsertRiskAnalysis(
          riskAnalysis,
          message.version
        );
      }
    )
    .exhaustive();
}
