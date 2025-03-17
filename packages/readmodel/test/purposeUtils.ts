/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { eq } from "drizzle-orm";
import { Purpose, PurposeId } from "pagopa-interop-models";
import {
  purposeInReadmodelPurpose,
  PurposeItemsSQL,
  purposeRiskAnalysisAnswerInReadmodelPurpose,
  PurposeRiskAnalysisAnswerSQL,
  purposeRiskAnalysisFormInReadmodelPurpose,
  PurposeRiskAnalysisFormSQL,
  PurposeSQL,
  purposeVersionDocumentInReadmodelPurpose,
  PurposeVersionDocumentSQL,
  purposeVersionInReadmodelPurpose,
  PurposeVersionSQL,
} from "pagopa-interop-readmodel-models";
import { drizzle } from "drizzle-orm/node-postgres";
import { expect } from "vitest";
import { purposeReadModelServiceBuilder } from "../src/purposeReadModelService.js";
import { readModelDB } from "./utils.js";

export const purposeReadModelService =
  purposeReadModelServiceBuilder(readModelDB);

export const checkCompletePurpose = async (
  purpose: Purpose
): Promise<PurposeItemsSQL> => {
  const retrievedPurposeSQL = await retrievePurposeSQLById(
    purpose.id,
    readModelDB
  );
  const retrievedRiskAnalysisFormSQL =
    await retrievePurposeRiskAnalysisFormSQLById(purpose.id, readModelDB);
  const retrievedRiskAnalysisAnswersSQL =
    await retrievePurposeRiskAnalysisAnswersSQLById(purpose.id, readModelDB);
  const retrievedPurposeVersionsSQL = await retrievePurposeVersionsSQLById(
    purpose.id,
    readModelDB
  );
  const retrievedPurposeVersionDocumentsSQL =
    await retrievePurposeVersionDocumentsSQLById(purpose.id, readModelDB);

  expect(retrievedPurposeSQL).toBeDefined();
  expect(retrievedRiskAnalysisFormSQL).toBeDefined();
  expect(retrievedRiskAnalysisAnswersSQL).toHaveLength(
    purpose.riskAnalysisForm!.multiAnswers.length +
      purpose.riskAnalysisForm!.singleAnswers.length
  );
  expect(retrievedPurposeVersionsSQL).toHaveLength(purpose.versions.length);
  expect(retrievedPurposeVersionDocumentsSQL).toHaveLength(
    purpose.versions.length
  );

  return {
    purposeSQL: retrievedPurposeSQL!,
    riskAnalysisFormSQL: retrievedRiskAnalysisFormSQL!,
    riskAnalysisAnswersSQL: retrievedRiskAnalysisAnswersSQL,
    versionsSQL: retrievedPurposeVersionsSQL,
    versionDocumentsSQL: retrievedPurposeVersionDocumentsSQL,
  };
};

export const retrievePurposeSQLById = async (
  purposeId: PurposeId,
  // TODO: import this
  db: ReturnType<typeof drizzle>
): Promise<PurposeSQL | undefined> => {
  const result = await db
    .select()
    .from(purposeInReadmodelPurpose)
    .where(eq(purposeInReadmodelPurpose.id, purposeId));

  return result[0];
};

export const retrievePurposeRiskAnalysisFormSQLById = async (
  purposeId: PurposeId,
  db: ReturnType<typeof drizzle>
): Promise<PurposeRiskAnalysisFormSQL | undefined> => {
  const result = await db
    .select()
    .from(purposeRiskAnalysisFormInReadmodelPurpose)
    .where(eq(purposeRiskAnalysisFormInReadmodelPurpose.purposeId, purposeId));

  return result[0];
};

export const retrievePurposeRiskAnalysisAnswersSQLById = async (
  purposeId: PurposeId,
  db: ReturnType<typeof drizzle>
): Promise<PurposeRiskAnalysisAnswerSQL[]> =>
  await db
    .select()
    .from(purposeRiskAnalysisAnswerInReadmodelPurpose)
    .where(
      eq(purposeRiskAnalysisAnswerInReadmodelPurpose.purposeId, purposeId)
    );

export const retrievePurposeVersionsSQLById = async (
  purposeId: PurposeId,
  db: ReturnType<typeof drizzle>
): Promise<PurposeVersionSQL[]> =>
  await db
    .select()
    .from(purposeVersionInReadmodelPurpose)
    .where(eq(purposeVersionInReadmodelPurpose.purposeId, purposeId));

export const retrievePurposeVersionDocumentsSQLById = async (
  purposeId: PurposeId,
  db: ReturnType<typeof drizzle>
): Promise<PurposeVersionDocumentSQL[]> =>
  await db
    .select()
    .from(purposeVersionDocumentInReadmodelPurpose)
    .where(eq(purposeVersionDocumentInReadmodelPurpose.purposeId, purposeId));
