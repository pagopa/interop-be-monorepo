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
  sortPurposeTemplate,
} from "pagopa-interop-commons-test";
import {
  RiskAnalysisFormTemplate,
  tenantKind,
  PurposeTemplate,
  toPurposeTemplateV2,
  purposeTemplateState,
  TenantId,
  generateId,
  PurposeTemplateDraftUpdatedV2,
  RiskAnalysisMultiAnswerId,
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
  riskAnalysisTemplateAnswerNotFound,
  tenantNotAllowed,
} from "../../src/model/domain/errors.js";

describe("deleteRiskAnalysisTemplateAnswerAnnotation", () => {
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

  it("should write on event-store for the deletion of a risk analysis template answer annotation and delete the associated documents", async () => {
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
      await purposeTemplateService.deleteRiskAnalysisTemplateAnswerAnnotation({
        purposeTemplateId: purposeTemplate.id,
        answerId: riskAnalysisFormTemplate.singleAnswers[0].id,
        ctx: getMockContext({
          authData: getMockAuthData(purposeTemplate.creatorId),
        }),
      });

    const annotationDeletionEvent = await readLastPurposeTemplateEvent(
      purposeTemplate.id
    );

    expect(annotationDeletionEvent).toMatchObject({
      stream_id: purposeTemplate.id,
      version: "1",
      type: "PurposeTemplateDraftUpdated",
      event_version: 2,
    });

    const annotationDeletionPayload = decodeProtobufPayload({
      messageType: PurposeTemplateDraftUpdatedV2,
      payload: annotationDeletionEvent.data,
    });

    const expectedAnswerWithoutAnnotation = {
      ...riskAnalysisFormTemplate.singleAnswers[0],
      annotation: undefined,
    };
    const expectedPurposeTemplate: PurposeTemplate = {
      ...purposeTemplate,
      purposeRiskAnalysisForm: {
        ...riskAnalysisFormTemplate,
        singleAnswers: [expectedAnswerWithoutAnnotation],
      },
    };

    expect(
      sortPurposeTemplate(annotationDeletionPayload.purposeTemplate)
    ).toEqual(
      sortPurposeTemplate(toPurposeTemplateV2(expectedPurposeTemplate))
    );

    expect(response).toEqual({
      data: expectedAnswerWithoutAnnotation,
      metadata: { version: 1 },
    });

    expect(fileManager.delete).toHaveBeenCalledWith(
      config.s3Bucket,
      annotationDocument1.path,
      genericLogger
    );
    expect(fileManager.delete).toHaveBeenCalledWith(
      config.s3Bucket,
      annotationDocument2.path,
      genericLogger
    );

    const filePathsAfterDeletion = await fileManager.listFiles(
      config.s3Bucket,
      genericLogger
    );
    expect(filePathsAfterDeletion).not.toContain(annotationDocument1.path);
    expect(filePathsAfterDeletion).not.toContain(annotationDocument2.path);
  });

  it("should throw purposeTemplateNotFound if the purpose template doesn't exist", () => {
    void expect(
      purposeTemplateService.deleteRiskAnalysisTemplateAnswerAnnotation({
        purposeTemplateId: purposeTemplate.id,
        answerId: riskAnalysisFormTemplate.singleAnswers[0].id,
        ctx: getMockContext({
          authData: getMockAuthData(purposeTemplate.creatorId),
        }),
      })
    ).rejects.toThrowError(purposeTemplateNotFound(purposeTemplate.id));
  });

  it("should throw tenantNotAllowed if the requester is not the creator", async () => {
    const requesterId = generateId<TenantId>();

    await addOnePurposeTemplate(purposeTemplate);
    expect(
      purposeTemplateService.deleteRiskAnalysisTemplateAnswerAnnotation({
        purposeTemplateId: purposeTemplate.id,
        answerId: riskAnalysisFormTemplate.singleAnswers[0].id,
        ctx: getMockContext({
          authData: getMockAuthData(requesterId),
        }),
      })
    ).rejects.toThrowError(tenantNotAllowed(requesterId));
  });

  it("should throw purposeTemplateRiskAnalysisFormNotFound if the purpose template doesn't have a risk analysis template", async () => {
    const purposeTemplateWithoutRiskAnalysisTemplate = getMockPurposeTemplate();

    await addOnePurposeTemplate(purposeTemplateWithoutRiskAnalysisTemplate);
    expect(
      purposeTemplateService.deleteRiskAnalysisTemplateAnswerAnnotation({
        purposeTemplateId: purposeTemplateWithoutRiskAnalysisTemplate.id,
        answerId: generateId(),
        ctx: getMockContext({
          authData: getMockAuthData(
            purposeTemplateWithoutRiskAnalysisTemplate.creatorId
          ),
        }),
      })
    ).rejects.toThrowError(
      purposeTemplateRiskAnalysisFormNotFound(
        purposeTemplateWithoutRiskAnalysisTemplate.id
      )
    );
  });

  it("should throw riskAnalysisTemplateAnswerNotFound if the purpose template doesn't have the risk analysis template answer", async () => {
    const answerId = generateId<RiskAnalysisMultiAnswerId>();

    await addOnePurposeTemplate(purposeTemplate);
    expect(
      purposeTemplateService.deleteRiskAnalysisTemplateAnswerAnnotation({
        purposeTemplateId: purposeTemplate.id,
        answerId,
        ctx: getMockContext({
          authData: getMockAuthData(purposeTemplate.creatorId),
        }),
      })
    ).rejects.toThrowError(
      riskAnalysisTemplateAnswerNotFound({
        purposeTemplateId: purposeTemplate.id,
        answerId,
      })
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
        purposeTemplateService.deleteRiskAnalysisTemplateAnswerAnnotation({
          purposeTemplateId: purposeTemplate.id,
          answerId: riskAnalysisFormTemplate.singleAnswers[0].id,
          ctx: getMockContext({
            authData: getMockAuthData(purposeTemplate.creatorId),
          }),
        })
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
