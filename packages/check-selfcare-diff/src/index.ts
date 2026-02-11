import { selfcareV2InstitutionClientBuilder } from "pagopa-interop-api-clients";
import { makeDrizzleConnection } from "pagopa-interop-readmodel";
import { config } from "./config/config.js";
import { checkDifferences } from "./checkDifferences.js";

const db = makeDrizzleConnection(config);
const selfcareClient = selfcareV2InstitutionClientBuilder(config);

const result = await checkDifferences(db, selfcareClient, config);

const hasDifferences = result.summary.tenantsWithDifferences > 0;

if (hasDifferences) {
  // eslint-disable-next-line no-console
  console.error(JSON.stringify(result, null, 2));
} else {
  // eslint-disable-next-line no-console
  console.info("No differences found between Selfcare and DB data");
}
