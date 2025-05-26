/* eslint-disable @typescript-eslint/no-floating-promises */
import {
  getMockPurposeVersion,
  getMockPurpose,
  decodeProtobufPayload,
  getMockDelegation,
  getMockAuthData,
  getMockContext,
  getMockEService,
} from "pagopa-interop-commons-test";
import {
  purposeVersionState,
  Purpose,
  generateId,
  PurposeVersionRejectedV2,
  PurposeVersion,
  toPurposeV2,
  PurposeId,
  PurposeVersionId,
  delegationState,
  delegationKind,
  DelegationId,
} from "pagopa-interop-models";
import { describe, expect, it, vi } from "vitest";
import {
  purposeNotFound,
  eserviceNotFound,
  tenantIsNotTheProducer,
  purposeVersionNotFound,
  notValidVersionState,
  tenantIsNotTheDelegatedProducer,
} from "../../src/model/domain/errors.js";
import {
  addOnePurpose,
  readLastPurposeEvent,
  purposeService,
  addOneDelegation,
  addOneEService,
} from "../integrationUtils.js";

describe("rejectPurposeVersion", () => {
  it("should write on event-store for the rejection of a purpose version ", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date());

    const mockEService = getMockEService();
    const mockPurposeVersion = {
      ...getMockPurposeVersion(),
      state: purposeVersionState.waitingForApproval,
    };
    const mockPurpose: Purpose = {
      ...getMockPurpose(),
      eserviceId: mockEService.id,
      versions: [mockPurposeVersion],
    };

    await addOnePurpose(mockPurpose);
    await addOneEService(mockEService);

    await purposeService.rejectPurposeVersion(
      {
        purposeId: mockPurpose.id,
        versionId: mockPurposeVersion.id,
        rejectionReason: "test",
      },
      getMockContext({ authData: getMockAuthData(mockEService.producerId) })
    );

    const writtenEvent = await readLastPurposeEvent(mockPurpose.id);

    expect(writtenEvent).toMatchObject({
      stream_id: mockPurpose.id,
      version: "1",
      type: "PurposeVersionRejected",
      event_version: 2,
    });

    const writtenPayload = decodeProtobufPayload({
      messageType: PurposeVersionRejectedV2,
      payload: writtenEvent.data,
    });

    const expectedPurposeVersion: PurposeVersion = {
      ...mockPurposeVersion,
      state: purposeVersionState.rejected,
      rejectionReason: "test",
      updatedAt: new Date(),
    };
    const expectedPurpose: Purpose = {
      ...mockPurpose,
      versions: [expectedPurposeVersion],
      updatedAt: new Date(),
    };

    expect(writtenPayload.purpose).toEqual(toPurposeV2(expectedPurpose));

    vi.useRealTimers();
  });
  it("should write on event-store for the rejection of a purpose version when the requester is delegate producer", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date());

    const mockEService = getMockEService();
    const mockPurposeVersion = {
      ...getMockPurposeVersion(),
      state: purposeVersionState.waitingForApproval,
    };
    const mockPurpose: Purpose = {
      ...getMockPurpose(),
      eserviceId: mockEService.id,
      versions: [mockPurposeVersion],
    };

    await addOnePurpose(mockPurpose);
    await addOneEService(mockEService);

    const delegate = getMockAuthData();
    const delegation = getMockDelegation({
      kind: delegationKind.delegatedProducer,
      eserviceId: mockEService.id,
      delegateId: delegate.organizationId,
      state: delegationState.active,
      delegatorId: mockEService.producerId,
    });

    await addOneDelegation(delegation);

    await purposeService.rejectPurposeVersion(
      {
        purposeId: mockPurpose.id,
        versionId: mockPurposeVersion.id,
        rejectionReason: "test",
      },
      getMockContext({ authData: getMockAuthData(delegate.organizationId) })
    );

    const writtenEvent = await readLastPurposeEvent(mockPurpose.id);

    expect(writtenEvent).toMatchObject({
      stream_id: mockPurpose.id,
      version: "1",
      type: "PurposeVersionRejected",
      event_version: 2,
    });

    const writtenPayload = decodeProtobufPayload({
      messageType: PurposeVersionRejectedV2,
      payload: writtenEvent.data,
    });

    const expectedPurposeVersion: PurposeVersion = {
      ...mockPurposeVersion,
      state: purposeVersionState.rejected,
      rejectionReason: "test",
      updatedAt: new Date(),
    };
    const expectedPurpose: Purpose = {
      ...mockPurpose,
      versions: [expectedPurposeVersion],
      updatedAt: new Date(),
    };

    expect(writtenPayload.purpose).toEqual(toPurposeV2(expectedPurpose));

    vi.useRealTimers();
  });
  it("should write on event-store for the rejection of a purpose version created by a consumer delegate when the requester is the producer", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date());

    const mockEService = getMockEService();
    const mockPurposeVersion = {
      ...getMockPurposeVersion(),
      state: purposeVersionState.waitingForApproval,
    };
    const mockPurpose: Purpose = {
      ...getMockPurpose(),
      eserviceId: mockEService.id,
      versions: [mockPurposeVersion],
      delegationId: generateId<DelegationId>(),
    };

    const producerDelegation = getMockDelegation({
      id: mockPurpose.delegationId,
      kind: delegationKind.delegatedConsumer,
      eserviceId: mockEService.id,
      state: delegationState.active,
      delegatorId: mockEService.producerId,
    });

    await addOneDelegation(producerDelegation);
    await addOnePurpose(mockPurpose);
    await addOneEService(mockEService);

    await purposeService.rejectPurposeVersion(
      {
        purposeId: mockPurpose.id,
        versionId: mockPurposeVersion.id,
        rejectionReason: "test",
      },
      getMockContext({ authData: getMockAuthData(mockEService.producerId) })
    );

    const writtenEvent = await readLastPurposeEvent(mockPurpose.id);

    expect(writtenEvent).toMatchObject({
      stream_id: mockPurpose.id,
      version: "1",
      type: "PurposeVersionRejected",
      event_version: 2,
    });

    const writtenPayload = decodeProtobufPayload({
      messageType: PurposeVersionRejectedV2,
      payload: writtenEvent.data,
    });

    const expectedPurposeVersion: PurposeVersion = {
      ...mockPurposeVersion,
      state: purposeVersionState.rejected,
      rejectionReason: "test",
      updatedAt: new Date(),
    };
    const expectedPurpose: Purpose = {
      ...mockPurpose,
      versions: [expectedPurposeVersion],
      updatedAt: new Date(),
    };

    expect(writtenPayload.purpose).toEqual(toPurposeV2(expectedPurpose));

    vi.useRealTimers();
  });
  it("should write on event-store for the rejection of a purpose version created by a consumer delegate when the requester is delegate producer", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date());

    const mockEService = getMockEService();
    const mockPurposeVersion = {
      ...getMockPurposeVersion(),
      state: purposeVersionState.waitingForApproval,
    };
    const mockPurpose: Purpose = {
      ...getMockPurpose(),
      eserviceId: mockEService.id,
      versions: [mockPurposeVersion],
      delegationId: generateId<DelegationId>(),
    };

    await addOnePurpose(mockPurpose);
    await addOneEService(mockEService);

    const producerDelegate = getMockAuthData();
    const producerDelegation = getMockDelegation({
      kind: delegationKind.delegatedProducer,
      eserviceId: mockEService.id,
      delegateId: producerDelegate.organizationId,
      state: delegationState.active,
      delegatorId: mockEService.producerId,
    });

    const consumerDelegation = getMockDelegation({
      id: mockPurpose.delegationId,
      kind: delegationKind.delegatedConsumer,
      eserviceId: mockEService.id,
      state: delegationState.active,
      delegatorId: mockPurpose.consumerId,
    });

    await addOneDelegation(producerDelegation);
    await addOneDelegation(consumerDelegation);

    await purposeService.rejectPurposeVersion(
      {
        purposeId: mockPurpose.id,
        versionId: mockPurposeVersion.id,
        rejectionReason: "test",
      },
      getMockContext({
        authData: getMockAuthData(producerDelegate.organizationId),
      })
    );

    const writtenEvent = await readLastPurposeEvent(mockPurpose.id);

    expect(writtenEvent).toMatchObject({
      stream_id: mockPurpose.id,
      version: "1",
      type: "PurposeVersionRejected",
      event_version: 2,
    });

    const writtenPayload = decodeProtobufPayload({
      messageType: PurposeVersionRejectedV2,
      payload: writtenEvent.data,
    });

    const expectedPurposeVersion: PurposeVersion = {
      ...mockPurposeVersion,
      state: purposeVersionState.rejected,
      rejectionReason: "test",
      updatedAt: new Date(),
    };
    const expectedPurpose: Purpose = {
      ...mockPurpose,
      versions: [expectedPurposeVersion],
      updatedAt: new Date(),
      delegationId: mockPurpose.delegationId,
    };

    expect(writtenPayload.purpose).toEqual(toPurposeV2(expectedPurpose));

    vi.useRealTimers();
  });
  it("should throw purposeNotFound if the purpose doesn't exist", async () => {
    const mockEService = getMockEService();
    const mockPurposeVersion = getMockPurposeVersion();
    const randomId: PurposeId = generateId();
    const mockPurpose: Purpose = {
      ...getMockPurpose(),
      eserviceId: mockEService.id,
      versions: [mockPurposeVersion],
    };

    await addOnePurpose(mockPurpose);
    await addOneEService(mockEService);

    expect(
      purposeService.rejectPurposeVersion(
        {
          purposeId: randomId,
          versionId: mockPurposeVersion.id,
          rejectionReason: "test",
        },
        getMockContext({ authData: getMockAuthData(mockEService.producerId) })
      )
    ).rejects.toThrowError(purposeNotFound(randomId));
  });
  it("Should throw eserviceNotFound if the eservice doesn't exist", async () => {
    const mockEService = getMockEService();
    const mockPurposeVersion = getMockPurposeVersion();
    const mockPurpose: Purpose = {
      ...getMockPurpose(),
      eserviceId: mockEService.id,
      versions: [mockPurposeVersion],
    };

    await addOnePurpose(mockPurpose);

    expect(
      purposeService.rejectPurposeVersion(
        {
          purposeId: mockPurpose.id,
          versionId: mockPurposeVersion.id,
          rejectionReason: "test",
        },
        getMockContext({ authData: getMockAuthData(mockPurpose.consumerId) })
      )
    ).rejects.toThrowError(eserviceNotFound(mockEService.id));
  });
  it("should throw tenantIsNotTheProducer if the requester is not the producer nor delegate", async () => {
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
      purposeService.rejectPurposeVersion(
        {
          purposeId: mockPurpose.id,
          versionId: mockPurposeVersion.id,
          rejectionReason: "test",
        },
        getMockContext({ authData: getMockAuthData(mockPurpose.consumerId) })
      )
    ).rejects.toThrowError(tenantIsNotTheProducer(mockPurpose.consumerId));
  });
  it("should throw tenantIsNotTheDelegatedProducer if the purpose e-service has an active delegation and the requester is the producer", async () => {
    const mockEService = getMockEService();
    const mockPurposeVersion = getMockPurposeVersion();
    const mockPurpose: Purpose = {
      ...getMockPurpose(),
      eserviceId: mockEService.id,
      versions: [mockPurposeVersion],
    };

    await addOnePurpose(mockPurpose);
    await addOneEService(mockEService);

    const delegate = getMockAuthData();
    const delegation = getMockDelegation({
      kind: delegationKind.delegatedProducer,
      eserviceId: mockEService.id,
      delegateId: delegate.organizationId,
      state: delegationState.active,
    });

    await addOneDelegation(delegation);

    expect(
      purposeService.rejectPurposeVersion(
        {
          purposeId: mockPurpose.id,
          versionId: mockPurposeVersion.id,
          rejectionReason: "test",
        },
        getMockContext({ authData: getMockAuthData(mockEService.producerId) })
      )
    ).rejects.toThrowError(
      tenantIsNotTheDelegatedProducer(mockEService.producerId, delegation.id)
    );
  });
  it("should throw tenantIsNotTheDelegatedProducer if the purpose e-service has an active delegation and the requester is not the producer nor the delegate", async () => {
    const mockEService = getMockEService();
    const mockPurposeVersion = getMockPurposeVersion();
    const mockPurpose: Purpose = {
      ...getMockPurpose(),
      eserviceId: mockEService.id,
      versions: [mockPurposeVersion],
    };

    await addOnePurpose(mockPurpose);
    await addOneEService(mockEService);

    const delegate = getMockAuthData();
    const delegation = getMockDelegation({
      kind: delegationKind.delegatedProducer,
      eserviceId: mockEService.id,
      delegateId: delegate.organizationId,
      state: delegationState.active,
    });

    await addOneDelegation(delegation);

    const randomCaller = getMockAuthData();

    expect(
      purposeService.rejectPurposeVersion(
        {
          purposeId: mockPurpose.id,
          versionId: mockPurposeVersion.id,
          rejectionReason: "test",
        },
        getMockContext({
          authData: getMockAuthData(randomCaller.organizationId),
        })
      )
    ).rejects.toThrowError(
      tenantIsNotTheDelegatedProducer(
        randomCaller.organizationId,
        delegation.id
      )
    );
  });
  it.each(
    Object.values(delegationState).filter((s) => s !== delegationState.active)
  )(
    "should throw tenantIsNotTheProducer if the requester is the e-service delegate but the delegation is in %s state",
    async (delegationState) => {
      const mockEService = getMockEService();
      const mockPurposeVersion = getMockPurposeVersion();
      const mockPurpose: Purpose = {
        ...getMockPurpose(),
        eserviceId: mockEService.id,
        versions: [mockPurposeVersion],
      };

      await addOnePurpose(mockPurpose);
      await addOneEService(mockEService);

      const delegate = getMockAuthData();
      const delegation = getMockDelegation({
        kind: delegationKind.delegatedProducer,
        eserviceId: mockEService.id,
        delegateId: delegate.organizationId,
        state: delegationState,
      });

      await addOneDelegation(delegation);

      expect(
        purposeService.rejectPurposeVersion(
          {
            purposeId: mockPurpose.id,
            versionId: mockPurposeVersion.id,
            rejectionReason: "test",
          },
          getMockContext({
            authData: getMockAuthData(delegate.organizationId),
          })
        )
      ).rejects.toThrowError(tenantIsNotTheProducer(delegate.organizationId));
    }
  );
  it("should throw purposeVersionNotFound if the purpose version doesn't exist", async () => {
    const mockEService = getMockEService();
    const mockPurposeVersion = getMockPurposeVersion();
    const randomVersionId: PurposeVersionId = generateId();
    const mockPurpose: Purpose = {
      ...getMockPurpose(),
      eserviceId: mockEService.id,
      versions: [mockPurposeVersion],
    };

    await addOnePurpose(mockPurpose);
    await addOneEService(mockEService);

    expect(
      purposeService.rejectPurposeVersion(
        {
          purposeId: mockPurpose.id,
          versionId: randomVersionId,
          rejectionReason: "test",
        },
        getMockContext({ authData: getMockAuthData(mockEService.producerId) })
      )
    ).rejects.toThrowError(
      purposeVersionNotFound(mockPurpose.id, randomVersionId)
    );
  });
  it.each(
    Object.values(purposeVersionState).filter(
      (state) => state !== purposeVersionState.waitingForApproval
    )
  )(
    "should throw notValidVersionState if the purpose version is in %s state",
    async (state) => {
      const mockEService = getMockEService();
      const mockPurposeVersion = getMockPurposeVersion(state);

      const mockPurpose: Purpose = {
        ...getMockPurpose(),
        eserviceId: mockEService.id,
        versions: [mockPurposeVersion],
      };

      await addOnePurpose(mockPurpose);
      await addOneEService(mockEService);

      expect(
        purposeService.rejectPurposeVersion(
          {
            purposeId: mockPurpose.id,
            versionId: mockPurposeVersion.id,
            rejectionReason: "test",
          },
          getMockContext({
            authData: getMockAuthData(mockEService.producerId),
          })
        )
      ).rejects.toThrowError(
        notValidVersionState(mockPurposeVersion.id, mockPurposeVersion.state)
      );
    }
  );
});
