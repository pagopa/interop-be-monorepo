/* eslint-disable @typescript-eslint/no-floating-promises */
import { describe, expect, it } from "vitest";
import {
  decodeProtobufPayload,
  getMockAuthData,
  getMockContext,
  getMockProducerKeychain,
  getMockTenant,
} from "pagopa-interop-commons-test";
import {
  EServiceId,
  generateId,
  ProducerKeychain,
  ProducerKeychainEServiceRemovedV2,
  toProducerKeychainV2,
} from "pagopa-interop-models";
import {
  producerKeychainNotFound,
  tenantNotAllowedOnProducerKeychain,
  eserviceNotFound,
} from "../../src/model/domain/errors.js";
import {
  addOneProducerKeychain,
  authorizationService,
  readLastAuthorizationEvent,
} from "../integrationUtils.js";

describe("remove producer keychain e-service", () => {
  it("should write on event-store for removing an e-service from a producer keychain", async () => {
    const mockProducer = getMockTenant();
    const eserviceIdToRemove: EServiceId = generateId();
    const eserviceIdToNotRemove: EServiceId = generateId();

    const mockProducerKeychain: ProducerKeychain = {
      ...getMockProducerKeychain(),
      producerId: mockProducer.id,
      eservices: [eserviceIdToRemove, eserviceIdToNotRemove],
    };

    await addOneProducerKeychain(mockProducerKeychain);

    const removeEServiceResponse =
      await authorizationService.removeProducerKeychainEService(
        {
          producerKeychainId: mockProducerKeychain.id,
          eserviceIdToRemove,
        },
        getMockContext({ authData: getMockAuthData(mockProducer.id) })
      );

    const writtenEvent = await readLastAuthorizationEvent(
      mockProducerKeychain.id
    );

    expect(writtenEvent).toMatchObject({
      stream_id: mockProducerKeychain.id,
      version: "1",
      type: "ProducerKeychainEServiceRemoved",
      event_version: 2,
    });

    const writtenPayload = decodeProtobufPayload({
      messageType: ProducerKeychainEServiceRemovedV2,
      payload: writtenEvent.data,
    });

    const expectedProducerKeychain: ProducerKeychain = {
      ...mockProducerKeychain,
      eservices: [eserviceIdToNotRemove],
    };

    expect(writtenPayload).toEqual({
      producerKeychain: toProducerKeychainV2(expectedProducerKeychain),
      eserviceId: eserviceIdToRemove,
    });

    expect(removeEServiceResponse).toEqual({
      data: expectedProducerKeychain,
      metadata: {
        version: 1,
      },
    });
  });
  it("should throw producerKeychainNotFound if the producer keychain doesn't exist", async () => {
    const mockProducer = getMockTenant();
    const eserviceIdToRemove: EServiceId = generateId();

    const mockProducerKeychain: ProducerKeychain = {
      ...getMockProducerKeychain(),
      producerId: mockProducer.id,
      eservices: [eserviceIdToRemove],
    };

    await addOneProducerKeychain(getMockProducerKeychain());

    expect(
      authorizationService.removeProducerKeychainEService(
        {
          producerKeychainId: mockProducerKeychain.id,
          eserviceIdToRemove,
        },
        getMockContext({ authData: getMockAuthData(mockProducer.id) })
      )
    ).rejects.toThrowError(producerKeychainNotFound(mockProducerKeychain.id));
  });
  it("should throw eserviceNotFound if that eserviceId is not related to that producer keychain", async () => {
    const mockProducer = getMockTenant();
    const notExistingEServiceId: EServiceId = generateId();
    const eserviceIdToNotRemove: EServiceId = generateId();

    const mockProducerKeychain: ProducerKeychain = {
      ...getMockProducerKeychain(),
      producerId: mockProducer.id,
      eservices: [eserviceIdToNotRemove],
    };

    await addOneProducerKeychain(mockProducerKeychain);

    expect(
      authorizationService.removeProducerKeychainEService(
        {
          producerKeychainId: mockProducerKeychain.id,
          eserviceIdToRemove: notExistingEServiceId,
        },
        getMockContext({ authData: getMockAuthData(mockProducer.id) })
      )
    ).rejects.toThrowError(eserviceNotFound(notExistingEServiceId));
  });
  it("should throw tenantNotAllowedOnProducerKeychain if the requester is not the producer", async () => {
    const mockProducer1 = getMockTenant();
    const mockProducer2 = getMockTenant();
    const eserviceIdToRemove: EServiceId = generateId();
    const mockProducerKeychain: ProducerKeychain = {
      ...getMockProducerKeychain(),
      producerId: mockProducer1.id,
      eservices: [eserviceIdToRemove],
    };

    await addOneProducerKeychain(mockProducerKeychain);

    expect(
      authorizationService.removeProducerKeychainEService(
        {
          producerKeychainId: mockProducerKeychain.id,
          eserviceIdToRemove,
        },
        getMockContext({ authData: getMockAuthData(mockProducer2.id) })
      )
    ).rejects.toThrowError(
      tenantNotAllowedOnProducerKeychain(
        mockProducer2.id,
        mockProducerKeychain.id
      )
    );
  });
});
