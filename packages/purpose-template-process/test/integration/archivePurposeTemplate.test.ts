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
  toPurposeTemplateV2,
  PurposeTemplateArchivedV2,
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
import { archivableInitialStates } from "../../src/services/validators.js";

describe("archivePurposeTemplate", () => {
  const creatorId = generateId<TenantId>();
  const riskAnalysisFormTemplate = getMockCompleteRiskAnalysisFormTemplate();

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

  it.each(archivableInitialStates)(
    "should write on event-store for the archiving of a purpose template in %s state",
    async (state) => {
      const metadataVersion = 1;
      await addOnePurposeTemplate(
        { ...purposeTemplate, state },
        metadataVersion
      );

      const archiveResponse =
        await purposeTemplateService.archivePurposeTemplate(
          purposeTemplate.id,
          getMockContext({ authData: getMockAuthData(creatorId) })
        );

      const updatedPurposeTemplate = archiveResponse.data;

      const writtenEvent = await readLastPurposeTemplateEvent(
        purposeTemplate.id
      );

      const expectedMetadataVersion = metadataVersion + 1;

      expect(writtenEvent).toMatchObject({
        stream_id: purposeTemplate.id,
        version: String(expectedMetadataVersion),
        type: "PurposeTemplateArchived",
        event_version: 2,
      });

      const expectedPurposeTemplate: PurposeTemplate = {
        ...purposeTemplate,
        state: purposeTemplateState.archived,
        updatedAt: new Date(),
      };

      const writtenPayload = decodeProtobufPayload({
        messageType: PurposeTemplateArchivedV2,
        payload: writtenEvent.data,
      });

      expect(sortPurposeTemplate(writtenPayload.purposeTemplate)).toEqual(
        sortPurposeTemplate(toPurposeTemplateV2(expectedPurposeTemplate))
      );
      expect(archiveResponse).toMatchObject({
        data: updatedPurposeTemplate,
        metadata: { version: expectedMetadataVersion },
      });
    }
  );

  it("should throw tenantNotAllowed if the caller is not the creator of the purpose template", async () => {
    await addOnePurposeTemplate(purposeTemplate);

    const otherTenantId = generateId<TenantId>();

    await expect(async () => {
      await purposeTemplateService.archivePurposeTemplate(
        purposeTemplate.id,
        getMockContext({ authData: getMockAuthData(otherTenantId) })
      );
    }).rejects.toThrowError(tenantNotAllowed(otherTenantId));
  });

  it.each([
    {
      error: purposeTemplateStateConflict(
        purposeTemplate.id,
        purposeTemplateState.archived
      ),
      state: purposeTemplateState.archived,
    },
    {
      error: purposeTemplateNotInExpectedStates(
        purposeTemplate.id,
        purposeTemplateState.draft,
        archivableInitialStates
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
        await purposeTemplateService.archivePurposeTemplate(
          purposeTemplateWithUnexpectedState.id,
          getMockContext({ authData: getMockAuthData(creatorId) })
        );
      }).rejects.toThrowError(error);
    }
  );
});
