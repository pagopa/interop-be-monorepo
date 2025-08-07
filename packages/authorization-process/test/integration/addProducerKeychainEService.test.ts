/* eslint-disable @typescript-eslint/no-floating-promises */
import {
  decodeProtobufPayload,
  getMockProducerKeychain,
  getMockEService,
  getMockAuthData,
  getMockContext,
} from "pagopa-interop-commons-test";
import { describe, expect, it } from "vitest";
import {
  ProducerKeychain,
  ProducerKeychainEServiceAddedV2,
  EService,
  TenantId,
  generateId,
  EServiceId,
  toProducerKeychainV2,
} from "pagopa-interop-models";
import {
  eserviceNotFound,
  tenantNotAllowedOnProducerKeychain,
  tenantNotAllowedOnEService,
  eserviceAlreadyLinkedToProducerKeychain,
  producerKeychainNotFound,
} from "../../src/model/domain/errors.js";
import {
  addOneEService,
  addOneProducerKeychain,
  authorizationService,
  readLastAuthorizationEvent,
} from "../integrationUtils.js";

describe("addProducerKeychainEService", async () => {
  it("should write on event-store for the addition of a eservice into a producer keychain", async () => {
    const mockProducerId: TenantId = generateId();
    const mockEServiceId: EServiceId = generateId();

    const mockEService: EService = {
      ...getMockEService(),
      id: mockEServiceId,
      producerId: mockProducerId,
    };

    const mockProducerKeychain: ProducerKeychain = {
      ...getMockProducerKeychain(),
      producerId: mockProducerId,
    };

    await addOneProducerKeychain(mockProducerKeychain);
    await addOneEService(mockEService);

    const addEServiceProducerKeychainResponse =
      await authorizationService.addProducerKeychainEService(
        {
          producerKeychainId: mockProducerKeychain.id,
          seed: { eserviceId: mockEService.id },
        },
        getMockContext({ authData: getMockAuthData(mockProducerId) })
      );

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

    const expectedProducerKeychain: ProducerKeychain = {
      ...mockProducerKeychain,
      eservices: [...mockProducerKeychain.eservices, mockEService.id],
    };

    expect(writtenPayload).toEqual({
      eserviceId: mockEService.id,
      producerKeychain: toProducerKeychainV2(expectedProducerKeychain),
    });

    expect(addEServiceProducerKeychainResponse).toEqual({
      data: expectedProducerKeychain,
      metadata: {
        version: 1,
      },
    });
  });
  it("should throw producerKeychainNotFound if the producer keychain does not exist", async () => {
    const mockProducerId: TenantId = generateId();

    const mockEService: EService = {
      ...getMockEService(),
      producerId: mockProducerId,
    };

    await addOneEService(mockEService);

    const mockProducerKeychain = getMockProducerKeychain();

    expect(
      authorizationService.addProducerKeychainEService(
        {
          producerKeychainId: mockProducerKeychain.id,
          seed: { eserviceId: mockEService.id },
        },
        getMockContext({ authData: getMockAuthData(mockProducerId) })
      )
    ).rejects.toThrowError(producerKeychainNotFound(mockProducerKeychain.id));
  });
  it("should throw tenantNotAllowedOnProducerKeychain if the requester is not the producer keychain producer", async () => {
    const mockProducerId: TenantId = generateId();
    const mockEServiceId: EServiceId = generateId();

    const mockEService: EService = {
      ...getMockEService(),
      id: mockEServiceId,
      producerId: mockProducerId,
    };

    const mockProducerKeychain = getMockProducerKeychain();

    await addOneProducerKeychain(mockProducerKeychain);
    await addOneEService(mockEService);

    expect(
      authorizationService.addProducerKeychainEService(
        {
          producerKeychainId: mockProducerKeychain.id,
          seed: { eserviceId: mockEService.id },
        },
        getMockContext({ authData: getMockAuthData(mockProducerId) })
      )
    ).rejects.toThrowError(
      tenantNotAllowedOnProducerKeychain(
        mockProducerId,
        mockProducerKeychain.id
      )
    );
  });
  it("should throw eserviceNotFound if the eservice doesn't exist", async () => {
    const mockProducerId: TenantId = generateId();
    const mockEServiceId: EServiceId = generateId();

    const mockEService: EService = {
      ...getMockEService(),
      id: mockEServiceId,
      producerId: mockProducerId,
    };

    const mockProducerKeychain: ProducerKeychain = {
      ...getMockProducerKeychain(),
      producerId: mockProducerId,
    };

    await addOneProducerKeychain(mockProducerKeychain);

    expect(
      authorizationService.addProducerKeychainEService(
        {
          producerKeychainId: mockProducerKeychain.id,
          seed: { eserviceId: mockEService.id },
        },
        getMockContext({ authData: getMockAuthData(mockProducerId) })
      )
    ).rejects.toThrowError(eserviceNotFound(mockEService.id));
  });
  it("should throw tenantNotAllowedOnEService if the requester is not the eservice producer", async () => {
    const mockProducerId: TenantId = generateId();
    const mockEServiceId: EServiceId = generateId();

    const mockEService: EService = {
      ...getMockEService(),
      id: mockEServiceId,
    };

    const mockProducerKeychain: ProducerKeychain = {
      ...getMockProducerKeychain(),
      producerId: mockProducerId,
    };

    await addOneProducerKeychain(mockProducerKeychain);
    await addOneEService(mockEService);

    expect(
      authorizationService.addProducerKeychainEService(
        {
          producerKeychainId: mockProducerKeychain.id,
          seed: { eserviceId: mockEService.id },
        },
        getMockContext({ authData: getMockAuthData(mockProducerId) })
      )
    ).rejects.toThrowError(
      tenantNotAllowedOnEService(mockProducerId, mockEService.id)
    );
  });
  it("should throw eserviceAlreadyLinkedToProducerKeychain if the eservice is already linked to that producer keychain", async () => {
    const mockProducerId: TenantId = generateId();
    const mockEServiceId: EServiceId = generateId();

    const mockEService: EService = {
      ...getMockEService(),
      id: mockEServiceId,
      producerId: mockProducerId,
    };

    const mockProducerKeychain: ProducerKeychain = {
      ...getMockProducerKeychain(),
      producerId: mockProducerId,
      eservices: [mockEService.id],
    };

    await addOneProducerKeychain(mockProducerKeychain);
    await addOneEService(mockEService);

    expect(
      authorizationService.addProducerKeychainEService(
        {
          producerKeychainId: mockProducerKeychain.id,
          seed: { eserviceId: mockEService.id },
        },
        getMockContext({ authData: getMockAuthData(mockProducerId) })
      )
    ).rejects.toThrowError(
      eserviceAlreadyLinkedToProducerKeychain(
        mockEService.id,
        mockProducerKeychain.id
      )
    );
  });
});
