/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/no-floating-promises */
import {
  decodeProtobufPayload,
  getMockContextM2MAdmin,
  getMockPurposeTemplate,
  getMockValidRiskAnalysisFormTemplate,
} from "pagopa-interop-commons-test";
import {
  generateId,
  tenantKind,
  PurposeTemplate,
  toPurposeTemplateV2,
  PurposeTemplateDraftUpdatedV2,
  purposeTemplateState,
  TenantId,
} from "pagopa-interop-models";
import { expect, describe, it, beforeAll, vi, afterAll } from "vitest";
import { purposeTemplateApi } from "pagopa-interop-api-clients";
import {
  addOnePurposeTemplate,
  purposeTemplateService,
  readLastPurposeTemplateEvent,
} from "../integrationUtils.js";
import {
  invalidFreeOfChargeReason,
  missingFreeOfChargeReason,
  purposeTemplateTitleConflict,
  purposeTemplateNotFound,
  purposeTemplateNotInExpectedStates,
  tenantNotAllowed,
} from "../../src/model/domain/errors.js";

describe("patch update purpose template", () => {
  const mockPurposeTemplate: PurposeTemplate = {
    ...getMockPurposeTemplate(),
    purposeRiskAnalysisForm: getMockValidRiskAnalysisFormTemplate(
      tenantKind.PA
    ),
  };

  beforeAll(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date());
  });
  afterAll(() => {
    vi.useRealTimers();
  });

  it.each([
    {}, // This should not throw an error and leave all fields unchanged
    { targetDescription: "updated target description" },
    {
      targetDescription: "updated target description",
      targetTenantKind: tenantKind.PRIVATE,
    },
    {
      targetDescription: "updated target description",
      targetTenantKind: tenantKind.PRIVATE,
      purposeTitle: "updated purpose title",
    },
    {
      targetDescription: "updated target description",
      targetTenantKind: tenantKind.PRIVATE,
      purposeTitle: "updated purpose title",
      purposeDescription: "updated purpose description",
    },
    {
      targetDescription: "updated target description",
      targetTenantKind: tenantKind.PRIVATE,
      purposeTitle: "updated purpose title",
      purposeDescription: "updated purpose description",
      purposeIsFreeOfCharge: false,
      purposeFreeOfChargeReason: null,
    },
    {
      targetDescription: "updated target description",
      targetTenantKind: tenantKind.PRIVATE,
      purposeTitle: "updated purpose title",
      purposeDescription: "updated purpose description",
      purposeIsFreeOfCharge: false,
      purposeFreeOfChargeReason: null,
      purposeDailyCalls: 10,
    },
    {
      targetDescription: "updated target description",
      targetTenantKind: tenantKind.PRIVATE,
      purposeTitle: "updated purpose title",
      purposeDescription: "updated purpose description",
      purposeIsFreeOfCharge: false,
      purposeFreeOfChargeReason: null,
      purposeDailyCalls: null,
      handlesPersonalData: true,
    },
  ] satisfies purposeTemplateApi.PatchUpdatePurposeTemplateSeed[])(
    "should write on event-store and update only the fields set in the seed, and leave undefined fields unchanged (seed #%#)",
    async (seed) => {
      const purposeTemplate: PurposeTemplate = {
        ...mockPurposeTemplate,
        targetDescription: "target description",
        targetTenantKind: tenantKind.PA,
        purposeTitle: "purpose title",
        purposeDescription: "purpose description",
        purposeIsFreeOfCharge: true,
        purposeFreeOfChargeReason: "free of charge reason",
        purposeDailyCalls: 1,
        handlesPersonalData: false,
      };

      await addOnePurposeTemplate(purposeTemplate);

      const updatePurposeTemplateReturn =
        await purposeTemplateService.patchUpdatePurposeTemplate(
          mockPurposeTemplate.id,
          seed,
          getMockContextM2MAdmin({
            organizationId: mockPurposeTemplate.creatorId,
          })
        );

      const expectedPurposeTemplate: PurposeTemplate = {
        ...purposeTemplate,
        targetDescription:
          seed.targetDescription ?? purposeTemplate.targetDescription,
        targetTenantKind:
          seed.targetTenantKind ?? purposeTemplate.targetTenantKind,
        purposeTitle: seed.purposeTitle ?? purposeTemplate.purposeTitle,
        purposeDescription:
          seed.purposeDescription ?? purposeTemplate.purposeDescription,
        purposeIsFreeOfCharge:
          seed.purposeIsFreeOfCharge ?? purposeTemplate.purposeIsFreeOfCharge,
        ...(seed.purposeIsFreeOfCharge === false && {
          purposeFreeOfChargeReason: undefined,
        }),
        purposeDailyCalls:
          seed.purposeDailyCalls ??
          (seed.purposeDailyCalls === null
            ? undefined
            : purposeTemplate.purposeDailyCalls),
        handlesPersonalData:
          seed.handlesPersonalData ?? purposeTemplate.handlesPersonalData,
        updatedAt: new Date(),
      };

      const writtenEvent = await readLastPurposeTemplateEvent(
        mockPurposeTemplate.id
      );

      expect(writtenEvent).toMatchObject({
        stream_id: mockPurposeTemplate.id,
        version: "1",
        type: "PurposeTemplateDraftUpdated",
        event_version: 2,
      });

      const writtenPayload = decodeProtobufPayload({
        messageType: PurposeTemplateDraftUpdatedV2,
        payload: writtenEvent.data,
      });

      expect(writtenPayload.purposeTemplate).toEqual(
        toPurposeTemplateV2(expectedPurposeTemplate)
      );
      expect(updatePurposeTemplateReturn).toEqual({
        data: expectedPurposeTemplate,
        metadata: { version: 1 },
      });
    }
  );

  it("should throw purposeTemplateNotFound if the purpose template doesn't exist", async () => {
    expect(
      purposeTemplateService.patchUpdatePurposeTemplate(
        mockPurposeTemplate.id,
        {},
        getMockContextM2MAdmin({
          organizationId: mockPurposeTemplate.creatorId,
        })
      )
    ).rejects.toThrowError(purposeTemplateNotFound(mockPurposeTemplate.id));
  });

  it("should throw tenantNotAllowed if the requester is not the creator", async () => {
    const requesterId = generateId<TenantId>();

    await addOnePurposeTemplate(mockPurposeTemplate);
    expect(
      purposeTemplateService.patchUpdatePurposeTemplate(
        mockPurposeTemplate.id,
        {},
        getMockContextM2MAdmin({ organizationId: requesterId })
      )
    ).rejects.toThrowError(tenantNotAllowed(requesterId));
  });

  it("should throw purposeTemplateTitleConflict if the updated title is already in use", async () => {
    const title = "title already in use";

    const purposeTemplate1: PurposeTemplate = {
      ...mockPurposeTemplate,
      id: generateId(),
    };

    const purposeTemplate2: PurposeTemplate = {
      ...mockPurposeTemplate,
      id: generateId(),
      purposeTitle: title,
      purposeRiskAnalysisForm: getMockValidRiskAnalysisFormTemplate(
        tenantKind.PA
      ),
    };
    await addOnePurposeTemplate(purposeTemplate1);
    await addOnePurposeTemplate(purposeTemplate2);

    expect(
      purposeTemplateService.patchUpdatePurposeTemplate(
        purposeTemplate1.id,
        {
          purposeTitle: title,
        },
        getMockContextM2MAdmin({ organizationId: purposeTemplate1.creatorId })
      )
    ).rejects.toThrowError(
      purposeTemplateTitleConflict([purposeTemplate2.id], title)
    );
  });

  it.each(
    Object.values(purposeTemplateState).filter(
      (state) => state !== purposeTemplateState.draft
    )
  )(
    "should throw purposeTemplateNotInExpectedStates if the purpose template is in %s state",
    async (state) => {
      const purposeTemplate: PurposeTemplate = {
        ...mockPurposeTemplate,
        state,
      };
      await addOnePurposeTemplate(purposeTemplate);

      expect(
        purposeTemplateService.patchUpdatePurposeTemplate(
          purposeTemplate.id,
          {},
          getMockContextM2MAdmin({ organizationId: purposeTemplate.creatorId })
        )
      ).rejects.toThrowError(
        purposeTemplateNotInExpectedStates(
          purposeTemplate.id,
          purposeTemplate.state,
          [purposeTemplateState.draft]
        )
      );
    }
  );

  it("should throw missingFreeOfChargeReason if purposeFreeOfChargerReason is missing and purposeIsFreeOfCharge is true", async () => {
    const purposeTemplate: PurposeTemplate = {
      ...mockPurposeTemplate,
      purposeIsFreeOfCharge: false,
    };
    await addOnePurposeTemplate(purposeTemplate);

    expect(
      purposeTemplateService.patchUpdatePurposeTemplate(
        mockPurposeTemplate.id,
        {
          purposeIsFreeOfCharge: true,
        },
        getMockContextM2MAdmin({ organizationId: purposeTemplate.creatorId })
      )
    ).rejects.toThrowError(missingFreeOfChargeReason());
  });

  it.each([{ freeOfChargeReason: "Some reason" }, { freeOfChargeReason: "" }])(
    "should throw invalidFreeOfChargeReason if purposeFreeOfChargerReason is defined and purposeIsFreeOfCharge is false",
    async ({ freeOfChargeReason }) => {
      const purposeTemplate: PurposeTemplate = {
        ...mockPurposeTemplate,
        purposeIsFreeOfCharge: true,
        purposeFreeOfChargeReason: "Some reason",
      };

      await addOnePurposeTemplate(purposeTemplate);

      const isFreeOfCharge = false;
      expect(
        purposeTemplateService.patchUpdatePurposeTemplate(
          purposeTemplate.id,
          {
            purposeIsFreeOfCharge: isFreeOfCharge,
            purposeFreeOfChargeReason: freeOfChargeReason,
          },
          getMockContextM2MAdmin({
            organizationId: purposeTemplate.creatorId,
          })
        )
      ).rejects.toThrowError(
        invalidFreeOfChargeReason(isFreeOfCharge, freeOfChargeReason)
      );
    }
  );
});
