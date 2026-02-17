/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/no-floating-promises */
import { fail } from "assert";
import { purposeTemplateApi } from "pagopa-interop-api-clients";
import {
  decodeProtobufPayload,
  getMockAuthData,
  getMockContext,
  getMockPurposeTemplate,
  getMockRiskAnalysisTemplateAnswerAnnotationDocument,
  getMockValidRiskAnalysisFormTemplate,
} from "pagopa-interop-commons-test";
import {
  PurposeTemplate,
  PurposeTemplateAnnotationDocumentUpdatedV2,
  PurposeTemplateId,
  RiskAnalysisTemplateAnswerAnnotationDocument,
  RiskAnalysisTemplateAnswerAnnotationDocumentId,
  RiskAnalysisTemplateAnswerAnnotationId,
  TenantId,
  fromPurposeTemplateV2,
  generateId,
  purposeTemplateState,
  targetTenantKind,
} from "pagopa-interop-models";
import { describe, expect, it } from "vitest";
import {
  addOnePurposeTemplate,
  purposeTemplateService,
  readLastPurposeTemplateEvent,
} from "../integrationUtils.js";
import {
  conflictDocumentPrettyNameDuplicate,
  purposeTemplateNotFound,
  purposeTemplateNotInExpectedStates,
  purposeTemplateRiskAnalysisFormNotFound,
  riskAnalysisTemplateAnswerAnnotationNotFound,
  riskAnalysisTemplateAnswerAnnotationDocumentNotFound,
  riskAnalysisTemplateAnswerNotFound,
} from "../../src/model/domain/errors.js";

