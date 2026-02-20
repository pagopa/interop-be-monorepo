/* eslint-disable functional/no-let */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/no-floating-promises */
import {
  getMockTenant,
  getMockPurpose,
  getMockPurposeVersion,
  decodeProtobufPayload,
  getMockEService,
  sortPurpose,
  getMockContextM2MAdmin,
  getMockDelegation,
  getMockValidRiskAnalysis,
} from "pagopa-interop-commons-test";
import {
  tenantKind,
  Tenant,
  EService,
  Purpose,
  purposeVersionState,
  DraftPurposeUpdatedV2,
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
  PurposeTemplateId,
} from "pagopa-interop-models";
import { purposeApi } from "pagopa-interop-api-clients";
import { describe, it, expect, beforeAll, vi, afterAll } from "vitest";
import {
  addOnePurpose,
  readLastPurposeEvent,
  purposeService,
  addOneTenant,
  addOneEService,
  addOneDelegation,
  sortUpdatePurposeReturn,
} from "../integrationUtils.js";
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
  tenantIsNotTheConsumer,
  tenantIsNotTheDelegatedConsumer,
  tenantKindNotFound,
  tenantNotFound,
} from "../../src/model/domain/errors.js";
import { UpdatePurposeReturn } from "../../src/services/purposeService.js";

