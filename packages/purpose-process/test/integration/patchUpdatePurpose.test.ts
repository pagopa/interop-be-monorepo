/* eslint-disable functional/no-let */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/no-floating-promises */
import { purposeApi } from "pagopa-interop-api-clients";
import { rulesVersionNotFoundError } from "pagopa-interop-commons";
import {
  getMockTenant,
  getMockPurpose,
  getMockPurposeVersion,
  getMockValidRiskAnalysis,
  decodeProtobufPayload,
  getMockEService,
  sortPurpose,
  getMockContextM2MAdmin,
  getMockDelegation,
  readEventByStreamIdAndVersion,
} from "pagopa-interop-commons-test";
import {
  tenantKind,
  Tenant,
  EService,
  Purpose,
  purposeVersionState,
  DraftPurposeUpdatedV2,
  PurposeTitleUpdatedV2,
  PurposeDescriptionUpdatedV2,
  PurposeEventV2,
  toPurposeV2,
  eserviceMode,
  delegationKind,
  delegationState,
  PurposeId,
  unsafeBrandId,
  generateId,
  DelegationId,
  PurposeVersionId,
  EServiceId,
  RiskAnalysis,
  PurposeTemplateId,
} from "pagopa-interop-models";
import { describe, it, expect, beforeAll, vi, afterAll } from "vitest";

import {
  duplicatedPurposeTitle,
  eServiceModeNotAllowed,
  eserviceNotFound,
  invalidFreeOfChargeReason,
  missingFreeOfChargeReason,
  purposeDelegationNotFound,
  purposeFromTemplateCannotBeModified,
  purposeNotFound,
  purposeNotInDraftState,
  riskAnalysisValidationFailed,
  tenantIsNotTheConsumer,
  tenantIsNotTheDelegatedConsumer,
  tenantKindNotFound,
  tenantNotFound,
} from "../../src/model/domain/errors.js";
import { UpdatePurposeReturn } from "../../src/services/purposeService.js";
import {
  addOnePurpose,
  readLastPurposeEvent,
  purposeService,
  addOneTenant,
  addOneEService,
  addOneDelegation,
  sortUpdatePurposeReturn,
  postgresDB,
} from "../integrationUtils.js";
import {
  buildRiskAnalysisSeed,
  createUpdatedRiskAnalysisForm,
} from "../mockUtils.js";