describe("updateRiskAnalysisAnswerAnnotationDocument", () => {
  const subjectDocumentSingleId =
    generateId<RiskAnalysisTemplateAnswerAnnotationDocumentId>();

  const validAnnotationSingleDocument: RiskAnalysisTemplateAnswerAnnotationDocument =
    getMockRiskAnalysisTemplateAnswerAnnotationDocument(
      subjectDocumentSingleId
    );

  const subjectDocumentMultiId =
    generateId<RiskAnalysisTemplateAnswerAnnotationDocumentId>();

  const validAnnotationMultiDocument: RiskAnalysisTemplateAnswerAnnotationDocument =
    getMockRiskAnalysisTemplateAnswerAnnotationDocument(subjectDocumentMultiId);

  const validUpdateDocumentSeed: purposeTemplateApi.UpdateRiskAnalysisTemplateAnswerAnnotationDocumentSeed =
    {
      prettyName: "New pretty name",
    };

  const mockValidRiskAnalysisTemplateForm =
    getMockValidRiskAnalysisFormTemplate(targetTenantKind.PA);

  const subjectSingleAnswer =
    mockValidRiskAnalysisTemplateForm.singleAnswers.find(
      (a) => a.key === "purpose"
    )!;

  const subjectMultiAnswer =
    mockValidRiskAnalysisTemplateForm.multiAnswers.find(
      (a) => a.key === "personalDataTypes"
    )!;

  const mockRiskAnalysisWithAnnotation = {
    ...mockValidRiskAnalysisTemplateForm,
    singleAnswers: mockValidRiskAnalysisTemplateForm.singleAnswers.map((a) =>
      a.id === subjectSingleAnswer.id
        ? {
            ...a,
            annotation: {
              id: generateId<RiskAnalysisTemplateAnswerAnnotationId>(),
              text: "Single answer annotation with future document",
              docs: [validAnnotationSingleDocument],
            },
          }
        : a
    ),
    multiAnswers: mockValidRiskAnalysisTemplateForm.multiAnswers.map((a) =>
      a.id === subjectMultiAnswer.id
        ? {
            ...a,
            annotation: {
              id: generateId<RiskAnalysisTemplateAnswerAnnotationId>(),
              text: "Multi answer annotation with future document",
              docs: [validAnnotationMultiDocument],
            },
          }
        : a
    ),
  };

  const existentPurposeTemplate: PurposeTemplate = {
    ...getMockPurposeTemplate(),
    purposeRiskAnalysisForm: mockRiskAnalysisWithAnnotation,
  };

  it.each([
    {
      subjectAnswerId: subjectSingleAnswer.id,
      subjectDocumentId: subjectDocumentSingleId,
      formAnswer: "singleAnswers" as const,
      validAnnotationDocument: validAnnotationSingleDocument,
    },
    {
      subjectAnswerId: subjectMultiAnswer.id,
      subjectDocumentId: subjectDocumentMultiId,
      formAnswer: "multiAnswers" as const,
      validAnnotationDocument: validAnnotationMultiDocument,
    },
  ])(
    "should write on event-store for update purpose template with new annotation on document in $formAnswer",
    async ({
      subjectAnswerId,
      subjectDocumentId,
      formAnswer,
      validAnnotationDocument,
    }) => {
      await addOnePurposeTemplate(existentPurposeTemplate);

      const updatedPurposeTemplateResponse =
        await purposeTemplateService.updateRiskAnalysisTemplateAnswerAnnotationDocument(
          existentPurposeTemplate.id,
          subjectAnswerId,
          subjectDocumentId,
          validUpdateDocumentSeed,
          getMockContext({
            authData: getMockAuthData(existentPurposeTemplate.creatorId),
          })
        );

      const expectedAnnotationDocument = {
        ...validAnnotationDocument,
        prettyName: validUpdateDocumentSeed.prettyName,
      };

      expect(updatedPurposeTemplateResponse).toEqual({
        data: expectedAnnotationDocument,
        metadata: { version: 1 },
      });

      expect(updatedPurposeTemplateResponse.data).toBeDefined();
      expect(updatedPurposeTemplateResponse.data).toEqual(
        expectedAnnotationDocument
      );

      // ======= Verify stored event =======
      const lastPurposeTemplateEvent = await readLastPurposeTemplateEvent(
        existentPurposeTemplate.id
      );

      if (!lastPurposeTemplateEvent) {
        fail(
          "Add Annotation Document failed: purpose template not found in event-store"
        );
      }

      expect(lastPurposeTemplateEvent).toMatchObject({
        stream_id: existentPurposeTemplate.id,
        version: "1",
        type: "PurposeTemplateAnnotationDocumentUpdated",
        event_version: 2,
      });

      const writtenData = decodeProtobufPayload({
        messageType: PurposeTemplateAnnotationDocumentUpdatedV2,
        payload: lastPurposeTemplateEvent.data,
      });

      expect(writtenData.documentId).toEqual(subjectDocumentId);
      expect(writtenData.purposeTemplate).toBeDefined();

      const actualPurposeTemplate = fromPurposeTemplateV2(
        writtenData.purposeTemplate!
      );
      expect(actualPurposeTemplate.purposeRiskAnalysisForm).toBeDefined();

      const actualDocument = actualPurposeTemplate
        .purposeRiskAnalysisForm![formAnswer].find(
          (a) => a.id === subjectAnswerId
        )
        ?.annotation?.docs.find((d) => d.id === subjectDocumentId);
      expect(actualDocument).toEqual(expectedAnnotationDocument);
    }
  );

  it("should throw purposeTemplateNotFound error when purpose template does not exist", async () => {
    const notExistentPurposeTemplateId = generateId<PurposeTemplateId>();
    await expect(
      purposeTemplateService.updateRiskAnalysisTemplateAnswerAnnotationDocument(
        notExistentPurposeTemplateId,
        subjectSingleAnswer.id,
        subjectDocumentSingleId,
        validUpdateDocumentSeed,
        getMockContext({
          authData: getMockAuthData(existentPurposeTemplate.creatorId),
        })
      )
    ).rejects.toThrowError(
      purposeTemplateNotFound(notExistentPurposeTemplateId)
    );
  });

  it("should throw purposeTemplateNotInExpectedStates error when purpose template is not in draft state", async () => {
    const publishedPurposeTemplate: PurposeTemplate = {
      ...existentPurposeTemplate,
      state: purposeTemplateState.published,
    };
    await addOnePurposeTemplate(publishedPurposeTemplate);

    await expect(
      purposeTemplateService.updateRiskAnalysisTemplateAnswerAnnotationDocument(
        publishedPurposeTemplate.id,
        subjectSingleAnswer.id,
        subjectDocumentSingleId,
        validUpdateDocumentSeed,
        getMockContext({
          authData: getMockAuthData(publishedPurposeTemplate.creatorId),
        })
      )
    ).rejects.toThrowError(
      purposeTemplateNotInExpectedStates(
        publishedPurposeTemplate.id,
        publishedPurposeTemplate.state,
        [purposeTemplateState.draft]
      )
    );
  });

  it("should throw purposeTemplateRiskAnalysisFormNotFound error when purpose template not have a risk analysis form", async () => {
    const purposeTemplateWithoutRiskAnalysis: PurposeTemplate = {
      ...existentPurposeTemplate,
      purposeRiskAnalysisForm: undefined,
    };
    await addOnePurposeTemplate(purposeTemplateWithoutRiskAnalysis);

    await expect(
      purposeTemplateService.updateRiskAnalysisTemplateAnswerAnnotationDocument(
        existentPurposeTemplate.id,
        subjectSingleAnswer.id,
        subjectDocumentSingleId,
        validUpdateDocumentSeed,
        getMockContext({
          authData: getMockAuthData(existentPurposeTemplate.creatorId),
        })
      )
    ).rejects.toThrowError(
      purposeTemplateRiskAnalysisFormNotFound(existentPurposeTemplate.id)
    );
  });

  it.each([
    {
      subjectAnswerId: subjectSingleAnswer.id,
      subjectDocumentId: subjectDocumentSingleId,
      formAnswer: "singleAnswers" as const,
    },
    {
      subjectAnswerId: subjectMultiAnswer.id,
      subjectDocumentId: subjectDocumentMultiId,
      formAnswer: "multiAnswers" as const,
    },
  ])(
    "should throw riskAnalysisTemplateAnswerNotFound error when answer not found in $formAnswer",
    async ({ subjectAnswerId, subjectDocumentId, formAnswer }) => {
      const purposeTemplateWithoutSubjectAnswer: PurposeTemplate = {
        ...existentPurposeTemplate,
        purposeRiskAnalysisForm: {
          ...existentPurposeTemplate.purposeRiskAnalysisForm!,
          [formAnswer]: existentPurposeTemplate.purposeRiskAnalysisForm![
            formAnswer
          ].filter((a) => a.id !== subjectAnswerId),
        },
      };
      await addOnePurposeTemplate(purposeTemplateWithoutSubjectAnswer);

      await expect(
        purposeTemplateService.updateRiskAnalysisTemplateAnswerAnnotationDocument(
          existentPurposeTemplate.id,
          subjectAnswerId,
          subjectDocumentId,
          validUpdateDocumentSeed,
          getMockContext({
            authData: getMockAuthData(existentPurposeTemplate.creatorId),
          })
        )
      ).rejects.toThrowError(
        riskAnalysisTemplateAnswerNotFound({
          purposeTemplateId: existentPurposeTemplate.id,
          answerId: subjectAnswerId,
        })
      );
    }
  );

  it.each([
    {
      subjectAnswerId: subjectSingleAnswer.id,
      subjectDocumentId: subjectDocumentSingleId,
      formAnswer: "singleAnswers" as const,
    },
    {
      subjectAnswerId: subjectMultiAnswer.id,
      subjectDocumentId: subjectDocumentMultiId,
      formAnswer: "multiAnswers" as const,
    },
  ])(
    "should throw conflictDocumentPrettyNameDuplicate error when some annotation document have the same pretty name in $formAnswer",
    async ({ subjectAnswerId, subjectDocumentId, formAnswer }) => {
      const purposeTemplateWithSameDocument: PurposeTemplate = {
        ...existentPurposeTemplate,
        purposeRiskAnalysisForm: {
          ...existentPurposeTemplate.purposeRiskAnalysisForm!,
          [formAnswer]: existentPurposeTemplate.purposeRiskAnalysisForm![
            formAnswer
          ].map((a) =>
            a.id !== subjectAnswerId
              ? a
              : {
                  ...a,
                  annotation: {
                    ...a.annotation,
                    docs: [
                      ...(a.annotation?.docs ?? []),
                      {
                        ...getMockRiskAnalysisTemplateAnswerAnnotationDocument(),
                        prettyName: validUpdateDocumentSeed.prettyName,
                      },
                    ],
                  },
                }
          ),
        },
      };
      await addOnePurposeTemplate(purposeTemplateWithSameDocument);

      await expect(
        purposeTemplateService.updateRiskAnalysisTemplateAnswerAnnotationDocument(
          existentPurposeTemplate.id,
          subjectAnswerId,
          subjectDocumentId,
          validUpdateDocumentSeed,
          getMockContext({
            authData: getMockAuthData(existentPurposeTemplate.creatorId),
          })
        )
      ).rejects.toThrowError(
        conflictDocumentPrettyNameDuplicate(
          subjectAnswerId,
          validUpdateDocumentSeed.prettyName
        )
      );
    }
  );

  it.each([
    {
      subjectAnswerId: subjectSingleAnswer.id,
      subjectDocumentId: subjectDocumentSingleId,
      formAnswer: "singleAnswers" as const,
    },
    {
      subjectAnswerId: subjectMultiAnswer.id,
      subjectDocumentId: subjectDocumentMultiId,
      formAnswer: "multiAnswers" as const,
    },
  ])(
    "should throw riskAnalysisTemplateAnswerAnnotationNotFound error when annotation is not found",
    async ({ subjectAnswerId, subjectDocumentId, formAnswer }) => {
      const purposeTemplateWithoutAnnotation: PurposeTemplate = {
        ...existentPurposeTemplate,
        purposeRiskAnalysisForm: {
          ...existentPurposeTemplate.purposeRiskAnalysisForm!,
          [formAnswer]: existentPurposeTemplate.purposeRiskAnalysisForm![
            formAnswer
          ].map((a) =>
            a.id === subjectAnswerId
              ? {
                  ...a,
                  annotation: undefined,
                }
              : a
          ),
        },
      };
      await addOnePurposeTemplate(purposeTemplateWithoutAnnotation);

      await expect(
        purposeTemplateService.updateRiskAnalysisTemplateAnswerAnnotationDocument(
          existentPurposeTemplate.id,
          subjectAnswerId,
          subjectDocumentId,
          validUpdateDocumentSeed,
          getMockContext({
            authData: getMockAuthData(existentPurposeTemplate.creatorId),
          })
        )
      ).rejects.toThrowError(
        riskAnalysisTemplateAnswerAnnotationNotFound(
          existentPurposeTemplate.id,
          subjectAnswerId
        )
      );
    }
  );

  it.each([
    {
      subjectAnswerId: subjectSingleAnswer.id,
      subjectDocumentId: subjectDocumentSingleId,
      formAnswer: "singleAnswers" as const,
    },
    {
      subjectAnswerId: subjectMultiAnswer.id,
      subjectDocumentId: subjectDocumentMultiId,
      formAnswer: "multiAnswers" as const,
    },
  ])(
    "should throw riskAnalysisTemplateAnswerAnnotationDocumentNotFound error when annotation is not found",
    async ({ subjectAnswerId, subjectDocumentId, formAnswer }) => {
      const purposeTemplateWithoutAnnotation: PurposeTemplate = {
        ...existentPurposeTemplate,
        purposeRiskAnalysisForm: {
          ...existentPurposeTemplate.purposeRiskAnalysisForm!,
          [formAnswer]: existentPurposeTemplate.purposeRiskAnalysisForm![
            formAnswer
          ].map((a) => {
            if (a.id !== subjectAnswerId) {
              return a;
            }
            const annotation = {
              ...a.annotation,
              docs: a.annotation?.docs?.filter(
                (d) => d.id !== subjectDocumentId
              ),
            };
            return {
              ...a,
              annotation,
            };
          }),
        },
      };
      await addOnePurposeTemplate(purposeTemplateWithoutAnnotation);

      await expect(
        purposeTemplateService.updateRiskAnalysisTemplateAnswerAnnotationDocument(
          existentPurposeTemplate.id,
          subjectAnswerId,
          subjectDocumentId,
          validUpdateDocumentSeed,
          getMockContext({
            authData: getMockAuthData(existentPurposeTemplate.creatorId),
          })
        )
      ).rejects.toThrowError(
        riskAnalysisTemplateAnswerAnnotationDocumentNotFound(
          existentPurposeTemplate.id,
          subjectDocumentId,
          subjectAnswerId
        )
      );
    }
  );

  it("should throw purposeTemplateNotFound if the requester is not the creator", async () => {
    await addOnePurposeTemplate(existentPurposeTemplate);

    const differentCreatorId = generateId<TenantId>();

    await expect(
      purposeTemplateService.updateRiskAnalysisTemplateAnswerAnnotationDocument(
        existentPurposeTemplate.id,
        subjectSingleAnswer.id,
        subjectDocumentSingleId,
        validUpdateDocumentSeed,
        getMockContext({
          authData: getMockAuthData(differentCreatorId),
        })
      )
    ).rejects.toThrowError(purposeTemplateNotFound(existentPurposeTemplate.id));
  });
});
