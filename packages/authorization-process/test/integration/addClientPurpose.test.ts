/* eslint-disable @typescript-eslint/no-floating-promises */
import {
  decodeProtobufPayload,
  getMockAgreement,
  getMockClient,
  getMockContext,
  getMockDelegation,
  getMockDescriptor,
  getMockDocument,
  getMockEService,
  getMockPurpose,
  getMockPurposeVersion,
  getMockAuthData,
} from "pagopa-interop-commons-test";
import { describe, expect, it } from "vitest";
import {
  Agreement,
  Client,
  ClientPurposeAddedV2,
  Descriptor,
  Purpose,
  TenantId,
  agreementState,
  delegationKind,
  delegationState,
  descriptorState,
  generateId,
  purposeVersionState,
  toClientV2,
  ClientKind,
} from "pagopa-interop-models";
import {
  clientNotFound,
  purposeDelegationNotFound,
  eserviceNotDelegableForClientAccess,
  eserviceNotFound,
  noActiveOrSuspendedAgreementFound,
  noActiveOrSuspendedPurposeVersionFound,
  tenantNotAllowedOnClient,
  tenantNotAllowedOnPurpose,
  purposeAlreadyLinkedToClient,
  purposeNotFound,
  clientKindNotAllowed,
} from "../../src/model/domain/errors.js";
import {
  addOneAgreement,
  addOneClient,
  addOneDelegation,
  addOneEService,
  addOnePurpose,
  authorizationService,
  readLastAuthorizationEvent,
} from "../integrationUtils.js";

