import {
  DrizzleReturnType,
  AgreementSQL,
  agreementInReadmodelAgreement,
} from "pagopa-interop-readmodel-models";

export const addOneAgreement = async (
  db: DrizzleReturnType,
  agreementSQL: AgreementSQL
): Promise<void> => {
  console.log("process.env ct", process.env);
  await db.insert(agreementInReadmodelAgreement).values(agreementSQL);
};
