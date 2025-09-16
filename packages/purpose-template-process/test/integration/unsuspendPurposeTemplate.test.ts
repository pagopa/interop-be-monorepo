/* eslint-disable @typescript-eslint/no-non-null-assertion */
import {
  decodeProtobufPayload,
  getMockAuthData,
  getMockContext,
  getMockPurposeTemplate,
  getMockRiskAnalysisTemplateAnswerAnnotation,
  getMockRiskAnalysisTemplateAnswerAnnotationDocument,
  getMockValidRiskAnalysisFormTemplate,
  sortPurposeTemplate,
} from "pagopa-interop-commons-test";
import {
  generateId,
  tenantKind,
  TenantId,
  PurposeTemplate,
  RiskAnalysisFormTemplate,
  RiskAnalysisTemplateMultiAnswer,
  RiskAnalysisTemplateSingleAnswer,
  purposeTemplateState,
  PurposeTemplateUnsuspendedV2,
  toPurposeTemplateV2,
} from "pagopa-interop-models";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
  riskAnalysisFormTemplateToRiskAnalysisFormTemplateToValidate,
  validatePurposeTemplateRiskAnalysis,
} from "pagopa-interop-commons";
import {
  addOnePurposeTemplate,
  purposeTemplateService,
  readLastPurposeTemplateEvent,
} from "../integrationUtils.js";
import {
  missingRiskAnalysisFormTemplate,
  purposeTemplateNotInExpectedState,
  riskAnalysisTemplateValidationFailed,
  tenantNotAllowed,
} from "../../src/model/domain/errors.js";

