import {
  getMockKey,
  getMockProducerKeychain,
} from "pagopa-interop-commons-test";
import {
  generateId,
  ProducerKeychain,
  WithMetadata,
} from "pagopa-interop-models";
import { describe, it, expect } from "vitest";

import { aggregateProducerKeychain } from "../../src/producer-keychain/aggregators.js";
import { splitProducerKeychainIntoObjectsSQL } from "../../src/producer-keychain/splitters.js";

describe("Producer keychain aggregator", () => {
  it("should convert a producer keychain SQL object into a business logic producer keychain ", () => {
    const producerKeychain: WithMetadata<ProducerKeychain> = {
      data: {
        ...getMockProducerKeychain(),
        users: [generateId(), generateId()],
        eservices: [generateId(), generateId()],
        keys: [getMockKey(), getMockKey()],
      },
      metadata: { version: 1 },
    };

    const { producerKeychainSQL, usersSQL, eservicesSQL, keysSQL } =
      splitProducerKeychainIntoObjectsSQL(producerKeychain.data, 1);

    const aggregatedProducerKeychain = aggregateProducerKeychain({
      producerKeychainSQL,
      usersSQL,
      eservicesSQL,
      keysSQL,
    });
    expect(aggregatedProducerKeychain).toStrictEqual(producerKeychain);
  });
});
