/* eslint-disable @typescript-eslint/no-floating-promises */
import {
  decodeProtobufPayload,
  getMockAgreement,
  getMockClient,
  getMockDescriptor,
  getMockDocument,
  getMockEService,
  getMockPurpose,
  getMockPurposeVersion,
  getMockTenant,
  writeInReadmodel,
} from "pagopa-interop-commons-test";
import { describe, expect, it } from "vitest";
import {
  Agreement,
  Client,
  ClientPurposeAddedV2,
  Descriptor,
  Purpose,
  agreementState,
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
    const mockConsumer = getMockTenant();

    const mockPurpose: Purpose = {
      ...getMockPurpose(),
      eserviceId: mockEservice.id,
      consumerId: mockConsumer.id,
      versions: [getMockPurposeVersion(purposeVersionState.active)],
    };

    const mockClient: Client = {
      ...getMockClient(),
      consumerId: mockConsumer.id,
    };

    const mockAgreement: Agreement = {
      ...getMockAgreement(),
      state: agreementState.active,
      eserviceId: mockEservice.id,
      descriptorId: mockDescriptor.id,
      consumerId: mockConsumer.id,
    };

    await addOneClient(mockClient);
    await writeInReadmodel(toReadModelPurpose(mockPurpose), purposes);
    await writeInReadmodel(toReadModelEService(mockEservice), eservices);
    await writeInReadmodel(toReadModelAgreement(mockAgreement), agreements);

    await authorizationService.addClientPurpose({
      clientId: mockClient.id,
      seed: { purposeId: mockPurpose.id },
      organizationId: mockConsumer.id,
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
    const mockConsumer = getMockTenant();

    const mockPurpose: Purpose = {
      ...getMockPurpose(),
      eserviceId: mockEservice.id,
      consumerId: mockConsumer.id,
      versions: [getMockPurposeVersion(purposeVersionState.active)],
    };

    const mockClient: Client = {
      ...getMockClient(),
      consumerId: mockConsumer.id,
    };

    const mockAgreement: Agreement = {
      ...getMockAgreement(),
      state: agreementState.active,
      eserviceId: mockEservice.id,
      descriptorId: mockDescriptor.id,
      consumerId: mockConsumer.id,
    };

    await writeInReadmodel(toReadModelPurpose(mockPurpose), purposes);
    await writeInReadmodel(toReadModelEService(mockEservice), eservices);
    await writeInReadmodel(toReadModelAgreement(mockAgreement), agreements);

    expect(
      authorizationService.addClientPurpose({
        clientId: mockClient.id,
        seed: { purposeId: mockPurpose.id },
        organizationId: mockConsumer.id,
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
    const mockConsumer = getMockTenant();

    const mockPurpose: Purpose = {
      ...getMockPurpose(),
      eserviceId: mockEservice.id,
      consumerId: mockConsumer.id,
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
      consumerId: mockConsumer.id,
    };

    await addOneClient(mockClient);
    await writeInReadmodel(toReadModelPurpose(mockPurpose), purposes);
    await writeInReadmodel(toReadModelEService(mockEservice), eservices);
    await writeInReadmodel(toReadModelAgreement(mockAgreement), agreements);

    expect(
      authorizationService.addClientPurpose({
        clientId: mockClient.id,
        seed: { purposeId: mockPurpose.id },
        organizationId: mockConsumer.id,
        correlationId: generateId(),
        logger: genericLogger,
      })
    ).rejects.toThrowError(
      organizationNotAllowedOnClient(mockConsumer.id, mockClient.id)
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
    const mockConsumer = getMockTenant();

    const mockPurpose: Purpose = {
      ...getMockPurpose(),
      eserviceId: mockEservice.id,
      consumerId: mockConsumer.id,
      versions: [getMockPurposeVersion(purposeVersionState.active)],
    };

    const mockClient: Client = {
      ...getMockClient(),
      consumerId: mockConsumer.id,
    };

    const mockAgreement: Agreement = {
      ...getMockAgreement(),
      state: agreementState.active,
      eserviceId: mockEservice.id,
      descriptorId: mockDescriptor.id,
      consumerId: mockConsumer.id,
    };

    await addOneClient(mockClient);
    await writeInReadmodel(toReadModelEService(mockEservice), eservices);
    await writeInReadmodel(toReadModelAgreement(mockAgreement), agreements);

    expect(
      authorizationService.addClientPurpose({
        clientId: mockClient.id,
        seed: { purposeId: mockPurpose.id },
        organizationId: mockConsumer.id,
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
    const mockConsumer = getMockTenant();

    const mockPurpose: Purpose = {
      ...getMockPurpose(),
      eserviceId: mockEservice.id,
      consumerId: generateId(),
      versions: [getMockPurposeVersion(purposeVersionState.active)],
    };

    const mockClient: Client = {
      ...getMockClient(),
      consumerId: mockConsumer.id,
    };

    const mockAgreement: Agreement = {
      ...getMockAgreement(),
      state: agreementState.active,
      eserviceId: mockEservice.id,
      descriptorId: mockDescriptor.id,
      consumerId: mockConsumer.id,
    };

    await addOneClient(mockClient);
    await writeInReadmodel(toReadModelPurpose(mockPurpose), purposes);
    await writeInReadmodel(toReadModelEService(mockEservice), eservices);
    await writeInReadmodel(toReadModelAgreement(mockAgreement), agreements);

    expect(
      authorizationService.addClientPurpose({
        clientId: mockClient.id,
        seed: { purposeId: mockPurpose.id },
        organizationId: mockConsumer.id,
        correlationId: generateId(),
        logger: genericLogger,
      })
    ).rejects.toThrowError(
      organizationNotAllowedOnPurpose(mockConsumer.id, mockPurpose.id)
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
    const mockConsumer = getMockTenant();

    const mockPurpose: Purpose = {
      ...getMockPurpose(),
      eserviceId: mockEservice.id,
      consumerId: mockConsumer.id,
      versions: [getMockPurposeVersion(purposeVersionState.active)],
    };

    const mockClient: Client = {
      ...getMockClient(),
      consumerId: mockConsumer.id,
    };

    const mockAgreement: Agreement = {
      ...getMockAgreement(),
      state: agreementState.active,
      eserviceId: mockEservice.id,
      descriptorId: mockDescriptor.id,
      consumerId: mockConsumer.id,
    };

    await addOneClient(mockClient);
    await writeInReadmodel(toReadModelPurpose(mockPurpose), purposes);
    await writeInReadmodel(toReadModelAgreement(mockAgreement), agreements);

    expect(
      authorizationService.addClientPurpose({
        clientId: mockClient.id,
        seed: { purposeId: mockPurpose.id },
        organizationId: mockConsumer.id,
        correlationId: generateId(),
        logger: genericLogger,
      })
    ).rejects.toThrowError(eserviceNotFound(mockEservice.id));
  });
  it("should throw noAgreementFoundInRequiredState if there is no agreement in required states", async () => {
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
    const mockConsumer = getMockTenant();

    const mockPurpose: Purpose = {
      ...getMockPurpose(),
      eserviceId: mockEservice.id,
      consumerId: mockConsumer.id,
      versions: [getMockPurposeVersion(purposeVersionState.active)],
    };
    const mockClient: Client = {
      ...getMockClient(),
      consumerId: mockConsumer.id,
    };

    await addOneClient(mockClient);
    await writeInReadmodel(toReadModelPurpose(mockPurpose), purposes);
    await writeInReadmodel(toReadModelEService(mockEservice), eservices);

    expect(
      authorizationService.addClientPurpose({
        clientId: mockClient.id,
        seed: { purposeId: mockPurpose.id },
        organizationId: mockConsumer.id,
        correlationId: generateId(),
        logger: genericLogger,
      })
    ).rejects.toThrowError(
      noAgreementFoundInRequiredState(mockEservice.id, mockConsumer.id)
    );
  });
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

    const mockConsumer = getMockTenant();

    const mockPurpose: Purpose = {
      ...getMockPurpose(),
      eserviceId: mockEservice.id,
      consumerId: mockConsumer.id,
      versions: [getMockPurposeVersion(purposeVersionState.active)],
    };

    const mockClient: Client = {
      ...getMockClient(),
      consumerId: mockConsumer.id,
    };

    const mockAgreement: Agreement = {
      ...getMockAgreement(),
      state: agreementState.active,
      eserviceId: mockEservice.id,
      descriptorId: mockDescriptor.id,
      consumerId: mockConsumer.id,
    };

    await addOneClient(mockClient);
    await writeInReadmodel(toReadModelPurpose(mockPurpose), purposes);
    await writeInReadmodel(toReadModelEService(mockEservice), eservices);
    await writeInReadmodel(toReadModelAgreement(mockAgreement), agreements);

    expect(
      authorizationService.addClientPurpose({
        clientId: mockClient.id,
        seed: { purposeId: mockPurpose.id },
        organizationId: mockConsumer.id,
        correlationId: generateId(),
        logger: genericLogger,
      })
    ).rejects.toThrowError(mockDescriptor.id);
  });
  it("should throw noPurposeVersionsFoundInRequiredState if the purpose has no versions in required states", async () => {
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

    const mockConsumer = getMockTenant();

    const mockPurpose: Purpose = {
      ...getMockPurpose(),
      eserviceId: mockEservice.id,
      consumerId: mockConsumer.id,
      versions: [],
    };

    const mockClient: Client = {
      ...getMockClient(),
      consumerId: mockConsumer.id,
    };

    const mockAgreement: Agreement = {
      ...getMockAgreement(),
      state: agreementState.active,
      eserviceId: mockEservice.id,
      descriptorId: mockDescriptor.id,
      consumerId: mockConsumer.id,
    };

    await addOneClient(mockClient);
    await writeInReadmodel(toReadModelPurpose(mockPurpose), purposes);
    await writeInReadmodel(toReadModelEService(mockEservice), eservices);
    await writeInReadmodel(toReadModelAgreement(mockAgreement), agreements);

    expect(
      authorizationService.addClientPurpose({
        clientId: mockClient.id,
        seed: { purposeId: mockPurpose.id },
        organizationId: mockConsumer.id,
        correlationId: generateId(),
        logger: genericLogger,
      })
    ).rejects.toThrowError(
      noPurposeVersionsFoundInRequiredState(mockPurpose.id)
    );
  });
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
    const mockConsumer = getMockTenant();

    const mockPurpose: Purpose = {
      ...getMockPurpose(),
      eserviceId: mockEservice.id,
      consumerId: mockConsumer.id,
      versions: [getMockPurposeVersion(purposeVersionState.active)],
    };

    const mockClient: Client = {
      ...getMockClient(),
      consumerId: mockConsumer.id,
      purposes: [mockPurpose.id],
    };

    const mockAgreement: Agreement = {
      ...getMockAgreement(),
      state: agreementState.active,
      eserviceId: mockEservice.id,
      descriptorId: mockDescriptor.id,
      consumerId: mockConsumer.id,
    };

    await addOneClient(mockClient);
    await writeInReadmodel(toReadModelPurpose(mockPurpose), purposes);
    await writeInReadmodel(toReadModelEService(mockEservice), eservices);
    await writeInReadmodel(toReadModelAgreement(mockAgreement), agreements);

    expect(
      authorizationService.addClientPurpose({
        clientId: mockClient.id,
        seed: { purposeId: mockPurpose.id },
        organizationId: mockConsumer.id,
        correlationId: generateId(),
        logger: genericLogger,
      })
    ).rejects.toThrowError(
      purposeAlreadyLinkedToClient(mockPurpose.id, mockClient.id)
    );
  });
});
