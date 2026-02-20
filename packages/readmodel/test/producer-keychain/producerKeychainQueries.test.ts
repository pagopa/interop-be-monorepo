import {
  getMockKey,
  getMockProducerKeychain,
} from "pagopa-interop-commons-test";
import { generateId, ProducerKeychain } from "pagopa-interop-models";
import { describe, expect, it } from "vitest";
import { upsertProducerKeychain } from "../../src/testUtils.js";
import { producerKeychainReadModelService } from "./producerKeychainUtils.js";
import { readModelDB } from "../utils.js";

describe("Producer Keychain queries", () => {
  describe("Get a Producer Keychain", async () => {
    it("should get a producer keychain by id if present", async () => {
      const producerKeychain: ProducerKeychain = {
        ...getMockProducerKeychain(),
        users: [generateId(), generateId()],
        eservices: [generateId(), generateId()],
        keys: [getMockKey(), getMockKey()],
      };

      await upsertProducerKeychain(readModelDB, producerKeychain, 1);

      const retrievedProducerKeychain =
        await producerKeychainReadModelService.getProducerKeychainById(
          producerKeychain.id
        );

      expect(retrievedProducerKeychain).toStrictEqual({
        data: producerKeychain,
        metadata: { version: 1 },
      });
    });

    it("should *not* get a producer keychain by id if not present", async () => {
      const retrievedProducerKeychain =
        await producerKeychainReadModelService.getProducerKeychainById(
          generateId()
        );

      expect(retrievedProducerKeychain).toBeUndefined();
    });
  });
});
