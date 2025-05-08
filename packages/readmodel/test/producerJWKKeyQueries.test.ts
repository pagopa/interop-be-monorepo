/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { describe, it, expect } from "vitest";
import { generateId, ProducerKeychainId } from "pagopa-interop-models";
import { getMockProducerJWKKey } from "pagopa-interop-commons-test";
import { aggregateProducerJWKKey } from "../src/authorization/producerJWKKeyAggregators.js";
import { readModelDB } from "./utils.js";
import {
  producerJWKKeyReadModelService,
  retrieveProducerJWKKeySQLByKid,
} from "./producerJWKKeyUtils.js";

describe("Producer JWK key queries", () => {
  describe("should insert or update a producer JWK key", () => {
    it("should add a producer JWK key", async () => {
      const producerKeychainId = generateId<ProducerKeychainId>();
      const producerJWKKey = getMockProducerJWKKey(producerKeychainId);
      await producerJWKKeyReadModelService.upsertProducerJWKKey(
        producerJWKKey,
        1
      );

      const producerJWKKeySQL = await retrieveProducerJWKKeySQLByKid(
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
      await producerJWKKeyReadModelService.upsertProducerJWKKey(
        producerJWKKey,
        1
      );
      await producerJWKKeyReadModelService.upsertProducerJWKKey(
        producerJWKKey,
        2
      );

      const producerJWKKeySQL = await retrieveProducerJWKKeySQLByKid(
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

  describe("should get a producer JWK key by producer keychain id and kid", () => {
    it("producer JWK key found", async () => {
      const producerKeychainId = generateId<ProducerKeychainId>();
      const producerJWKKey = getMockProducerJWKKey(producerKeychainId);
      await producerJWKKeyReadModelService.upsertProducerJWKKey(
        producerJWKKey,
        1
      );

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

  describe("should delete a producer JWK key by producer keychain id and kid", () => {
    it("delete one producer JWK key", async () => {
      const producerKeychainId1 = generateId<ProducerKeychainId>();
      const producerJWKKey1 = getMockProducerJWKKey(producerKeychainId1);
      await producerJWKKeyReadModelService.upsertProducerJWKKey(
        producerJWKKey1,
        1
      );

      const producerKeychainId2 = generateId<ProducerKeychainId>();
      const producerJWKKey2 = getMockProducerJWKKey(producerKeychainId2);
      await producerJWKKeyReadModelService.upsertProducerJWKKey(
        producerJWKKey2,
        1
      );

      expect(
        await retrieveProducerJWKKeySQLByKid(
          producerKeychainId1,
          producerJWKKey1.kid,
          readModelDB
        )
      ).toBeDefined();
      expect(
        await retrieveProducerJWKKeySQLByKid(
          producerKeychainId2,
          producerJWKKey2.kid,
          readModelDB
        )
      ).toBeDefined();

      await producerJWKKeyReadModelService.deleteProducerJWKKeyByProducerKeychainAndKid(
        producerKeychainId1,
        producerJWKKey1.kid,
        2
      );

      expect(
        await retrieveProducerJWKKeySQLByKid(
          producerKeychainId1,
          producerJWKKey1.kid,
          readModelDB
        )
      ).toBeUndefined();
      expect(
        await retrieveProducerJWKKeySQLByKid(
          producerKeychainId2,
          producerJWKKey2.kid,
          readModelDB
        )
      ).toBeDefined();
    });
  });
});
