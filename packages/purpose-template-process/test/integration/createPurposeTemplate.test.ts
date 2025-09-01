/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/no-floating-promises */
import { fail } from "assert";
import { purposeTemplateApi } from "pagopa-interop-api-clients";
import {
  decodeProtobufPayload,
  getMockAuthData,
  getMockContext,
} from "pagopa-interop-commons-test";
import { getMockValidRiskAnalysisFormTemplate } from "pagopa-interop-commons-test/src/riskAnalysisTemplateTestUtils.js";
import {
  PurposeTemplate,
  PurposeTemplateAddedV2,
  RiskAnalysisFormTemplate,
  generateId,
  purposeTemplateState,
  tenantKind,
  toPurposeTemplateV2,
  unsafeBrandId,
} from "pagopa-interop-models";
import { describe, expect, it, vi } from "vitest";
import {
  invalidTemplateResult,
  unexpectedTemplateRulesVersionError,
} from "pagopa-interop-commons";
import {
  missingFreeOfChargeReason,
  purposeTemplateNameConflict,
  riskAnalysisTemplateValidationFailed,
} from "../../src/model/domain/errors.js";
import {
  addOnePurposeTemplate,
  purposeTemplateService,
  readLastPurposeTemplateEvent,
} from "../integrationUtils.js";
import {
  buildRiskAnalysisFormTemplateSeed,
  getMockPurposeTemplateSeed,
} from "../mockUtils.js";

describe("createPurposeTemplate", () => {
  const mockPurposeTemplate: PurposeTemplate = {
    id: generateId(),
    targetDescription: "Test target description",
    targetTenantKind: "PA",
    creatorId: generateId(),
    state: purposeTemplateState.draft,
    createdAt: new Date(),
    purposeTitle: "Test purpose title",
    purposeDescription: "Test purpose description",
    purposeRiskAnalysisForm: undefined,
    purposeIsFreeOfCharge: true,
    purposeFreeOfChargeReason: "Test reason",
    purposeDailyCalls: 10,
  };

  const mockValidRiskAnalysisTemplateForm =
    getMockValidRiskAnalysisFormTemplate(tenantKind.PA);

  const purposeTemplateSeed = getMockPurposeTemplateSeed(
    buildRiskAnalysisFormTemplateSeed(mockValidRiskAnalysisTemplateForm)
  );

  it("should write on event-store for the creation of a purpose template", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date());

    const createPurposeTemplateResponse =
      await purposeTemplateService.createPurposeTemplate(
        purposeTemplateSeed,
        getMockContext({
          authData: getMockAuthData(mockPurposeTemplate.creatorId),
        })
      );

    const writtenEvent = await readLastPurposeTemplateEvent(
      createPurposeTemplateResponse.data.purposeTemplate.id
    );

    if (!writtenEvent) {
      fail("Creation failed: purpose template not found in event-store");
    }

    expect(writtenEvent).toMatchObject({
      stream_id: createPurposeTemplateResponse.data.purposeTemplate.id,
      version: "0",
      type: "PurposeTemplateAdded",
      event_version: 2,
    });

    const writtenPayload = decodeProtobufPayload({
      messageType: PurposeTemplateAddedV2,
      payload: writtenEvent.data,
    });

    const expectedRiskAnalysisForm: RiskAnalysisFormTemplate = {
      ...mockValidRiskAnalysisTemplateForm,
      id: unsafeBrandId(
        createPurposeTemplateResponse.data.purposeTemplate
          .purposeRiskAnalysisForm!.id
      ),
      singleAnswers: mockValidRiskAnalysisTemplateForm.singleAnswers.map(
        (answer, i) => ({
          ...answer,
          id: createPurposeTemplateResponse.data.purposeTemplate
            .purposeRiskAnalysisForm!.singleAnswers[i].id,
        })
      ),
      multiAnswers: mockValidRiskAnalysisTemplateForm.multiAnswers.map(
        (answer, i) => ({
          ...answer,
          id: createPurposeTemplateResponse.data.purposeTemplate
            .purposeRiskAnalysisForm!.multiAnswers[i].id,
        })
      ),
    };

    const expectedPurposeTemplate: PurposeTemplate = {
      id: unsafeBrandId(createPurposeTemplateResponse.data.purposeTemplate.id),
      createdAt: new Date(),
      targetDescription: purposeTemplateSeed.targetDescription,
      targetTenantKind: purposeTemplateSeed.targetTenantKind,
      creatorId: unsafeBrandId(mockPurposeTemplate.creatorId),
      state: purposeTemplateState.draft,
      purposeTitle: purposeTemplateSeed.purposeTitle,
      purposeDescription: purposeTemplateSeed.purposeDescription,
      purposeRiskAnalysisForm: expectedRiskAnalysisForm,
      purposeIsFreeOfCharge: purposeTemplateSeed.purposeIsFreeOfCharge,
      purposeFreeOfChargeReason: purposeTemplateSeed.purposeFreeOfChargeReason,
      purposeDailyCalls: purposeTemplateSeed.purposeDailyCalls,
    };

    expect(writtenPayload.purposeTemplate).toEqual(
      toPurposeTemplateV2(expectedPurposeTemplate)
    );
    expect(createPurposeTemplateResponse).toEqual({
      data: {
        purposeTemplate: expectedPurposeTemplate,
      },
      metadata: { version: 0 },
    });

    vi.useRealTimers();
  });

  it("should throw missingFreeOfChargeReason if the freeOfChargeReason is empty", async () => {
    const seed: purposeTemplateApi.PurposeTemplateSeed = {
      ...purposeTemplateSeed,
      purposeFreeOfChargeReason: undefined,
    };

    expect(
      purposeTemplateService.createPurposeTemplate(
        seed,
        getMockContext({
          authData: getMockAuthData(mockPurposeTemplate.creatorId),
        })
      )
    ).rejects.toThrowError(missingFreeOfChargeReason());
  });

  it("should throw purposeTemplateNameConflict if a purpose template with same name already exists", async () => {
    const existingPurposeTemplate: PurposeTemplate = {
      ...mockPurposeTemplate,
      purposeTitle: purposeTemplateSeed.purposeTitle,
    };

    await addOnePurposeTemplate(existingPurposeTemplate);

    expect(
      purposeTemplateService.createPurposeTemplate(
        purposeTemplateSeed,
        getMockContext({
          authData: getMockAuthData(mockPurposeTemplate.creatorId),
        })
      )
    ).rejects.toThrowError(
      purposeTemplateNameConflict(
        existingPurposeTemplate.id,
        purposeTemplateSeed.purposeTitle
      )
    );
  });

  it("should throw riskAnalysisTemplateValidationFailed if the purpose template has a non valid risk analysis", async () => {
    const seedWithInvalidRiskAnalysis: purposeTemplateApi.PurposeTemplateSeed =
      {
        ...purposeTemplateSeed,
        purposeRiskAnalysisForm: {
          version: "0", // invalid version
          answers: {},
        },
      };

    expect(
      purposeTemplateService.createPurposeTemplate(
        seedWithInvalidRiskAnalysis,
        getMockContext({
          authData: getMockAuthData(mockPurposeTemplate.creatorId),
        })
      )
    ).rejects.toThrowError(
      riskAnalysisTemplateValidationFailed(
        invalidTemplateResult([
          unexpectedTemplateRulesVersionError(
            seedWithInvalidRiskAnalysis.purposeRiskAnalysisForm!.version
          ),
        ]).issues
      )
    );
  });
});
