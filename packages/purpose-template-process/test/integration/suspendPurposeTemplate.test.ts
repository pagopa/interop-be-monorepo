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
  PurposeTemplateSuspendedV2,
  toPurposeTemplateV2,
} from "pagopa-interop-models";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
  addOnePurposeTemplate,
  purposeTemplateService,
  readLastPurposeTemplateEvent,
} from "../integrationUtils.js";
import {
  purposeTemplateNotInExpectedStates,
  purposeTemplateStateConflict,
  tenantNotAllowed,
} from "../../src/model/domain/errors.js";

describe("suspendPurposeTemplate", () => {
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
    state: purposeTemplateState.active,
    creatorId,
  };

  beforeAll(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date());
  });

  afterAll(() => {
    vi.useRealTimers();
  });

  it("should write on event-store for the suspending of a purpose template in active state", async () => {
    const metadataVersion = 1;
    await addOnePurposeTemplate(purposeTemplate, metadataVersion);

    const suspendResponse = await purposeTemplateService.suspendPurposeTemplate(
      purposeTemplate.id,
      getMockContext({ authData: getMockAuthData(creatorId) })
    );

    const updatedPurposeTemplate = suspendResponse.data;

    const writtenEvent = await readLastPurposeTemplateEvent(purposeTemplate.id);

    const expectedMetadataVersion = metadataVersion + 1;

    expect(writtenEvent).toMatchObject({
      stream_id: purposeTemplate.id,
      version: String(expectedMetadataVersion),
      type: "PurposeTemplateSuspended",
      event_version: 2,
    });

    const expectedPurposeTemplate: PurposeTemplate = {
      ...purposeTemplate,
      state: purposeTemplateState.suspended,
      updatedAt: new Date(),
    };

    const writtenPayload = decodeProtobufPayload({
      messageType: PurposeTemplateSuspendedV2,
      payload: writtenEvent.data,
    });

    expect(sortPurposeTemplate(writtenPayload.purposeTemplate)).toEqual(
      sortPurposeTemplate(toPurposeTemplateV2(expectedPurposeTemplate))
    );
    expect(suspendResponse).toMatchObject({
      data: updatedPurposeTemplate,
      metadata: { version: expectedMetadataVersion },
    });
  });

  it("should throw tenantNotAllowed if the caller is not the creator of the purpose template", async () => {
    await addOnePurposeTemplate(purposeTemplate);

    const otherTenantId = generateId<TenantId>();

    await expect(async () => {
      await purposeTemplateService.suspendPurposeTemplate(
        purposeTemplate.id,
        getMockContext({ authData: getMockAuthData(otherTenantId) })
      );
    }).rejects.toThrowError(tenantNotAllowed(otherTenantId));
  });

  it.each([
    {
      error: purposeTemplateStateConflict(
        purposeTemplate.id,
        purposeTemplateState.suspended
      ),
      state: purposeTemplateState.suspended,
    },
    {
      error: purposeTemplateNotInExpectedStates(
        purposeTemplate.id,
        purposeTemplateState.archived,
        [purposeTemplateState.active]
      ),
      state: purposeTemplateState.archived,
    },
    {
      error: purposeTemplateNotInExpectedStates(
        purposeTemplate.id,
        purposeTemplateState.draft,
        [purposeTemplateState.active]
      ),
      state: purposeTemplateState.draft,
    },
  ])(
    `should throw $error.code if the purpose template is in %s state`,
    async ({ error, state }) => {
      const purposeTemplateWithUnexpectedState: PurposeTemplate = {
        ...purposeTemplate,
        state,
      };

      await addOnePurposeTemplate(purposeTemplateWithUnexpectedState);

      await expect(async () => {
        await purposeTemplateService.suspendPurposeTemplate(
          purposeTemplateWithUnexpectedState.id,
          getMockContext({ authData: getMockAuthData(creatorId) })
        );
      }).rejects.toThrowError(error);
    }
  );
});
