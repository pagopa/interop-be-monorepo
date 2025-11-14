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
  RiskAnalysisSingleAnswerId,
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
  riskAnalysisTemplateAnswerNotFound,
  tenantNotAllowed,
} from "../../src/model/domain/errors.js";

describe("getRiskAnalysisTemplateAnswerAnnotationDocument", async () => {
  const riskAnalysisFormTemplate = getMockCompleteRiskAnalysisFormTemplate();
  const singleAnswer = riskAnalysisFormTemplate.singleAnswers[0];

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
          answerId: singleAnswer.id,
          documentId: singleAnswer.annotation!.docs[0].id,
        },
        getMockContext({ authData: getMockAuthData(purposeTemplate.creatorId) })
      );
    expect(purposeTemplateResponse).toMatchObject({
      data: singleAnswer.annotation!.docs[0],
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
          answerId: singleAnswer.id,
          documentId: notExistingDocumentId,
        },
        getMockContext({ authData: getMockAuthData(purposeTemplate.creatorId) })
      )
    ).rejects.toThrowError(
      riskAnalysisTemplateAnswerAnnotationDocumentNotFound(
        purposeTemplate.id,
        notExistingDocumentId,
        singleAnswer.id
      )
    );
  });

  it("should throw tenantNotAllowed if the requester is not the creator and the purpose template is in draft state", async () => {
    const requesterId = generateId<TenantId>();
    await expect(
      purposeTemplateService.getRiskAnalysisTemplateAnswerAnnotationDocument(
        {
          purposeTemplateId: purposeTemplate.id,
          answerId: singleAnswer.id,
          documentId: singleAnswer.annotation!.docs[0].id,
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
          answerId: singleAnswer.id,
          documentId: singleAnswer.annotation!.docs[0].id,
        },
        getMockContext({
          authData: getMockAuthData(purposeTemplate.creatorId),
        })
      )
    ).rejects.toThrowError(
      purposeTemplateNotFound(notExistentPurposeTemplateId)
    );
  });

  it("should throw riskAnalysisTemplateAnswerNotFound if the requester is not the creator and the purpose template is in draft state", async () => {
    const notExistingAnswerId = generateId<RiskAnalysisSingleAnswerId>();
    await expect(
      purposeTemplateService.getRiskAnalysisTemplateAnswerAnnotationDocument(
        {
          purposeTemplateId: purposeTemplate.id,
          answerId: notExistingAnswerId,
          documentId: singleAnswer.annotation!.docs[0].id,
        },
        getMockContext({
          authData: getMockAuthData(purposeTemplate.creatorId),
        })
      )
    ).rejects.toThrowError(
      riskAnalysisTemplateAnswerNotFound({
        purposeTemplateId: purposeTemplate.id,
        answerId: notExistingAnswerId,
      })
    );
  });
});