describe("addClientPurpose", async () => {
  it("should write on event-store for the addition of a purpose into a client", async () => {
    const mockDescriptor: Descriptor = {
      ...getMockDescriptor(),
      state: descriptorState.published,
      interface: getMockDocument(),
      publishedAt: new Date(),
    };

    const mockEservice = {
      ...getMockEService(),
      descriptors: [mockDescriptor],
    };
    const mockConsumerId: TenantId = generateId();

    const mockPurpose: Purpose = {
      ...getMockPurpose(),
      eserviceId: mockEservice.id,
      consumerId: mockConsumerId,
      versions: [getMockPurposeVersion(purposeVersionState.active)],
    };

    const mockClient: Client = {
      ...getMockClient(),
      consumerId: mockConsumerId,
    };

    const mockAgreement: Agreement = {
      ...getMockAgreement(),
      state: agreementState.active,
      eserviceId: mockEservice.id,
      descriptorId: mockDescriptor.id,
      consumerId: mockConsumerId,
    };

    await addOneClient(mockClient);
    await addOnePurpose(mockPurpose);
    await addOneEService(mockEservice);
    await addOneAgreement(mockAgreement);

    const addClientPurposeResponse =
      await authorizationService.addClientPurpose(
        {
          clientId: mockClient.id,
          seed: { purposeId: mockPurpose.id },
        },
        getMockContext({ authData: getMockAuthData(mockConsumerId) })
      );

    const writtenEvent = await readLastAuthorizationEvent(mockClient.id);

    expect(writtenEvent).toMatchObject({
      stream_id: mockClient.id,
      version: "1",
      type: "ClientPurposeAdded",
      event_version: 2,
    });

    const writtenPayload = decodeProtobufPayload({
      messageType: ClientPurposeAddedV2,
      payload: writtenEvent.data,
    });

    const expectedClient: Client = {
      ...mockClient,
      purposes: [...mockClient.purposes, mockPurpose.id],
    };
    expect(writtenPayload).toEqual({
      purposeId: mockPurpose.id,
      client: toClientV2(expectedClient),
    });
    expect(addClientPurposeResponse).toEqual({
      data: expectedClient,
      metadata: {
        version: 1,
      },
    });
  });

  it("should write on event-store for the addition of a purpose into a client when the eservice has an active Consumer delegation and the requester is the delegator", async () => {
    const mockDescriptor: Descriptor = {
      ...getMockDescriptor(),
      state: descriptorState.published,
      interface: getMockDocument(),
      publishedAt: new Date(),
    };

    const mockEservice = {
      ...getMockEService(),
      descriptors: [mockDescriptor],
    };
    const mockConsumerId: TenantId = generateId();

    const mockPurpose: Purpose = {
      ...getMockPurpose(),
      eserviceId: mockEservice.id,
      consumerId: mockConsumerId,
      versions: [getMockPurposeVersion(purposeVersionState.active)],
      delegationId: undefined,
    };

    const mockClient: Client = {
      ...getMockClient(),
      consumerId: mockConsumerId,
    };

    const mockAgreement: Agreement = {
      ...getMockAgreement(),
      state: agreementState.active,
      eserviceId: mockEservice.id,
      descriptorId: mockDescriptor.id,
      consumerId: mockConsumerId,
    };

    const delegation = getMockDelegation({
      kind: delegationKind.delegatedConsumer,
      eserviceId: mockPurpose.eserviceId,
      delegatorId: mockPurpose.consumerId,
      delegateId: generateId<TenantId>(),
      state: delegationState.active,
    });

    await addOneClient(mockClient);
    await addOneDelegation(delegation);
    await addOnePurpose(mockPurpose);
    await addOneEService(mockEservice);
    await addOneAgreement(mockAgreement);

    const addClientPurposeResponse =
      await authorizationService.addClientPurpose(
        {
          clientId: mockClient.id,
          seed: { purposeId: mockPurpose.id },
        },
        getMockContext({
          authData: getMockAuthData(mockClient.consumerId),
        })
      );

    const writtenEvent = await readLastAuthorizationEvent(mockClient.id);

    expect(writtenEvent).toMatchObject({
      stream_id: mockClient.id,
      version: "1",
      type: "ClientPurposeAdded",
      event_version: 2,
    });

    const writtenPayload = decodeProtobufPayload({
      messageType: ClientPurposeAddedV2,
      payload: writtenEvent.data,
    });

    const expectedClient: Client = {
      ...mockClient,
      purposes: [...mockClient.purposes, mockPurpose.id],
    };
    expect(writtenPayload).toEqual({
      purposeId: mockPurpose.id,
      client: toClientV2(expectedClient),
    });
    expect(addClientPurposeResponse).toEqual({
      data: expectedClient,
      metadata: {
        version: 1,
      },
    });
  });

  it("should write on event-store for the addition of a purpose created by the delegate into a client when the eservice has an active Consumer delegation and the requester is the delegator", async () => {
    const mockDescriptor: Descriptor = {
      ...getMockDescriptor(),
      state: descriptorState.published,
      interface: getMockDocument(),
      publishedAt: new Date(),
    };

    const mockEservice = {
      ...getMockEService(),
      descriptors: [mockDescriptor],
    };
    const mockConsumerId: TenantId = generateId();

    const delegation = getMockDelegation({
      kind: delegationKind.delegatedConsumer,
      eserviceId: mockEservice.id,
      delegatorId: mockConsumerId,
      state: delegationState.active,
    });

    const mockPurpose: Purpose = {
      ...getMockPurpose(),
      eserviceId: mockEservice.id,
      consumerId: mockConsumerId,
      delegationId: delegation.id,
      versions: [getMockPurposeVersion(purposeVersionState.active)],
    };

    const mockClient: Client = {
      ...getMockClient(),
      consumerId: mockConsumerId,
    };

    const mockAgreement: Agreement = {
      ...getMockAgreement(),
      state: agreementState.active,
      eserviceId: mockEservice.id,
      descriptorId: mockDescriptor.id,
      consumerId: mockConsumerId,
    };

    await addOneClient(mockClient);
    await addOneDelegation(delegation);
    await addOnePurpose(mockPurpose);
    await addOneEService(mockEservice);
    await addOneAgreement(mockAgreement);

    const addClientPurposeResponse =
      await authorizationService.addClientPurpose(
        {
          clientId: mockClient.id,
          seed: { purposeId: mockPurpose.id },
        },
        getMockContext({
          authData: getMockAuthData(mockClient.consumerId),
        })
      );

    const writtenEvent = await readLastAuthorizationEvent(mockClient.id);

    expect(writtenEvent).toMatchObject({
      stream_id: mockClient.id,
      version: "1",
      type: "ClientPurposeAdded",
      event_version: 2,
    });

    const writtenPayload = decodeProtobufPayload({
      messageType: ClientPurposeAddedV2,
      payload: writtenEvent.data,
    });

    const expectedClient: Client = {
      ...mockClient,
      purposes: [...mockClient.purposes, mockPurpose.id],
    };
    expect(writtenPayload).toEqual({
      purposeId: mockPurpose.id,
      client: toClientV2(expectedClient),
    });

    expect(addClientPurposeResponse).toEqual({
      data: expectedClient,
      metadata: {
        version: 1,
      },
    });
  });

  it("should throw clientNotFound if the client doesn't exist", async () => {
    const mockDescriptor: Descriptor = {
      ...getMockDescriptor(),
      state: descriptorState.published,
      interface: getMockDocument(),
      publishedAt: new Date(),
    };

    const mockEservice = {
      ...getMockEService(),
      descriptors: [mockDescriptor],
    };
    const mockConsumerId: TenantId = generateId();

    const mockPurpose: Purpose = {
      ...getMockPurpose(),
      eserviceId: mockEservice.id,
      consumerId: mockConsumerId,
      versions: [getMockPurposeVersion(purposeVersionState.active)],
    };

    const mockClient: Client = {
      ...getMockClient(),
      consumerId: mockConsumerId,
    };

    const mockAgreement: Agreement = {
      ...getMockAgreement(),
      state: agreementState.active,
      eserviceId: mockEservice.id,
      descriptorId: mockDescriptor.id,
      consumerId: mockConsumerId,
    };

    await addOnePurpose(mockPurpose);
    await addOneEService(mockEservice);
    await addOneAgreement(mockAgreement);

    expect(
      authorizationService.addClientPurpose(
        {
          clientId: mockClient.id,
          seed: { purposeId: mockPurpose.id },
        },
        getMockContext({ authData: getMockAuthData(mockConsumerId) })
      )
    ).rejects.toThrowError(clientNotFound(mockClient.id));
  });
  it("should throw tenantNotAllowedOnClient if the requester is not the client consumer", async () => {
    const mockDescriptor: Descriptor = {
      ...getMockDescriptor(),
      state: descriptorState.published,
      interface: getMockDocument(),
      publishedAt: new Date(),
    };

    const mockEservice = {
      ...getMockEService(),
      descriptors: [mockDescriptor],
    };
    const mockConsumerId: TenantId = generateId();

    const mockPurpose: Purpose = {
      ...getMockPurpose(),
      eserviceId: mockEservice.id,
      consumerId: mockConsumerId,
      versions: [getMockPurposeVersion(purposeVersionState.active)],
    };

    const mockClient: Client = {
      ...getMockClient(),
      consumerId: generateId(),
    };

    const mockAgreement: Agreement = {
      ...getMockAgreement(),
      state: agreementState.active,
      eserviceId: mockEservice.id,
      descriptorId: mockDescriptor.id,
      consumerId: mockConsumerId,
    };

    await addOneClient(mockClient);
    await addOnePurpose(mockPurpose);
    await addOneEService(mockEservice);
    await addOneAgreement(mockAgreement);

    expect(
      authorizationService.addClientPurpose(
        {
          clientId: mockClient.id,
          seed: { purposeId: mockPurpose.id },
        },
        getMockContext({ authData: getMockAuthData(mockConsumerId) })
      )
    ).rejects.toThrowError(
      tenantNotAllowedOnClient(mockConsumerId, mockClient.id)
    );
  });
  it("should throw clientKindNotAllowed if the requester is the client api", async () => {
    const mockConsumerId: TenantId = generateId();

    const mockPurpose: Purpose = {
      ...getMockPurpose(),
      versions: [getMockPurposeVersion(purposeVersionState.active)],
    };

    const mockClient: Client = {
      ...getMockClient(),
      kind: ClientKind.Enum.Api,
    };

    await addOneClient(mockClient);
    await addOnePurpose(mockPurpose);

    expect(
      authorizationService.addClientPurpose(
        {
          clientId: mockClient.id,
          seed: { purposeId: mockPurpose.id },
        },
        getMockContext({ authData: getMockAuthData(mockConsumerId) })
      )
    ).rejects.toThrowError(clientKindNotAllowed(mockClient.id));
  });
  it("should throw purposeNotFound if the purpose doesn't exist", async () => {
    const mockDescriptor: Descriptor = {
      ...getMockDescriptor(),
      state: descriptorState.published,
      interface: getMockDocument(),
      publishedAt: new Date(),
    };

    const mockEservice = {
      ...getMockEService(),
      descriptors: [mockDescriptor],
    };
    const mockConsumerId: TenantId = generateId();

    const mockPurpose: Purpose = {
      ...getMockPurpose(),
      eserviceId: mockEservice.id,
      consumerId: mockConsumerId,
      versions: [getMockPurposeVersion(purposeVersionState.active)],
    };

    const mockClient: Client = {
      ...getMockClient(),
      consumerId: mockConsumerId,
    };

    const mockAgreement: Agreement = {
      ...getMockAgreement(),
      state: agreementState.active,
      eserviceId: mockEservice.id,
      descriptorId: mockDescriptor.id,
      consumerId: mockConsumerId,
    };

    await addOneClient(mockClient);
    await addOneEService(mockEservice);
    await addOneAgreement(mockAgreement);

    expect(
      authorizationService.addClientPurpose(
        {
          clientId: mockClient.id,
          seed: { purposeId: mockPurpose.id },
        },
        getMockContext({ authData: getMockAuthData(mockConsumerId) })
      )
    ).rejects.toThrowError(purposeNotFound(mockPurpose.id));
  });
  it("should throw tenantNotAllowedOnPurpose if the requester is not the purpose consumer", async () => {
    const mockDescriptor: Descriptor = {
      ...getMockDescriptor(),
      state: descriptorState.published,
      interface: getMockDocument(),
      publishedAt: new Date(),
    };

    const mockEservice = {
      ...getMockEService(),
      descriptors: [mockDescriptor],
    };
    const mockConsumerId: TenantId = generateId();

    const mockPurpose: Purpose = {
      ...getMockPurpose(),
      eserviceId: mockEservice.id,
      consumerId: generateId(),
      versions: [getMockPurposeVersion(purposeVersionState.active)],
    };

    const mockClient: Client = {
      ...getMockClient(),
      consumerId: mockConsumerId,
    };

    const mockAgreement: Agreement = {
      ...getMockAgreement(),
      state: agreementState.active,
      eserviceId: mockEservice.id,
      descriptorId: mockDescriptor.id,
      consumerId: mockConsumerId,
    };

    await addOneClient(mockClient);
    await addOnePurpose(mockPurpose);
    await addOneEService(mockEservice);
    await addOneAgreement(mockAgreement);

    expect(
      authorizationService.addClientPurpose(
        {
          clientId: mockClient.id,
          seed: { purposeId: mockPurpose.id },
        },
        getMockContext({ authData: getMockAuthData(mockConsumerId) })
      )
    ).rejects.toThrowError(
      tenantNotAllowedOnPurpose(mockConsumerId, mockPurpose.id)
    );
  });
  it("should throw eserviceNotFound if the eservice doesn't exist", async () => {
    const mockDescriptor: Descriptor = {
      ...getMockDescriptor(),
      state: descriptorState.published,
      interface: getMockDocument(),
      publishedAt: new Date(),
    };

    const mockEservice = {
      ...getMockEService(),
      descriptors: [mockDescriptor],
    };
    const mockConsumerId: TenantId = generateId();

    const mockPurpose: Purpose = {
      ...getMockPurpose(),
      eserviceId: mockEservice.id,
      consumerId: mockConsumerId,
      versions: [getMockPurposeVersion(purposeVersionState.active)],
    };

    const mockClient: Client = {
      ...getMockClient(),
      consumerId: mockConsumerId,
    };

    const mockAgreement: Agreement = {
      ...getMockAgreement(),
      state: agreementState.active,
      eserviceId: mockEservice.id,
      descriptorId: mockDescriptor.id,
      consumerId: mockConsumerId,
    };

    await addOneClient(mockClient);
    await addOnePurpose(mockPurpose);
    await addOneAgreement(mockAgreement);

    expect(
      authorizationService.addClientPurpose(
        {
          clientId: mockClient.id,
          seed: { purposeId: mockPurpose.id },
        },
        getMockContext({ authData: getMockAuthData(mockConsumerId) })
      )
    ).rejects.toThrowError(eserviceNotFound(mockEservice.id));
  });
  it("should throw noActiveOrSuspendedAgreementFound if there is no agreement in required states (found no agreement)", async () => {
    const mockDescriptor: Descriptor = {
      ...getMockDescriptor(),
      state: descriptorState.published,
      interface: getMockDocument(),
      publishedAt: new Date(),
    };

    const mockEservice = {
      ...getMockEService(),
      descriptors: [mockDescriptor],
    };
    const mockConsumerId: TenantId = generateId();

    const mockPurpose: Purpose = {
      ...getMockPurpose(),
      eserviceId: mockEservice.id,
      consumerId: mockConsumerId,
      versions: [getMockPurposeVersion(purposeVersionState.active)],
    };
    const mockClient: Client = {
      ...getMockClient(),
      consumerId: mockConsumerId,
    };

    await addOneClient(mockClient);
    await addOnePurpose(mockPurpose);
    await addOneEService(mockEservice);

    expect(
      authorizationService.addClientPurpose(
        {
          clientId: mockClient.id,
          seed: { purposeId: mockPurpose.id },
        },
        getMockContext({ authData: getMockAuthData(mockConsumerId) })
      )
    ).rejects.toThrowError(
      noActiveOrSuspendedAgreementFound(mockEservice.id, mockConsumerId)
    );
  });
  it.each(
    Object.values(agreementState).filter(
      (state) =>
        state !== agreementState.active && state !== agreementState.suspended
    )
  )(
    "should throw noActiveOrSuspendedAgreementFound if there is no agreement in required states (found: %s agreements)",
    async (agreementState) => {
      const mockDescriptor: Descriptor = {
        ...getMockDescriptor(),
        state: descriptorState.published,
        interface: getMockDocument(),
        publishedAt: new Date(),
      };

      const mockEservice = {
        ...getMockEService(),
        descriptors: [mockDescriptor],
      };
      const mockConsumerId: TenantId = generateId();

      const mockAgreement: Agreement = {
        ...getMockAgreement(),
        eserviceId: mockEservice.id,
        consumerId: mockConsumerId,
        state: agreementState,
      };

      const mockPurpose: Purpose = {
        ...getMockPurpose(),
        eserviceId: mockEservice.id,
        consumerId: mockConsumerId,
        versions: [getMockPurposeVersion(purposeVersionState.active)],
      };
      const mockClient: Client = {
        ...getMockClient(),
        consumerId: mockConsumerId,
      };

      await addOneClient(mockClient);
      await addOnePurpose(mockPurpose);
      await addOneEService(mockEservice);
      await addOneAgreement(mockAgreement);

      expect(
        authorizationService.addClientPurpose(
          {
            clientId: mockClient.id,
            seed: { purposeId: mockPurpose.id },
          },
          getMockContext({ authData: getMockAuthData(mockConsumerId) })
        )
      ).rejects.toThrowError(
        noActiveOrSuspendedAgreementFound(mockEservice.id, mockConsumerId)
      );
    }
  );
  it("should throw descriptorNotFound if the descriptor doesn't exist", async () => {
    const mockDescriptor: Descriptor = {
      ...getMockDescriptor(),
      state: descriptorState.published,
      interface: getMockDocument(),
      publishedAt: new Date(),
    };

    const mockEservice = {
      ...getMockEService(),
      descriptors: [],
    };

    const mockConsumerId: TenantId = generateId();

    const mockPurpose: Purpose = {
      ...getMockPurpose(),
      eserviceId: mockEservice.id,
      consumerId: mockConsumerId,
      versions: [getMockPurposeVersion(purposeVersionState.active)],
    };

    const mockClient: Client = {
      ...getMockClient(),
      consumerId: mockConsumerId,
    };

    const mockAgreement: Agreement = {
      ...getMockAgreement(),
      state: agreementState.active,
      eserviceId: mockEservice.id,
      descriptorId: mockDescriptor.id,
      consumerId: mockConsumerId,
    };

    await addOneClient(mockClient);
    await addOnePurpose(mockPurpose);
    await addOneEService(mockEservice);
    await addOneAgreement(mockAgreement);

    expect(
      authorizationService.addClientPurpose(
        {
          clientId: mockClient.id,
          seed: { purposeId: mockPurpose.id },
        },
        getMockContext({ authData: getMockAuthData(mockConsumerId) })
      )
    ).rejects.toThrowError(mockDescriptor.id);
  });
  it("should throw noActiveOrSuspendedPurposeVersionFound if the purpose has no versions in required states (found no versions)", async () => {
    const mockDescriptor: Descriptor = {
      ...getMockDescriptor(),
      state: descriptorState.published,
      interface: getMockDocument(),
      publishedAt: new Date(),
    };

    const mockEservice = {
      ...getMockEService(),
      descriptors: [mockDescriptor],
    };

    const mockConsumerId: TenantId = generateId();

    const mockPurpose: Purpose = {
      ...getMockPurpose(),
      eserviceId: mockEservice.id,
      consumerId: mockConsumerId,
      versions: [],
    };

    const mockClient: Client = {
      ...getMockClient(),
      consumerId: mockConsumerId,
    };

    const mockAgreement: Agreement = {
      ...getMockAgreement(),
      state: agreementState.active,
      eserviceId: mockEservice.id,
      descriptorId: mockDescriptor.id,
      consumerId: mockConsumerId,
    };

    await addOneClient(mockClient);
    await addOnePurpose(mockPurpose);
    await addOneEService(mockEservice);
    await addOneAgreement(mockAgreement);

    expect(
      authorizationService.addClientPurpose(
        {
          clientId: mockClient.id,
          seed: { purposeId: mockPurpose.id },
        },
        getMockContext({ authData: getMockAuthData(mockConsumerId) })
      )
    ).rejects.toThrowError(
      noActiveOrSuspendedPurposeVersionFound(mockPurpose.id)
    );
  });
  it.each(
    Object.values(purposeVersionState).filter(
      (state) =>
        state !== purposeVersionState.active &&
        state !== purposeVersionState.suspended
    )
  )(
    "should throw noActiveOrSuspendedPurposeVersionFound if the purpose has no versions in required states (found: %s version)",
    async (versionState) => {
      const mockDescriptor: Descriptor = {
        ...getMockDescriptor(),
        state: descriptorState.published,
        interface: getMockDocument(),
        publishedAt: new Date(),
      };

      const mockEservice = {
        ...getMockEService(),
        descriptors: [mockDescriptor],
      };

      const mockConsumerId: TenantId = generateId();

      const mockPurpose: Purpose = {
        ...getMockPurpose(),
        eserviceId: mockEservice.id,
        consumerId: mockConsumerId,
        versions: [getMockPurposeVersion(versionState)],
      };

      const mockClient: Client = {
        ...getMockClient(),
        consumerId: mockConsumerId,
      };

      const mockAgreement: Agreement = {
        ...getMockAgreement(),
        state: agreementState.active,
        eserviceId: mockEservice.id,
        descriptorId: mockDescriptor.id,
        consumerId: mockConsumerId,
      };

      await addOneClient(mockClient);
      await addOnePurpose(mockPurpose);
      await addOneEService(mockEservice);
      await addOneAgreement(mockAgreement);

      expect(
        authorizationService.addClientPurpose(
          {
            clientId: mockClient.id,
            seed: { purposeId: mockPurpose.id },
          },
          getMockContext({ authData: getMockAuthData(mockConsumerId) })
        )
      ).rejects.toThrowError(
        noActiveOrSuspendedPurposeVersionFound(mockPurpose.id)
      );
    }
  );
  it("should throw purposeAlreadyLinkedToClient if the purpose is already linked to that client", async () => {
    const mockDescriptor: Descriptor = {
      ...getMockDescriptor(),
      state: descriptorState.published,
      interface: getMockDocument(),
      publishedAt: new Date(),
    };

    const mockEservice = {
      ...getMockEService(),
      descriptors: [mockDescriptor],
    };
    const mockConsumerId: TenantId = generateId();

    const mockPurpose: Purpose = {
      ...getMockPurpose(),
      eserviceId: mockEservice.id,
      consumerId: mockConsumerId,
      versions: [getMockPurposeVersion(purposeVersionState.active)],
    };

    const mockClient: Client = {
      ...getMockClient(),
      consumerId: mockConsumerId,
      purposes: [mockPurpose.id],
    };

    const mockAgreement: Agreement = {
      ...getMockAgreement(),
      state: agreementState.active,
      eserviceId: mockEservice.id,
      descriptorId: mockDescriptor.id,
      consumerId: mockConsumerId,
    };

    await addOneClient(mockClient);
    await addOnePurpose(mockPurpose);
    await addOneEService(mockEservice);
    await addOneAgreement(mockAgreement);

    expect(
      authorizationService.addClientPurpose(
        {
          clientId: mockClient.id,
          seed: { purposeId: mockPurpose.id },
        },
        getMockContext({ authData: getMockAuthData(mockConsumerId) })
      )
    ).rejects.toThrowError(
      purposeAlreadyLinkedToClient(mockPurpose.id, mockClient.id)
    );
  });
  it("should write on event-store for the addition of a purpose into a client where the requester is the delegate", async () => {
    const mockDescriptor: Descriptor = {
      ...getMockDescriptor(),
      state: descriptorState.published,
      interface: getMockDocument(),
      publishedAt: new Date(),
    };

    const mockEservice = {
      ...getMockEService(),
      descriptors: [mockDescriptor],
      isClientAccessDelegable: true,
    };
    const delegateId: TenantId = generateId();
    const consumerId: TenantId = generateId();

    const delegation = getMockDelegation({
      delegateId,
      delegatorId: consumerId,
      state: delegationState.active,
      eserviceId: mockEservice.id,
      kind: delegationKind.delegatedConsumer,
    });
    await addOneDelegation(delegation);

    const mockPurpose: Purpose = {
      ...getMockPurpose(),
      eserviceId: mockEservice.id,
      consumerId,
      delegationId: delegation.id,
      versions: [getMockPurposeVersion(purposeVersionState.active)],
    };

    const mockClient: Client = {
      ...getMockClient(),
      consumerId: delegateId,
    };

    const mockAgreement: Agreement = {
      ...getMockAgreement(),
      state: agreementState.active,
      eserviceId: mockEservice.id,
      descriptorId: mockDescriptor.id,
      consumerId,
    };

    await addOneClient(mockClient);
    await addOnePurpose(mockPurpose);
    await addOneEService(mockEservice);
    await addOneAgreement(mockAgreement);

    const addClientPurposeResponse =
      await authorizationService.addClientPurpose(
        {
          clientId: mockClient.id,
          seed: { purposeId: mockPurpose.id },
        },
        getMockContext({ authData: getMockAuthData(delegateId) })
      );

    const writtenEvent = await readLastAuthorizationEvent(mockClient.id);

    expect(writtenEvent).toMatchObject({
      stream_id: mockClient.id,
      version: "1",
      type: "ClientPurposeAdded",
      event_version: 2,
    });

    const writtenPayload = decodeProtobufPayload({
      messageType: ClientPurposeAddedV2,
      payload: writtenEvent.data,
    });

    const expectedClient = {
      ...mockClient,
      purposes: [...mockClient.purposes, mockPurpose.id],
    };
    expect(writtenPayload).toEqual({
      purposeId: mockPurpose.id,
      client: toClientV2(expectedClient),
    });
    expect(addClientPurposeResponse).toEqual({
      data: expectedClient,
      metadata: {
        version: 1,
      },
    });
  });
  it("should write on event-store for the addition of a purpose created by a delegate into a client where the requester is the consumer", async () => {
    const mockDescriptor: Descriptor = {
      ...getMockDescriptor(),
      state: descriptorState.published,
      interface: getMockDocument(),
      publishedAt: new Date(),
    };

    const mockEservice = {
      ...getMockEService(),
      descriptors: [mockDescriptor],
    };
    const delegateId: TenantId = generateId();
    const consumerId: TenantId = generateId();

    const delegation = getMockDelegation({
      delegateId,
      delegatorId: consumerId,
      state: delegationState.active,
      eserviceId: mockEservice.id,
      kind: delegationKind.delegatedConsumer,
    });
    await addOneDelegation(delegation);

    const mockPurpose: Purpose = {
      ...getMockPurpose(),
      eserviceId: mockEservice.id,
      consumerId,
      delegationId: delegation.id,
      versions: [getMockPurposeVersion(purposeVersionState.active)],
    };

    const mockClient: Client = {
      ...getMockClient(),
      consumerId,
    };

    const mockAgreement: Agreement = {
      ...getMockAgreement(),
      state: agreementState.active,
      eserviceId: mockEservice.id,
      descriptorId: mockDescriptor.id,
      consumerId,
    };

    await addOneClient(mockClient);
    await addOnePurpose(mockPurpose);
    await addOneEService(mockEservice);
    await addOneAgreement(mockAgreement);

    const addClientPurposeResponse =
      await authorizationService.addClientPurpose(
        {
          clientId: mockClient.id,
          seed: { purposeId: mockPurpose.id },
        },
        getMockContext({ authData: getMockAuthData(consumerId) })
      );

    const writtenEvent = await readLastAuthorizationEvent(mockClient.id);

    expect(writtenEvent).toMatchObject({
      stream_id: mockClient.id,
      version: "1",
      type: "ClientPurposeAdded",
      event_version: 2,
    });

    const writtenPayload = decodeProtobufPayload({
      messageType: ClientPurposeAddedV2,
      payload: writtenEvent.data,
    });

    const expectedClient = {
      ...mockClient,
      purposes: [...mockClient.purposes, mockPurpose.id],
    };

    expect(writtenPayload).toEqual({
      purposeId: mockPurpose.id,
      client: toClientV2(expectedClient),
    });
    expect(addClientPurposeResponse).toEqual({
      data: expectedClient,
      metadata: {
        version: 1,
      },
    });
  });
  it("should throw delegationNotFound if the purpose delegation is not found or is not in an active state", async () => {
    const mockDescriptor: Descriptor = {
      ...getMockDescriptor(),
      state: descriptorState.published,
      interface: getMockDocument(),
      publishedAt: new Date(),
    };

    const mockEservice = {
      ...getMockEService(),
      descriptors: [mockDescriptor],
      isClientAccessDelegable: true,
    };
    const delegateId: TenantId = generateId();
    const consumerId: TenantId = generateId();

    const delegation = getMockDelegation({
      delegateId,
      delegatorId: consumerId,
      state: delegationState.revoked,
      eserviceId: mockEservice.id,
      kind: delegationKind.delegatedConsumer,
    });
    await addOneDelegation(delegation);

    const mockPurpose: Purpose = {
      ...getMockPurpose(),
      eserviceId: mockEservice.id,
      consumerId,
      delegationId: delegation.id,
      versions: [getMockPurposeVersion(purposeVersionState.active)],
    };

    const mockClient: Client = {
      ...getMockClient(),
      consumerId: delegateId,
    };

    const mockAgreement: Agreement = {
      ...getMockAgreement(),
      state: agreementState.active,
      eserviceId: mockEservice.id,
      descriptorId: mockDescriptor.id,
      consumerId,
    };

    await addOneClient(mockClient);
    await addOnePurpose(mockPurpose);
    await addOneEService(mockEservice);
    await addOneAgreement(mockAgreement);

    expect(
      authorizationService.addClientPurpose(
        {
          clientId: mockClient.id,
          seed: { purposeId: mockPurpose.id },
        },
        getMockContext({ authData: getMockAuthData(delegateId) })
      )
    ).rejects.toThrowError(purposeDelegationNotFound(delegation.id));
  });
  it("should throw tenantNotAllowedOnPurpose if the requester is not the purpose delegation delegate nor delegator", async () => {
    const mockDescriptor: Descriptor = {
      ...getMockDescriptor(),
      state: descriptorState.published,
      interface: getMockDocument(),
      publishedAt: new Date(),
    };

    const mockEservice = {
      ...getMockEService(),
      descriptors: [mockDescriptor],
      isClientAccessDelegable: true,
    };
    const delegateId: TenantId = generateId();
    const consumerId: TenantId = generateId();

    const delegation = getMockDelegation({
      delegateId: generateId<TenantId>(),
      delegatorId: consumerId,
      state: delegationState.active,
      eserviceId: mockEservice.id,
      kind: delegationKind.delegatedConsumer,
    });
    await addOneDelegation(delegation);

    const mockPurpose: Purpose = {
      ...getMockPurpose(),
      eserviceId: mockEservice.id,
      consumerId,
      delegationId: delegation.id,
      versions: [getMockPurposeVersion(purposeVersionState.active)],
    };

    const mockClient: Client = {
      ...getMockClient(),
      consumerId: delegateId,
    };

    const mockAgreement: Agreement = {
      ...getMockAgreement(),
      state: agreementState.active,
      eserviceId: mockEservice.id,
      descriptorId: mockDescriptor.id,
      consumerId,
    };

    await addOneClient(mockClient);
    await addOnePurpose(mockPurpose);
    await addOneEService(mockEservice);
    await addOneAgreement(mockAgreement);

    expect(
      authorizationService.addClientPurpose(
        {
          clientId: mockClient.id,
          seed: { purposeId: mockPurpose.id },
        },
        getMockContext({ authData: getMockAuthData(delegateId) })
      )
    ).rejects.toThrowError(
      tenantNotAllowedOnPurpose(delegateId, mockPurpose.id, delegation.id)
    );
  });
  it("should throw eserviceNotDelegableForClientAccess if for a purpose with a delegation the eservice doesn't have the isClientAccessDelegable to true", async () => {
    const mockDescriptor: Descriptor = {
      ...getMockDescriptor(),
      state: descriptorState.published,
      interface: getMockDocument(),
      publishedAt: new Date(),
    };

    const mockEservice = {
      ...getMockEService(),
      descriptors: [mockDescriptor],
      isClientAccessDelegable: false,
    };
    const delegateId: TenantId = generateId();
    const consumerId: TenantId = generateId();

    const delegation = getMockDelegation({
      delegateId,
      delegatorId: consumerId,
      state: delegationState.active,
      eserviceId: mockEservice.id,
      kind: delegationKind.delegatedConsumer,
    });
    await addOneDelegation(delegation);

    const mockPurpose: Purpose = {
      ...getMockPurpose(),
      eserviceId: mockEservice.id,
      consumerId,
      delegationId: delegation.id,
      versions: [getMockPurposeVersion(purposeVersionState.active)],
    };

    const mockClient: Client = {
      ...getMockClient(),
      consumerId: delegateId,
    };

    const mockAgreement: Agreement = {
      ...getMockAgreement(),
      state: agreementState.active,
      eserviceId: mockEservice.id,
      descriptorId: mockDescriptor.id,
      consumerId,
    };

    await addOneClient(mockClient);
    await addOnePurpose(mockPurpose);
    await addOneEService(mockEservice);
    await addOneAgreement(mockAgreement);

    expect(
      authorizationService.addClientPurpose(
        {
          clientId: mockClient.id,
          seed: { purposeId: mockPurpose.id },
        },
        getMockContext({ authData: getMockAuthData(delegateId) })
      )
    ).rejects.toThrowError(eserviceNotDelegableForClientAccess(mockEservice));
  });
  it("should throw noActiveOrSuspendedAgreementFound if for a purpose with a delegation the agreement doesn't have the delegatorId as consumerId", async () => {
    const mockDescriptor: Descriptor = {
      ...getMockDescriptor(),
      state: descriptorState.published,
      interface: getMockDocument(),
      publishedAt: new Date(),
    };

    const mockEservice = {
      ...getMockEService(),
      descriptors: [mockDescriptor],
      isClientAccessDelegable: true,
    };
    const delegateId: TenantId = generateId();
    const consumerId: TenantId = generateId();

    const delegation = getMockDelegation({
      delegateId,
      delegatorId: consumerId,
      state: delegationState.active,
      eserviceId: mockEservice.id,
      kind: delegationKind.delegatedConsumer,
    });
    await addOneDelegation(delegation);

    const mockPurpose: Purpose = {
      ...getMockPurpose(),
      eserviceId: mockEservice.id,
      consumerId,
      delegationId: delegation.id,
      versions: [getMockPurposeVersion(purposeVersionState.active)],
    };

    const mockClient: Client = {
      ...getMockClient(),
      consumerId: delegateId,
    };

    const mockAgreement: Agreement = {
      ...getMockAgreement(),
      state: agreementState.active,
      eserviceId: mockEservice.id,
      descriptorId: mockDescriptor.id,
      consumerId: generateId(),
    };

    await addOneClient(mockClient);
    await addOnePurpose(mockPurpose);
    await addOneEService(mockEservice);
    await addOneAgreement(mockAgreement);

    expect(
      authorizationService.addClientPurpose(
        {
          clientId: mockClient.id,
          seed: { purposeId: mockPurpose.id },
        },
        getMockContext({ authData: getMockAuthData(delegateId) })
      )
    ).rejects.toThrowError(
      noActiveOrSuspendedAgreementFound(mockEservice.id, delegation.delegatorId)
    );
  });
});
