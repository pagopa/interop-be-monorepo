/* eslint-disable @typescript-eslint/no-floating-promises */
import {
  decodeProtobufPayload,
  getMockProducerKeychain,
  getMockEService,
  writeInReadmodel,
} from "pagopa-interop-commons-test";
import { describe, expect, it } from "vitest";
import {
  ProducerKeychain,
  ProducerKeychainEServiceAddedV2,
  EService,
  TenantId,
  generateId,
  toReadModelEService,
  toProducerKeychainV2,
} from "pagopa-interop-models";
import { genericLogger } from "pagopa-interop-commons";
import {
  eserviceNotFound,
  organizationNotAllowedOnProducerKeychain,
  organizationNotAllowedOnEService,
  eserviceAlreadyLinkedToProducerKeychain,
  producerKeychainNotFound,
} from "../src/model/domain/errors.js";
import {
  addOneProducerKeychain,
  authorizationService,
  eservices,
  readLastAuthorizationEvent,
} from "./utils.js";

describe("addProducerKeychainEServices", async () => {
  it("should write on event-store for the addition of one eservice into a producer keychain", async () => {
    const mockProducerId: TenantId = generateId();

    const mockEService: EService = {
      ...getMockEService(),
      producerId: mockProducerId,
    };

    const mockProducerKeychain: ProducerKeychain = {
      ...getMockProducerKeychain(),
      producerId: mockProducerId,
    };

    await addOneProducerKeychain(mockProducerKeychain);
    await writeInReadmodel(toReadModelEService(mockEService), eservices);

    await authorizationService.addProducerKeychainEServices({
      producerKeychainId: mockProducerKeychain.id,
      seed: { eserviceIds: [mockEService.id] },
      organizationId: mockProducerId,
      correlationId: generateId(),
      logger: genericLogger,
    });

    const writtenEvent = await readLastAuthorizationEvent(
      mockProducerKeychain.id
    );

    expect(writtenEvent).toMatchObject({
      stream_id: mockProducerKeychain.id,
      version: "1",
      type: "ProducerKeychainEServiceAdded",
      event_version: 2,
    });

    const writtenPayload = decodeProtobufPayload({
      messageType: ProducerKeychainEServiceAddedV2,
      payload: writtenEvent.data,
    });

    expect(writtenPayload).toEqual({
      eserviceId: mockEService.id,
      producerKeychain: toProducerKeychainV2({
        ...mockProducerKeychain,
        eservices: [mockEService.id],
      }),
    });
  });
  it("should write on event-store for the addition of more than one eservice into a producer keychain", async () => {
    const mockProducerId: TenantId = generateId();

    const mockEService: EService = {
      ...getMockEService(),
      producerId: mockProducerId,
    };
    const mockEService2: EService = {
      ...getMockEService(),
      producerId: mockProducerId,
    };
    const mockEService3: EService = {
      ...getMockEService(),
      producerId: mockProducerId,
    };

    const mockProducerKeychain: ProducerKeychain = {
      ...getMockProducerKeychain(),
      producerId: mockProducerId,
    };

    await addOneProducerKeychain(mockProducerKeychain);
    await writeInReadmodel(toReadModelEService(mockEService), eservices);
    await writeInReadmodel(toReadModelEService(mockEService2), eservices);
    await writeInReadmodel(toReadModelEService(mockEService3), eservices);

    await authorizationService.addProducerKeychainEServices({
      producerKeychainId: mockProducerKeychain.id,
      seed: {
        eserviceIds: [mockEService.id, mockEService2.id, mockEService3.id],
      },
      organizationId: mockProducerId,
      correlationId: generateId(),
      logger: genericLogger,
    });

    const writtenEvent = await readLastAuthorizationEvent(
      mockProducerKeychain.id
    );

    expect(writtenEvent).toMatchObject({
      stream_id: mockProducerKeychain.id,
      version: "3",
      type: "ProducerKeychainEServiceAdded",
      event_version: 2,
    });

    const writtenPayload = decodeProtobufPayload({
      messageType: ProducerKeychainEServiceAddedV2,
      payload: writtenEvent.data,
    });

    expect(writtenPayload).toEqual({
      eserviceId: mockEService3.id,
      producerKeychain: toProducerKeychainV2({
        ...mockProducerKeychain,
        eservices: [mockEService.id, mockEService2.id, mockEService3.id],
      }),
    });
  });
  it("should throw producerKeychainNotFound if the producer keychain does not exist", async () => {
    const mockProducerId: TenantId = generateId();

    const mockEService: EService = {
      ...getMockEService(),
      producerId: mockProducerId,
    };

    await writeInReadmodel(toReadModelEService(mockEService), eservices);

    const mockProducerKeychain = getMockProducerKeychain();

    expect(
      authorizationService.addProducerKeychainEServices({
        producerKeychainId: mockProducerKeychain.id,
        seed: { eserviceIds: [mockEService.id] },
        organizationId: mockProducerId,
        correlationId: generateId(),
        logger: genericLogger,
      })
    ).rejects.toThrowError(producerKeychainNotFound(mockProducerKeychain.id));
  });
  it("should throw organizationNotAllowedOnProducerKeychain if the requester is not the producer keychain producer", async () => {
    const mockProducerId: TenantId = generateId();

    const mockEService: EService = {
      ...getMockEService(),
      producerId: mockProducerId,
    };

    const mockProducerKeychain = getMockProducerKeychain();

    await addOneProducerKeychain(mockProducerKeychain);
    await writeInReadmodel(toReadModelEService(mockEService), eservices);

    expect(
      authorizationService.addProducerKeychainEServices({
        producerKeychainId: mockProducerKeychain.id,
        seed: { eserviceIds: [mockEService.id] },
        organizationId: mockProducerId,
        correlationId: generateId(),
        logger: genericLogger,
      })
    ).rejects.toThrowError(
      organizationNotAllowedOnProducerKeychain(
        mockProducerId,
        mockProducerKeychain.id
      )
    );
  });
  it("should throw eserviceNotFound if one of the eservices doesn't exist", async () => {
    const mockProducerId: TenantId = generateId();

    const mockEService: EService = {
      ...getMockEService(),
      producerId: mockProducerId,
    };

    const mockEService2: EService = {
      ...getMockEService(),
      producerId: mockProducerId,
    };

    const mockProducerKeychain: ProducerKeychain = {
      ...getMockProducerKeychain(),
      producerId: mockProducerId,
    };

    await addOneProducerKeychain(mockProducerKeychain);
    await writeInReadmodel(toReadModelEService(mockEService), eservices);

    expect(
      authorizationService.addProducerKeychainEServices({
        producerKeychainId: mockProducerKeychain.id,
        seed: { eserviceIds: [mockEService.id, mockEService2.id] },
        organizationId: mockProducerId,
        correlationId: generateId(),
        logger: genericLogger,
      })
    ).rejects.toThrowError(eserviceNotFound(mockEService2.id));
  });
  it("should throw organizationNotAllowedOnEService if the requester is not the eservice producer", async () => {
    const mockProducerId: TenantId = generateId();

    const mockEService: EService = getMockEService();

    const mockProducerKeychain: ProducerKeychain = {
      ...getMockProducerKeychain(),
      producerId: mockProducerId,
    };

    await addOneProducerKeychain(mockProducerKeychain);
    await writeInReadmodel(toReadModelEService(mockEService), eservices);

    expect(
      authorizationService.addProducerKeychainEServices({
        producerKeychainId: mockProducerKeychain.id,
        seed: { eserviceIds: [mockEService.id] },
        organizationId: mockProducerId,
        correlationId: generateId(),
        logger: genericLogger,
      })
    ).rejects.toThrowError(
      organizationNotAllowedOnEService(mockProducerId, mockEService.id)
    );
  });
  it("should throw eserviceAlreadyLinkedToProducerKeychain if one of the eservices is already linked to that producer keychain", async () => {
    const mockProducerId: TenantId = generateId();

    const mockEService: EService = {
      ...getMockEService(),
      producerId: mockProducerId,
    };
    const mockEService2: EService = {
      ...getMockEService(),
      producerId: mockProducerId,
    };

    const mockProducerKeychain: ProducerKeychain = {
      ...getMockProducerKeychain(),
      producerId: mockProducerId,
      eservices: [mockEService2.id],
    };

    await addOneProducerKeychain(mockProducerKeychain);
    await writeInReadmodel(toReadModelEService(mockEService), eservices);
    await writeInReadmodel(toReadModelEService(mockEService2), eservices);

    expect(
      authorizationService.addProducerKeychainEServices({
        producerKeychainId: mockProducerKeychain.id,
        seed: { eserviceIds: [mockEService.id, mockEService2.id] },
        organizationId: mockProducerId,
        correlationId: generateId(),
        logger: genericLogger,
      })
    ).rejects.toThrowError(
      eserviceAlreadyLinkedToProducerKeychain(
        mockEService2.id,
        mockProducerKeychain.id
      )
    );
  });
});
