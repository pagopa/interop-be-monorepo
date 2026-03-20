import {
  logger,
  InteropTokenGenerator,
  RefreshableInteropToken,
} from "pagopa-interop-commons";
import { CorrelationId, generateId } from "pagopa-interop-models";
import { makeDrizzleConnection } from "pagopa-interop-readmodel";
import { config } from "./configs/config.js";
import { readModelServiceBuilderSQL } from "./services/readModelServiceSQL.js";
import { getInteropBeClients } from "./clients/clientsProvider.js";
import { riskAnalysisProcessingServiceBuilder } from "./services/riskAnalysisProcessingService.js";

const correlationId = generateId<CorrelationId>();
const loggerInstance = logger({
  serviceName: "risk-analysis-processing-job",
  correlationId: correlationId,
});

const tokenGenerator = new InteropTokenGenerator(config);
const refreshableToken = new RefreshableInteropToken(tokenGenerator);

const readModelDB = makeDrizzleConnection(config);
const readModelServiceSQL = readModelServiceBuilderSQL(readModelDB);

await refreshableToken.init();
const { catalogProcess, purposeProcess } = getInteropBeClients();

export async function main(): Promise<void> {
  loggerInstance.info("Tenant kind fix job is starting...\n");

  const riskAnalysisProcessingService = riskAnalysisProcessingServiceBuilder(
    readModelServiceSQL,
    catalogProcess.client,
    purposeProcess.client,
    refreshableToken,
    correlationId
  );

  const eservicesProcessingResult =
    await riskAnalysisProcessingService.processEServiceRiskAnalyses();

  if (eservicesProcessingResult.processed.riskAnalyses !== 0) {
    loggerInstance.info(
      `(EService RiskAnalysis) fixed ${eservicesProcessingResult.processed.riskAnalyses} tenantKind/s.`
    );
    return;
  }

  const purposesProcessingResult =
    await riskAnalysisProcessingService.processPurposeRiskAnalyses();

  loggerInstance.info(
    `(Purpose RiskAnalysisForm) fixed ${purposesProcessingResult.processed.riskAnalyses} tenantKind/s.`
  );
}

await main();
process.exit(0);
