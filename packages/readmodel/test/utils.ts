/* eslint-disable fp/no-delete */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { setupTestContainersVitest } from "pagopa-interop-commons-test";
import { afterEach, inject } from "vitest";
import { EServiceRiskAnalysisAnswerSQL } from "pagopa-interop-readmodel-models";
import {
  Agreement,
  AgreementId,
  RiskAnalysis,
  riskAnalysisAnswerKind,
  stringToDate,
} from "pagopa-interop-models";
import { getMockAgreement } from "pagopa-interop-commons-test";
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
import { catalogReadModelServiceBuilderSQL } from "../src/catalogReadModelService.js";
import { agreementReadModelServiceBuilderSQL } from "../src/agreementReadModelService.js";

export const { cleanup, readModelDB } = await setupTestContainersVitest(
  undefined,
  undefined,
  undefined,
  undefined,
  undefined,
  undefined,
  inject("readModelSQLConfig")
);

export const readModelService = catalogReadModelServiceBuilderSQL(readModelDB);

afterEach(cleanup);

export const catalogReadModelService =
  catalogReadModelServiceBuilderSQL(readModelDB);

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

export const agreementReadModelService =
  agreementReadModelServiceBuilderSQL(readModelDB);

export function stringToISOString(input: string): string;
export function stringToISOString(input: string | null): string | null;
export function stringToISOString(input: string | null): string | null {
  return input ? stringToDate(input).toISOString() : null;
}

export const generateRiskAnalysisAnswersSQL = (
  eserviceId: string,
  riskAnalyses: RiskAnalysis[],
  metadataVersion: number
): EServiceRiskAnalysisAnswerSQL[] =>
  riskAnalyses.flatMap(({ riskAnalysisForm }) => [
    ...riskAnalysisForm.singleAnswers.map(
      (a): EServiceRiskAnalysisAnswerSQL => ({
        id: a.id,
        eserviceId,
        metadataVersion,
        key: a.key,
        value: a.value ? [a.value] : [],
        riskAnalysisFormId: riskAnalysisForm.id,
        kind: riskAnalysisAnswerKind.single,
      })
    ),
    ...riskAnalysisForm.multiAnswers.map(
      (a): EServiceRiskAnalysisAnswerSQL => ({
        id: a.id,
        eserviceId,
        metadataVersion,
        key: a.key,
        value: a.values,
        riskAnalysisFormId: riskAnalysisForm.id,
        kind: riskAnalysisAnswerKind.multi,
      })
    ),
  ]);

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
