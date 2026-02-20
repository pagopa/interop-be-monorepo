import { describe, it, expect } from "vitest";
import { generateId, ProducerKeychainId } from "pagopa-interop-models";
import { getMockProducerJWKKey } from "pagopa-interop-commons-test";
import { upsertProducerJWKKey } from "../../src/testUtils.js";
import { readModelDB } from "../utils.js";
import { producerJWKKeyReadModelService } from "./producerJWKKeyUtils.js";

describe("Producer JWK key queries", () => {
  describe("should get a producer JWK key by producer keychain id and kid", () => {
    it("producer JWK key found", async () => {
      const producerKeychainId = generateId<ProducerKeychainId>();
      const producerJWKKey = getMockProducerJWKKey(producerKeychainId);
      await upsertProducerJWKKey(readModelDB, producerJWKKey, 1);

      const retrievedProducerJWKKey =
        await producerJWKKeyReadModelService.getProducerJWKKeyByProducerKeychainIdAndKid(
          producerKeychainId,
          producerJWKKey.kid
        );
      expect(retrievedProducerJWKKey).toStrictEqual({
        data: producerJWKKey,
        metadata: { version: 1 },
      });
    });

    it("producer JWK key NOT found", async () => {
      const producerKeychainId = generateId<ProducerKeychainId>();
      const retrievedProducerJWKKey =
        await producerJWKKeyReadModelService.getProducerJWKKeyByProducerKeychainIdAndKid(
          producerKeychainId,
          "fake kid"
        );
      expect(retrievedProducerJWKKey).toBeUndefined();
    });
  });
});
