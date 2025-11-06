/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/no-floating-promises */
import { genericLogger } from "pagopa-interop-commons";
import {
  decodeProtobufPayload,
  getMockContext,
  getMockAuthData,
  getMockRiskAnalysisTemplateAnswerAnnotationDocument,
  getMockPurposeTemplate,
  getMockRiskAnalysisTemplateAnswerAnnotation,
  getMockValidRiskAnalysisFormTemplate,
} from "pagopa-interop-commons-test";
import {
  RiskAnalysisFormTemplate,
  tenantKind,
  PurposeTemplate,
  toPurposeTemplateV2,
  purposeTemplateState,
  TenantId,
  generateId,
  PurposeTemplateAnnotationDocumentDeletedV2,
  RiskAnalysisMultiAnswerId,
  RiskAnalysisTemplateAnswerAnnotationDocumentId,
} from "pagopa-interop-models";
import { expect, describe, it, vi } from "vitest";
import { config } from "../../src/config/config.js";
import {
  addOnePurposeTemplate,
  fileManager,
  purposeTemplateService,
  readLastPurposeTemplateEvent,
} from "../integrationUtils.js";
import {
  purposeTemplateNotFound,
  purposeTemplateNotInExpectedStates,
  purposeTemplateRiskAnalysisFormNotFound,
  riskAnalysisTemplateAnswerAnnotationDocumentNotFound,
  tenantNotAllowed,
} from "../../src/model/domain/errors.js";

