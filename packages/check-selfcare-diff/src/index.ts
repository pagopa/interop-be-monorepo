import { selfcareV2InstitutionClientBuilder } from "pagopa-interop-api-clients";
import { Logger, logger } from "pagopa-interop-commons";
import { CorrelationId, generateId } from "pagopa-interop-models";
import { makeDrizzleConnection } from "pagopa-interop-readmodel";

import {
  checkDifferences,
  DiffResult,
  TenantDiff,
} from "./checkDifferences.js";
import { config } from "./config/config.js";

function logTenantDifference(loggerInstance: Logger, tenant: TenantDiff): void {
  loggerInstance.error(
    `Difference found for tenant: ${JSON.stringify(tenant)}`
  );
}

function logDifferences(loggerInstance: Logger, result: DiffResult): void {
  result.tenants.forEach((tenant) =>
    logTenantDifference(loggerInstance, tenant)
  );
  loggerInstance.error(
    `Differences summary: ${JSON.stringify(result.summary)}`
  );
}

const correlationId = generateId<CorrelationId>();
const loggerInstance = logger({
  serviceName: "check-selfcare-diff",
  correlationId,
});

const db = makeDrizzleConnection(config);
const selfcareClient = selfcareV2InstitutionClientBuilder(config);

const result = await checkDifferences(db, selfcareClient, config);

if (result.summary.tenantsWithDifferences > 0) {
  logDifferences(loggerInstance, result);
} else {
  loggerInstance.info("No differences found between Selfcare and DB data");
}
