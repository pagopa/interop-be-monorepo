/* eslint-disable @typescript-eslint/no-non-null-assertion */
import {
  getMockCompleteRiskAnalysisFormTemplate,
  getMockPurposeTemplate,
  setupTestContainersVitest,
} from "pagopa-interop-commons-test";
import { inject, afterEach, expect } from "vitest";
import { purposeTemplateReadModelServiceBuilder } from "pagopa-interop-readmodel";
import { PurposeTemplate, PurposeTemplateId } from "pagopa-interop-models";
import {
  DrizzleReturnType,
  purposeTemplateInReadmodelPurposeTemplate,
  PurposeTemplateItemsSQL,
  purposeTemplateRiskAnalysisAnswerAnnotationDocumentInReadmodelPurposeTemplate,
  PurposeTemplateRiskAnalysisAnswerAnnotationDocumentSQL,
  purposeTemplateRiskAnalysisAnswerAnnotationInReadmodelPurposeTemplate,
  PurposeTemplateRiskAnalysisAnswerAnnotationSQL,
  purposeTemplateRiskAnalysisAnswerInReadmodelPurposeTemplate,
  PurposeTemplateRiskAnalysisAnswerSQL,
  purposeTemplateRiskAnalysisFormDocumentInReadmodelPurposeTemplate,
  PurposeTemplateRiskAnalysisFormDocumentSQL,
  purposeTemplateRiskAnalysisFormInReadmodelPurposeTemplate,
  purposeTemplateRiskAnalysisFormSignedDocumentInReadmodelPurposeTemplate,
  PurposeTemplateRiskAnalysisFormSignedDocumentSQL,
  PurposeTemplateRiskAnalysisFormSQL,
  PurposeTemplateSQL,
} from "pagopa-interop-readmodel-models";
import { eq } from "drizzle-orm";
import { purposeTemplateWriterServiceBuilder } from "../src/purposeTemplateWriterService.js";

export const { cleanup, readModelDB } = await setupTestContainersVitest(
  undefined,
  undefined,
  undefined,
  undefined,
  undefined,
  inject("readModelSQLConfig")
);

afterEach(cleanup);

export const purposeTemplateReadModelService =
  purposeTemplateReadModelServiceBuilder(readModelDB);
export const purposeTemplateWriterService =
  purposeTemplateWriterServiceBuilder(readModelDB);

export const getCompleteMockPurposeTemplate = (): PurposeTemplate => {
  const riskAnalysisFormTemplate = getMockCompleteRiskAnalysisFormTemplate();

  return {
    ...getMockPurposeTemplate(),
    updatedAt: new Date(),
    purposeRiskAnalysisForm: riskAnalysisFormTemplate,
    purposeFreeOfChargeReason: "Free of charge reason",
    purposeDailyCalls: 100,
  };
};

export const checkCompletePurposeTemplate = async (
  purposeTemplate: PurposeTemplate
): Promise<PurposeTemplateItemsSQL> => {
  const retrievedPurposeTemplateSQL = await retrievePurposeTemplateSQLById(
    readModelDB,
    purposeTemplate.id
  );
  const retrievedRiskAnalysisFormTemplateSQL =
    await retrievePurposeTemplateRiskAnalysisFormSQLById(
      readModelDB,
      purposeTemplate.id
    );
  const retrievedRiskAnalysisTemplateAnswersSQL =
    await retrievePurposeTemplateRiskAnalysisAnswersSQLById(
      readModelDB,
      purposeTemplate.id
    );
  const retrievedRiskAnalysisTemplateAnswersAnnotationsSQL =
    await retrievePurposeTemplateRiskAnalysisAnswersAnnotationsSQLById(
      readModelDB,
      purposeTemplate.id
    );
  const retrievedRiskAnalysisTemplateAnswersAnnotationsDocumentsSQL =
    await retrievePurposeTemplateRiskAnalysisAnswersAnnotationsDocumentsSQLById(
      readModelDB,
      purposeTemplate.id
    );
  const retrievedTemplateRiskAnalysisFormDocumentSQL =
    await retrievePurposeTemplateRiskAnalysisFormDocumentSQLById(
      readModelDB,
      purposeTemplate.id
    );
  const retrievedTemplateRiskAnalysisFormSignedDocumentSQL =
    await retrievePurposeTemplateRiskAnalysisFormSignedDocumentSQLById(
      readModelDB,
      purposeTemplate.id
    );

  const answersLength =
    purposeTemplate.purposeRiskAnalysisForm!.singleAnswers.length +
    purposeTemplate.purposeRiskAnalysisForm!.multiAnswers.length;
  expect(retrievedPurposeTemplateSQL).toBeDefined();
  expect(retrievedRiskAnalysisFormTemplateSQL).toBeDefined();
  expect(retrievedRiskAnalysisTemplateAnswersSQL).toHaveLength(answersLength);
  expect(retrievedRiskAnalysisTemplateAnswersAnnotationsSQL).toHaveLength(
    answersLength
  );
  expect(
    retrievedRiskAnalysisTemplateAnswersAnnotationsDocumentsSQL
  ).toHaveLength(answersLength);
  expect(retrievedTemplateRiskAnalysisFormDocumentSQL).toBeDefined();
  expect(retrievedTemplateRiskAnalysisFormSignedDocumentSQL).toBeDefined();

  return {
    purposeTemplateSQL: retrievedPurposeTemplateSQL!,
    riskAnalysisFormTemplateSQL: retrievedRiskAnalysisFormTemplateSQL,
    riskAnalysisTemplateAnswersSQL: retrievedRiskAnalysisTemplateAnswersSQL,
    riskAnalysisTemplateAnswersAnnotationsSQL:
      retrievedRiskAnalysisTemplateAnswersAnnotationsSQL,
    riskAnalysisTemplateAnswersAnnotationsDocumentsSQL:
      retrievedRiskAnalysisTemplateAnswersAnnotationsDocumentsSQL,
    riskAnalysisTemplateDocumentSQL:
      retrievedTemplateRiskAnalysisFormDocumentSQL!,
    riskAnalysisTemplateSignedDocumentSQL:
      retrievedTemplateRiskAnalysisFormSignedDocumentSQL!,
  };
};