describe("deleteRiskAnalysisTemplateAnswerAnnotationDocument", () => {
  const mockDocument1 = getMockRiskAnalysisTemplateAnswerAnnotationDocument();
  const mockDocument2 = getMockRiskAnalysisTemplateAnswerAnnotationDocument();
  const annotationDocument1 = {
    ...mockDocument1,
    path: `${config.purposeTemplateDocumentsPath}/${mockDocument1.id}/${mockDocument1.name}`,
  };
  const annotationDocument2 = {
    ...mockDocument2,
    path: `${config.purposeTemplateDocumentsPath}/${mockDocument2.id}/${mockDocument2.name}`,
  };

  const incompleteRiskAnalysisFormTemplate =
    getMockValidRiskAnalysisFormTemplate(tenantKind.PA);
  const riskAnalysisFormTemplate: RiskAnalysisFormTemplate = {
    ...incompleteRiskAnalysisFormTemplate,
    singleAnswers: [
      {
        ...incompleteRiskAnalysisFormTemplate.singleAnswers[0],
        annotation: {
          ...getMockRiskAnalysisTemplateAnswerAnnotation(),
          docs: [annotationDocument1, annotationDocument2],
        },
      },
    ],
  };

  const purposeTemplate: PurposeTemplate = {
    ...getMockPurposeTemplate(),
    purposeRiskAnalysisForm: riskAnalysisFormTemplate,
  };

  it("should write on event-store for the deletion of a risk analysis template answer annotation document", async () => {
    vi.spyOn(fileManager, "delete");

    await addOnePurposeTemplate(purposeTemplate);

    await fileManager.storeBytes(
      {
        bucket: config.s3Bucket,
        path: config.purposeTemplateDocumentsPath,
        resourceId: annotationDocument1.id,
        name: annotationDocument1.name,
        content: Buffer.from("test-test"),
      },
      genericLogger
    );

    await fileManager.storeBytes(
      {
        bucket: config.s3Bucket,
        path: config.purposeTemplateDocumentsPath,
        resourceId: annotationDocument2.id,
        name: annotationDocument2.name,
        content: Buffer.from("test-test"),
      },
      genericLogger
    );

    const filePathsBeforeDeletion = await fileManager.listFiles(
      config.s3Bucket,
      genericLogger
    );
    expect(filePathsBeforeDeletion).toContain(annotationDocument1.path);
    expect(filePathsBeforeDeletion).toContain(annotationDocument2.path);

    const response =
      await purposeTemplateService.deleteRiskAnalysisTemplateAnswerAnnotationDocument(
        purposeTemplate.id,
        riskAnalysisFormTemplate.singleAnswers[0].id,
        annotationDocument1.id,
        getMockContext({
          authData: getMockAuthData(purposeTemplate.creatorId),
        })
      );

    const annotationDocumentDeletionEvent = await readLastPurposeTemplateEvent(
      purposeTemplate.id
    );

    expect(annotationDocumentDeletionEvent).toMatchObject({
      stream_id: purposeTemplate.id,
      version: "1",
      type: "PurposeTemplateAnnotationDocumentDeleted",
      event_version: 2,
    });

    const annotationDocumentDeletionPayload = decodeProtobufPayload({
      messageType: PurposeTemplateAnnotationDocumentDeletedV2,
      payload: annotationDocumentDeletionEvent.data,
    });

    const expectedPurposeTemplate: PurposeTemplate = {
      ...purposeTemplate,
      purposeRiskAnalysisForm: {
        ...riskAnalysisFormTemplate,
        singleAnswers: [
          {
            ...riskAnalysisFormTemplate.singleAnswers[0],
            annotation: {
              ...riskAnalysisFormTemplate.singleAnswers[0].annotation!,
              docs: [annotationDocument2],
            },
          },
        ],
      },
    };

    expect(annotationDocumentDeletionPayload).toEqual({
      purposeTemplate: toPurposeTemplateV2(expectedPurposeTemplate),
      documentId: annotationDocument1.id,
    });

    expect(response).toEqual({
      data: annotationDocument1,
      metadata: { version: 1 },
    });

    expect(fileManager.delete).toHaveBeenCalledWith(
      config.s3Bucket,
      annotationDocument1.path,
      genericLogger
    );

    const filePathsAfterDeletion = await fileManager.listFiles(
      config.s3Bucket,
      genericLogger
    );
    expect(filePathsAfterDeletion).not.toContain(annotationDocument1.path);
    expect(filePathsAfterDeletion).toContain(annotationDocument2.path);
  });

  it("should throw purposeTemplateNotFound if the purpose template doesn't exist", () => {
    void expect(
      purposeTemplateService.deleteRiskAnalysisTemplateAnswerAnnotationDocument(
        purposeTemplate.id,
        riskAnalysisFormTemplate.singleAnswers[0].id,
        annotationDocument1.id,
        getMockContext({
          authData: getMockAuthData(purposeTemplate.creatorId),
        })
      )
    ).rejects.toThrowError(purposeTemplateNotFound(purposeTemplate.id));
  });

  it("should throw tenantNotAllowed if the requester is not the creator", async () => {
    const requesterId = generateId<TenantId>();

    await addOnePurposeTemplate(purposeTemplate);
    expect(
      purposeTemplateService.deleteRiskAnalysisTemplateAnswerAnnotationDocument(
        purposeTemplate.id,
        riskAnalysisFormTemplate.singleAnswers[0].id,
        annotationDocument1.id,
        getMockContext({
          authData: getMockAuthData(requesterId),
        })
      )
    ).rejects.toThrowError(tenantNotAllowed(requesterId));
  });

  it("should throw riskAnalysisTemplateNotFound if the purpose template doesn't have a risk analysis template", async () => {
    const purposeTemplateWithoutRiskAnalysisTemplate = getMockPurposeTemplate();

    await addOnePurposeTemplate(purposeTemplateWithoutRiskAnalysisTemplate);
    expect(
      purposeTemplateService.deleteRiskAnalysisTemplateAnswerAnnotationDocument(
        purposeTemplateWithoutRiskAnalysisTemplate.id,
        generateId(),
        generateId(),
        getMockContext({
          authData: getMockAuthData(
            purposeTemplateWithoutRiskAnalysisTemplate.creatorId
          ),
        })
      )
    ).rejects.toThrowError(
      purposeTemplateRiskAnalysisFormNotFound(
        purposeTemplateWithoutRiskAnalysisTemplate.id
      )
    );
  });

  it("should throw riskAnalysisTemplateAnswerAnnotationDocumentNotFound if the risk analysis template answer annotation document doesn't exist", async () => {
    const answerId = generateId<RiskAnalysisMultiAnswerId>();
    const documentId =
      generateId<RiskAnalysisTemplateAnswerAnnotationDocumentId>();

    await addOnePurposeTemplate(purposeTemplate);
    expect(
      purposeTemplateService.deleteRiskAnalysisTemplateAnswerAnnotationDocument(
        purposeTemplate.id,
        answerId,
        documentId,
        getMockContext({
          authData: getMockAuthData(purposeTemplate.creatorId),
        })
      )
    ).rejects.toThrowError(
      riskAnalysisTemplateAnswerAnnotationDocumentNotFound(
        purposeTemplate.id,
        answerId,
        documentId
      )
    );
  });

  it.each(
    Object.values(purposeTemplateState).filter(
      (state) => state !== purposeTemplateState.draft
    )
  )(
    "should throw purposeTemplateNotInExpectedState if the purpose template is in %s state",
    async (state) => {
      const purposeTemplateNotInWrongState: PurposeTemplate = {
        ...purposeTemplate,
        state,
      };

      await addOnePurposeTemplate(purposeTemplateNotInWrongState);
      expect(
        purposeTemplateService.deleteRiskAnalysisTemplateAnswerAnnotationDocument(
          purposeTemplate.id,
          riskAnalysisFormTemplate.singleAnswers[0].id,
          annotationDocument1.id,
          getMockContext({
            authData: getMockAuthData(purposeTemplate.creatorId),
          })
        )
      ).rejects.toThrowError(
        purposeTemplateNotInExpectedStates(
          purposeTemplateNotInWrongState.id,
          purposeTemplateNotInWrongState.state,
          [purposeTemplateState.draft]
        )
      );
    }
  );
});
