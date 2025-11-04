/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { inject, afterEach, expect } from "vitest";
import { setupTestContainersVitest } from "pagopa-interop-commons-test";
import { purposeReadModelServiceBuilder } from "pagopa-interop-readmodel";
import { eq } from "drizzle-orm";
import { Purpose, PurposeId } from "pagopa-interop-models";
import {
  PurposeItemsSQL,
  DrizzleReturnType,
  PurposeSQL,
  purposeInReadmodelPurpose,
  PurposeRiskAnalysisFormSQL,
  purposeRiskAnalysisFormInReadmodelPurpose,
  PurposeRiskAnalysisAnswerSQL,
  purposeRiskAnalysisAnswerInReadmodelPurpose,
  PurposeVersionSQL,
  purposeVersionInReadmodelPurpose,
  PurposeVersionDocumentSQL,
  purposeVersionDocumentInReadmodelPurpose,
  PurposeVersionStampSQL,
  purposeVersionStampInReadmodelPurpose,
  PurposeVersionSignedDocumentSQL,
  purposeVersionSignedDocumentInReadmodelPurpose,
} from "pagopa-interop-readmodel-models";
import { purposeWriterServiceBuilder } from "../src/purposeWriterService.js";

export const { cleanup, readModelDB } = await setupTestContainersVitest(
  undefined,
  undefined,
  undefined,
  undefined,
  undefined,
  inject("readModelSQLConfig"),
);

afterEach(cleanup);

export const purposeReadModelService =
  purposeReadModelServiceBuilder(readModelDB);
export const purposeWriterService = purposeWriterServiceBuilder(readModelDB);

export const checkCompletePurpose = async (
  purpose: Purpose,
): Promise<PurposeItemsSQL> => {
  const retrievedPurposeSQL = await retrievePurposeSQLById(
    purpose.id,
    readModelDB,
  );
  const retrievedRiskAnalysisFormSQL =
    await retrievePurposeRiskAnalysisFormSQLById(purpose.id, readModelDB);
  const retrievedRiskAnalysisAnswersSQL =
    await retrievePurposeRiskAnalysisAnswersSQLById(purpose.id, readModelDB);
  const retrievedPurposeVersionsSQL = await retrievePurposeVersionsSQLById(
    purpose.id,
    readModelDB,
  );
  const retrievedPurposeVersionDocumentsSQL =
    await retrievePurposeVersionDocumentsSQLById(purpose.id, readModelDB);
  const retrievedPurposeVersionStampsSQL =
    await retrievePurposeVersionStampsSQLById(purpose.id, readModelDB);
  const retrievedPurposeVersionSignedDocumentsSQL =
    await retrievePurposeVersionSignedDocumentsSQLById(purpose.id, readModelDB);

  expect(retrievedPurposeSQL).toBeDefined();
  expect(retrievedRiskAnalysisFormSQL).toBeDefined();
  expect(retrievedRiskAnalysisAnswersSQL).toHaveLength(
    purpose.riskAnalysisForm!.multiAnswers.length +
      purpose.riskAnalysisForm!.singleAnswers.length,
  );
  expect(retrievedPurposeVersionsSQL).toHaveLength(purpose.versions.length);
  expect(retrievedPurposeVersionDocumentsSQL).toHaveLength(
    purpose.versions.length,
  );
  expect(retrievedPurposeVersionStampsSQL).toHaveLength(1);

  return {
    purposeSQL: retrievedPurposeSQL!,
    riskAnalysisFormSQL: retrievedRiskAnalysisFormSQL,
    riskAnalysisAnswersSQL: retrievedRiskAnalysisAnswersSQL,
    versionsSQL: retrievedPurposeVersionsSQL,
    versionDocumentsSQL: retrievedPurposeVersionDocumentsSQL,
    versionStampsSQL: retrievedPurposeVersionStampsSQL,
    versionSignedDocumentsSQL: retrievedPurposeVersionSignedDocumentsSQL,
  };
};

export const retrievePurposeSQLById = async (
  purposeId: PurposeId,
  db: DrizzleReturnType,
): Promise<PurposeSQL | undefined> => {
  const result = await db
    .select()
    .from(purposeInReadmodelPurpose)
    .where(eq(purposeInReadmodelPurpose.id, purposeId));

  return result[0];
};

export const retrievePurposeRiskAnalysisFormSQLById = async (
  purposeId: PurposeId,
  db: DrizzleReturnType,
): Promise<PurposeRiskAnalysisFormSQL | undefined> => {
  const result = await db
    .select()
    .from(purposeRiskAnalysisFormInReadmodelPurpose)
    .where(eq(purposeRiskAnalysisFormInReadmodelPurpose.purposeId, purposeId));

  return result[0];
};

export const retrievePurposeRiskAnalysisAnswersSQLById = async (
  purposeId: PurposeId,
  db: DrizzleReturnType,
): Promise<PurposeRiskAnalysisAnswerSQL[]> =>
  await db
    .select()
    .from(purposeRiskAnalysisAnswerInReadmodelPurpose)
    .where(
      eq(purposeRiskAnalysisAnswerInReadmodelPurpose.purposeId, purposeId),
    );

export const retrievePurposeVersionsSQLById = async (
  purposeId: PurposeId,
  db: DrizzleReturnType,
): Promise<PurposeVersionSQL[]> =>
  await db
    .select()
    .from(purposeVersionInReadmodelPurpose)
    .where(eq(purposeVersionInReadmodelPurpose.purposeId, purposeId));

export const retrievePurposeVersionDocumentsSQLById = async (
  purposeId: PurposeId,
  db: DrizzleReturnType,
): Promise<PurposeVersionDocumentSQL[]> =>
  await db
    .select()
    .from(purposeVersionDocumentInReadmodelPurpose)
    .where(eq(purposeVersionDocumentInReadmodelPurpose.purposeId, purposeId));

export const retrievePurposeVersionStampsSQLById = async (
  purposeId: PurposeId,
  db: DrizzleReturnType,
): Promise<PurposeVersionStampSQL[]> =>
  await db
    .select()
    .from(purposeVersionStampInReadmodelPurpose)
    .where(eq(purposeVersionStampInReadmodelPurpose.purposeId, purposeId));

export const retrievePurposeVersionSignedDocumentsSQLById = async (
  purposeId: PurposeId,
  db: DrizzleReturnType,
): Promise<PurposeVersionSignedDocumentSQL[]> =>
  await db
    .select()
    .from(purposeVersionSignedDocumentInReadmodelPurpose)
    .where(
      eq(purposeVersionSignedDocumentInReadmodelPurpose.purposeId, purposeId),
    );
