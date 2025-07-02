import { setupTestContainersVitest } from "pagopa-interop-commons-test";
import { agreementReadModelServiceBuilder } from "pagopa-interop-readmodel";
import { afterEach, inject } from "vitest";
import { eq } from "drizzle-orm";
import { AgreementId } from "pagopa-interop-models";
import {
  AgreementSQL,
  agreementInReadmodelAgreement,
  AgreementStampSQL,
  agreementStampInReadmodelAgreement,
  AgreementAttributeSQL,
  agreementAttributeInReadmodelAgreement,
  AgreementConsumerDocumentSQL,
  agreementConsumerDocumentInReadmodelAgreement,
  AgreementContractSQL,
  agreementContractInReadmodelAgreement,
} from "pagopa-interop-readmodel-models";
import { agreementWriterServiceBuilder } from "../src/agreementWriterService.js";

export const { cleanup, readModelDB } = await setupTestContainersVitest(
  undefined,
  undefined,
  undefined,
  undefined,
  undefined,
  undefined,
  inject("readModelSQLConfig")
);

afterEach(cleanup);

export const agreementReadModelService =
  agreementReadModelServiceBuilder(readModelDB);
export const agreementWriterService =
  agreementWriterServiceBuilder(readModelDB);

export const readAgreementSQL = async (
  agreementId: AgreementId
): Promise<AgreementSQL | undefined> => {
  const result = await readModelDB
    .select()
    .from(agreementInReadmodelAgreement)
    .where(eq(agreementInReadmodelAgreement.id, agreementId));
  return result[0];
};

export const readAgreementStampsSQLByAgreementId = async (
  agreementId: AgreementId
): Promise<AgreementStampSQL[]> =>
  await readModelDB
    .select()
    .from(agreementStampInReadmodelAgreement)
    .where(eq(agreementStampInReadmodelAgreement.agreementId, agreementId));

export const readAgreementAttributesSQLByAgreementId = async (
  agreementId: AgreementId
): Promise<AgreementAttributeSQL[]> =>
  await readModelDB
    .select()
    .from(agreementAttributeInReadmodelAgreement)
    .where(eq(agreementAttributeInReadmodelAgreement.agreementId, agreementId));

export const readAgreementConsumerDocumentSQLByAgreementId = async (
  agreementId: AgreementId
): Promise<AgreementConsumerDocumentSQL[]> =>
  await readModelDB
    .select()
    .from(agreementConsumerDocumentInReadmodelAgreement)
    .where(
      eq(agreementConsumerDocumentInReadmodelAgreement.agreementId, agreementId)
    );

export const readAgreementContractQLByAgreementId = async (
  agreementId: AgreementId
): Promise<AgreementContractSQL[]> =>
  await readModelDB
    .select()
    .from(agreementContractInReadmodelAgreement)
    .where(eq(agreementContractInReadmodelAgreement.agreementId, agreementId));
