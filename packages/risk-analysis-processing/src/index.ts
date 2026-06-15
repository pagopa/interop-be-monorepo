import { z } from "zod";
import {
  logger,
  InteropTokenGenerator,
  RefreshableInteropToken,
} from "pagopa-interop-commons";
import {
  CorrelationId,
  EServiceTemplateId,
  generateId,
} from "pagopa-interop-models";
import { makeDrizzleConnection } from "pagopa-interop-readmodel";
import { config } from "./configs/config.js";
import { readModelServiceBuilderSQL } from "./services/readModelServiceSQL.js";
import { getInteropBeClients } from "./clients/clientsProvider.js";
import { riskAnalysisProcessingServiceBuilder } from "./services/riskAnalysisProcessingService.js";
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";

const correlationId = generateId<CorrelationId>();
const loggerInstance = logger({
  serviceName: "risk-analysis-processing",
  correlationId: correlationId,
});

const tokenGenerator = new InteropTokenGenerator(config);
const refreshableToken = new RefreshableInteropToken(tokenGenerator);

const readModelDB = makeDrizzleConnection(config);
const tenantKindHistoryDB = drizzle({
  client: new pg.Pool({
    host: config.tenantKindHistoryDBHost,
    port: config.tenantKindHistoryDBPort,
    database: config.tenantKindHistoryDBName,
    user: config.tenantKindHistoryDBUsername,
    password: config.tenantKindHistoryDBPassword,
    ssl: config.tenantKindHistoryDBUseSSL
      ? { rejectUnauthorized: false }
      : undefined,
  }),
});
const readModelServiceSQL = readModelServiceBuilderSQL(
  readModelDB,
  tenantKindHistoryDB
);

await refreshableToken.init();
const { catalogProcess, purposeProcess, eserviceTemplateProcess } =
  getInteropBeClients();

export async function main(): Promise<void> {
  loggerInstance.info("Tenant kind fix job is starting...\n");

  const riskAnalysisProcessingService = riskAnalysisProcessingServiceBuilder(
    readModelServiceSQL,
    catalogProcess.client,
    purposeProcess.client,
    eserviceTemplateProcess.client,
    refreshableToken,
    correlationId,
    loggerInstance
  );

  if (
    config.fixListTenantKindRiskAnalysisEserviceTemplates &&
    config.fixListTenantKindRiskAnalysisEserviceTemplates.length > 0
  ) {
    const templatesIds = z
      .array(EServiceTemplateId)
      .parse(config.fixListTenantKindRiskAnalysisEserviceTemplates);
    const eserviceTemplatesProcessingResult =
      await riskAnalysisProcessingService.processEServiceTemplateRiskAnalyses(
        templatesIds
      );
    loggerInstance.info(
      `(EService Template RiskAnalysis) fixed ${eserviceTemplatesProcessingResult.processed.riskAnalyses} tenantKind/s.`
    );
    return;
  }

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

  if (purposesProcessingResult.processed.riskAnalyses !== 0) {
    loggerInstance.info(
      `(Purpose RiskAnalysisForm) fixed ${purposesProcessingResult.processed.riskAnalyses} tenantKind/s, skipped ${purposesProcessingResult.processed.skipped} purpose/s with no tenantKindHistory entry.`
    );
    return;
  }

  loggerInstance.info("No entities were fixed.");
}

await main();
process.exit(0);
