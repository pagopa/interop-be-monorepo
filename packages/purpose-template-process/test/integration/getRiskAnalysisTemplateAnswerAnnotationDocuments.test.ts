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
  RiskAnalysisSingleAnswerId,
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
  riskAnalysisTemplateAnswerNotFound,
  tenantNotAllowed,
} from "../../src/model/domain/errors.js";

const sortByCreatedAtDate = (
  a: RiskAnalysisTemplateAnswerAnnotationDocument,
  b: RiskAnalysisTemplateAnswerAnnotationDocument
): number => a.createdAt.getTime() - b.createdAt.getTime();

describe("getRiskAnalysisTemplateAnswerAnnotationDocuments", () => {
  const riskAnalysisTemplate = getMockCompleteRiskAnalysisFormTemplate();
  const answerId = riskAnalysisTemplate.singleAnswers[0].id;
  const riskAnalysisTemplateAnswerAnnotationDocuments: RiskAnalysisTemplateAnswerAnnotationDocument[] =
    [
      getMockRiskAnalysisTemplateAnswerAnnotationDocument(),
      getMockRiskAnalysisTemplateAnswerAnnotationDocument(),
    ];
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
      await purposeTemplateService.getRiskAnalysisTemplateAnswerAnnotationDocuments(
        purposeTemplate.id,
        answerId,
        { offset: 0, limit: 10 },
        getMockContext({ authData })
      );

    expect(result).toEqual({
      results:
        riskAnalysisTemplateAnswerAnnotationDocuments.sort(sortByCreatedAtDate),
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
        await purposeTemplateService.getRiskAnalysisTemplateAnswerAnnotationDocuments(
          purposeTemplateNotInDraftState.id,
          answerId,
          { offset: 0, limit: 10 },
          getMockContext({ authData })
        );

      expect(result).toEqual({
        results:
          riskAnalysisTemplateAnswerAnnotationDocuments.sort(
            sortByCreatedAtDate
          ),
        totalCount: riskAnalysisTemplateAnswerAnnotationDocuments.length,
      });
    }
  );

  it("should throw tenantNotAllowed if the requester is not the creator and the purpose template state is draft", async () => {
    const requesterId = generateId<TenantId>();
    await expect(
      purposeTemplateService.getRiskAnalysisTemplateAnswerAnnotationDocuments(
        purposeTemplate.id,
        answerId,
        { offset: 0, limit: 10 },
        getMockContext({ authData: getMockAuthData(requesterId) })
      )
    ).rejects.toThrowError(tenantNotAllowed(requesterId));
  });

  it("should throw riskAnalysisTemplateAnswerNotFound if the risk analysis template answer doesn't exist", async () => {
    const notExistentAnswerId = generateId<RiskAnalysisSingleAnswerId>();
    await expect(
      purposeTemplateService.getRiskAnalysisTemplateAnswerAnnotationDocuments(
        purposeTemplate.id,
        notExistentAnswerId,
        { offset: 0, limit: 10 },
        getMockContext({ authData: getMockAuthData(purposeTemplate.creatorId) })
      )
    ).rejects.toThrowError(
      riskAnalysisTemplateAnswerNotFound({
        purposeTemplateId: purposeTemplate.id,
        answerId: notExistentAnswerId,
      })
    );
  });

  it("should throw purposeTemplateNotFound if the purpose template doesn't exist", async () => {
    const notExistentPurposeTemplateId = generateId<PurposeTemplateId>();
    await expect(
      purposeTemplateService.getRiskAnalysisTemplateAnswerAnnotationDocuments(
        notExistentPurposeTemplateId,
        answerId,
        { offset: 0, limit: 10 },
        getMockContext({})
      )
    ).rejects.toThrowError(
      purposeTemplateNotFound(notExistentPurposeTemplateId)
    );
  });
});
