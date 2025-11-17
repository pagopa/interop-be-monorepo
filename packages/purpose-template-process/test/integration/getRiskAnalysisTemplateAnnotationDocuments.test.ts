/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable functional/no-let */
import {
  getMockAuthData,
  getMockContext,
  getMockPurposeTemplate,
  getMockCompleteRiskAnalysisFormTemplate,
  getMockRiskAnalysisTemplateAnswerAnnotation,
  getMockRiskAnalysisTemplateAnswerAnnotationDocument,
} from "pagopa-interop-commons-test";
import {
  PurposeTemplate,
  PurposeTemplateId,
  RiskAnalysisTemplateAnswerAnnotationDocument,
  TenantId,
  generateId,
  purposeTemplateState,
  userRole,
} from "pagopa-interop-models";
import { beforeEach, describe, expect, it } from "vitest";
import { AuthData } from "pagopa-interop-commons";
import { upsertPurposeTemplate } from "pagopa-interop-readmodel/testUtils";
import {
  addOnePurposeTemplate,
  purposeTemplateService,
  readModelDB,
} from "../integrationUtils.js";
import {
  purposeTemplateNotFound,
  tenantNotAllowed,
} from "../../src/model/domain/errors.js";

const sortByCreatedAtDate = (
  a: RiskAnalysisTemplateAnswerAnnotationDocument,
  b: RiskAnalysisTemplateAnswerAnnotationDocument
): number => a.createdAt.getTime() - b.createdAt.getTime();

describe("getRiskAnalysisTemplateAnnotationDocuments", () => {
  const mockDate1 = new Date();
  const mockDate2 = new Date(mockDate1.getTime() + 1000);
  const riskAnalysisTemplate = getMockCompleteRiskAnalysisFormTemplate();
  const riskAnalysisTemplateAnswerAnnotationDocuments: RiskAnalysisTemplateAnswerAnnotationDocument[] =
    [
      {
        ...getMockRiskAnalysisTemplateAnswerAnnotationDocument(),
        createdAt: mockDate1,
      },
      {
        ...getMockRiskAnalysisTemplateAnswerAnnotationDocument(),
        createdAt: mockDate2,
      },
    ].sort(sortByCreatedAtDate);
  const riskAnalysisTemplateAnswerAnnotationDocumentsWithAnswerId =
    riskAnalysisTemplateAnswerAnnotationDocuments.map((document) => ({
      answerId: riskAnalysisTemplate.singleAnswers[0].id,
      document,
    }));
  const purposeTemplate: PurposeTemplate = {
    ...getMockPurposeTemplate(),
    purposeRiskAnalysisForm: {
      ...riskAnalysisTemplate,
      singleAnswers: [
        {
          ...riskAnalysisTemplate.singleAnswers[0],
          annotation: {
            ...getMockRiskAnalysisTemplateAnswerAnnotation(),
            docs: riskAnalysisTemplateAnswerAnnotationDocuments,
          },
        },
      ],
      multiAnswers: [],
    },
  };

  beforeEach(async () => {
    await addOnePurposeTemplate(purposeTemplate);
  });

  it("should get the annotation documents of a risk analysis template (requester is the creator)", async () => {
    const authData: AuthData = {
      ...getMockAuthData(purposeTemplate.creatorId),
      userRoles: [userRole.ADMIN_ROLE],
    };
    const result =
      await purposeTemplateService.getRiskAnalysisTemplateAnnotationDocuments(
        purposeTemplate.id,
        { offset: 0, limit: 10 },
        getMockContext({ authData })
      );

    expect(result).toEqual({
      results: riskAnalysisTemplateAnswerAnnotationDocumentsWithAnswerId,
      totalCount: riskAnalysisTemplateAnswerAnnotationDocuments.length,
    });
  });

  it.each([
    purposeTemplateState.suspended,
    purposeTemplateState.published,
    purposeTemplateState.archived,
  ])(
    "should get the annotation documents of a risk analysis template for a purpose template in state %s (requester is not the creator)",
    async (state) => {
      const purposeTemplateNotInDraftState: PurposeTemplate = {
        ...purposeTemplate,
        state,
      };
      await upsertPurposeTemplate(
        readModelDB,
        purposeTemplateNotInDraftState,
        1
      );
      const authData: AuthData = {
        ...getMockAuthData(generateId<TenantId>()),
        userRoles: [userRole.ADMIN_ROLE],
      };
      const result =
        await purposeTemplateService.getRiskAnalysisTemplateAnnotationDocuments(
          purposeTemplateNotInDraftState.id,
          { offset: 0, limit: 10 },
          getMockContext({ authData })
        );

      expect(result).toEqual({
        results: riskAnalysisTemplateAnswerAnnotationDocumentsWithAnswerId,
        totalCount:
          riskAnalysisTemplateAnswerAnnotationDocumentsWithAnswerId.length,
      });
    }
  );

  it("should throw tenantNotAllowed if the requester is not the creator and the purpose template state is draft", async () => {
    const requesterId = generateId<TenantId>();
    await expect(
      purposeTemplateService.getRiskAnalysisTemplateAnnotationDocuments(
        purposeTemplate.id,
        { offset: 0, limit: 10 },
        getMockContext({ authData: getMockAuthData(requesterId) })
      )
    ).rejects.toThrowError(tenantNotAllowed(requesterId));
  });

  it("should throw purposeTemplateNotFound if the purpose template doesn't exist", async () => {
    const notExistentPurposeTemplateId = generateId<PurposeTemplateId>();
    await expect(
      purposeTemplateService.getRiskAnalysisTemplateAnnotationDocuments(
        notExistentPurposeTemplateId,
        { offset: 0, limit: 10 },
        getMockContext({})
      )
    ).rejects.toThrowError(
      purposeTemplateNotFound(notExistentPurposeTemplateId)
    );
  });
});
