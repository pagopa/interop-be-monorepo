import {
  InteropTokenGenerator,
  logger,
  RefreshableInteropToken,
} from "pagopa-interop-commons";
import { CorrelationId, generateId } from "pagopa-interop-models";
import { makeDrizzleConnection } from "pagopa-interop-readmodel";

import { getInteropBeClients } from "./clients/clientsProvider.js";
import { config } from "./configs/config.js";
import { readModelServiceBuilderSQL } from "./services/readModelServiceSQL.js";
import { riskAnalysisProcessingServiceBuilder } from "./services/riskAnalysisProcessingService.js";

const correlationId = generateId<CorrelationId>();
const loggerInstance = logger({
  serviceName: "risk-analysis-processing",
  correlationId: correlationId,
});

const tokenGenerator = new InteropTokenGenerator(config);
const refreshableToken = new RefreshableInteropToken(tokenGenerator);

const readModelDB = makeDrizzleConnection(config);
const readModelServiceSQL = readModelServiceBuilderSQL(readModelDB);

await refreshableToken.init();
const { purposeProcess } = getInteropBeClients();

export async function main(): Promise<void> {
  loggerInstance.info("Reviewer workflow migration job is starting...\n");

  const riskAnalysisProcessingService = riskAnalysisProcessingServiceBuilder(
    readModelServiceSQL,
    purposeProcess.client,
    refreshableToken,
    correlationId
  );

  const purposesProcessingResult =
    await riskAnalysisProcessingService.processPurposeReviewerWorkflows();

  if (purposesProcessingResult.processed.riskAnalyses !== 0) {
    loggerInstance.info(
      `(Purpose RiskAnalysis) fixed ${purposesProcessingResult.processed.riskAnalyses} reviewer workflow/s.`
    );
    return;
  }

  loggerInstance.info("No entities were fixed.");
}

await main();
process.exit(0);
