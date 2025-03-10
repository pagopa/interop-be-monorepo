import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
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
): Promise<PurposeRiskAnalysisAnswerSQL[] | undefined> => {
  const result = await db
    .select()
    .from(purposeRiskAnalysisAnswerInReadmodelPurpose)
    .where(
      eq(purposeRiskAnalysisAnswerInReadmodelPurpose.purposeId, purposeId)
    );

  return result.length > 0 ? result : undefined;
};

export const retrievePurposeVersionsSQL = async (
  purposeId: PurposeId,
  db: ReturnType<typeof drizzle>
): Promise<PurposeVersionSQL[] | undefined> => {
  const result = await db
    .select()
    .from(purposeVersionInReadmodelPurpose)
    .where(eq(purposeVersionInReadmodelPurpose.purposeId, purposeId));

  return result.length > 0 ? result : undefined;
};

export const retrievePurposeVersionDocumentSQL = async (
  purposeId: PurposeId,
  db: ReturnType<typeof drizzle>
): Promise<PurposeVersionDocumentSQL[] | undefined> => {
  const result = await db
    .select()
    .from(purposeVersionDocumentInReadmodelPurpose)
    .where(eq(purposeVersionDocumentInReadmodelPurpose.purposeId, purposeId));

  return result.length > 0 ? result : undefined;
};