export const retrievePurposeTemplateSQLById = async (
  readModelDB: DrizzleReturnType,
  purposeTemplateId: PurposeTemplateId
): Promise<PurposeTemplateSQL | undefined> => {
  const queryResult = await readModelDB
    .select()
    .from(purposeTemplateInReadmodelPurposeTemplate)
    .where(eq(purposeTemplateInReadmodelPurposeTemplate.id, purposeTemplateId));

  return queryResult[0];
};

export const retrievePurposeTemplateRiskAnalysisFormSQLById = async (
  readModelDB: DrizzleReturnType,
  purposeTemplateId: PurposeTemplateId
): Promise<PurposeTemplateRiskAnalysisFormSQL | undefined> => {
  const queryResult = await readModelDB
    .select()
    .from(purposeTemplateRiskAnalysisFormInReadmodelPurposeTemplate)
    .where(
      eq(
        purposeTemplateRiskAnalysisFormInReadmodelPurposeTemplate.purposeTemplateId,
        purposeTemplateId
      )
    );

  return queryResult[0];
};

export const retrievePurposeTemplateRiskAnalysisAnswersSQLById = async (
  readModelDB: DrizzleReturnType,
  purposeTemplateId: PurposeTemplateId
): Promise<PurposeTemplateRiskAnalysisAnswerSQL[]> =>
  await readModelDB
    .select()
    .from(purposeTemplateRiskAnalysisAnswerInReadmodelPurposeTemplate)
    .where(
      eq(
        purposeTemplateRiskAnalysisAnswerInReadmodelPurposeTemplate.purposeTemplateId,
        purposeTemplateId
      )
    );

export const retrievePurposeTemplateRiskAnalysisAnswersAnnotationsSQLById =
  async (
    readModelDB: DrizzleReturnType,
    purposeTemplateId: PurposeTemplateId
  ): Promise<PurposeTemplateRiskAnalysisAnswerAnnotationSQL[]> =>
    await readModelDB
      .select()
      .from(
        purposeTemplateRiskAnalysisAnswerAnnotationInReadmodelPurposeTemplate
      )
      .where(
        eq(
          purposeTemplateRiskAnalysisAnswerAnnotationInReadmodelPurposeTemplate.purposeTemplateId,
          purposeTemplateId
        )
      );

export const retrievePurposeTemplateRiskAnalysisAnswersAnnotationsDocumentsSQLById =
  async (
    readModelDB: DrizzleReturnType,
    purposeTemplateId: PurposeTemplateId
  ): Promise<PurposeTemplateRiskAnalysisAnswerAnnotationDocumentSQL[]> =>
    await readModelDB
      .select()
      .from(
        purposeTemplateRiskAnalysisAnswerAnnotationDocumentInReadmodelPurposeTemplate
      )
      .where(
        eq(
          purposeTemplateRiskAnalysisAnswerAnnotationDocumentInReadmodelPurposeTemplate.purposeTemplateId,
          purposeTemplateId
        )
      );

export const retrievePurposeTemplateRiskAnalysisFormDocumentSQLById = async (
  readModelDB: DrizzleReturnType,
  purposeTemplateId: PurposeTemplateId
): Promise<PurposeTemplateRiskAnalysisFormDocumentSQL | undefined> => {
  const result = await readModelDB
    .select()
    .from(purposeTemplateRiskAnalysisFormDocumentInReadmodelPurposeTemplate)
    .where(
      eq(
        purposeTemplateRiskAnalysisFormDocumentInReadmodelPurposeTemplate.purposeTemplateId,
        purposeTemplateId
      )
    );
  return result[0];
};

export const retrievePurposeTemplateRiskAnalysisFormSignedDocumentSQLById =
  async (
    readModelDB: DrizzleReturnType,
    purposeTemplateId: PurposeTemplateId
  ): Promise<PurposeTemplateRiskAnalysisFormSignedDocumentSQL | undefined> => {
    const result = await readModelDB
      .select()
      .from(
        purposeTemplateRiskAnalysisFormSignedDocumentInReadmodelPurposeTemplate
      )
      .where(
        eq(
          purposeTemplateRiskAnalysisFormSignedDocumentInReadmodelPurposeTemplate.purposeTemplateId,
          purposeTemplateId
        )
      );

    return result[0];
  };
