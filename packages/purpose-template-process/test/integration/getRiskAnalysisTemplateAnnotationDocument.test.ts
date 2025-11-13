/* eslint-disable @typescript-eslint/no-non-null-assertion */
import {
  getMockAuthData,
  getMockCompleteRiskAnalysisFormTemplate,
  getMockContext,
  getMockPurposeTemplate,
} from "pagopa-interop-commons-test";
import {
  generateId,
  PurposeTemplate,
  PurposeTemplateId,
  RiskAnalysisTemplateAnswerAnnotationDocumentId,
  TenantId,
} from "pagopa-interop-models";
import { beforeEach, describe, expect, it } from "vitest";
import {
  addOnePurposeTemplate,
  purposeTemplateService,
} from "../integrationUtils.js";
import {
  purposeTemplateNotFound,
  riskAnalysisTemplateAnswerAnnotationDocumentNotFound,
  tenantNotAllowed,
} from "../../src/model/domain/errors.js";

describe("getRiskAnalysisTemplateAnnotationDocument", async () => {
  const riskAnalysisFormTemplate = getMockCompleteRiskAnalysisFormTemplate();
  const annotationDoc =
    riskAnalysisFormTemplate.singleAnswers[0].annotation!.docs[0];

  const purposeTemplate: PurposeTemplate = {
    ...getMockPurposeTemplate(),
    purposeRiskAnalysisForm: riskAnalysisFormTemplate,
  };

  beforeEach(async () => {
    await addOnePurposeTemplate(purposeTemplate);
  });

  it("should get the risk analysis template answer annotation document if it exists", async () => {
    const purposeTemplateResponse =
      await purposeTemplateService.getRiskAnalysisTemplateAnswerAnnotationDocument(
        {
          purposeTemplateId: purposeTemplate.id,
          documentId: annotationDoc.id,
        },
        getMockContext({ authData: getMockAuthData(purposeTemplate.creatorId) })
      );
    expect(purposeTemplateResponse).toMatchObject({
      data: annotationDoc,
      metadata: { version: 0 },
    });
  });

  it("should throw riskAnalysisTemplateAnswerAnnotationDocumentNotFound if the risk analysis template answer annotation document doesn't exist", async () => {
    const notExistingDocumentId =
      generateId<RiskAnalysisTemplateAnswerAnnotationDocumentId>();

    await expect(
      purposeTemplateService.getRiskAnalysisTemplateAnswerAnnotationDocument(
        {
          purposeTemplateId: purposeTemplate.id,
          documentId: notExistingDocumentId,
        },
        getMockContext({ authData: getMockAuthData(purposeTemplate.creatorId) })
      )
    ).rejects.toThrowError(
      riskAnalysisTemplateAnswerAnnotationDocumentNotFound(
        purposeTemplate.id,
        notExistingDocumentId
      )
    );
  });

  it("should throw tenantNotAllowed if the requester is not the creator and the purpose template is in draft state", async () => {
    const requesterId = generateId<TenantId>();
    await expect(
      purposeTemplateService.getRiskAnalysisTemplateAnswerAnnotationDocument(
        {
          purposeTemplateId: purposeTemplate.id,
          documentId: annotationDoc.id,
        },
        getMockContext({
          authData: getMockAuthData(requesterId),
        })
      )
    ).rejects.toThrowError(tenantNotAllowed(requesterId));
  });

  it("should throw purposeTemplateNotFound if the requester is not the creator and the purpose template is in draft state", async () => {
    const notExistentPurposeTemplateId = generateId<PurposeTemplateId>();
    await expect(
      purposeTemplateService.getRiskAnalysisTemplateAnswerAnnotationDocument(
        {
          purposeTemplateId: notExistentPurposeTemplateId,
          documentId: annotationDoc.id,
        },
        getMockContext({
          authData: getMockAuthData(purposeTemplate.creatorId),
        })
      )
    ).rejects.toThrowError(
      purposeTemplateNotFound(notExistentPurposeTemplateId)
    );
  });
});
