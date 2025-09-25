/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/no-floating-promises */
import { fail } from "assert";
import { purposeTemplateApi } from "pagopa-interop-api-clients";
import {
  decodeProtobufPayload,
  getMockAuthData,
  getMockContext,
  getMockPurposeTemplate,
  getMockValidRiskAnalysisFormTemplate,
} from "pagopa-interop-commons-test";
import {
  PurposeTemplate,
  PurposeTemplateAddedV2,
  RiskAnalysisFormTemplate,
  TenantKind,
  purposeTemplateState,
  tenantKind,
  toPurposeTemplateV2,
  unsafeBrandId,
} from "pagopa-interop-models";
import { describe, expect, it, vi } from "vitest";
import {
  invalidTemplateResult,
  unexpectedRiskAnalysisTemplateRulesVersionError,
  unexpectedRiskAnalysisTemplateFieldError,
  missingExpectedRiskAnalysisTemplateFieldError,
} from "pagopa-interop-commons";
import {
  missingFreeOfChargeReason,
  purposeTemplateNameConflict,
  riskAnalysisTemplateValidationFailed,
  ruleSetNotFoundError,
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
    ...getMockPurposeTemplate(),
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
      createPurposeTemplateResponse.data.id
    );

    if (!writtenEvent) {
      fail("Creation failed: purpose template not found in event-store");
    }

    expect(writtenEvent).toMatchObject({
      stream_id: createPurposeTemplateResponse.data.id,
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
        createPurposeTemplateResponse.data.purposeRiskAnalysisForm!.id
      ),
      singleAnswers: mockValidRiskAnalysisTemplateForm.singleAnswers.map(
        (answer, i) => ({
          ...answer,
          id: createPurposeTemplateResponse.data.purposeRiskAnalysisForm!
            .singleAnswers[i].id,
        })
      ),
      multiAnswers: mockValidRiskAnalysisTemplateForm.multiAnswers.map(
        (answer, i) => ({
          ...answer,
          id: createPurposeTemplateResponse.data.purposeRiskAnalysisForm!
            .multiAnswers[i].id,
        })
      ),
    };

    const expectedPurposeTemplate: PurposeTemplate = {
      id: unsafeBrandId(createPurposeTemplateResponse.data.id),
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

    expect(writtenPayload).toEqual({
      purposeTemplate: toPurposeTemplateV2(expectedPurposeTemplate),
    });
    expect(createPurposeTemplateResponse).toEqual({
      data: expectedPurposeTemplate,
      metadata: { version: 0 },
    });

    vi.useRealTimers();
  });

  it("should write on event-store for the creation of a purpose template with free of charge false", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date());

    const seedWithFreeOfChargeFalse: purposeTemplateApi.PurposeTemplateSeed = {
      ...purposeTemplateSeed,
      purposeIsFreeOfCharge: false,
      purposeFreeOfChargeReason: undefined,
    };

    const createPurposeTemplateResponse =
      await purposeTemplateService.createPurposeTemplate(
        seedWithFreeOfChargeFalse,
        getMockContext({
          authData: getMockAuthData(mockPurposeTemplate.creatorId),
        })
      );

    const writtenEvent = await readLastPurposeTemplateEvent(
      createPurposeTemplateResponse.data.id
    );

    if (!writtenEvent) {
      fail("Creation failed: purpose template not found in event-store");
    }

    expect(writtenEvent).toMatchObject({
      stream_id: createPurposeTemplateResponse.data.id,
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
        createPurposeTemplateResponse.data.purposeRiskAnalysisForm!.id
      ),
      singleAnswers: mockValidRiskAnalysisTemplateForm.singleAnswers.map(
        // eslint-disable-next-line sonarjs/no-identical-functions
        (answer, i) => ({
          ...answer,
          id: createPurposeTemplateResponse.data.purposeRiskAnalysisForm!
            .singleAnswers[i].id,
        })
      ),
      multiAnswers: mockValidRiskAnalysisTemplateForm.multiAnswers.map(
        // eslint-disable-next-line sonarjs/no-identical-functions
        (answer, i) => ({
          ...answer,
          id: createPurposeTemplateResponse.data.purposeRiskAnalysisForm!
            .multiAnswers[i].id,
        })
      ),
    };

    const expectedPurposeTemplate: PurposeTemplate = {
      id: unsafeBrandId(createPurposeTemplateResponse.data.id),
      createdAt: new Date(),
      targetDescription: seedWithFreeOfChargeFalse.targetDescription,
      targetTenantKind: seedWithFreeOfChargeFalse.targetTenantKind,
      creatorId: unsafeBrandId(mockPurposeTemplate.creatorId),
      state: purposeTemplateState.draft,
      purposeTitle: seedWithFreeOfChargeFalse.purposeTitle,
      purposeDescription: seedWithFreeOfChargeFalse.purposeDescription,
      purposeRiskAnalysisForm: expectedRiskAnalysisForm,
      purposeIsFreeOfCharge: seedWithFreeOfChargeFalse.purposeIsFreeOfCharge,
      purposeFreeOfChargeReason:
        seedWithFreeOfChargeFalse.purposeFreeOfChargeReason,
      purposeDailyCalls: seedWithFreeOfChargeFalse.purposeDailyCalls,
    };

    expect(writtenPayload).toEqual({
      purposeTemplate: toPurposeTemplateV2(expectedPurposeTemplate),
    });
    expect(createPurposeTemplateResponse).toEqual({
      data: expectedPurposeTemplate,
      metadata: { version: 0 },
    });

    vi.useRealTimers();
  });

  it("should throw missingFreeOfChargeReason if isFreeOfCharge is true and freeOfChargeReason is empty", async () => {
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
          unexpectedRiskAnalysisTemplateRulesVersionError(
            seedWithInvalidRiskAnalysis.purposeRiskAnalysisForm!.version
          ),
        ]).issues
      )
    );
  });

  it("should throw riskAnalysisTemplateValidationFailed if the purpose template risk analysis has unexpected field", async () => {
    const validTemplate = buildRiskAnalysisFormTemplateSeed(
      getMockValidRiskAnalysisFormTemplate(tenantKind.PA)
    );

    const seedWithUnexpectedField: purposeTemplateApi.PurposeTemplateSeed = {
      ...purposeTemplateSeed,
      purposeRiskAnalysisForm: {
        ...validTemplate,
        answers: {
          ...validTemplate.answers,
          unexpectedField: {
            values: ["someValue"], // unexpected field
            editable: false,
            suggestedValues: [],
          },
        },
      },
    };

    expect(
      purposeTemplateService.createPurposeTemplate(
        seedWithUnexpectedField,
        getMockContext({
          authData: getMockAuthData(mockPurposeTemplate.creatorId),
        })
      )
    ).rejects.toThrowError(
      riskAnalysisTemplateValidationFailed(
        invalidTemplateResult([
          unexpectedRiskAnalysisTemplateFieldError("unexpectedField"),
        ]).issues
      )
    );
  });

  it("should throw riskAnalysisTemplateValidationFailed if the purpose template risk analysis has missing expected field", async () => {
    const validTemplate = buildRiskAnalysisFormTemplateSeed(
      getMockValidRiskAnalysisFormTemplate(tenantKind.PA)
    );

    // Remove otherPurpose field which is required when purpose is OTHER
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { otherPurpose, ...answersWithoutOtherPurpose } =
      validTemplate.answers;

    const seedWithMissingField: purposeTemplateApi.PurposeTemplateSeed = {
      ...purposeTemplateSeed,
      purposeRiskAnalysisForm: {
        ...validTemplate,
        answers: {
          ...answersWithoutOtherPurpose,
          purpose: {
            values: ["OTHER"],
            editable: false,
            suggestedValues: [],
          },
        },
      },
    };

    expect(
      purposeTemplateService.createPurposeTemplate(
        seedWithMissingField,
        getMockContext({
          authData: getMockAuthData(mockPurposeTemplate.creatorId),
        })
      )
    ).rejects.toThrowError(
      riskAnalysisTemplateValidationFailed(
        invalidTemplateResult([
          missingExpectedRiskAnalysisTemplateFieldError("otherPurpose"),
        ]).issues
      )
    );
  });

  it("should throw ruleSetNotFoundError if not exists rules for provided target tenant kind", async () => {
    const invalidTenantKind = "INVALID" as TenantKind;
    const seedWithInvalidTargetTenantKind: purposeTemplateApi.PurposeTemplateSeed =
      {
        ...purposeTemplateSeed,
        purposeRiskAnalysisForm: undefined,
        targetTenantKind: invalidTenantKind,
      };

    expect(
      purposeTemplateService.createPurposeTemplate(
        seedWithInvalidTargetTenantKind,
        getMockContext({
          authData: getMockAuthData(mockPurposeTemplate.creatorId),
        })
      )
    ).rejects.toThrowError(ruleSetNotFoundError(invalidTenantKind));
  });
});
