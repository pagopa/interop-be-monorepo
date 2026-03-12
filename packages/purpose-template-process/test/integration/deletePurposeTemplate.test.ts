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
  PurposeTemplateDraftDeletedV2,
  RiskAnalysisFormTemplate,
  targetTenantKind,
  PurposeTemplate,
  toPurposeTemplateV2,
  purposeTemplateState,
  TenantId,
  generateId,
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
} from "../../src/model/domain/errors.js";

describe("deletePurposeTemplate", () => {
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
    getMockValidRiskAnalysisFormTemplate(targetTenantKind.PA);
  const riskAnalysisFormTemplate: RiskAnalysisFormTemplate = {
    ...incompleteRiskAnalysisFormTemplate,
    singleAnswers: [
      {
        ...incompleteRiskAnalysisFormTemplate.singleAnswers[0],
        annotation: {
          ...getMockRiskAnalysisTemplateAnswerAnnotation(),
          docs: [annotationDocument1],
        },
      },
    ],
    multiAnswers: [
      {
        ...incompleteRiskAnalysisFormTemplate.multiAnswers[0],
        annotation: {
          ...getMockRiskAnalysisTemplateAnswerAnnotation(),
          docs: [annotationDocument2],
        },
      },
    ],
  };

  const purposeTemplate: PurposeTemplate = {
    ...getMockPurposeTemplate(),
    purposeRiskAnalysisForm: riskAnalysisFormTemplate,
  };

  it("should write on event-store for the deletion of a purpose template and delete the risk analysis template answer annotation documents", async () => {
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

    await purposeTemplateService.deletePurposeTemplate(
      purposeTemplate.id,
      getMockContext({ authData: getMockAuthData(purposeTemplate.creatorId) })
    );

    const purposeTemplateDeletionEvent = await readLastPurposeTemplateEvent(
      purposeTemplate.id
    );

    expect(purposeTemplateDeletionEvent).toMatchObject({
      stream_id: purposeTemplate.id,
      version: "1",
      type: "PurposeTemplateDraftDeleted",
      event_version: 2,
    });

    const purposeDeletionPayload = decodeProtobufPayload({
      messageType: PurposeTemplateDraftDeletedV2,
      payload: purposeTemplateDeletionEvent.data,
    });

    expect(purposeDeletionPayload.purposeTemplate).toEqual(
      toPurposeTemplateV2(purposeTemplate)
    );

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
      purposeTemplateService.deletePurposeTemplate(
        purposeTemplate.id,
        getMockContext({ authData: getMockAuthData(purposeTemplate.creatorId) })
      )
    ).rejects.toThrowError(purposeTemplateNotFound(purposeTemplate.id));
  });

  it("should throw purposeTemplateNotFound if the requester is not the creator", async () => {
    const requesterId = generateId<TenantId>();

    await addOnePurposeTemplate(purposeTemplate);
    expect(
      purposeTemplateService.deletePurposeTemplate(
        purposeTemplate.id,
        getMockContext({ authData: getMockAuthData(requesterId) })
      )
    ).rejects.toThrowError(purposeTemplateNotFound(purposeTemplate.id));
  });

  it("should throw purposeTemplateRiskAnalysisFormNotFound if the purpose template doesn't have a risk analysis form", async () => {
    const purposeTemplateWithoutRiskAnalysisForm = getMockPurposeTemplate();

    await addOnePurposeTemplate(purposeTemplateWithoutRiskAnalysisForm);
    expect(
      purposeTemplateService.deletePurposeTemplate(
        purposeTemplateWithoutRiskAnalysisForm.id,
        getMockContext({
          authData: getMockAuthData(
            purposeTemplateWithoutRiskAnalysisForm.creatorId
          ),
        })
      )
    ).rejects.toThrowError(
      purposeTemplateRiskAnalysisFormNotFound(
        purposeTemplateWithoutRiskAnalysisForm.id
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
        purposeTemplateService.deletePurposeTemplate(
          purposeTemplate.id,
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
