import {
  getMockKey,
  getMockProducerKeychain,
} from "pagopa-interop-commons-test";
import { describe, it, expect } from "vitest";
import {
  generateId,
  ProducerKeychain,
  WithMetadata,
} from "pagopa-interop-models";
import { splitProducerKeychainIntoObjectsSQL } from "../src/authorization/producerKeychainSplitters.js";
import { producerKeychainSQLToProducerKeychain } from "../src/authorization/producerKeychainAggregators.js";

describe("Producer keychain aggregator", () => {
  it("should convert a producer keychain SQL object into a business logic producer keychain ", () => {
    const producerKeychain: WithMetadata<ProducerKeychain> = {
      data: {
        ...getMockProducerKeychain(),
        users: [generateId(), generateId()],
        eservices: [generateId(), generateId()],
        keys: [getMockKey(), getMockKey()],
        description: "Test description",
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
    expect(aggregatedProducerKeychain).toMatchObject(producerKeychain);
  });
});
