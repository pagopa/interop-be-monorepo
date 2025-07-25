/* eslint-disable @typescript-eslint/no-floating-promises */
import { describe, expect, it, vi } from "vitest";
import {
  getMockPurposeVersion,
  getMockPurpose,
  decodeProtobufPayload,
  getMockAuthData,
  getMockDelegation,
  addSomeRandomDelegations,
  getMockTenant,
  getMockAgreement,
  getMockContext,
  getMockEService,
} from "pagopa-interop-commons-test";
import {
  purposeVersionState,
  Purpose,
  generateId,
  WaitingForApprovalPurposeVersionDeletedV2,
  toPurposeV2,
  PurposeId,
  PurposeVersionId,
  delegationKind,
  delegationState,
  TenantId,
  tenantKind,
  Agreement,
  agreementState,
  EService,
  PurposeVersion,
  DelegationId,
} from "pagopa-interop-models";
import {
  purposeNotFound,
  purposeVersionNotFound,
  tenantIsNotTheConsumer,
  purposeVersionCannotBeDeleted,
  tenantIsNotTheDelegatedConsumer,
  purposeDelegationNotFound,
} from "../../src/model/domain/errors.js";
import {
  addOneAgreement,
  addOneDelegation,
  addOneEService,
  addOnePurpose,
  addOneTenant,
  purposeService,
  readLastPurposeEvent,
} from "../integrationUtils.js";

