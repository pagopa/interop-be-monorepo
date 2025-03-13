/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { setupTestContainersVitest } from "pagopa-interop-commons-test";
import { PurposeId } from "pagopa-interop-models";
import { afterEach, inject } from "vitest";
import {
  purposeInReadmodelPurpose,
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
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { purposeReadModelServiceBuilder } from "../src/purposeReadModelService.js";

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

// PURPOSE
export const purposeReadModelService =
  purposeReadModelServiceBuilder(readModelDB);

export const retrievePurposeSQL = async (
  purposeId: PurposeId,
  db: ReturnType<typeof drizzle>
): Promise<PurposeSQL | undefined> => {
  const result = await db
    .select()
    .from(purposeInReadmodelPurpose)
    .where(eq(purposeInReadmodelPurpose.id, purposeId));

  return result[0];
};

export const retrievePurposeRiskAnalysisForm = async (
  purposeId: PurposeId,
  db: ReturnType<typeof drizzle>
): Promise<PurposeRiskAnalysisFormSQL | undefined> => {
  const result = await db
    .select()
    .from(purposeRiskAnalysisFormInReadmodelPurpose)
    .where(eq(purposeRiskAnalysisFormInReadmodelPurpose.purposeId, purposeId));

  return result[0];
};

export const retrievePurposeRiskAnalysisAnswersSQL = async (
  purposeId: PurposeId,
  db: ReturnType<typeof drizzle>
): Promise<PurposeRiskAnalysisAnswerSQL[]> =>
  await db
    .select()
    .from(purposeRiskAnalysisAnswerInReadmodelPurpose)
    .where(
      eq(purposeRiskAnalysisAnswerInReadmodelPurpose.purposeId, purposeId)
    );

export const retrievePurposeVersionsSQL = async (
  purposeId: PurposeId,
  db: ReturnType<typeof drizzle>
): Promise<PurposeVersionSQL[]> =>
  await db
    .select()
    .from(purposeVersionInReadmodelPurpose)
    .where(eq(purposeVersionInReadmodelPurpose.purposeId, purposeId));

export const retrievePurposeVersionDocumentSQL = async (
  purposeId: PurposeId,
  db: ReturnType<typeof drizzle>
): Promise<PurposeVersionDocumentSQL[]> =>
  await db
    .select()
    .from(purposeVersionDocumentInReadmodelPurpose)
    .where(eq(purposeVersionDocumentInReadmodelPurpose.purposeId, purposeId));
