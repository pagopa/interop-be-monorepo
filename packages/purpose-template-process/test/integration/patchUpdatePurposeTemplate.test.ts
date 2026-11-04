/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/no-floating-promises */
import { purposeTemplateApi } from "pagopa-interop-api-clients";
import {
  decodeProtobufPayload,
  getMockContextM2MAdmin,
  getMockPurposeTemplate,
  getMockValidRiskAnalysisFormTemplate,
  writeInEventstore,
} from "pagopa-interop-commons-test";
import {
  generateId,
  tenantKind,
  eventConflictError,
  PurposeTemplate,
  toPurposeTemplateV2,
  PurposeTemplateDraftUpdatedV2,
  PurposeTemplateEvent,
  PurposeTemplatePurposeTitleUpdatedV2,
  PurposeTemplatePurposeDescriptionUpdatedV2,
  PurposeTemplateTargetDescriptionUpdatedV2,
  purposeTemplateState,
  TenantId,
} from "pagopa-interop-models";
import { expect, describe, it, beforeAll, vi, afterAll } from "vitest";

import {
  invalidFreeOfChargeReason,
  missingFreeOfChargeReason,
  purposeTemplateTitleConflict,
  purposeTemplateNotFound,
  purposeTemplateNotInExpectedStates,
} from "../../src/model/domain/errors.js";
import {
  addOnePurposeTemplate,
  purposeTemplateService,
  readLastPurposeTemplateEvent,
  postgresDB,
} from "../integrationUtils.js";

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

      expect(writtenPayload).toEqual({
        purposeTemplate: toPurposeTemplateV2(expectedPurposeTemplate),
      });
      expect(updatePurposeTemplateReturn).toEqual({
        data: expectedPurposeTemplate,
        metadata: { version: 1 },
      });
    }
  );

  const oldFreeOfChargeReason = "Some reason";
  const newFreeOfChargeReason = "New reason";
  const successFreeOfChargeTestCases: Array<
    [
      Pick<
        PurposeTemplate,
        "purposeIsFreeOfCharge" | "purposeFreeOfChargeReason"
      >,
      Pick<
        purposeTemplateApi.PatchUpdatePurposeTemplateSeed,
        "purposeIsFreeOfCharge" | "purposeFreeOfChargeReason"
      >,
      Pick<
        PurposeTemplate,
        "purposeIsFreeOfCharge" | "purposeFreeOfChargeReason"
      >,
    ]
  > = [
    [
      {
        purposeIsFreeOfCharge: true,
        purposeFreeOfChargeReason: oldFreeOfChargeReason,
      },
      {
        purposeIsFreeOfCharge: true,
        purposeFreeOfChargeReason: newFreeOfChargeReason,
      },
      {
        purposeIsFreeOfCharge: true,
        purposeFreeOfChargeReason: newFreeOfChargeReason,
      },
    ],
    [
      {
        purposeIsFreeOfCharge: true,
        purposeFreeOfChargeReason: oldFreeOfChargeReason,
      },
      { purposeIsFreeOfCharge: true },
      {
        purposeIsFreeOfCharge: true,
        purposeFreeOfChargeReason: oldFreeOfChargeReason,
      },
    ],
    [
      {
        purposeIsFreeOfCharge: true,
        purposeFreeOfChargeReason: oldFreeOfChargeReason,
      },
      { purposeIsFreeOfCharge: false },
      { purposeIsFreeOfCharge: false, purposeFreeOfChargeReason: undefined },
    ],
    [
      {
        purposeIsFreeOfCharge: true,
        purposeFreeOfChargeReason: oldFreeOfChargeReason,
      },
      { purposeIsFreeOfCharge: false, purposeFreeOfChargeReason: "" },
      { purposeIsFreeOfCharge: false, purposeFreeOfChargeReason: undefined },
    ],
    [
      {
        purposeIsFreeOfCharge: true,
        purposeFreeOfChargeReason: oldFreeOfChargeReason,
      },
      { purposeFreeOfChargeReason: newFreeOfChargeReason },
      {
        purposeIsFreeOfCharge: true,
        purposeFreeOfChargeReason: newFreeOfChargeReason,
      },
    ],
    [
      {
        purposeIsFreeOfCharge: true,
        purposeFreeOfChargeReason: oldFreeOfChargeReason,
      },
      {
        purposeIsFreeOfCharge: undefined,
        purposeFreeOfChargeReason: undefined,
      },
      {
        purposeIsFreeOfCharge: true,
        purposeFreeOfChargeReason: oldFreeOfChargeReason,
      },
    ],
    [
      {
        purposeIsFreeOfCharge: true,
        purposeFreeOfChargeReason: oldFreeOfChargeReason,
      },
      {
        purposeIsFreeOfCharge: false,
        purposeFreeOfChargeReason: null,
      },
      {
        purposeIsFreeOfCharge: false,
        purposeFreeOfChargeReason: undefined,
      },
    ],
    [
      { purposeIsFreeOfCharge: false, purposeFreeOfChargeReason: undefined },
      {
        purposeIsFreeOfCharge: true,
        purposeFreeOfChargeReason: newFreeOfChargeReason,
      },
      {
        purposeIsFreeOfCharge: true,
        purposeFreeOfChargeReason: newFreeOfChargeReason,
      },
    ],
    [
      { purposeIsFreeOfCharge: false, purposeFreeOfChargeReason: undefined },
      { purposeIsFreeOfCharge: false },
      { purposeIsFreeOfCharge: false, purposeFreeOfChargeReason: undefined },
    ],
    [
      {
        purposeIsFreeOfCharge: false,
        purposeFreeOfChargeReason: undefined,
      },
      {
        purposeIsFreeOfCharge: undefined,
        purposeFreeOfChargeReason: undefined,
      },
      {
        purposeIsFreeOfCharge: false,
        purposeFreeOfChargeReason: undefined,
      },
    ],
    [
      {
        purposeIsFreeOfCharge: false,
        purposeFreeOfChargeReason: undefined,
      },
      {
        purposeIsFreeOfCharge: false,
        purposeFreeOfChargeReason: null,
      },
      {
        purposeIsFreeOfCharge: false,
        purposeFreeOfChargeReason: undefined,
      },
    ],
    [
      {
        purposeIsFreeOfCharge: false,
        purposeFreeOfChargeReason: undefined,
      },
      {
        purposeIsFreeOfCharge: false,
        purposeFreeOfChargeReason: "",
      },
      {
        purposeIsFreeOfCharge: false,
        purposeFreeOfChargeReason: undefined,
      },
    ],
    [
      {
        purposeIsFreeOfCharge: false,
        purposeFreeOfChargeReason: undefined,
      },
      {
        purposeFreeOfChargeReason: null,
      },
      {
        purposeIsFreeOfCharge: false,
        purposeFreeOfChargeReason: undefined,
      },
    ],
    [
      {
        purposeIsFreeOfCharge: false,
        purposeFreeOfChargeReason: undefined,
      },
      {
        purposeFreeOfChargeReason: "",
      },
      {
        purposeIsFreeOfCharge: false,
        purposeFreeOfChargeReason: undefined,
      },
    ],
    [
      {
        purposeIsFreeOfCharge: false,
        purposeFreeOfChargeReason: oldFreeOfChargeReason,
      },
      { purposeIsFreeOfCharge: false },
      { purposeIsFreeOfCharge: false, purposeFreeOfChargeReason: undefined },
    ],
    [
      {
        purposeIsFreeOfCharge: false,
        purposeFreeOfChargeReason: oldFreeOfChargeReason,
      },
      {
        purposeIsFreeOfCharge: true,
        purposeFreeOfChargeReason: newFreeOfChargeReason,
      },
      {
        purposeIsFreeOfCharge: true,
        purposeFreeOfChargeReason: newFreeOfChargeReason,
      },
    ],
    [
      {
        purposeIsFreeOfCharge: false,
        purposeFreeOfChargeReason: oldFreeOfChargeReason,
      },
      {
        purposeIsFreeOfCharge: undefined,
        purposeFreeOfChargeReason: undefined,
      },
      { purposeIsFreeOfCharge: false, purposeFreeOfChargeReason: undefined },
    ],
    [
      {
        purposeIsFreeOfCharge: false,
        purposeFreeOfChargeReason: oldFreeOfChargeReason,
      },
      {
        purposeIsFreeOfCharge: false,
        purposeFreeOfChargeReason: null,
      },
      { purposeIsFreeOfCharge: false, purposeFreeOfChargeReason: undefined },
    ],
    [
      {
        purposeIsFreeOfCharge: false,
        purposeFreeOfChargeReason: oldFreeOfChargeReason,
      },
      {
        purposeFreeOfChargeReason: null,
      },
      { purposeIsFreeOfCharge: false, purposeFreeOfChargeReason: undefined },
    ],
    [
      {
        purposeIsFreeOfCharge: false,
        purposeFreeOfChargeReason: oldFreeOfChargeReason,
      },
      {
        purposeFreeOfChargeReason: "",
      },
      { purposeIsFreeOfCharge: false, purposeFreeOfChargeReason: undefined },
    ],
  ];
  it.each(successFreeOfChargeTestCases)(
    "should successfully update purposeIsFreeOfCharge and purposeFreeOfChargeReason (seed #%#)",
    async (initData, seed, expected) => {
      const cleanedSeed = Object.fromEntries(
        Object.entries({
          ...seed,
        }).filter(([_, v]) => v !== undefined)
      ) as purposeTemplateApi.PatchUpdatePurposeTemplateSeed;

      const purposeTemplate: PurposeTemplate = {
        ...mockPurposeTemplate,
        purposeIsFreeOfCharge: initData.purposeIsFreeOfCharge,
        purposeFreeOfChargeReason: initData.purposeFreeOfChargeReason,
      };

      await addOnePurposeTemplate(purposeTemplate);

      const patchPurposeTemplateResult =
        await purposeTemplateService.patchUpdatePurposeTemplate(
          mockPurposeTemplate.id,
          cleanedSeed,
          getMockContextM2MAdmin({
            organizationId: mockPurposeTemplate.creatorId,
          })
        );

      const expectedPurposeTemplate: PurposeTemplate = {
        ...purposeTemplate,
        purposeIsFreeOfCharge: expected.purposeIsFreeOfCharge,
        purposeFreeOfChargeReason: expected.purposeFreeOfChargeReason,
        updatedAt: new Date(),
      };

      expect(patchPurposeTemplateResult).toEqual({
        data: expectedPurposeTemplate,
        metadata: { version: 1 },
      });
    }
  );

  const failureFreeOfChargeTestCases: Array<
    [
      Pick<
        PurposeTemplate,
        "purposeIsFreeOfCharge" | "purposeFreeOfChargeReason"
      >,
      Pick<
        purposeTemplateApi.PatchUpdatePurposeTemplateSeed,
        "purposeIsFreeOfCharge" | "purposeFreeOfChargeReason"
      >,
      Pick<
        PurposeTemplate,
        "purposeIsFreeOfCharge" | "purposeFreeOfChargeReason"
      >,
    ]
  > = [
    [
      {
        purposeIsFreeOfCharge: true,
        purposeFreeOfChargeReason: oldFreeOfChargeReason,
      },
      {
        purposeIsFreeOfCharge: false,
        purposeFreeOfChargeReason: newFreeOfChargeReason,
      },
      {
        purposeIsFreeOfCharge: false,
        purposeFreeOfChargeReason: newFreeOfChargeReason,
      },
    ],
    [
      { purposeIsFreeOfCharge: false, purposeFreeOfChargeReason: undefined },
      {
        purposeIsFreeOfCharge: false,
        purposeFreeOfChargeReason: newFreeOfChargeReason,
      },
      {
        purposeIsFreeOfCharge: false,
        purposeFreeOfChargeReason: newFreeOfChargeReason,
      },
    ],
    [
      { purposeIsFreeOfCharge: false, purposeFreeOfChargeReason: undefined },
      { purposeFreeOfChargeReason: newFreeOfChargeReason },
      {
        purposeIsFreeOfCharge: false,
        purposeFreeOfChargeReason: newFreeOfChargeReason,
      },
    ],
  ];
  it.each(failureFreeOfChargeTestCases)(
    "should throw invalidFreeOfChargeReason (seed #%#)",
    async (initData, seed, wrongUpdatedData) => {
      const purposeTemplate: PurposeTemplate = {
        ...mockPurposeTemplate,
        purposeIsFreeOfCharge: initData.purposeIsFreeOfCharge,
        purposeFreeOfChargeReason: initData.purposeFreeOfChargeReason,
      };

      await addOnePurposeTemplate(purposeTemplate);

      expect(
        purposeTemplateService.patchUpdatePurposeTemplate(
          mockPurposeTemplate.id,
          seed,
          getMockContextM2MAdmin({
            organizationId: mockPurposeTemplate.creatorId,
          })
        )
      ).rejects.toThrowError(
        invalidFreeOfChargeReason(
          wrongUpdatedData.purposeIsFreeOfCharge,
          wrongUpdatedData.purposeFreeOfChargeReason
        )
      );
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

  it("should throw purposeTemplateNotFound if the requester is not the creator", async () => {
    const requesterId = generateId<TenantId>();

    await addOnePurposeTemplate(mockPurposeTemplate);
    expect(
      purposeTemplateService.patchUpdatePurposeTemplate(
        mockPurposeTemplate.id,
        {},
        getMockContextM2MAdmin({ organizationId: requesterId })
      )
    ).rejects.toThrowError(purposeTemplateNotFound(mockPurposeTemplate.id));
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

  it.each([
    { purposeFreeOfChargeReason: null },
    { purposeFreeOfChargeReason: "" },
    { purposeIsFreeOfCharge: true, purposeFreeOfChargeReason: null },
    { purposeIsFreeOfCharge: true, purposeFreeOfChargeReason: "" },
  ] satisfies purposeTemplateApi.PatchUpdatePurposeTemplateSeed[])(
    `Should throw missingFreeOfChargeReason if purposeIsFreeOfCharge is set to true
    and purposeFreeOfChargeReason is set to not be present anymore (seed #%#)`,
    async (seed) => {
      const purposeTemplate: PurposeTemplate = {
        ...mockPurposeTemplate,
        purposeIsFreeOfCharge: true,
        purposeFreeOfChargeReason: "Some reason",
      };
      await addOnePurposeTemplate(purposeTemplate);

      expect(
        purposeTemplateService.patchUpdatePurposeTemplate(
          mockPurposeTemplate.id,
          seed,
          getMockContextM2MAdmin({ organizationId: purposeTemplate.creatorId })
        )
      ).rejects.toThrowError(missingFreeOfChargeReason());
    }
  );

  describe.each(Object.values(purposeTemplateState))(
    "metadata updates in %s",
    (state) => {
      const metadataUpdates = [
        {
          seed: { purposeTitle: "Updated purpose title" },
          type: "PurposeTemplatePurposeTitleUpdated",
          messageType: PurposeTemplatePurposeTitleUpdatedV2,
        },
        {
          seed: { purposeDescription: "Updated purpose description" },
          type: "PurposeTemplatePurposeDescriptionUpdated",
          messageType: PurposeTemplatePurposeDescriptionUpdatedV2,
        },
        {
          seed: { targetDescription: "Updated target description" },
          type: "PurposeTemplateTargetDescriptionUpdated",
          messageType: PurposeTemplateTargetDescriptionUpdatedV2,
        },
      ] as const;

      it.each(metadataUpdates)(
        "should emit the state-appropriate event without changing operational fields or documents",
        async ({ seed, type, messageType }) => {
          const purposeTemplate = {
            ...mockPurposeTemplate,
            state,
            updatedAt: new Date("2025-01-01"),
          };
          await addOnePurposeTemplate(purposeTemplate, 5);
          const ctx = getMockContextM2MAdmin({
            organizationId: purposeTemplate.creatorId,
          });
          const result =
            await purposeTemplateService.patchUpdatePurposeTemplate(
              purposeTemplate.id,
              seed,
              ctx
            );
          const expectedEventType =
            state === purposeTemplateState.draft
              ? "PurposeTemplateDraftUpdated"
              : type;
          const expectedMessageType =
            state === purposeTemplateState.draft
              ? PurposeTemplateDraftUpdatedV2
              : messageType;
          const expected = {
            ...purposeTemplate,
            ...seed,
            updatedAt: new Date(),
          };
          expect(result).toEqual({
            data: expected,
            metadata: { version: 6 },
          });
          const event = await readLastPurposeTemplateEvent(purposeTemplate.id);
          expect(event).toMatchObject({
            type: expectedEventType,
            version: "6",
            event_version: 2,
          });
          expect(
            decodeProtobufPayload({
              messageType: expectedMessageType,
              payload: event.data,
            })
          ).toEqual({ purposeTemplate: toPurposeTemplateV2(expected) });
        }
      );

      it("should persist all changed metadata atomically with consecutive versions and the same correlation id", async () => {
        const purposeTemplate = { ...mockPurposeTemplate, state };
        await addOnePurposeTemplate(purposeTemplate, 5);
        const ctx = getMockContextM2MAdmin({
          organizationId: purposeTemplate.creatorId,
        });
        const seed = {
          purposeTitle: "Updated purpose title",
          purposeDescription: "Updated purpose description",
          targetDescription: "Updated target description",
        };
        const result = await purposeTemplateService.patchUpdatePurposeTemplate(
          purposeTemplate.id,
          seed,
          ctx
        );
        const isDraft = state === purposeTemplateState.draft;
        const expectedEvents = isDraft
          ? [
              {
                type: "PurposeTemplateDraftUpdated",
                messageType: PurposeTemplateDraftUpdatedV2,
              },
            ]
          : metadataUpdates;
        expect(result).toEqual({
          data: { ...purposeTemplate, ...seed, updatedAt: new Date() },
          metadata: { version: isDraft ? 6 : 8 },
        });
        const events = await postgresDB.many<{
          type: PurposeTemplateEvent["type"];
          version: string;
          correlation_id: string;
          data: Uint8Array;
        }>(
          "SELECT type, version, correlation_id, data FROM purpose_template.events WHERE stream_id = $1 AND version > 5 ORDER BY version",
          [purposeTemplate.id]
        );
        expect(events).toHaveLength(expectedEvents.length);
        for (const [index, update] of expectedEvents.entries()) {
          expect(events[index]).toMatchObject({
            type: update.type,
            version: (6 + index).toString(),
            correlation_id: ctx.correlationId,
          });
          expect(
            decodeProtobufPayload({
              messageType: update.messageType,
              payload: events[index].data,
            })
          ).toEqual({ purposeTemplate: toPurposeTemplateV2(result.data) });
        }
      });

      it("should write events and advance the version when supplied metadata is unchanged", async () => {
        const purposeTemplate = {
          ...mockPurposeTemplate,
          state,
          updatedAt: new Date("2025-01-01"),
        };
        await addOnePurposeTemplate(purposeTemplate, 5);
        const result = await purposeTemplateService.patchUpdatePurposeTemplate(
          purposeTemplate.id,
          {
            purposeTitle: purposeTemplate.purposeTitle,
            purposeDescription: purposeTemplate.purposeDescription,
            targetDescription: purposeTemplate.targetDescription,
          },
          getMockContextM2MAdmin({
            organizationId: purposeTemplate.creatorId,
          })
        );
        expect(result).toEqual({
          data: { ...purposeTemplate, updatedAt: new Date() },
          metadata: { version: state === purposeTemplateState.draft ? 6 : 8 },
        });
        expect(
          await readLastPurposeTemplateEvent(purposeTemplate.id)
        ).toMatchObject({
          type:
            state === purposeTemplateState.draft
              ? "PurposeTemplateDraftUpdated"
              : "PurposeTemplateTargetDescriptionUpdated",
          version: state === purposeTemplateState.draft ? "6" : "8",
        });
      });

      it("should reject a metadata update from another creator without writing events", async () => {
        const purposeTemplate = { ...mockPurposeTemplate, state };
        await addOnePurposeTemplate(purposeTemplate);
        await expect(
          purposeTemplateService.patchUpdatePurposeTemplate(
            purposeTemplate.id,
            { purposeTitle: purposeTemplate.purposeTitle },
            getMockContextM2MAdmin({ organizationId: generateId<TenantId>() })
          )
        ).rejects.toThrowError(purposeTemplateNotFound(purposeTemplate.id));
        expect(
          await readLastPurposeTemplateEvent(purposeTemplate.id)
        ).toMatchObject({ type: "PurposeTemplateAdded", version: "0" });
      });

      if (state !== purposeTemplateState.draft) {
        it.each([
          { targetTenantKind: tenantKind.PRIVATE },
          { purposeDailyCalls: null },
          { purposeIsFreeOfCharge: false },
          { purposeFreeOfChargeReason: null },
          { handlesPersonalData: false },
        ] satisfies purposeTemplateApi.PatchUpdatePurposeTemplateSeed[])(
          "should reject mixed updates atomically even if the operational value is unchanged (seed %#)",
          async (operationalSeed) => {
            const purposeTemplate = { ...mockPurposeTemplate, state };
            await addOnePurposeTemplate(purposeTemplate);
            await expect(
              purposeTemplateService.patchUpdatePurposeTemplate(
                purposeTemplate.id,
                {
                  purposeTitle: "Updated purpose title",
                  ...operationalSeed,
                },
                getMockContextM2MAdmin({
                  organizationId: purposeTemplate.creatorId,
                })
              )
            ).rejects.toThrowError(
              purposeTemplateNotInExpectedStates(purposeTemplate.id, state, [
                purposeTemplateState.draft,
              ])
            );
            expect(
              await readLastPurposeTemplateEvent(purposeTemplate.id)
            ).toMatchObject({ type: "PurposeTemplateAdded", version: "0" });
          }
        );
      }
    }
  );

  it("should emit one Draft event when metadata changes and operational values are unchanged", async () => {
    await addOnePurposeTemplate({
      ...mockPurposeTemplate,
      updatedAt: new Date("2025-01-01"),
    });
    const result = await purposeTemplateService.patchUpdatePurposeTemplate(
      mockPurposeTemplate.id,
      {
        purposeTitle: "Updated purpose title",
        purposeDescription: mockPurposeTemplate.purposeDescription,
        handlesPersonalData: mockPurposeTemplate.handlesPersonalData,
      },
      getMockContextM2MAdmin({
        organizationId: mockPurposeTemplate.creatorId,
      })
    );
    expect(result.metadata.version).toBe(1);
    expect(
      await readLastPurposeTemplateEvent(mockPurposeTemplate.id)
    ).toMatchObject({
      type: "PurposeTemplateDraftUpdated",
      version: "1",
    });
  });

  it.each([undefined, new Date("2025-01-01")])(
    "should emit a Draft event and update updatedAt from %s for unchanged operational values",
    async (updatedAt) => {
      const purposeTemplate = {
        ...mockPurposeTemplate,
        purposeIsFreeOfCharge: false,
        purposeFreeOfChargeReason: undefined,
        purposeDailyCalls: undefined,
        updatedAt,
      };
      await addOnePurposeTemplate(purposeTemplate, 5);
      const result = await purposeTemplateService.patchUpdatePurposeTemplate(
        purposeTemplate.id,
        {
          purposeTitle: purposeTemplate.purposeTitle,
          purposeIsFreeOfCharge: false,
          purposeFreeOfChargeReason: null,
          purposeDailyCalls: null,
        },
        getMockContextM2MAdmin({
          organizationId: purposeTemplate.creatorId,
        })
      );
      expect(result).toEqual({
        data: { ...purposeTemplate, updatedAt: new Date() },
        metadata: { version: 6 },
      });
      expect(
        await readLastPurposeTemplateEvent(purposeTemplate.id)
      ).toMatchObject({ type: "PurposeTemplateDraftUpdated", version: "6" });
    }
  );

  it("should preserve the metadata-only path when no risk analysis form exists", async () => {
    const purposeTemplate = {
      ...mockPurposeTemplate,
      purposeRiskAnalysisForm: undefined,
    };
    await addOnePurposeTemplate(purposeTemplate);
    const result = await purposeTemplateService.patchUpdatePurposeTemplate(
      purposeTemplate.id,
      { purposeTitle: "Updated purpose title" },
      getMockContextM2MAdmin({
        organizationId: purposeTemplate.creatorId,
      })
    );
    expect(result.data).toEqual({
      ...purposeTemplate,
      purposeTitle: "Updated purpose title",
      updatedAt: new Date(),
    });
    expect(
      await readLastPurposeTemplateEvent(purposeTemplate.id)
    ).toMatchObject({ type: "PurposeTemplateDraftUpdated", version: "1" });
  });

  it("should roll back all events if a later event conflicts, without retrying", async () => {
    const purposeTemplate = {
      ...mockPurposeTemplate,
      state: purposeTemplateState.published,
    };
    await addOnePurposeTemplate(purposeTemplate);
    await writeInEventstore(
      {
        stream_id: purposeTemplate.id,
        version: 2,
        event: {
          type: "PurposeTemplateDraftUpdated",
          event_version: 2,
          data: { purposeTemplate: toPurposeTemplateV2(purposeTemplate) },
        },
      },
      "purpose_template",
      postgresDB
    );
    const ctx = getMockContextM2MAdmin({
      organizationId: purposeTemplate.creatorId,
    });
    await expect(
      purposeTemplateService.patchUpdatePurposeTemplate(
        purposeTemplate.id,
        {
          purposeTitle: "Updated purpose title",
          purposeDescription: "Updated purpose description",
          targetDescription: "Updated target description",
        },
        ctx
      )
    ).rejects.toThrowError(
      eventConflictError(ctx.correlationId, purposeTemplate.id, 1)
    );
    const events = await postgresDB.many<{ version: string }>(
      "SELECT version FROM purpose_template.events WHERE stream_id = $1 ORDER BY version",
      [purposeTemplate.id]
    );
    expect(events).toEqual([{ version: "0" }, { version: "2" }]);
  });

  it("should emit only one draft event with the complete snapshot for a mixed Draft update", async () => {
    await addOnePurposeTemplate(mockPurposeTemplate);
    const ctx = getMockContextM2MAdmin({
      organizationId: mockPurposeTemplate.creatorId,
    });
    const seed = {
      purposeTitle: "Updated purpose title",
      purposeDescription: "Updated purpose description",
      targetDescription: "Updated target description",
      handlesPersonalData: !mockPurposeTemplate.handlesPersonalData,
    };
    const result = await purposeTemplateService.patchUpdatePurposeTemplate(
      mockPurposeTemplate.id,
      seed,
      ctx
    );
    expect(result).toEqual({
      data: { ...mockPurposeTemplate, ...seed, updatedAt: new Date() },
      metadata: { version: 1 },
    });
    const events = await postgresDB.many<{
      type: PurposeTemplateEvent["type"];
      version: string;
      correlation_id: string;
      data: Uint8Array;
    }>(
      "SELECT type, version, correlation_id, data FROM purpose_template.events WHERE stream_id = $1 AND version > 0 ORDER BY version",
      [mockPurposeTemplate.id]
    );
    expect(events.map(({ type }) => type)).toEqual([
      "PurposeTemplateDraftUpdated",
    ]);
    for (const [index, event] of events.entries()) {
      expect(event).toMatchObject({
        version: (index + 1).toString(),
        correlation_id: ctx.correlationId,
      });
      expect(
        decodeProtobufPayload({
          messageType: PurposeTemplateDraftUpdatedV2,
          payload: event.data,
        })
      ).toEqual({ purposeTemplate: toPurposeTemplateV2(result.data) });
    }
  });
});