describe("deletePurposeVersion", () => {
  it("should write in event-store for the deletion of a purpose version", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date());

    const mockEService = getMockEService();
    const mockPurposeVersion1 = getMockPurposeVersion(
      purposeVersionState.waitingForApproval
    );
    const mockPurposeVersion2 = getMockPurposeVersion(
      purposeVersionState.draft
    );
    const mockPurpose: Purpose = {
      ...getMockPurpose(),
      eserviceId: mockEService.id,
      versions: [mockPurposeVersion1, mockPurposeVersion2],
    };

    await addOnePurpose(mockPurpose);
    await addOneEService(mockEService);

    const deletePurposeVersionResponse =
      await purposeService.deletePurposeVersion(
        {
          purposeId: mockPurpose.id,
          versionId: mockPurposeVersion1.id,
        },
        getMockContext({ authData: getMockAuthData(mockPurpose.consumerId) })
      );

    const writtenEvent = await readLastPurposeEvent(mockPurpose.id);

    expect(writtenEvent).toMatchObject({
      stream_id: mockPurpose.id,
      version: "1",
      type: "WaitingForApprovalPurposeVersionDeleted",
      event_version: 2,
    });

    const writtenPayload = decodeProtobufPayload({
      messageType: WaitingForApprovalPurposeVersionDeletedV2,
      payload: writtenEvent.data,
    });

    const expectedPurpose: Purpose = {
      ...mockPurpose,
      versions: [mockPurposeVersion2],
      updatedAt: new Date(),
    };

    expect(deletePurposeVersionResponse).toEqual({
      data: expectedPurpose,
      metadata: { version: parseInt(writtenEvent.version, 10) },
    });
    expect(writtenPayload.purpose).toEqual(toPurposeV2(expectedPurpose));

    vi.useRealTimers();
  });
  it("should succeed when requester is Consumer Delegate and the Purpose is in a deletable state", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date());

    const mockEService = getMockEService();
    const mockPurposeVersion1 = getMockPurposeVersion(
      purposeVersionState.waitingForApproval
    );
    const mockPurposeVersion2 = getMockPurposeVersion(
      purposeVersionState.draft
    );
    const mockPurpose: Purpose = {
      ...getMockPurpose(),
      eserviceId: mockEService.id,
      versions: [mockPurposeVersion1, mockPurposeVersion2],
      delegationId: generateId<DelegationId>(),
    };

    const authData = getMockAuthData();

    const delegation = getMockDelegation({
      id: mockPurpose.delegationId,
      kind: delegationKind.delegatedConsumer,
      eserviceId: mockPurpose.eserviceId,
      delegatorId: mockPurpose.consumerId,
      delegateId: authData.organizationId,
      state: delegationState.active,
    });

    await addOnePurpose(mockPurpose);
    await addOneDelegation(delegation);
    await addSomeRandomDelegations(mockPurpose, addOneDelegation);
    await addOneEService(mockEService);

    const deletePurposeVersionResponse =
      await purposeService.deletePurposeVersion(
        {
          purposeId: mockPurpose.id,
          versionId: mockPurposeVersion1.id,
        },
        getMockContext({ authData })
      );

    const writtenEvent = await readLastPurposeEvent(mockPurpose.id);

    expect(writtenEvent).toMatchObject({
      stream_id: mockPurpose.id,
      version: "1",
      type: "WaitingForApprovalPurposeVersionDeleted",
      event_version: 2,
    });

    const writtenPayload = decodeProtobufPayload({
      messageType: WaitingForApprovalPurposeVersionDeletedV2,
      payload: writtenEvent.data,
    });

    const expectedPurpose: Purpose = {
      ...mockPurpose,
      versions: [mockPurposeVersion2],
      updatedAt: new Date(),
    };

    expect(deletePurposeVersionResponse).toEqual({
      data: expectedPurpose,
      metadata: { version: parseInt(writtenEvent.version, 10) },
    });
    expect(writtenPayload.purpose).toEqual(toPurposeV2(expectedPurpose));

    vi.useRealTimers();
  });
  it("should succeed when requester is Consumer Delegate and the eservice was created by a delegated tenant and the Purpose is in a deletable state", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date());

    const producer = {
      ...getMockTenant(),
      id: generateId<TenantId>(),
      kind: tenantKind.PA,
    };
    const producerDelegate = {
      ...getMockTenant(),
      id: generateId<TenantId>(),
      kind: tenantKind.PA,
    };
    const consumer = {
      ...getMockTenant(),
      id: generateId<TenantId>(),
      kind: tenantKind.PA,
    };
    const consumerDelegate = {
      ...getMockTenant(),
      id: generateId<TenantId>(),
      kind: tenantKind.PA,
    };

    const eservice: EService = {
      ...getMockEService(),
      producerId: producer.id,
    };

    const agreement: Agreement = {
      ...getMockAgreement(),
      producerId: producer.id,
      consumerId: consumer.id,
      eserviceId: eservice.id,
      state: agreementState.active,
    };

    const mockPurposeVersion1 = getMockPurposeVersion(
      purposeVersionState.waitingForApproval
    );
    const mockPurposeVersion2 = getMockPurposeVersion(
      purposeVersionState.draft
    );

    const delegatePurpose: Purpose = {
      ...getMockPurpose(),
      consumerId: consumer.id,
      eserviceId: eservice.id,
      versions: [mockPurposeVersion1, mockPurposeVersion2],
      delegationId: generateId<DelegationId>(),
    };

    const producerDelegation = getMockDelegation({
      kind: delegationKind.delegatedProducer,
      eserviceId: eservice.id,
      delegatorId: producer.id,
      delegateId: producerDelegate.id,
      state: delegationState.active,
    });

    const consumerDelegation = getMockDelegation({
      id: delegatePurpose.delegationId,
      kind: delegationKind.delegatedConsumer,
      eserviceId: eservice.id,
      delegatorId: consumer.id,
      delegateId: consumerDelegate.id,
      state: delegationState.active,
    });

    await addOneTenant(producerDelegate);
    await addOneTenant(producer);
    await addOneTenant(consumerDelegate);
    await addOneTenant(consumer);
    await addOneEService(eservice);
    await addOneAgreement(agreement);
    await addOnePurpose(delegatePurpose);
    await addOneDelegation(producerDelegation);
    await addOneDelegation(consumerDelegation);
    await addSomeRandomDelegations(delegatePurpose, addOneDelegation);

    const deletePurposeVersionResponse =
      await purposeService.deletePurposeVersion(
        {
          purposeId: delegatePurpose.id,
          versionId: mockPurposeVersion1.id,
        },
        getMockContext({ authData: getMockAuthData(consumerDelegate.id) })
      );

    const writtenEvent = await readLastPurposeEvent(delegatePurpose.id);

    expect(writtenEvent).toMatchObject({
      stream_id: delegatePurpose.id,
      version: "1",
      type: "WaitingForApprovalPurposeVersionDeleted",
      event_version: 2,
    });

    const writtenPayload = decodeProtobufPayload({
      messageType: WaitingForApprovalPurposeVersionDeletedV2,
      payload: writtenEvent.data,
    });

    const expectedPurpose: Purpose = {
      ...delegatePurpose,
      versions: [mockPurposeVersion2],
      updatedAt: new Date(),
    };

    expect(deletePurposeVersionResponse).toEqual({
      data: expectedPurpose,
      metadata: { version: parseInt(writtenEvent.version, 10) },
    });
    expect(writtenPayload.purpose).toEqual(toPurposeV2(expectedPurpose));

    vi.useRealTimers();
  });
  it("should throw purposeNotFound if the purpose doesn't exist", async () => {
    const randomId: PurposeId = generateId();
    const mockEService = getMockEService();
    const mockPurposeVersion = getMockPurposeVersion();
    const mockPurpose: Purpose = {
      ...getMockPurpose(),
      eserviceId: mockEService.id,
      versions: [mockPurposeVersion],
    };

    await addOnePurpose(mockPurpose);
    await addOneEService(mockEService);

    expect(
      purposeService.deletePurposeVersion(
        {
          purposeId: randomId,
          versionId: mockPurposeVersion.id,
        },
        getMockContext({ authData: getMockAuthData(mockEService.producerId) })
      )
    ).rejects.toThrowError(purposeNotFound(randomId));
  });
  it("should throw purposeVersionNotFound if the purpose version doesn't exist", async () => {
    const randomVersionId: PurposeVersionId = generateId();
    const mockEService = getMockEService();
    const mockPurpose: Purpose = {
      ...getMockPurpose(),
      eserviceId: mockEService.id,
      versions: [getMockPurposeVersion()],
    };

    await addOnePurpose(mockPurpose);
    await addOneEService(mockEService);

    expect(
      purposeService.deletePurposeVersion(
        {
          purposeId: mockPurpose.id,
          versionId: randomVersionId,
        },
        getMockContext({ authData: getMockAuthData(mockPurpose.consumerId) })
      )
    ).rejects.toThrowError(
      purposeVersionNotFound(mockPurpose.id, randomVersionId)
    );
  });
  it("should throw tenantIsNotTheConsumer if the requester is not the consumer", async () => {
    const mockEService = getMockEService();
    const mockPurposeVersion = getMockPurposeVersion();
    const mockPurpose: Purpose = {
      ...getMockPurpose(),
      eserviceId: mockEService.id,
      versions: [
        mockPurposeVersion,
        getMockPurposeVersion(purposeVersionState.draft),
      ],
    };

    await addOnePurpose(mockPurpose);
    await addOneEService(mockEService);

    expect(
      purposeService.deletePurposeVersion(
        {
          purposeId: mockPurpose.id,
          versionId: mockPurposeVersion.id,
        },
        getMockContext({ authData: getMockAuthData(mockEService.producerId) })
      )
    ).rejects.toThrowError(tenantIsNotTheConsumer(mockEService.producerId));
  });
  it.each(
    Object.values(purposeVersionState).filter(
      (state) => state !== purposeVersionState.waitingForApproval
    )
  )(
    "should throw purposeVersionCannotBeDeleted if the purpose version is in %s state",
    async (state) => {
      const mockPurposeVersion = getMockPurposeVersion(state);
      const mockEService = getMockEService();
      const mockPurpose: Purpose = {
        ...getMockPurpose(),
        eserviceId: mockEService.id,
        versions: [
          mockPurposeVersion,
          getMockPurposeVersion(purposeVersionState.draft),
        ],
      };

      await addOnePurpose(mockPurpose);
      await addOneEService(mockEService);

      expect(
        purposeService.deletePurposeVersion(
          {
            purposeId: mockPurpose.id,
            versionId: mockPurposeVersion.id,
          },
          getMockContext({
            authData: getMockAuthData(mockPurpose.consumerId),
          })
        )
      ).rejects.toThrowError(
        purposeVersionCannotBeDeleted(mockPurpose.id, mockPurposeVersion.id)
      );
    }
  );
  it("should throw purposeVersionCannotBeDeleted if the purpose has only that version", async () => {
    const mockPurposeVersion = getMockPurposeVersion(
      purposeVersionState.waitingForApproval
    );
    const mockEService = getMockEService();
    const mockPurpose: Purpose = {
      ...getMockPurpose(),
      eserviceId: mockEService.id,
      versions: [mockPurposeVersion],
    };

    await addOnePurpose(mockPurpose);
    await addOneEService(mockEService);

    expect(
      purposeService.deletePurposeVersion(
        {
          purposeId: mockPurpose.id,
          versionId: mockPurposeVersion.id,
        },
        getMockContext({ authData: getMockAuthData(mockPurpose.consumerId) })
      )
    ).rejects.toThrowError(
      purposeVersionCannotBeDeleted(mockPurpose.id, mockPurposeVersion.id)
    );
  });
  it.each([purposeVersionState.active, purposeVersionState.waitingForApproval])(
    "should throw tenantIsNotTheDelegatedConsumer when the requester is the Consumer and is deleting a purpose version created by the delegate in deletePurposeVersion",
    async (s) => {
      const authData = getMockAuthData();
      const mockPurposeVersion: PurposeVersion = {
        ...getMockPurposeVersion(),
        state: s,
      };

      const mockPurpose: Purpose = {
        ...getMockPurpose(),
        versions: [mockPurposeVersion],
        consumerId: authData.organizationId,
        delegationId: generateId<DelegationId>(),
      };

      const delegation = getMockDelegation({
        id: mockPurpose.delegationId,
        kind: delegationKind.delegatedConsumer,
        eserviceId: mockPurpose.eserviceId,
        delegatorId: mockPurpose.consumerId,
        delegateId: generateId<TenantId>(),
        state: delegationState.active,
      });
      await addOnePurpose(mockPurpose);
      await addOneDelegation(delegation);

      expect(
        purposeService.deletePurposeVersion(
          {
            purposeId: mockPurpose.id,
            versionId: mockPurposeVersion.id,
          },
          getMockContext({ authData })
        )
      ).rejects.toThrowError(
        tenantIsNotTheDelegatedConsumer(authData.organizationId, delegation.id)
      );
    }
  );
  it("should throw purposeDelegationNotFound when the requester is the Consumer, is deleting a purpose created by a delegate in deletePurpose, but the delegation cannot be found", async () => {
    const authData = getMockAuthData();
    const mockEService = getMockEService();
    const mockPurposeVersion: PurposeVersion = getMockPurposeVersion(
      purposeVersionState.draft
    );
    const mockPurpose: Purpose = {
      ...getMockPurpose(),
      eserviceId: mockEService.id,
      versions: [mockPurposeVersion],
      delegationId: generateId<DelegationId>(),
      consumerId: authData.organizationId,
    };

    await addOnePurpose(mockPurpose);
    await addOneEService(mockEService);

    expect(
      purposeService.deletePurposeVersion(
        {
          purposeId: mockPurpose.id,
          versionId: mockPurposeVersion.id,
        },
        getMockContext({ authData })
      )
    ).rejects.toThrowError(
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      purposeDelegationNotFound(mockPurpose.id, mockPurpose.delegationId!)
    );
  });
  it("should throw tenantIsNotTheConsumer when the requester is a delegate for the eservice and there is no delegationId in the purpose", async () => {
    const authData = getMockAuthData();
    const mockPurposeVersion: PurposeVersion = {
      ...getMockPurposeVersion(),
      state: purposeVersionState.draft,
    };
    const mockPurpose: Purpose = {
      ...getMockPurpose(),
      versions: [mockPurposeVersion],
      consumerId: authData.organizationId,
      delegationId: undefined,
    };

    const delegation = getMockDelegation({
      kind: delegationKind.delegatedConsumer,
      eserviceId: mockPurpose.eserviceId,
      delegatorId: mockPurpose.consumerId,
      delegateId: generateId<TenantId>(),
      state: delegationState.active,
    });
    await addOnePurpose(mockPurpose);
    await addOneDelegation(delegation);

    expect(
      purposeService.deletePurposeVersion(
        {
          purposeId: mockPurpose.id,
          versionId: mockPurposeVersion.id,
        },
        getMockContext({ authData: getMockAuthData(delegation.delegateId) })
      )
    ).rejects.toThrowError(tenantIsNotTheConsumer(delegation.delegateId));
  });
  it("should throw tenantIsNotTheDelegatedConsumer if the the requester is a delegate for the eservice and there is a delegationId in purpose but for a different delegationId (a different delegate)", async () => {
    const mockEService = getMockEService();

    const mockPurposeVersion: PurposeVersion = {
      ...getMockPurposeVersion(),
      state: purposeVersionState.draft,
    };
    const mockPurpose: Purpose = {
      ...getMockPurpose(),
      eserviceId: mockEService.id,
      versions: [mockPurposeVersion],
      delegationId: generateId<DelegationId>(),
    };

    const delegation = getMockDelegation({
      id: generateId<DelegationId>(),
      kind: delegationKind.delegatedConsumer,
      eserviceId: mockPurpose.eserviceId,
      delegatorId: mockPurpose.consumerId,
      delegateId: generateId<TenantId>(),
      state: delegationState.active,
    });

    const purposeDelegation = getMockDelegation({
      id: mockPurpose.delegationId,
      kind: delegationKind.delegatedConsumer,
      eserviceId: mockPurpose.eserviceId,
      delegatorId: mockPurpose.consumerId,
      delegateId: generateId<TenantId>(),
      state: delegationState.active,
    });
    await addOnePurpose(mockPurpose);
    await addOneDelegation(delegation);
    await addOneDelegation(purposeDelegation);
    await addOneEService(mockEService);

    expect(
      purposeService.deletePurposeVersion(
        {
          purposeId: mockPurpose.id,
          versionId: mockPurposeVersion.id,
        },
        getMockContext({ authData: getMockAuthData(delegation.delegateId) })
      )
    ).rejects.toThrowError(
      tenantIsNotTheDelegatedConsumer(
        delegation.delegateId,
        mockPurpose.delegationId
      )
    );
  });
});
