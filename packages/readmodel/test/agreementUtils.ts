/* eslint-disable functional/immutable-data */
/* eslint-disable fp/no-delete */
import { eq } from "drizzle-orm";
import { getMockAgreement } from "pagopa-interop-commons-test/index.js";
import { Agreement, AgreementId } from "pagopa-interop-models";
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
import { agreementReadModelServiceBuilder } from "../src/agreementReadModelService.js";
import { readModelDB } from "./utils.js";

export const agreementReadModelService =
  agreementReadModelServiceBuilder(readModelDB);

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
