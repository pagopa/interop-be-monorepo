import {
  getMockAuthData,
  getMockContext,
  getMockPurposeTemplate,
  getMockValidRiskAnalysisFormTemplate,
  sortPurposeTemplate,
} from "pagopa-interop-commons-test";
import {
  generateId,
  PurposeTemplate,
  PurposeTemplateId,
  purposeTemplateState,
  TenantId,
  tenantKind,
} from "pagopa-interop-models";
import { describe, expect, it } from "vitest";
import {
  addOnePurposeTemplate,
  purposeTemplateService,
} from "../integrationUtils.js";
import {
  purposeTemplateNotFound,
  tenantNotAllowed,
} from "../../src/model/domain/errors.js";

describe("getPurposeTemplateById", () => {
  it.each(Object.values(purposeTemplateState))(
    "should get the purpose template if the requester is the creator and the purpose template is in state %s",
    async (purposeTemplateState) => {
      const purposeTemplate: PurposeTemplate = {
        ...getMockPurposeTemplate(),
        state: purposeTemplateState,
        purposeRiskAnalysisForm: getMockValidRiskAnalysisFormTemplate(
          tenantKind.PA
        ),
      };
      await addOnePurposeTemplate(purposeTemplate);

      const purposeTemplateResponse =
        await purposeTemplateService.getPurposeTemplateById(
          purposeTemplate.id,
          getMockContext({
            authData: getMockAuthData(purposeTemplate.creatorId),
          })
        );
      expect({
        ...purposeTemplateResponse,
        data: sortPurposeTemplate(purposeTemplateResponse.data),
      } satisfies typeof purposeTemplateResponse).toMatchObject({
        data: sortPurposeTemplate(purposeTemplate),
        metadata: { version: 0 },
      });
    }
  );

  const creatorOnlyPurposeTemplateStates = Object.values(
    purposeTemplateState
  ).filter((s) => s !== purposeTemplateState.active);
  it.each(creatorOnlyPurposeTemplateStates)(
    "should throw tenantNotAllowed if the requester is not the creator and the purpose template is in state %s",
    async (purposeTemplateState) => {
      const requesterId = generateId<TenantId>();

      const purposeTemplate: PurposeTemplate = {
        ...getMockPurposeTemplate(),
        state: purposeTemplateState,
        purposeRiskAnalysisForm: getMockValidRiskAnalysisFormTemplate(
          tenantKind.PA
        ),
      };
      await addOnePurposeTemplate(purposeTemplate);

      await expect(
        purposeTemplateService.getPurposeTemplateById(
          purposeTemplate.id,
          getMockContext({ authData: getMockAuthData(requesterId) })
        )
      ).rejects.toThrowError(tenantNotAllowed(requesterId));
    }
  );

  it("should throw purposeTemplateNotFound if the purpose template doesn't exist", async () => {
    const notExistingId = generateId<PurposeTemplateId>();
    const purposeTemplate = getMockPurposeTemplate();
    await addOnePurposeTemplate(purposeTemplate);

    await expect(
      purposeTemplateService.getPurposeTemplateById(
        notExistingId,
        getMockContext({ authData: getMockAuthData(generateId<TenantId>()) })
      )
    ).rejects.toThrowError(purposeTemplateNotFound(notExistingId));
  });
});
