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
  PurposeTemplateAnnotationDocumentAddedV2,
  PurposeTemplateId,
  RiskAnalysisTemplateAnswerAnnotationDocument,
  RiskAnalysisTemplateAnswerAnnotationDocumentId,
  RiskAnalysisTemplateAnswerAnnotationId,
  TenantId,
  fromPurposeTemplateV2,
  generateId,
  purposeTemplateState,
  tenantKind,
} from "pagopa-interop-models";
import { describe, expect, it, vi } from "vitest";
import {
  addOnePurposeTemplate,
  purposeTemplateService,
  readLastPurposeTemplateEvent,
} from "../integrationUtils.js";
import {
  annotationDocumentLimitExceeded,
  conflictDocumentPrettyNameDuplicate,
  conflictDuplicatedDocument,
  purposeTemplateNotFound,
  purposeTemplateNotInExpectedStates,
  purposeTemplateRiskAnalysisFormNotFound,
  riskAnalysisTemplateAnswerAnnotationNotFound,
  riskAnalysisTemplateAnswerNotFound,
  tenantNotAllowed,
} from "../../src/model/domain/errors.js";
import { ANNOTATION_DOCUMENTS_LIMIT } from "../../src/services/validators.js";

describe("addRiskAnalysisTemplateAnswerAnnotationDocument", () => {
  const mockValidRiskAnalysisTemplateForm =
    getMockValidRiskAnalysisFormTemplate(tenantKind.PA);

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
              text: "Annotation with future document",
              docs: [],
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
              text: "Annotation with future document",
              docs: [],
            },
          }
        : a
    ),
  };

  const existentPurposeTemplate: PurposeTemplate = {
    ...getMockPurposeTemplate(),
    purposeRiskAnalysisForm: mockRiskAnalysisWithAnnotation,
  };

  const subjectDocumentId =
    generateId<RiskAnalysisTemplateAnswerAnnotationDocumentId>();

  const validAnnotationDocumentSeed: purposeTemplateApi.RiskAnalysisTemplateAnswerAnnotationDocumentSeed =
    {
      documentId: subjectDocumentId,
      name: "A Document",
      prettyName: "A Document",
      path: "/annotation/documents",
      contentType: "application/pdf",
      checksum:
        "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    };

  it.each([
    {
      subjectAnswerId: subjectSingleAnswer.id,
      formAnswer: "singleAnswers" as const,
    },
    {
      subjectAnswerId: subjectMultiAnswer.id,
      formAnswer: "multiAnswers" as const,
    },
  ])(
    "should write on event-store for update purpose template with new annotation on document in $formAnswer",
    async ({ subjectAnswerId, formAnswer }) => {
      const expectedUpdateDate = new Date();
      vi.useFakeTimers();
      vi.setSystemTime(expectedUpdateDate);

      await addOnePurposeTemplate(existentPurposeTemplate);

      const updatedPurposeTemplateResponse =
        await purposeTemplateService.addRiskAnalysisTemplateAnswerAnnotationDocument(
          existentPurposeTemplate.id,
          subjectAnswerId,
          validAnnotationDocumentSeed,
          getMockContext({
            authData: getMockAuthData(existentPurposeTemplate.creatorId),
          })
        );

      // ======= Verify service response =======
      const expectedAnnotationDocument: RiskAnalysisTemplateAnswerAnnotationDocument =
        {
          id: subjectDocumentId,
          createdAt: expectedUpdateDate,
          name: validAnnotationDocumentSeed.name,
          prettyName: validAnnotationDocumentSeed.prettyName,
          contentType: validAnnotationDocumentSeed.contentType,
          path: validAnnotationDocumentSeed.path,
          checksum: validAnnotationDocumentSeed.checksum,
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
        type: "PurposeTemplateAnnotationDocumentAdded",
        event_version: 2,
      });

      const writtenData = decodeProtobufPayload({
        messageType: PurposeTemplateAnnotationDocumentAddedV2,
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

      vi.useRealTimers();
    }
  );

  it("should throw purposeTemplateNotFound error when purpose template does not exist", async () => {
    const notExistentPurposeTemplateId = generateId<PurposeTemplateId>();
    await expect(
      purposeTemplateService.addRiskAnalysisTemplateAnswerAnnotationDocument(
        notExistentPurposeTemplateId,
        subjectSingleAnswer.id,
        validAnnotationDocumentSeed,
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
      purposeTemplateService.addRiskAnalysisTemplateAnswerAnnotationDocument(
        publishedPurposeTemplate.id,
        subjectSingleAnswer.id,
        validAnnotationDocumentSeed,
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
      purposeTemplateService.addRiskAnalysisTemplateAnswerAnnotationDocument(
        existentPurposeTemplate.id,
        subjectSingleAnswer.id,
        validAnnotationDocumentSeed,
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
      formAnswer: "singleAnswers" as const,
    },
    {
      subjectAnswerId: subjectMultiAnswer.id,
      formAnswer: "multiAnswers" as const,
    },
  ])(
    "should throw riskAnalysisTemplateAnswerNotFound error when answer not found in $formAnswer",
    async ({ subjectAnswerId, formAnswer }) => {
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
        purposeTemplateService.addRiskAnalysisTemplateAnswerAnnotationDocument(
          existentPurposeTemplate.id,
          subjectAnswerId,
          validAnnotationDocumentSeed,
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
      formAnswer: "singleAnswers" as const,
    },
    {
      subjectAnswerId: subjectMultiAnswer.id,
      formAnswer: "multiAnswers" as const,
    },
  ])(
    "should throw conflictDocumentPrettyNameDuplicate error when some annotation document have the same pretty name in $formAnswer",
    async ({ subjectAnswerId, formAnswer }) => {
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
                        prettyName: validAnnotationDocumentSeed.prettyName,
                      },
                    ],
                  },
                }
          ),
        },
      };
      await addOnePurposeTemplate(purposeTemplateWithSameDocument);

      await expect(
        purposeTemplateService.addRiskAnalysisTemplateAnswerAnnotationDocument(
          existentPurposeTemplate.id,
          subjectAnswerId,
          validAnnotationDocumentSeed,
          getMockContext({
            authData: getMockAuthData(existentPurposeTemplate.creatorId),
          })
        )
      ).rejects.toThrowError(
        conflictDocumentPrettyNameDuplicate(
          subjectAnswerId,
          validAnnotationDocumentSeed.prettyName
        )
      );
    }
  );

  it.each([
    {
      subjectAnswerId: subjectSingleAnswer.id,
      formAnswer: "singleAnswers" as const,
    },
    {
      subjectAnswerId: subjectMultiAnswer.id,
      formAnswer: "multiAnswers" as const,
    },
  ])(
    "should throw conflictDuplicatedDocument error when some annotation document have the same checksum in $formAnswer",
    async ({ subjectAnswerId, formAnswer }) => {
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
                        checksum: validAnnotationDocumentSeed.checksum,
                      },
                    ],
                  },
                }
          ),
        },
      };
      await addOnePurposeTemplate(purposeTemplateWithSameDocument);

      await expect(
        purposeTemplateService.addRiskAnalysisTemplateAnswerAnnotationDocument(
          existentPurposeTemplate.id,
          subjectAnswerId,
          validAnnotationDocumentSeed,
          getMockContext({
            authData: getMockAuthData(existentPurposeTemplate.creatorId),
          })
        )
      ).rejects.toThrowError(
        conflictDuplicatedDocument(
          subjectAnswerId,
          validAnnotationDocumentSeed.checksum
        )
      );
    }
  );

  it.each([
    {
      subjectAnswerId: subjectSingleAnswer.id,
      formAnswer: "singleAnswers" as const,
    },
    {
      subjectAnswerId: subjectMultiAnswer.id,
      formAnswer: "multiAnswers" as const,
    },
  ])(
    "should throw riskAnalysisTemplateAnswerAnnotationNotFound error when annotation is not found",
    async ({ subjectAnswerId, formAnswer }) => {
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
        purposeTemplateService.addRiskAnalysisTemplateAnswerAnnotationDocument(
          existentPurposeTemplate.id,
          subjectAnswerId,
          validAnnotationDocumentSeed,
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
      formAnswer: "singleAnswers" as const,
    },
    {
      subjectAnswerId: subjectMultiAnswer.id,
      formAnswer: "multiAnswers" as const,
    },
  ])(
    "should throw annotationDocumentLimitExceeded error when exceed the maximum number of annotation documents in $formAnswer",
    async ({ subjectAnswerId, formAnswer }) => {
      const purposeTemplateWithAllAvailableAnnotationDocs: PurposeTemplate = {
        ...existentPurposeTemplate,
        purposeRiskAnalysisForm: {
          ...existentPurposeTemplate.purposeRiskAnalysisForm!,
          [formAnswer]: existentPurposeTemplate.purposeRiskAnalysisForm![
            formAnswer
          ].map((a) =>
            a.id === subjectAnswerId
              ? {
                  ...a,
                  annotation: {
                    ...a.annotation,
                    docs: Array.from(
                      { length: ANNOTATION_DOCUMENTS_LIMIT },
                      (_) => ({
                        ...getMockRiskAnalysisTemplateAnswerAnnotationDocument(),
                        checksum: generateId(),
                      })
                    ),
                  },
                }
              : a
          ),
        },
      };
      await addOnePurposeTemplate(
        purposeTemplateWithAllAvailableAnnotationDocs
      );

      await expect(
        purposeTemplateService.addRiskAnalysisTemplateAnswerAnnotationDocument(
          existentPurposeTemplate.id,
          subjectAnswerId,
          validAnnotationDocumentSeed,
          getMockContext({
            authData: getMockAuthData(existentPurposeTemplate.creatorId),
          })
        )
      ).rejects.toThrowError(annotationDocumentLimitExceeded(subjectAnswerId));
    }
  );

  it("should throw tenantNotAllowed if the requester is not the creator", async () => {
    await addOnePurposeTemplate(existentPurposeTemplate);

    const differentCreatorId = generateId<TenantId>();

    await expect(
      purposeTemplateService.addRiskAnalysisTemplateAnswerAnnotationDocument(
        existentPurposeTemplate.id,
        subjectSingleAnswer.id,
        validAnnotationDocumentSeed,
        getMockContext({
          authData: getMockAuthData(differentCreatorId),
        })
      )
    ).rejects.toThrowError(tenantNotAllowed(differentCreatorId));
  });
});
