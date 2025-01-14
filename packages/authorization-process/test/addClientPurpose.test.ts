/* eslint-disable @typescript-eslint/no-floating-promises */
import {
  decodeProtobufPayload,
  getMockAgreement,
  getMockClient,
  getMockDelegation,
  getMockDescriptor,
  getMockDocument,
  getMockEService,
  getMockPurpose,
  getMockPurposeVersion,
  getRandomAuthData,
  writeInReadmodel,
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
  toReadModelAgreement,
  toReadModelEService,
  toReadModelPurpose,
} from "pagopa-interop-models";
import { genericLogger } from "pagopa-interop-commons";
import {
  clientNotFound,
  eserviceNotFound,
  noAgreementFoundInRequiredState,
  noPurposeVersionsFoundInRequiredState,
  organizationNotAllowedOnClient,
  organizationNotAllowedOnPurpose,
  purposeAlreadyLinkedToClient,
  purposeNotFound,
} from "../src/model/domain/errors.js";
import {
  addOneClient,
  addOneDelegation,
  agreements,
  authorizationService,
  eservices,
  purposes,
  readLastAuthorizationEvent,
} from "./utils.js";

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
    await writeInReadmodel(toReadModelPurpose(mockPurpose), purposes);
    await writeInReadmodel(toReadModelEService(mockEservice), eservices);
    await writeInReadmodel(toReadModelAgreement(mockAgreement), agreements);

    await authorizationService.addClientPurpose({
      clientId: mockClient.id,
      seed: { purposeId: mockPurpose.id },
      organizationId: mockConsumerId,
      correlationId: generateId(),
      logger: genericLogger,
    });

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

    expect(writtenPayload).toEqual({
      purposeId: mockPurpose.id,
      client: toClientV2({
        ...mockClient,
        purposes: [...mockClient.purposes, mockPurpose.id],
      }),
    });
  });

  it("should succeed when a delegating user can associate his own purposes linked to an eservice for which he has given a delegation for use to his clients", async () => {
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

    const authData = getRandomAuthData(mockClient.consumerId);

    const delegation = getMockDelegation({
      kind: delegationKind.delegatedConsumer,
      eserviceId: mockPurpose.eserviceId,
      delegatorId: mockPurpose.consumerId,
      delegateId: authData.organizationId,
      state: delegationState.active,
    });

    await addOneClient(mockClient);
    await addOneDelegation(delegation);
    await writeInReadmodel(toReadModelPurpose(mockPurpose), purposes);
    await writeInReadmodel(toReadModelEService(mockEservice), eservices);
    await writeInReadmodel(toReadModelAgreement(mockAgreement), agreements);

    await authorizationService.addClientPurpose({
      clientId: mockClient.id,
      seed: { purposeId: mockPurpose.id },
      organizationId: authData.organizationId,
      correlationId: generateId(),
      logger: genericLogger,
    });

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

    expect(writtenPayload).toEqual({
      purposeId: mockPurpose.id,
      client: toClientV2({
        ...mockClient,
        purposes: [...mockClient.purposes, mockPurpose.id],
      }),
    });
  });

  it("should succeed when a delegating user can associate the purposes created by a delegate for an eservice for which he has given a delegation for use by his clients", async () => {
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

    const mockDelegateConsumerId: TenantId = generateId();

    const purposeDelegation = getMockDelegation({
      kind: delegationKind.delegatedConsumer,
      eserviceId: mockEservice.id,
      delegatorId: mockConsumerId,
      delegateId: mockDelegateConsumerId,
      state: delegationState.active,
    });

    const mockPurpose: Purpose = {
      ...getMockPurpose(),
      eserviceId: mockEservice.id,
      consumerId: mockConsumerId,
      delegationId: purposeDelegation.id,
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

    const authData = getRandomAuthData(mockClient.consumerId);

    const delegation = getMockDelegation({
      kind: delegationKind.delegatedConsumer,
      eserviceId: mockPurpose.eserviceId,
      delegatorId: mockPurpose.consumerId,
      delegateId: authData.organizationId,
      state: delegationState.active,
    });

    await addOneClient(mockClient);
    await addOneDelegation(purposeDelegation);
    await addOneDelegation(delegation);
    await writeInReadmodel(toReadModelPurpose(mockPurpose), purposes);
    await writeInReadmodel(toReadModelEService(mockEservice), eservices);
    await writeInReadmodel(toReadModelAgreement(mockAgreement), agreements);

    await authorizationService.addClientPurpose({
      clientId: mockClient.id,
      seed: { purposeId: mockPurpose.id },
      organizationId: authData.organizationId,
      correlationId: generateId(),
      logger: genericLogger,
    });

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

    expect(writtenPayload).toEqual({
      purposeId: mockPurpose.id,
      client: toClientV2({
        ...mockClient,
        purposes: [...mockClient.purposes, mockPurpose.id],
      }),
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

    await writeInReadmodel(toReadModelPurpose(mockPurpose), purposes);
    await writeInReadmodel(toReadModelEService(mockEservice), eservices);
    await writeInReadmodel(toReadModelAgreement(mockAgreement), agreements);

    expect(
      authorizationService.addClientPurpose({
        clientId: mockClient.id,
        seed: { purposeId: mockPurpose.id },
        organizationId: mockConsumerId,
        correlationId: generateId(),
        logger: genericLogger,
      })
    ).rejects.toThrowError(clientNotFound(mockClient.id));
  });
  it("should throw organizationNotAllowedOnClient if the requester is not the client consumer", async () => {
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
    await writeInReadmodel(toReadModelPurpose(mockPurpose), purposes);
    await writeInReadmodel(toReadModelEService(mockEservice), eservices);
    await writeInReadmodel(toReadModelAgreement(mockAgreement), agreements);

    expect(
      authorizationService.addClientPurpose({
        clientId: mockClient.id,
        seed: { purposeId: mockPurpose.id },
        organizationId: mockConsumerId,
        correlationId: generateId(),
        logger: genericLogger,
      })
    ).rejects.toThrowError(
      organizationNotAllowedOnClient(mockConsumerId, mockClient.id)
    );
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
    await writeInReadmodel(toReadModelEService(mockEservice), eservices);
    await writeInReadmodel(toReadModelAgreement(mockAgreement), agreements);

    expect(
      authorizationService.addClientPurpose({
        clientId: mockClient.id,
        seed: { purposeId: mockPurpose.id },
        organizationId: mockConsumerId,
        correlationId: generateId(),
        logger: genericLogger,
      })
    ).rejects.toThrowError(purposeNotFound(mockPurpose.id));
  });
  it("should throw organizationNotAllowedOnPurpose if the requester is not the purpose consumer", async () => {
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
    await writeInReadmodel(toReadModelPurpose(mockPurpose), purposes);
    await writeInReadmodel(toReadModelEService(mockEservice), eservices);
    await writeInReadmodel(toReadModelAgreement(mockAgreement), agreements);

    expect(
      authorizationService.addClientPurpose({
        clientId: mockClient.id,
        seed: { purposeId: mockPurpose.id },
        organizationId: mockConsumerId,
        correlationId: generateId(),
        logger: genericLogger,
      })
    ).rejects.toThrowError(
      organizationNotAllowedOnPurpose(mockConsumerId, mockPurpose.id)
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
    await writeInReadmodel(toReadModelPurpose(mockPurpose), purposes);
    await writeInReadmodel(toReadModelAgreement(mockAgreement), agreements);

    expect(
      authorizationService.addClientPurpose({
        clientId: mockClient.id,
        seed: { purposeId: mockPurpose.id },
        organizationId: mockConsumerId,
        correlationId: generateId(),
        logger: genericLogger,
      })
    ).rejects.toThrowError(eserviceNotFound(mockEservice.id));
  });
  it("should throw noAgreementFoundInRequiredState if there is no agreement in required states (found no agreement)", async () => {
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
    await writeInReadmodel(toReadModelPurpose(mockPurpose), purposes);
    await writeInReadmodel(toReadModelEService(mockEservice), eservices);

    expect(
      authorizationService.addClientPurpose({
        clientId: mockClient.id,
        seed: { purposeId: mockPurpose.id },
        organizationId: mockConsumerId,
        correlationId: generateId(),
        logger: genericLogger,
      })
    ).rejects.toThrowError(
      noAgreementFoundInRequiredState(mockEservice.id, mockConsumerId)
    );
  });
  it.each(
    Object.values(agreementState).filter(
      (state) =>
        state !== agreementState.active && state !== agreementState.suspended
    )
  )(
    "should throw noAgreementFoundInRequiredState if there is no agreement in required states (found: %s agreements)",
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
      await writeInReadmodel(toReadModelPurpose(mockPurpose), purposes);
      await writeInReadmodel(toReadModelEService(mockEservice), eservices);
      await writeInReadmodel(toReadModelAgreement(mockAgreement), agreements);

      expect(
        authorizationService.addClientPurpose({
          clientId: mockClient.id,
          seed: { purposeId: mockPurpose.id },
          organizationId: mockConsumerId,
          correlationId: generateId(),
          logger: genericLogger,
        })
      ).rejects.toThrowError(
        noAgreementFoundInRequiredState(mockEservice.id, mockConsumerId)
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
    await writeInReadmodel(toReadModelPurpose(mockPurpose), purposes);
    await writeInReadmodel(toReadModelEService(mockEservice), eservices);
    await writeInReadmodel(toReadModelAgreement(mockAgreement), agreements);

    expect(
      authorizationService.addClientPurpose({
        clientId: mockClient.id,
        seed: { purposeId: mockPurpose.id },
        organizationId: mockConsumerId,
        correlationId: generateId(),
        logger: genericLogger,
      })
    ).rejects.toThrowError(mockDescriptor.id);
  });
  it("should throw noPurposeVersionsFoundInRequiredState if the purpose has no versions in required states (found no versions)", async () => {
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
    await writeInReadmodel(toReadModelPurpose(mockPurpose), purposes);
    await writeInReadmodel(toReadModelEService(mockEservice), eservices);
    await writeInReadmodel(toReadModelAgreement(mockAgreement), agreements);

    expect(
      authorizationService.addClientPurpose({
        clientId: mockClient.id,
        seed: { purposeId: mockPurpose.id },
        organizationId: mockConsumerId,
        correlationId: generateId(),
        logger: genericLogger,
      })
    ).rejects.toThrowError(
      noPurposeVersionsFoundInRequiredState(mockPurpose.id)
    );
  });
  it.each(
    Object.values(purposeVersionState).filter(
      (state) =>
        state !== purposeVersionState.active &&
        state !== purposeVersionState.suspended
    )
  )(
    "should throw noPurposeVersionsFoundInRequiredState if the purpose has no versions in required states (found: %s version)",
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
      await writeInReadmodel(toReadModelPurpose(mockPurpose), purposes);
      await writeInReadmodel(toReadModelEService(mockEservice), eservices);
      await writeInReadmodel(toReadModelAgreement(mockAgreement), agreements);

      expect(
        authorizationService.addClientPurpose({
          clientId: mockClient.id,
          seed: { purposeId: mockPurpose.id },
          organizationId: mockConsumerId,
          correlationId: generateId(),
          logger: genericLogger,
        })
      ).rejects.toThrowError(
        noPurposeVersionsFoundInRequiredState(mockPurpose.id)
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
    await writeInReadmodel(toReadModelPurpose(mockPurpose), purposes);
    await writeInReadmodel(toReadModelEService(mockEservice), eservices);
    await writeInReadmodel(toReadModelAgreement(mockAgreement), agreements);

    expect(
      authorizationService.addClientPurpose({
        clientId: mockClient.id,
        seed: { purposeId: mockPurpose.id },
        organizationId: mockConsumerId,
        correlationId: generateId(),
        logger: genericLogger,
      })
    ).rejects.toThrowError(
      purposeAlreadyLinkedToClient(mockPurpose.id, mockClient.id)
    );
  });
});
