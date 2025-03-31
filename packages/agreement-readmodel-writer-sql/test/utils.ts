/* eslint-disable functional/immutable-data */
/* eslint-disable fp/no-delete */
import {
  getMockAgreement,
  setupTestContainersVitest,
} from "pagopa-interop-commons-test";
import { agreementReadModelServiceBuilder } from "pagopa-interop-readmodel";
import { afterEach, inject } from "vitest";
import { Agreement, AgreementId } from "pagopa-interop-models";
import {
  agreementAttributeInReadmodelAgreement,
  AgreementAttributeSQL,
  agreementConsumerDocumentInReadmodelAgreement,
  AgreementConsumerDocumentSQL,
  agreementContractInReadmodelAgreement,
  AgreementContractSQL,
  agreementInReadmodelAgreement,
  AgreementSQL,
  agreementStampInReadmodelAgreement,
  AgreementStampSQL,
} from "pagopa-interop-readmodel-models";
import { eq } from "drizzle-orm";
import { readModelServiceBuilder } from "../src/readModelService.js";

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
export const readModelService = readModelServiceBuilder(readModelDB);

export const getCustomMockAgreement = (): Agreement => {
  const agreement = getMockAgreement();
  delete agreement.suspendedByConsumer;
  delete agreement.suspendedByProducer;
  delete agreement.suspendedByPlatform;
  delete agreement.updatedAt;
  delete agreement.consumerNotes;
  delete agreement.contract;
  delete agreement.rejectionReason;
  delete agreement.suspendedAt;
  return agreement;
};

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
