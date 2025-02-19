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
  WithMetadata,
} from "pagopa-interop-models";
import { splitProducerKeychainIntoObjectsSQL } from "../src/authorization/producerKeychainSplitters.js";
import { producerKeychainSQLToProducerKeychain } from "../src/authorization/producerKeychainAggregators.js";

describe("Producer keychain aggregator", () => {
  it("should convert a producer keychain SQL object into a business logic producer keychain ", () => {
    const userId1 = generateId<UserId>();
    const userId2 = generateId<UserId>();
    const eserviceId1 = generateId<EServiceId>();
    const eserviceId2 = generateId<EServiceId>();
    const key1 = getMockKey();
    const key2 = getMockKey();
    const description = "test description";

    const producerKeychain: WithMetadata<ProducerKeychain> = {
      data: {
        ...getMockProducerKeychain(),
        users: [userId1, userId2],
        eservices: [eserviceId1, eserviceId2],
        keys: [key1, key2],
        description,
      },
      metadata: { version: 1 },
    };

    const {
      producerKeychainSQL,
      producerKeychainUsersSQL,
      producerKeychainEServicesSQL,
      producerKeychainKeysSQL,
    } = splitProducerKeychainIntoObjectsSQL(producerKeychain.data, 1);

    const aggregatedProducerKeychain = producerKeychainSQLToProducerKeychain(
      producerKeychainSQL,
      producerKeychainUsersSQL,
      producerKeychainEServicesSQL,
      producerKeychainKeysSQL
    );
    expect(aggregatedProducerKeychain).toEqual(producerKeychain);
  });
});