describe("patchUpdateReversePurpose", () => {
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
    purposeId: PurposeId
  ): Promise<DraftPurposeUpdatedV2> {
    const writtenEvent = await readLastPurposeEvent(purposeId);
    expect(writtenEvent).toMatchObject({
      stream_id: purposeId,
      version: "1",
      type: "DraftPurposeUpdated",
      event_version: 2,
    });
    return decodeProtobufPayload({
      messageType: DraftPurposeUpdatedV2,
      payload: writtenEvent.data,
    });
  }

  async function expectUpdatedPurpose(
    updatePurposeReturn: UpdatePurposeReturn,
    writtenPayload: DraftPurposeUpdatedV2,
    expectedPurpose: Purpose,
    expectedIsRiskAnalysisValid: boolean = true
  ): Promise<void> {
    const sortedExpectedPurpose = sortPurpose(expectedPurpose);
    const sortedWrittenPayloadPurpose = sortPurpose(writtenPayload.purpose);
    const sortedUpdatePurposeReturn =
      sortUpdatePurposeReturn(updatePurposeReturn);
    expect(sortedWrittenPayloadPurpose).toEqual(
      sortPurpose(toPurposeV2(sortedExpectedPurpose))
    );
    expect(sortedUpdatePurposeReturn).toEqual({
      data: {
        purpose: sortedExpectedPurpose,
        isRiskAnalysisValid: expectedIsRiskAnalysisValid,
      },
      metadata: { version: 1 },
    });
  }

  const producer: Tenant = {
    ...getMockTenant(),
    kind: tenantKind.PA,
  };

  const consumer: Tenant = {
    ...getMockTenant(),
  };

  const eservice: EService = {
    ...getMockEService(),
    producerId: producer.id,
    mode: eserviceMode.receive,
  };

  const validRiskAnalysis = getMockValidRiskAnalysis(producer.kind!);

  it("Should write on event store for the patch update of a reverse purpose updating all fields", async () => {
    await addOnePurpose(draftPurpose);
    await addOneEService(eservice);
    await addOneTenant(producer);
    await addOneTenant(consumer);
    await addOneTenant(producer);

    const seed: purposeApi.PatchReversePurposeUpdateContent = {
      title: "updated title",
      dailyCalls: 99,
      description: "updated description",
      isFreeOfCharge: true,
      freeOfChargeReason: "updated freeOfChargeReason",
    };
    const updatePurposeReturn = await purposeService.patchUpdateReversePurpose(
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
    await addOneTenant(producer);
    await addOneDelegation(consumerDelegation);

    const seed: purposeApi.PatchReversePurposeUpdateContent = {
      title: "updated title",
      dailyCalls: 99,
      description: "updated description",
      isFreeOfCharge: true,
      freeOfChargeReason: "updated freeOfChargeReason",
    };
    const updatePurposeReturn = await purposeService.patchUpdateReversePurpose(
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
      updatedAt: new Date(),
    };

    await expectUpdatedPurpose(
      updatePurposeReturn,
      writtenPayload,
      expectedPurpose
    );
  });

  it.each([
    {}, // This should not throw an error and leave all fields unchanged
    { title: "updated title" },
    { description: "updated description" },
    {
      title: "updated title",
      description: undefined, // This keeps the existing description, same as not setting it
      dailyCalls: undefined, // This keeps the existing dailyCalls, same as not setting it
    },
    { dailyCalls: 99 },
    { freeOfChargeReason: "updated freeOfChargeReason" },
    { isFreeOfCharge: true, freeOfChargeReason: "updated freeOfChargeReason" },
    {
      isFreeOfCharge: true,
      freeOfChargeReason: undefined, // This keeps the existing reason, same as not setting it
    },
    {
      title: "updated title",
      description: "updated description",
      dailyCalls: 99,
    },
  ] as purposeApi.PatchReversePurposeUpdateContent[])(
    "should update only the fields set in the seed, and leave undefined fields unchanged (seed #%#)",
    async (seed) => {
      await addOnePurpose(draftPurpose);
      await addOneEService(eservice);
      await addOneTenant(consumer);
      await addOneTenant(producer);

      const updatePurposeReturn =
        await purposeService.patchUpdateReversePurpose(
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
        title: seed.title ?? draftPurpose.title,
        description: seed.description ?? draftPurpose.description,
        isFreeOfCharge: seed.isFreeOfCharge ?? draftPurpose.isFreeOfCharge,
        freeOfChargeReason:
          seed.freeOfChargeReason ?? draftPurpose.freeOfChargeReason,
        versions: [
          {
            ...draftPurpose.versions[0],
            dailyCalls: seed.dailyCalls ?? draftPurpose.versions[0].dailyCalls,
            updatedAt: new Date(),
          },
        ],
        updatedAt: new Date(),
      };

      await expectUpdatedPurpose(
        updatePurposeReturn,
        writtenPayload,
        expectedPurpose
      );
    }
  );

  it("should remove nullable fields that are set to null in the seed", async () => {
    await addOnePurpose(draftPurpose);
    await addOneEService(eservice);
    await addOneTenant(consumer);
    await addOneTenant(producer);

    const seed: purposeApi.PatchReversePurposeUpdateContent = {
      title: "updated title",
      isFreeOfCharge: false,
      freeOfChargeReason: null, // This is the only nullable field for this call
    };

    const updatePurposeReturn = await purposeService.patchUpdateReversePurpose(
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
      expectedPurpose
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
      purposeService.patchUpdateReversePurpose(
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

  it("Should throw purposeFromTemplateCannotBeModified if the purpose was created from a purpose template", async () => {
    const purposeTemplateId = generateId<PurposeTemplateId>();
    const purposeFromTemplate: Purpose = {
      ...draftPurpose,
      purposeTemplateId,
    };
    await addOnePurpose(purposeFromTemplate);

    expect(
      purposeService.patchUpdateReversePurpose(
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
  });

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
      await addOneTenant(producer);
      await addOnePurpose(draftPurpose);
      await addOneEService(eservice);
      expect(
        purposeService.patchUpdateReversePurpose(
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
        purposeApi.PatchReversePurposeUpdateContent,
        "isFreeOfCharge" | "freeOfChargeReason"
      >,
      Pick<Purpose, "isFreeOfCharge" | "freeOfChargeReason">
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
      await addOneTenant(producer);
      await addOneEService(eservice);

      const cleanedSeed = Object.fromEntries(
        Object.entries({
          ...seed,
        }).filter(([_, v]) => v !== undefined)
      ) as purposeApi.PatchReversePurposeUpdateContent;

      const purpose: Purpose = {
        ...draftPurpose,
        isFreeOfCharge: initData.isFreeOfCharge,
        freeOfChargeReason: initData.freeOfChargeReason,
      };

      await addOnePurpose(purpose);

      const patchPurposeResult = await purposeService.patchUpdateReversePurpose(
        draftPurpose.id,
        cleanedSeed,
        getMockContextM2MAdmin({
          organizationId: draftPurpose.consumerId,
        })
      );

      const expectedPurpose: Purpose = {
        ...purpose,
        isFreeOfCharge: expected.isFreeOfCharge,
        freeOfChargeReason: expected.freeOfChargeReason,
        updatedAt: new Date(),
      };

      expect(patchPurposeResult.data.purpose).toEqual(expectedPurpose);
    }
  );

  const failureFreeOfChargeTestCases: Array<
    [
      Pick<Purpose, "isFreeOfCharge" | "freeOfChargeReason">,
      Pick<
        purposeApi.PatchPurposeUpdateContent,
        "isFreeOfCharge" | "freeOfChargeReason"
      >,
      Pick<Purpose, "isFreeOfCharge" | "freeOfChargeReason">
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
      await addOneTenant(producer);
      await addOneEService(eservice);

      const purpose: Purpose = {
        ...draftPurpose,
        isFreeOfCharge: initData.isFreeOfCharge,
        freeOfChargeReason: initData.freeOfChargeReason,
      };

      await addOnePurpose(purpose);

      expect(
        purposeService.patchUpdateReversePurpose(
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
      purposeService.patchUpdateReversePurpose(
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
    await addOneTenant(producer);

    expect(
      purposeService.patchUpdateReversePurpose(
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
    await addOneTenant(producer);

    await addOneDelegation(consumerDelegation);

    expect(
      purposeService.patchUpdateReversePurpose(
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
    await addOneTenant(producer);

    expect(
      purposeService.patchUpdateReversePurpose(
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
    await addOneTenant(producer);

    expect(
      purposeService.patchUpdateReversePurpose(
        publishedPurpose.id,
        {
          title: "updated title",
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
    await addOneTenant(producer);

    expect(
      purposeService.patchUpdateReversePurpose(
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

  it("Should throw eServiceModeNotAllowed if the eservice is in mode DELIVER", async () => {
    await addOneEService({
      ...eservice,
      mode: eserviceMode.deliver,
    });
    await addOnePurpose(draftPurpose);
    await addOneTenant(consumer);
    await addOneTenant(producer);

    expect(
      purposeService.patchUpdateReversePurpose(
        draftPurpose.id,
        {
          title: "updated title",
        },
        getMockContextM2MAdmin({
          organizationId: consumer.id,
        })
      )
    ).rejects.toThrowError(eServiceModeNotAllowed(eservice.id, "Receive"));
  });

  it("Should throw tenantNotFound if the producer tenant does not exist", async () => {
    await addOneEService(eservice);
    await addOnePurpose(draftPurpose);

    expect(
      purposeService.patchUpdateReversePurpose(
        draftPurpose.id,
        {
          title: "updated title",
        },
        getMockContextM2MAdmin({
          organizationId: consumer.id,
        })
      )
    ).rejects.toThrowError(tenantNotFound(producer.id));
  });

  it("Should throw tenantKindNotFound if the producer tenant kind does not exist", async () => {
    await addOnePurpose(draftPurpose);
    await addOneEService(eservice);
    await addOneTenant({
      ...producer,
      kind: undefined,
    });

    expect(
      purposeService.patchUpdateReversePurpose(
        draftPurpose.id,
        {
          title: "updated title",
        },
        getMockContextM2MAdmin({
          organizationId: consumer.id,
        })
      )
    ).rejects.toThrowError(tenantKindNotFound(producer.id));
  });
});