describe("unsuspendPurposeTemplate", () => {
  const creatorId = generateId<TenantId>();
  const incompleteRiskAnalysisFormTemplate =
    getMockValidRiskAnalysisFormTemplate(tenantKind.PA);
  const riskAnalysisFormTemplate: RiskAnalysisFormTemplate = {
    ...incompleteRiskAnalysisFormTemplate,
    singleAnswers: incompleteRiskAnalysisFormTemplate.singleAnswers.map(
      (a): RiskAnalysisTemplateSingleAnswer => ({
        ...a,
        annotation: {
          ...getMockRiskAnalysisTemplateAnswerAnnotation(),
          docs: [getMockRiskAnalysisTemplateAnswerAnnotationDocument()],
        },
        suggestedValues: [],
      })
    ),
    multiAnswers: incompleteRiskAnalysisFormTemplate.multiAnswers.map(
      (a): RiskAnalysisTemplateMultiAnswer => ({
        ...a,
        annotation: {
          ...getMockRiskAnalysisTemplateAnswerAnnotation(),
          docs: [getMockRiskAnalysisTemplateAnswerAnnotationDocument()],
        },
      })
    ),
  };

  const purposeTemplate: PurposeTemplate = {
    ...getMockPurposeTemplate(),
    updatedAt: new Date(),
    purposeRiskAnalysisForm: riskAnalysisFormTemplate,
    purposeFreeOfChargeReason: "Free of charge reason",
    purposeDailyCalls: 100,
    state: purposeTemplateState.suspended,
    creatorId,
  };

  beforeAll(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date());
  });

  afterAll(() => {
    vi.useRealTimers();
  });

  it("should write on event-store for the unsuspending of a purpose template in suspended state", async () => {
    const metadataVersion = 2;
    await addOnePurposeTemplate(
      purposeTemplate,
      "PurposeTemplateSuspended",
      metadataVersion
    );

    const unsuspendResponse =
      await purposeTemplateService.unsuspendPurposeTemplate(
        purposeTemplate.id,
        getMockContext({ authData: getMockAuthData(creatorId) })
      );

    const updatedPurposeTemplate = unsuspendResponse.data;

    const writtenEvent = await readLastPurposeTemplateEvent(purposeTemplate.id);

    const expectedMetadataVersion = metadataVersion + 1;

    expect(writtenEvent).toMatchObject({
      stream_id: purposeTemplate.id,
      version: String(expectedMetadataVersion),
      type: "PurposeTemplateUnsuspended",
      event_version: 2,
    });

    const expectedPurposeTemplate: PurposeTemplate = {
      ...purposeTemplate,
      state: purposeTemplateState.active,
      updatedAt: new Date(),
    };

    const writtenPayload = decodeProtobufPayload({
      messageType: PurposeTemplateUnsuspendedV2,
      payload: writtenEvent.data,
    });

    expect(sortPurposeTemplate(writtenPayload.purposeTemplate)).toEqual(
      sortPurposeTemplate(toPurposeTemplateV2(expectedPurposeTemplate))
    );
    expect(unsuspendResponse).toMatchObject({
      data: updatedPurposeTemplate,
      metadata: { version: expectedMetadataVersion },
    });
  });

  it("should throw tenantNotAllowed if the caller is not the creator of the purpose template", async () => {
    await addOnePurposeTemplate(purposeTemplate, "PurposeTemplateSuspended");

    const otherTenantId = generateId<TenantId>();

    await expect(async () => {
      await purposeTemplateService.unsuspendPurposeTemplate(
        purposeTemplate.id,
        getMockContext({ authData: getMockAuthData(otherTenantId) })
      );
    }).rejects.toThrowError(tenantNotAllowed(otherTenantId));
  });

  it("should throw missingRiskAnalysisFormTemplate if the purpose template has no risk analysis template", async () => {
    const purposeTemplateWithoutRiskAnalysis: PurposeTemplate = {
      ...purposeTemplate,
      purposeRiskAnalysisForm: undefined,
    };

    await addOnePurposeTemplate(
      purposeTemplateWithoutRiskAnalysis,
      "PurposeTemplateSuspended"
    );

    await expect(async () => {
      await purposeTemplateService.unsuspendPurposeTemplate(
        purposeTemplateWithoutRiskAnalysis.id,
        getMockContext({ authData: getMockAuthData(creatorId) })
      );
    }).rejects.toThrowError(
      missingRiskAnalysisFormTemplate(purposeTemplateWithoutRiskAnalysis.id)
    );
  });

  it("should throw riskAnalysisTemplateValidationFailed if the purpose template has an invalid risk analysis template", async () => {
    const purposeTemplateWithInvalidRiskAnalysis: PurposeTemplate = {
      ...purposeTemplate,
      purposeRiskAnalysisForm: {
        id: generateId(),
        version: "3.0",
        singleAnswers: [
          {
            id: generateId(),
            key: "wrong-key",
            editable: true,
            suggestedValues: [],
          },
        ],
        multiAnswers: [],
      },
    };

    await addOnePurposeTemplate(
      purposeTemplateWithInvalidRiskAnalysis,
      "PurposeTemplateSuspended"
    );

    const result = validatePurposeTemplateRiskAnalysis(
      riskAnalysisFormTemplateToRiskAnalysisFormTemplateToValidate(
        purposeTemplateWithInvalidRiskAnalysis.purposeRiskAnalysisForm!
      ),
      purposeTemplateWithInvalidRiskAnalysis.targetTenantKind
    );

    await expect(async () => {
      await purposeTemplateService.unsuspendPurposeTemplate(
        purposeTemplateWithInvalidRiskAnalysis.id,
        getMockContext({ authData: getMockAuthData(creatorId) })
      );
    }).rejects.toThrowError(
      riskAnalysisTemplateValidationFailed(
        result.type === "invalid" ? result.issues : []
      )
    );
  });

  it.each([
    purposeTemplateState.active,
    purposeTemplateState.archived,
    purposeTemplateState.draft,
  ])(
    `should throw purposeTemplateNotInExpectedState if the purpose template is in %s state`,
    async (state) => {
      const purposeTemplateWithUnexpectedState: PurposeTemplate = {
        ...purposeTemplate,
        state,
      };

      await addOnePurposeTemplate(
        purposeTemplateWithUnexpectedState,
        "PurposeTemplateSuspended"
      );

      await expect(async () => {
        await purposeTemplateService.unsuspendPurposeTemplate(
          purposeTemplateWithUnexpectedState.id,
          getMockContext({ authData: getMockAuthData(creatorId) })
        );
      }).rejects.toThrowError(
        purposeTemplateNotInExpectedState(
          purposeTemplateWithUnexpectedState.id,
          state,
          purposeTemplateState.suspended
        )
      );
    }
  );
});
