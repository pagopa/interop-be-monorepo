console.log("LOADING pagopa-interop-readmodel-models");
import { PgTable } from "drizzle-orm/pg-core";
import {
  DrizzleReturnType,
  AgreementSQL,
} from "pagopa-interop-readmodel-models";

export const addOneAgreement = async (
  db: DrizzleReturnType,
  table: PgTable,
  agreementSQL: AgreementSQL
): Promise<void> => {
  console.log("EXECUTING addOneAgreement");
  await db.insert(table).values(agreementSQL);
};
