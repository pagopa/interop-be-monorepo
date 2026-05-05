import {
  getMockKey,
  getMockProducerKeychain,
} from "pagopa-interop-commons-test";
import { describe, it, expect } from "vitest";
import {
  EServiceId,
  generateId,
  ProducerKeychain,
  UserId,
} from "pagopa-interop-models";
import {
  ProducerKeychainEServiceSQL,
  ProducerKeychainKeySQL,
  ProducerKeychainSQL,
  ProducerKeychainUserSQL,
} from "pagopa-interop-readmodel-models";
import { splitProducerKeychainIntoObjectsSQL } from "../../src/producer-keychain/splitters.js";

describe("Producer keychain splitter", () => {
  it("should convert a producer keychain into producer keychain SQL objects", () => {
    const userId1 = generateId<UserId>();
    const userId2 = generateId<UserId>();
    const eserviceId1 = generateId<EServiceId>();
    const eserviceId2 = generateId<EServiceId>();
    const key1 = getMockKey();
    const key2 = getMockKey();

    const producerKeychain: ProducerKeychain = {
      ...getMockProducerKeychain(),
      users: [userId1, userId2],
      eservices: [eserviceId1, eserviceId2],
      keys: [key1, key2],
    };

    const { producerKeychainSQL, usersSQL, eservicesSQL, keysSQL } =
      splitProducerKeychainIntoObjectsSQL(producerKeychain, 1);

    const expectedProducerKeychainSQL: ProducerKeychainSQL = {
      id: producerKeychain.id,
      producerId: producerKeychain.producerId,
      name: producerKeychain.name,
      createdAt: producerKeychain.createdAt.toISOString(),
      description: producerKeychain.description,
      metadataVersion: 1,
    };

    const expectedProducerKeychainUserSQL1: ProducerKeychainUserSQL = {
      metadataVersion: 1,
      producerKeychainId: producerKeychain.id,
      userId: userId1,
    };
    const expectedProducerKeychainUserSQL2: ProducerKeychainUserSQL = {
      metadataVersion: 1,
      producerKeychainId: producerKeychain.id,
      userId: userId2,
    };

    const expectedProducerKeychainEServicesSQL1: ProducerKeychainEServiceSQL = {
      metadataVersion: 1,
      producerKeychainId: producerKeychain.id,
      eserviceId: eserviceId1,
    };
    const expectedProducerKeychainEServicesSQL2: ProducerKeychainEServiceSQL = {
      metadataVersion: 1,
      producerKeychainId: producerKeychain.id,
      eserviceId: eserviceId2,
    };

    const expectedProducerKeychainKeySQL1: ProducerKeychainKeySQL = {
      ...key1,
      metadataVersion: 1,
      producerKeychainId: producerKeychain.id,
      createdAt: key1.createdAt.toISOString(),
    };
    const expectedProducerKeychainKeySQL2: ProducerKeychainKeySQL = {
      ...key2,
      metadataVersion: 1,
      producerKeychainId: producerKeychain.id,
      createdAt: key2.createdAt.toISOString(),
    };

    expect(producerKeychainSQL).toStrictEqual(expectedProducerKeychainSQL);
    expect(usersSQL).toStrictEqual(
      expect.arrayContaining([
        expectedProducerKeychainUserSQL1,
        expectedProducerKeychainUserSQL2,
      ])
    );
    expect(eservicesSQL).toStrictEqual(
      expect.arrayContaining([
        expectedProducerKeychainEServicesSQL1,
        expectedProducerKeychainEServicesSQL2,
      ])
    );
    expect(keysSQL).toStrictEqual(
      expect.arrayContaining([
        expectedProducerKeychainKeySQL1,
        expectedProducerKeychainKeySQL2,
      ])
    );
  });
});
