import { selfcareV2InstitutionClientBuilder } from "pagopa-interop-api-clients";
import { makeDrizzleConnection } from "pagopa-interop-readmodel";
import { config } from "./config/config.js";
import { checkDifferences } from "./checkDifferences.js";

const db = makeDrizzleConnection(config);
const selfcareClient = selfcareV2InstitutionClientBuilder(config);

const result = await checkDifferences(db, selfcareClient, config);

console.log(JSON.stringify(result, null, 2));