describe("patchUpdatePurpose", () => {
  let draftPurpose: Purpose;

  beforeAll(async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date());

    draftPurpose = {
      ...getMockPurpose(),
      eserviceId: eservice.id,
      consumerId: consumer.id,
      riskAnalysisForm: validRiskAnalysis.riskAnalysisForm,
      versions: [
        {
          ...getMockPurposeVersion(),
          state: purposeVersionState.draft,
          dailyCalls: 10,
        },
      ],
    };
  });

  afterAll(() => {
    vi.useRealTimers();
  });

  async function expectWrittenEventAndGetPayload(
    purposeId: PurposeId,
    eventTypes: PurposeEventV2["type"][] = ["DraftPurposeUpdated"]
  ): Promise<DraftPurposeUpdatedV2> {
    const writtenEvent = await readLastPurposeEvent(purposeId);
    expect(writtenEvent).toMatchObject({
      stream_id: purposeId,
      version: eventTypes.length.toString(),
      type: eventTypes.at(-1) ?? "PurposeAdded",
      event_version: 2,
    });
    for (const [index, type] of eventTypes.entries()) {
      const event = await readEventByStreamIdAndVersion(
        purposeId,
        index + 1,
        "purpose",
        postgresDB
      );
      expect(event).toMatchObject({
        type,
        version: (index + 1).toString(),
        event_version: 2,
        data: writtenEvent.data,
      });
    }
    if (eventTypes.length > 0) {
      const correlations = await postgresDB.many<{ correlation_id: string }>(
        "SELECT DISTINCT correlation_id FROM purpose.events WHERE stream_id = $1 AND version > 0",
        [purposeId]
      );
      expect(correlations).toHaveLength(1);
      expect(correlations[0].correlation_id).toEqual(expect.any(String));
    }
    return decodeProtobufPayload({
      messageType:
        writtenEvent.type === "PurposeTitleUpdated"
          ? PurposeTitleUpdatedV2
          : writtenEvent.type === "PurposeDescriptionUpdated"
            ? PurposeDescriptionUpdatedV2
            : DraftPurposeUpdatedV2,
      payload: writtenEvent.data,
    });
  }

  async function expectUpdatedPurpose(
    updatePurposeReturn: UpdatePurposeReturn,
    writtenPayload: DraftPurposeUpdatedV2,
    expectedPurpose: Purpose,
    expectedVersion = 1
  ): Promise<void> {
    const sortedExpectedPurpose = sortPurpose(expectedPurpose);
    const sortedUpdatePurposeReturn =
      sortUpdatePurposeReturn(updatePurposeReturn);
    expect({
      ...writtenPayload,
      purpose: sortPurpose(writtenPayload.purpose),
    }).toEqual({
      purpose: sortPurpose(toPurposeV2(sortedExpectedPurpose)),
    });
    expect(sortedUpdatePurposeReturn).toEqual({
      data: {
        purpose: sortedExpectedPurpose,
      },
      metadata: { version: expectedVersion },
    });
  }

  const testTenantKind = tenantKind.PA;
  const consumer: Tenant = {
    ...getMockTenant(),
    kind: testTenantKind,
  };

  const eservice: EService = {
    ...getMockEService(),
    mode: eserviceMode.deliver,
  };

  const validRiskAnalysis = getMockValidRiskAnalysis(testTenantKind);

  it.each(Object.values(purposeVersionState))(
    "should update metadata in %s without modifying versions or risk analysis",
    async (state) => {
      const purpose: Purpose = {
        ...draftPurpose,
        updatedAt: new Date(0),
        versions: [
          getMockPurposeVersion(state),
          getMockPurposeVersion(purposeVersionState.archived),
        ],
      };
      await addOnePurpose(purpose);
      await addOneEService(eservice);
      await addOneTenant(consumer);

      const result = await purposeService.patchUpdatePurpose(
        purpose.id,
        {
          title: "updated title",
          description: "updated description",
        },
        getMockContextM2MAdmin({ organizationId: consumer.id })
      );
      const payload = await expectWrittenEventAndGetPayload(purpose.id, [
        "PurposeTitleUpdated",
        "PurposeDescriptionUpdated",
      ]);
      await expectUpdatedPurpose(
        result,
        payload,
        {
          ...purpose,
          title: "updated title",
          description: "updated description",
          updatedAt: new Date(),
        },
        2
      );
    }
  );

  it.each(Object.values(purposeVersionState))(
    "should preserve the event version and timestamps for unchanged metadata in %s",
    async (state) => {
      const purpose: Purpose = {
        ...draftPurpose,
        updatedAt: new Date(0),
        versions: [getMockPurposeVersion(state)],
      };
      await addOnePurpose(purpose);
      await addOneEService(eservice);
      await addOneTenant(consumer);

      const result = await purposeService.patchUpdatePurpose(
        purpose.id,
        { title: purpose.title, description: purpose.description },
        getMockContextM2MAdmin({ organizationId: consumer.id })
      );
      expect(sortUpdatePurposeReturn(result)).toEqual({
        data: { purpose: sortPurpose(purpose) },
        metadata: { version: 0 },
      });
      expect(await readLastPurposeEvent(purpose.id)).toMatchObject({
        type: "PurposeAdded",
        version: "0",
      });
    }
  );

  it("should preserve risk analysis IDs and timestamps for an equivalent operational seed", async () => {
    const purpose: Purpose = {
      ...draftPurpose,
      updatedAt: new Date(0),
      versions: [{ ...draftPurpose.versions[0], updatedAt: new Date(0) }],
    };
    await addOnePurpose(purpose);
    await addOneEService(eservice);
    await addOneTenant(consumer);

    const result = await purposeService.patchUpdatePurpose(
      purpose.id,
      {
        title: purpose.title,
        description: purpose.description,
        dailyCalls: purpose.versions[0].dailyCalls,
        isFreeOfCharge: purpose.isFreeOfCharge,
        freeOfChargeReason: purpose.freeOfChargeReason,
        riskAnalysisForm: buildRiskAnalysisSeed(validRiskAnalysis),
      },
      getMockContextM2MAdmin({ organizationId: consumer.id })
    );
    expect(sortUpdatePurposeReturn(result)).toEqual({
      data: { purpose: sortPurpose(purpose) },
      metadata: { version: 0 },
    });
    expect(await readLastPurposeEvent(purpose.id)).toMatchObject({
      type: "PurposeAdded",
      version: "0",
    });
  });

  it("should emit only metadata events when supplied operational values are unchanged", async () => {
    await addOnePurpose(draftPurpose);
    await addOneEService(eservice);
    await addOneTenant(consumer);
    const result = await purposeService.patchUpdatePurpose(
      draftPurpose.id,
      {
        title: "updated title",
        description: "updated description",
        dailyCalls: draftPurpose.versions[0].dailyCalls,
        riskAnalysisForm: buildRiskAnalysisSeed(validRiskAnalysis),
      },
      getMockContextM2MAdmin({ organizationId: consumer.id })
    );
    const payload = await expectWrittenEventAndGetPayload(draftPurpose.id, [
      "PurposeTitleUpdated",
      "PurposeDescriptionUpdated",
    ]);
    await expectUpdatedPurpose(
      result,
      payload,
      {
        ...draftPurpose,
        title: "updated title",
        description: "updated description",
        updatedAt: new Date(),
      },
      2
    );
  });

  it("should preserve Draft risk analysis editing when answers change", async () => {
    await addOnePurpose(draftPurpose);
    await addOneEService(eservice);
    await addOneTenant(consumer);
    const seed = buildRiskAnalysisSeed(validRiskAnalysis);
    const result = await purposeService.patchUpdatePurpose(
      draftPurpose.id,
      {
        riskAnalysisForm: {
          ...seed,
          answers: {
            ...seed.answers,
            institutionalPurpose: ["Updated institutional purpose"],
          },
        },
      },
      getMockContextM2MAdmin({ organizationId: consumer.id })
    );
    await expectWrittenEventAndGetPayload(draftPurpose.id, [
      "DraftPurposeUpdated",
    ]);
    expect(result.metadata.version).toBe(1);
    expect(result.data.purpose.riskAnalysisForm?.id).not.toBe(
      draftPurpose.riskAnalysisForm?.id
    );
    expect(result.data.purpose.riskAnalysisForm?.singleAnswers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: "institutionalPurpose",
          value: "Updated institutional purpose",
        }),
      ])
    );
    expect(result.data.purpose.title).toBe(draftPurpose.title);
    expect(result.data.purpose.description).toBe(draftPurpose.description);
  });

  it("should allow a consumer delegate to update archived metadata", async () => {
    const delegation = getMockDelegation({
      kind: delegationKind.delegatedConsumer,
      eserviceId: eservice.id,
      delegatorId: consumer.id,
      state: delegationState.active,
    });
    const purpose: Purpose = {
      ...draftPurpose,
      delegationId: delegation.id,
      versions: [getMockPurposeVersion(purposeVersionState.archived)],
    };
    await addOnePurpose(purpose);
    await addOneEService(eservice);
    await addOneTenant(consumer);
    await addOneDelegation(delegation);
    const result = await purposeService.patchUpdatePurpose(
      purpose.id,
      { title: "updated title", description: "updated description" },
      getMockContextM2MAdmin({ organizationId: delegation.delegateId })
    );
    const payload = await expectWrittenEventAndGetPayload(purpose.id, [
      "PurposeTitleUpdated",
      "PurposeDescriptionUpdated",
    ]);
    await expectUpdatedPurpose(
      result,
      payload,
      {
        ...purpose,
        title: "updated title",
        description: "updated description",
        updatedAt: new Date(),
      },
      2
    );
  });

  it.each(
    Object.values(purposeVersionState).filter(
      (state) => state !== purposeVersionState.draft
    )
  )(
    "should reject a mixed operational update atomically in %s",
    async (state) => {
      const purpose: Purpose = {
        ...draftPurpose,
        versions: [getMockPurposeVersion(state)],
      };
      await addOnePurpose(purpose);
      await addOneEService(eservice);
      await addOneTenant(consumer);
      await expect(
        purposeService.patchUpdatePurpose(
          purpose.id,
          {
            title: "updated title",
            description: "updated description",
            dailyCalls: purpose.versions[0].dailyCalls,
          },
          getMockContextM2MAdmin({ organizationId: consumer.id })
        )
      ).rejects.toThrowError(purposeNotInDraftState(purpose.id));
      expect(await readLastPurposeEvent(purpose.id)).toMatchObject({
        type: "PurposeAdded",
        version: "0",
      });
    }
  );

  it("should reject a concurrent metadata update without partial events", async () => {
    await addOnePurpose(draftPurpose);
    await addOneEService(eservice);
    await addOneTenant(consumer);
    const results = await Promise.allSettled(
      Array.from({ length: 2 }, () =>
        purposeService.patchUpdatePurpose(
          draftPurpose.id,
          { title: "updated title", description: "updated description" },
          getMockContextM2MAdmin({ organizationId: consumer.id })
        )
      )
    );
    expect(
      results.filter((result) => result.status === "fulfilled")
    ).toHaveLength(1);
    expect(results).toEqual(
      expect.arrayContaining([
        {
          status: "rejected",
          reason: expect.objectContaining({ code: "eventConflictError" }),
        },
      ])
    );
    await expectWrittenEventAndGetPayload(draftPurpose.id, [
      "PurposeTitleUpdated",
      "PurposeDescriptionUpdated",
    ]);
  });

  it("Should write on event store for the patch update of a purpose updating all fields", async () => {
    await addOnePurpose(draftPurpose);
    await addOneEService(eservice);
    await addOneTenant(consumer);

    const seed: purposeApi.PatchPurposeUpdateContent = {
      title: "updated title",
      dailyCalls: 99,
      description: "updated description",
      isFreeOfCharge: true,
      freeOfChargeReason: "updated freeOfChargeReason",
      riskAnalysisForm: buildRiskAnalysisSeed(validRiskAnalysis),
    };
    const updatePurposeReturn = await purposeService.patchUpdatePurpose(
      draftPurpose.id,
      seed,
      getMockContextM2MAdmin({
        organizationId: consumer.id,
      })
    );

    const writtenPayload = await expectWrittenEventAndGetPayload(
      draftPurpose.id
    );

    const expectedPurpose: Purpose = {
      ...draftPurpose,
      title: seed.title!,
      description: seed.description!,
      isFreeOfCharge: seed.isFreeOfCharge!,
      freeOfChargeReason: seed.freeOfChargeReason!,
      versions: [
        {
          ...draftPurpose.versions[0],
          dailyCalls: 99,
          updatedAt: new Date(),
        },
      ],
      riskAnalysisForm: createUpdatedRiskAnalysisForm(
        draftPurpose.riskAnalysisForm!,
        writtenPayload.purpose!.riskAnalysisForm!
      ),
      updatedAt: new Date(),
    };

    await expectUpdatedPurpose(
      updatePurposeReturn,
      writtenPayload,
      expectedPurpose
    );
  });

  it("should succeed when requester is Consumer Delegate", async () => {
    const consumerDelegation = getMockDelegation({
      kind: delegationKind.delegatedConsumer,
      eserviceId: eservice.id,
      delegatorId: consumer.id,
      state: delegationState.active,
    });

    const delegatedDraftPurpose: Purpose = {
      ...draftPurpose,
      delegationId: consumerDelegation.id,
    };
    await addOnePurpose(delegatedDraftPurpose);
    await addOneEService(eservice);
    await addOneTenant(consumer);
    await addOneDelegation(consumerDelegation);

    const seed: purposeApi.PatchPurposeUpdateContent = {
      title: "updated title",
      dailyCalls: 99,
      description: "updated description",
      isFreeOfCharge: true,
      freeOfChargeReason: "updated freeOfChargeReason",
      riskAnalysisForm: buildRiskAnalysisSeed(validRiskAnalysis),
    };
    const updatePurposeReturn = await purposeService.patchUpdatePurpose(
      delegatedDraftPurpose.id,
      seed,
      getMockContextM2MAdmin({
        organizationId: consumerDelegation.delegateId,
      })
    );

    const writtenPayload = await expectWrittenEventAndGetPayload(
      delegatedDraftPurpose.id
    );

    const expectedPurpose: Purpose = {
      ...delegatedDraftPurpose,
      title: seed.title!,
      description: seed.description!,
      isFreeOfCharge: seed.isFreeOfCharge!,
      freeOfChargeReason: seed.freeOfChargeReason!,
      versions: [
        {
          ...delegatedDraftPurpose.versions[0],
          dailyCalls: seed.dailyCalls!,
          updatedAt: new Date(),
        },
      ],
      riskAnalysisForm: createUpdatedRiskAnalysisForm(
        delegatedDraftPurpose.riskAnalysisForm!,
        writtenPayload.purpose!.riskAnalysisForm!
      ),
      updatedAt: new Date(),
    };

    await expectUpdatedPurpose(
      updatePurposeReturn,
      writtenPayload,
      expectedPurpose
    );
  });

  it.each([
    {
      seed: { title: "updated title" },
      eventTypes: ["PurposeTitleUpdated"],
      operationalChanges: false,
    },
    {
      seed: { description: "updated description" },
      eventTypes: ["PurposeDescriptionUpdated"],
      operationalChanges: false,
    },
    {
      seed: {
        title: "updated title",
        description: undefined,
        dailyCalls: undefined,
      },
      eventTypes: ["PurposeTitleUpdated"],
      operationalChanges: false,
    },
    {
      seed: { dailyCalls: 99 },
      eventTypes: ["DraftPurposeUpdated"],
      operationalChanges: true,
    },
    {
      seed: { isFreeOfCharge: false, freeOfChargeReason: null },
      eventTypes: ["DraftPurposeUpdated"],
      operationalChanges: true,
    },
    {
      seed: { freeOfChargeReason: "updated freeOfChargeReason" },
      eventTypes: ["DraftPurposeUpdated"],
      operationalChanges: true,
    },
    {
      seed: {
        title: "updated title",
        description: "updated description",
        dailyCalls: 99,
      },
      eventTypes: ["DraftPurposeUpdated"],
      operationalChanges: true,
    },
  ] satisfies Array<{
    seed: purposeApi.PatchPurposeUpdateContent;
    eventTypes: PurposeEventV2["type"][];
    operationalChanges: boolean;
  }>)(
    "should update only the fields set in the seed, and leave undefined fields unchanged (seed #%#)",
    async ({ seed, eventTypes, operationalChanges }) => {
      await addOnePurpose(draftPurpose);
      await addOneEService(eservice);
      await addOneTenant(consumer);

      const updatePurposeReturn = await purposeService.patchUpdatePurpose(
        draftPurpose.id,
        seed,
        getMockContextM2MAdmin({
          organizationId: consumer.id,
        })
      );

      const writtenPayload = await expectWrittenEventAndGetPayload(
        draftPurpose.id,
        eventTypes
      );

      const expectedPurpose: Purpose = {
        ...draftPurpose,
        title: seed.title ?? draftPurpose.title,
        description: seed.description ?? draftPurpose.description,
        isFreeOfCharge: seed.isFreeOfCharge ?? draftPurpose.isFreeOfCharge,
        freeOfChargeReason:
          seed.freeOfChargeReason === null
            ? undefined
            : (seed.freeOfChargeReason ?? draftPurpose.freeOfChargeReason),
        versions: [
          {
            ...draftPurpose.versions[0],
            dailyCalls: seed.dailyCalls ?? draftPurpose.versions[0].dailyCalls,
            ...(operationalChanges ? { updatedAt: new Date() } : {}),
          },
        ],
        updatedAt: new Date(),
      };

      await expectUpdatedPurpose(
        updatePurposeReturn,
        writtenPayload,
        expectedPurpose,
        eventTypes.length
      );
    }
  );

  it("should remove nullable fields that are set to null in the seed", async () => {
    await addOnePurpose(draftPurpose);
    await addOneEService(eservice);
    await addOneTenant(consumer);

    const seed: purposeApi.PatchPurposeUpdateContent = {
      title: "updated title",
      isFreeOfCharge: false,
      freeOfChargeReason: null, // This is the only nullable field for this call
    };

    const updatePurposeReturn = await purposeService.patchUpdatePurpose(
      draftPurpose.id,
      seed,
      getMockContextM2MAdmin({
        organizationId: consumer.id,
      })
    );

    const writtenPayload = await expectWrittenEventAndGetPayload(
      draftPurpose.id,
      ["DraftPurposeUpdated"]
    );

    const expectedPurpose: Purpose = {
      ...draftPurpose,
      title: seed.title!,
      isFreeOfCharge: seed.isFreeOfCharge!,
      freeOfChargeReason: undefined,
      versions: [
        {
          ...draftPurpose.versions[0],
          updatedAt: new Date(),
        },
      ],
      updatedAt: new Date(),
    };

    await expectUpdatedPurpose(
      updatePurposeReturn,
      writtenPayload,
      expectedPurpose,
      1
    );
  });

  it("Should throw duplicatedPurposeTitle if the purpose title already exists", async () => {
    const purposeWithDuplicatedTitle: Purpose = {
      ...draftPurpose,
      id: unsafeBrandId<PurposeId>(generateId()),
      title: "duplicated",
      versions: [],
    };
    await addOnePurpose(draftPurpose);
    await addOnePurpose(purposeWithDuplicatedTitle);

    expect(
      purposeService.patchUpdatePurpose(
        draftPurpose.id,
        {
          title: purposeWithDuplicatedTitle.title,
        },
        getMockContextM2MAdmin({
          organizationId: consumer.id,
        })
      )
    ).rejects.toThrowError(
      duplicatedPurposeTitle(purposeWithDuplicatedTitle.title)
    );
  });

  it.each(Object.values(purposeVersionState))(
    "should reject template-derived metadata updates in %s",
    async (state) => {
      const purposeTemplateId = generateId<PurposeTemplateId>();
      const purposeFromTemplate: Purpose = {
        ...draftPurpose,
        purposeTemplateId,
        versions: [getMockPurposeVersion(state)],
      };
      await addOnePurpose(purposeFromTemplate);

      await expect(
        purposeService.patchUpdatePurpose(
          purposeFromTemplate.id,
          {
            title: "updated title",
          },
          getMockContextM2MAdmin({
            organizationId: consumer.id,
          })
        )
      ).rejects.toThrowError(
        purposeFromTemplateCannotBeModified(
          purposeFromTemplate.id,
          purposeTemplateId
        )
      );
    }
  );

  it.each([
    { freeOfChargeReason: null },
    { freeOfChargeReason: "" },
    { isFreeOfCharge: true, freeOfChargeReason: null },
    { isFreeOfCharge: true, freeOfChargeReason: "" },
  ])(
    `Should throw missingFreeOfChargeReason if isFreeOfCharge is set to true
    and freeOfChargeReason is set to not be present anymore (seed #%#)`,
    async (seed) => {
      await addOneTenant(consumer);
      await addOnePurpose(draftPurpose);
      await addOneEService(eservice);
      expect(
        purposeService.patchUpdatePurpose(
          draftPurpose.id,
          seed,
          getMockContextM2MAdmin({
            organizationId: consumer.id,
          })
        )
      ).rejects.toThrowError(missingFreeOfChargeReason());
    }
  );

  const oldFreeOfChargeReason = "Some reason";
  const newFreeOfChargeReason = "New reason";
  const successFreeOfChargeTestCases: Array<
    [
      Pick<Purpose, "isFreeOfCharge" | "freeOfChargeReason">,
      Pick<
        purposeApi.PatchPurposeUpdateContent,
        "isFreeOfCharge" | "freeOfChargeReason"
      >,
      Pick<Purpose, "isFreeOfCharge" | "freeOfChargeReason">,
    ]
  > = [
    [
      {
        isFreeOfCharge: true,
        freeOfChargeReason: oldFreeOfChargeReason,
      },
      {
        isFreeOfCharge: true,
        freeOfChargeReason: newFreeOfChargeReason,
      },
      {
        isFreeOfCharge: true,
        freeOfChargeReason: newFreeOfChargeReason,
      },
    ],
    [
      {
        isFreeOfCharge: true,
        freeOfChargeReason: oldFreeOfChargeReason,
      },
      { isFreeOfCharge: true },
      {
        isFreeOfCharge: true,
        freeOfChargeReason: oldFreeOfChargeReason,
      },
    ],
    [
      {
        isFreeOfCharge: true,
        freeOfChargeReason: oldFreeOfChargeReason,
      },
      { isFreeOfCharge: false },
      { isFreeOfCharge: false, freeOfChargeReason: undefined },
    ],
    [
      {
        isFreeOfCharge: true,
        freeOfChargeReason: oldFreeOfChargeReason,
      },
      { isFreeOfCharge: false, freeOfChargeReason: "" },
      { isFreeOfCharge: false, freeOfChargeReason: undefined },
    ],
    [
      {
        isFreeOfCharge: true,
        freeOfChargeReason: oldFreeOfChargeReason,
      },
      { freeOfChargeReason: newFreeOfChargeReason },
      {
        isFreeOfCharge: true,
        freeOfChargeReason: newFreeOfChargeReason,
      },
    ],
    [
      {
        isFreeOfCharge: true,
        freeOfChargeReason: oldFreeOfChargeReason,
      },
      {
        isFreeOfCharge: undefined,
        freeOfChargeReason: undefined,
      },
      {
        isFreeOfCharge: true,
        freeOfChargeReason: oldFreeOfChargeReason,
      },
    ],
    [
      {
        isFreeOfCharge: true,
        freeOfChargeReason: oldFreeOfChargeReason,
      },
      {
        isFreeOfCharge: false,
        freeOfChargeReason: null,
      },
      {
        isFreeOfCharge: false,
        freeOfChargeReason: undefined,
      },
    ],
    [
      { isFreeOfCharge: false, freeOfChargeReason: undefined },
      {
        isFreeOfCharge: true,
        freeOfChargeReason: newFreeOfChargeReason,
      },
      {
        isFreeOfCharge: true,
        freeOfChargeReason: newFreeOfChargeReason,
      },
    ],
    [
      { isFreeOfCharge: false, freeOfChargeReason: undefined },
      { isFreeOfCharge: false },
      { isFreeOfCharge: false, freeOfChargeReason: undefined },
    ],
    [
      {
        isFreeOfCharge: false,
        freeOfChargeReason: undefined,
      },
      {
        isFreeOfCharge: undefined,
        freeOfChargeReason: undefined,
      },
      {
        isFreeOfCharge: false,
        freeOfChargeReason: undefined,
      },
    ],
    [
      {
        isFreeOfCharge: false,
        freeOfChargeReason: undefined,
      },
      {
        isFreeOfCharge: false,
        freeOfChargeReason: null,
      },
      {
        isFreeOfCharge: false,
        freeOfChargeReason: undefined,
      },
    ],
    [
      {
        isFreeOfCharge: false,
        freeOfChargeReason: undefined,
      },
      {
        isFreeOfCharge: false,
        freeOfChargeReason: "",
      },
      {
        isFreeOfCharge: false,
        freeOfChargeReason: undefined,
      },
    ],
    [
      {
        isFreeOfCharge: false,
        freeOfChargeReason: undefined,
      },
      {
        freeOfChargeReason: null,
      },
      {
        isFreeOfCharge: false,
        freeOfChargeReason: undefined,
      },
    ],
    [
      {
        isFreeOfCharge: false,
        freeOfChargeReason: undefined,
      },
      {
        freeOfChargeReason: "",
      },
      {
        isFreeOfCharge: false,
        freeOfChargeReason: undefined,
      },
    ],
    [
      {
        isFreeOfCharge: false,
        freeOfChargeReason: oldFreeOfChargeReason,
      },
      { isFreeOfCharge: false },
      { isFreeOfCharge: false, freeOfChargeReason: undefined },
    ],
    [
      {
        isFreeOfCharge: false,
        freeOfChargeReason: oldFreeOfChargeReason,
      },
      {
        isFreeOfCharge: true,
        freeOfChargeReason: newFreeOfChargeReason,
      },
      {
        isFreeOfCharge: true,
        freeOfChargeReason: newFreeOfChargeReason,
      },
    ],
    [
      {
        isFreeOfCharge: false,
        freeOfChargeReason: oldFreeOfChargeReason,
      },
      {
        isFreeOfCharge: undefined,
        freeOfChargeReason: undefined,
      },
      { isFreeOfCharge: false, freeOfChargeReason: undefined },
    ],
    [
      {
        isFreeOfCharge: false,
        freeOfChargeReason: oldFreeOfChargeReason,
      },
      {
        isFreeOfCharge: false,
        freeOfChargeReason: null,
      },
      { isFreeOfCharge: false, freeOfChargeReason: undefined },
    ],
    [
      {
        isFreeOfCharge: false,
        freeOfChargeReason: oldFreeOfChargeReason,
      },
      {
        freeOfChargeReason: null,
      },
      { isFreeOfCharge: false, freeOfChargeReason: undefined },
    ],
    [
      {
        isFreeOfCharge: false,
        freeOfChargeReason: oldFreeOfChargeReason,
      },
      {
        freeOfChargeReason: "",
      },
      { isFreeOfCharge: false, freeOfChargeReason: undefined },
    ],
  ];
  it.each(successFreeOfChargeTestCases)(
    "should successfully update isFreeOfCharge and freeOfChargeReason (seed #%#)",
    async (initData, seed, expected) => {
      await addOneTenant(consumer);
      await addOneEService(eservice);

      const cleanedSeed = Object.fromEntries(
        Object.entries({
          ...seed,
        }).filter(([_, v]) => v !== undefined)
      ) as purposeApi.PatchPurposeUpdateContent;

      const purpose: Purpose = {
        ...draftPurpose,
        isFreeOfCharge: initData.isFreeOfCharge,
        freeOfChargeReason: initData.freeOfChargeReason,
      };

      await addOnePurpose(purpose);

      const patchPurposeResult = await purposeService.patchUpdatePurpose(
        draftPurpose.id,
        cleanedSeed,
        getMockContextM2MAdmin({
          organizationId: draftPurpose.consumerId,
        })
      );

      const expectedPurpose: Purpose = {
        ...purpose,
        ...(Object.keys(cleanedSeed).length > 0 ? expected : {}),
        ...(Object.keys(cleanedSeed).length > 0 &&
        (initData.isFreeOfCharge !== expected.isFreeOfCharge ||
          initData.freeOfChargeReason !== expected.freeOfChargeReason)
          ? { updatedAt: new Date() }
          : {}),
      };

      expect(sortPurpose(patchPurposeResult.data.purpose)).toEqual(
        sortPurpose(expectedPurpose)
      );
    }
  );

  const failureFreeOfChargeTestCases: Array<
    [
      Pick<Purpose, "isFreeOfCharge" | "freeOfChargeReason">,
      Pick<
        purposeApi.PatchPurposeUpdateContent,
        "isFreeOfCharge" | "freeOfChargeReason"
      >,
      Pick<Purpose, "isFreeOfCharge" | "freeOfChargeReason">,
    ]
  > = [
    [
      {
        isFreeOfCharge: true,
        freeOfChargeReason: oldFreeOfChargeReason,
      },
      {
        isFreeOfCharge: false,
        freeOfChargeReason: newFreeOfChargeReason,
      },
      {
        isFreeOfCharge: false,
        freeOfChargeReason: newFreeOfChargeReason,
      },
    ],
    [
      { isFreeOfCharge: false, freeOfChargeReason: undefined },
      {
        isFreeOfCharge: false,
        freeOfChargeReason: newFreeOfChargeReason,
      },
      {
        isFreeOfCharge: false,
        freeOfChargeReason: newFreeOfChargeReason,
      },
    ],
    [
      { isFreeOfCharge: false, freeOfChargeReason: undefined },
      { freeOfChargeReason: newFreeOfChargeReason },
      {
        isFreeOfCharge: false,
        freeOfChargeReason: newFreeOfChargeReason,
      },
    ],
  ];
  it.each(failureFreeOfChargeTestCases)(
    "should throw invalidFreeOfChargeReason (seed #%#)",
    async (initData, seed, wrongUpdatedData) => {
      await addOneTenant(consumer);
      await addOneEService(eservice);

      const purpose: Purpose = {
        ...draftPurpose,
        isFreeOfCharge: initData.isFreeOfCharge,
        freeOfChargeReason: initData.freeOfChargeReason,
      };

      await addOnePurpose(purpose);

      expect(
        purposeService.patchUpdatePurpose(
          draftPurpose.id,
          seed,
          getMockContextM2MAdmin({
            organizationId: draftPurpose.consumerId,
          })
        )
      ).rejects.toThrowError(
        invalidFreeOfChargeReason(
          wrongUpdatedData.isFreeOfCharge,
          wrongUpdatedData.freeOfChargeReason
        )
      );
    }
  );

  it("should throw purposeNotFound if the purpose doesn't exist", async () => {
    const purposeId: PurposeId = unsafeBrandId(generateId());
    expect(
      purposeService.patchUpdatePurpose(
        purposeId,
        {
          title: "updated title",
        },
        getMockContextM2MAdmin({
          organizationId: consumer.id,
        })
      )
    ).rejects.toThrowError(purposeNotFound(purposeId));
  });

  it(`should throw tenantIsNotTheConsumer if the tenant is not the consumer`, async () => {
    await addOnePurpose(draftPurpose);
    await addOneEService(eservice);
    await addOneTenant(consumer);

    expect(
      purposeService.patchUpdatePurpose(
        draftPurpose.id,
        {
          title: "updated title",
        },
        getMockContextM2MAdmin({
          organizationId: eservice.producerId,
        })
      )
    ).rejects.toThrowError(tenantIsNotTheConsumer(eservice.producerId));
  });

  it(`Should throw tenantIsNotTheDelegatedConsumer if there is an active consumer delegation
    and the tenant is not the consumer delegate`, async () => {
    const consumerDelegation = getMockDelegation({
      kind: delegationKind.delegatedConsumer,
      eserviceId: eservice.id,
      delegatorId: consumer.id,
      state: delegationState.active,
    });

    const delegatedDraftPurpose: Purpose = {
      ...draftPurpose,
      delegationId: consumerDelegation.id,
    };
    await addOnePurpose(delegatedDraftPurpose);
    await addOneEService(eservice);
    await addOneTenant(consumer);

    await addOneDelegation(consumerDelegation);

    expect(
      purposeService.patchUpdatePurpose(
        delegatedDraftPurpose.id,
        {
          title: "updated title",
        },
        getMockContextM2MAdmin({
          organizationId: eservice.producerId,
        })
      )
    ).rejects.toThrowError(
      tenantIsNotTheDelegatedConsumer(
        eservice.producerId,
        consumerDelegation.id
      )
    );
  });

  it(`should throw purposeDelegationNotFound if the purpose is created under a delegation
    but the delegation cannot be found`, async () => {
    const delegatedDraftPurpose: Purpose = {
      ...draftPurpose,
      delegationId: generateId<DelegationId>(),
    };
    await addOnePurpose(delegatedDraftPurpose);
    await addOneEService(eservice);
    await addOneTenant(consumer);

    expect(
      purposeService.patchUpdatePurpose(
        delegatedDraftPurpose.id,
        {
          title: "updated title",
        },
        getMockContextM2MAdmin({
          organizationId: consumer.id,
        })
      )
    ).rejects.toThrowError(
      purposeDelegationNotFound(
        delegatedDraftPurpose.id,
        delegatedDraftPurpose.delegationId!
      )
    );
  });

  it("Should throw purposeNotInDraftState if the purpose is not in draft state", async () => {
    const publishedPurpose: Purpose = {
      ...draftPurpose,
      versions: [
        ...draftPurpose.versions,
        {
          ...getMockPurposeVersion(),
          id: generateId<PurposeVersionId>(),
          state: purposeVersionState.active,
        },
      ],
    };
    await addOnePurpose(publishedPurpose);
    await addOneEService(eservice);
    await addOneTenant(consumer);

    expect(
      purposeService.patchUpdatePurpose(
        publishedPurpose.id,
        {
          title: "updated title",
          dailyCalls: 99,
        },
        getMockContextM2MAdmin({
          organizationId: consumer.id,
        })
      )
    ).rejects.toThrowError(purposeNotInDraftState(publishedPurpose.id));
  });

  it("Should throw eserviceNotFound if the eservice doesn't exist", async () => {
    const eserviceId: EServiceId = generateId();
    const mockPurpose: Purpose = {
      ...draftPurpose,
      eserviceId,
    };

    await addOnePurpose(mockPurpose);
    await addOneTenant(consumer);

    expect(
      purposeService.patchUpdatePurpose(
        mockPurpose.id,
        {
          title: "updated title",
        },
        getMockContextM2MAdmin({
          organizationId: consumer.id,
        })
      )
    ).rejects.toThrowError(eserviceNotFound(eserviceId));
  });

  it("Should throw eServiceModeNotAllowed if the eservice is in mode RECEIVE", async () => {
    await addOneEService({
      ...eservice,
      mode: eserviceMode.receive,
    });
    await addOnePurpose(draftPurpose);
    await addOneTenant(consumer);

    expect(
      purposeService.patchUpdatePurpose(
        draftPurpose.id,
        {
          title: "updated title",
        },
        getMockContextM2MAdmin({
          organizationId: consumer.id,
        })
      )
    ).rejects.toThrowError(eServiceModeNotAllowed(eservice.id, "Deliver"));
  });

  it("Should throw tenantNotFound if the consumer tenant caller does not exist", async () => {
    await addOneEService(eservice);
    await addOnePurpose(draftPurpose);

    expect(
      purposeService.patchUpdatePurpose(
        draftPurpose.id,
        {
          title: "updated title",
        },
        getMockContextM2MAdmin({
          organizationId: consumer.id,
        })
      )
    ).rejects.toThrowError(tenantNotFound(consumer.id));
  });

  it("Should throw tenantKindNotFound if the consumer tenant kind does not exist", async () => {
    await addOnePurpose(draftPurpose);
    await addOneEService(eservice);
    await addOneTenant({
      ...consumer,
      kind: undefined,
    });

    expect(
      purposeService.patchUpdatePurpose(
        draftPurpose.id,
        {
          title: "updated title",
        },
        getMockContextM2MAdmin({
          organizationId: consumer.id,
        })
      )
    ).rejects.toThrowError(tenantKindNotFound(consumer.id));
  });

  it("Should throw riskAnalysisValidationFailed if the risk analysis is not valid in updatePurpose", async () => {
    await addOnePurpose(draftPurpose);
    await addOneEService(eservice);
    await addOneTenant(consumer);

    const invalidRiskAnalysis: RiskAnalysis = {
      ...validRiskAnalysis,
      riskAnalysisForm: {
        ...validRiskAnalysis.riskAnalysisForm,
        version: "0",
      },
    };

    expect(
      purposeService.patchUpdatePurpose(
        draftPurpose.id,
        {
          riskAnalysisForm: buildRiskAnalysisSeed(invalidRiskAnalysis),
        },
        getMockContextM2MAdmin({
          organizationId: consumer.id,
        })
      )
    ).rejects.toThrowError(
      riskAnalysisValidationFailed([
        rulesVersionNotFoundError(consumer.kind!, "0"),
      ])
    );
  });
});
