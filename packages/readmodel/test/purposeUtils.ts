import { eq } from "drizzle-orm";
import { PurposeId } from "pagopa-interop-models";
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
import { drizzle } from "drizzle-orm/node-postgres";
import { purposeReadModelServiceBuilder } from "../src/purposeReadModelService.js";
import { readModelDB } from "./utils.js";

export const purposeReadModelService =
  purposeReadModelServiceBuilder(readModelDB);

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

export const retrievePurposeRiskAnalysisFormById = async (
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

export const retrievePurposeVersionDocumentSQLById = async (
  purposeId: PurposeId,
  db: ReturnType<typeof drizzle>
): Promise<PurposeVersionDocumentSQL[]> =>
  await db
    .select()
    .from(purposeVersionDocumentInReadmodelPurpose)
    .where(eq(purposeVersionDocumentInReadmodelPurpose.purposeId, purposeId));
