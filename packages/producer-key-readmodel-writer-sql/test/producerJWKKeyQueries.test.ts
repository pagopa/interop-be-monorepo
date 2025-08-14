/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { describe, it, expect } from "vitest";
import { generateId, ProducerKeychainId } from "pagopa-interop-models";
import { getMockProducerJWKKey } from "pagopa-interop-commons-test";
import { aggregateProducerJWKKey } from "pagopa-interop-readmodel";
import {
  retrieveProducerJWKKeySQLByProducerKeychainIdAndKid,
  readModelDB,
  producerJWKKeyWriterService,
} from "./utils.js";

describe("Producer JWK key queries", () => {
  describe("should insert or update a producer JWK key", () => {
    it("should add a producer JWK key", async () => {
      const producerKeychainId = generateId<ProducerKeychainId>();
      const producerJWKKey = getMockProducerJWKKey(producerKeychainId);
      await producerJWKKeyWriterService.upsertProducerJWKKey(producerJWKKey, 1);

      const producerJWKKeySQL =
        await retrieveProducerJWKKeySQLByProducerKeychainIdAndKid(
          producerKeychainId,
          producerJWKKey.kid,
          readModelDB
        );
      expect(producerJWKKeySQL).toBeDefined();

      const retrievedProducerJWKKey = aggregateProducerJWKKey(
        producerJWKKeySQL!
      );
      expect(retrievedProducerJWKKey).toStrictEqual({
        data: producerJWKKey,
        metadata: { version: 1 },
      });
    });

    it("should update a producer JWK key", async () => {
      const producerKeychainId = generateId<ProducerKeychainId>();
      const producerJWKKey = getMockProducerJWKKey(producerKeychainId);
      await producerJWKKeyWriterService.upsertProducerJWKKey(producerJWKKey, 1);
      await producerJWKKeyWriterService.upsertProducerJWKKey(producerJWKKey, 2);

      const producerJWKKeySQL =
        await retrieveProducerJWKKeySQLByProducerKeychainIdAndKid(
          producerKeychainId,
          producerJWKKey.kid,
          readModelDB
        );
      expect(producerJWKKeySQL).toBeDefined();

      const retrievedProducerJWKKey = aggregateProducerJWKKey(
        producerJWKKeySQL!
      );
      expect(retrievedProducerJWKKey).toStrictEqual({
        data: producerJWKKey,
        metadata: { version: 2 },
      });
    });
  });

  describe("should delete a producer JWK key by producer keychain id and kid", () => {
    it("delete one producer JWK key", async () => {
      const producerKeychainId1 = generateId<ProducerKeychainId>();
      const producerJWKKey1 = getMockProducerJWKKey(producerKeychainId1);
      await producerJWKKeyWriterService.upsertProducerJWKKey(
        producerJWKKey1,
        1
      );

      const producerKeychainId2 = generateId<ProducerKeychainId>();
      const producerJWKKey2 = getMockProducerJWKKey(producerKeychainId2);
      await producerJWKKeyWriterService.upsertProducerJWKKey(
        producerJWKKey2,
        1
      );

      expect(
        await retrieveProducerJWKKeySQLByProducerKeychainIdAndKid(
          producerKeychainId1,
          producerJWKKey1.kid,
          readModelDB
        )
      ).toBeDefined();
      expect(
        await retrieveProducerJWKKeySQLByProducerKeychainIdAndKid(
          producerKeychainId2,
          producerJWKKey2.kid,
          readModelDB
        )
      ).toBeDefined();

      await producerJWKKeyWriterService.deleteProducerJWKKeyByProducerKeychainAndKid(
        producerKeychainId1,
        producerJWKKey1.kid,
        2
      );

      expect(
        await retrieveProducerJWKKeySQLByProducerKeychainIdAndKid(
          producerKeychainId1,
          producerJWKKey1.kid,
          readModelDB
        )
      ).toBeUndefined();
      expect(
        await retrieveProducerJWKKeySQLByProducerKeychainIdAndKid(
          producerKeychainId2,
          producerJWKKey2.kid,
          readModelDB
        )
      ).toBeDefined();
    });
  });
});
