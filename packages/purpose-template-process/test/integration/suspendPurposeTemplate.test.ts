/* eslint-disable @typescript-eslint/no-non-null-assertion */
import {
  decodeProtobufPayload,
  getMockAuthData,
  getMockCompleteRiskAnalysisFormTemplate,
  getMockContext,
  getMockPurposeTemplate,
  sortPurposeTemplate,
} from "pagopa-interop-commons-test";
import {
  generateId,
  TenantId,
  PurposeTemplate,
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
  purposeTemplateNotFound,
  purposeTemplateNotInExpectedStates,
  purposeTemplateStateConflict,
} from "../../src/model/domain/errors.js";

describe("suspendPurposeTemplate", () => {
  const creatorId = generateId<TenantId>();
  const riskAnalysisFormTemplate = getMockCompleteRiskAnalysisFormTemplate();

  const purposeTemplate: PurposeTemplate = {
    ...getMockPurposeTemplate(),
    updatedAt: new Date(),
    purposeRiskAnalysisForm: riskAnalysisFormTemplate,
    purposeFreeOfChargeReason: "Free of charge reason",
    purposeDailyCalls: 100,
    state: purposeTemplateState.published,
    creatorId,
  };

  beforeAll(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date());
  });

  afterAll(() => {
    vi.useRealTimers();
  });

  it("should write on event-store for the suspending of a purpose template in published state", async () => {
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

  it("should throw purposeTemplateNotFound if the caller is not the creator of the purpose template", async () => {
    await addOnePurposeTemplate(purposeTemplate);

    const otherTenantId = generateId<TenantId>();

    await expect(async () => {
      await purposeTemplateService.suspendPurposeTemplate(
        purposeTemplate.id,
        getMockContext({ authData: getMockAuthData(otherTenantId) })
      );
    }).rejects.toThrowError(purposeTemplateNotFound(purposeTemplate.id));
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
        [purposeTemplateState.published]
      ),
      state: purposeTemplateState.archived,
    },
    {
      error: purposeTemplateNotInExpectedStates(
        purposeTemplate.id,
        purposeTemplateState.draft,
        [purposeTemplateState.published]
      ),
      state: purposeTemplateState.draft,
    },
  ])(
    `should throw $error.code if the purpose template is in $state state`,
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
