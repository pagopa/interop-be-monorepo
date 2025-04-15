/* eslint-disable @typescript-eslint/no-non-null-assertion */
import {
  getMockKey,
  getMockProducerKeychain,
} from "pagopa-interop-commons-test";
import { generateId, ProducerKeychain } from "pagopa-interop-models";
import { describe, expect, it } from "vitest";
import { aggregateProducerKeychain } from "../src/authorization/producerKeychainAggregators.js";
import {
  checkCompleteProducerKeychain,
  producerKeychainReadModelService,
  retrieveProducerKeychainEServicesSQLById,
  retrieveProducerKeychainKeysSQLById,
  retrieveProducerKeychainSQLById,
  retrieveProducerKeychainUsersSQLById,
} from "./producerKeychainUtils.js";
import { readModelDB } from "./utils.js";

describe("Producer Keychain queries", () => {
  describe("Upsert Producer Keychain", () => {
    it("should add a producer keychain", async () => {
      const producerKeychain: ProducerKeychain = {
        ...getMockProducerKeychain(),
        users: [generateId(), generateId()],
        eservices: [generateId(), generateId()],
        keys: [getMockKey(), getMockKey()],
      };

      await producerKeychainReadModelService.upsertProducerKeychain(
        producerKeychain,
        1
      );

      const { producerKeychainSQL, usersSQL, eservicesSQL, keysSQL } =
        await checkCompleteProducerKeychain(producerKeychain);

      const retrievedProducerKeychain = aggregateProducerKeychain({
        producerKeychainSQL,
        usersSQL,
        eservicesSQL,
        keysSQL,
      });

      expect(retrievedProducerKeychain).toStrictEqual({
        data: producerKeychain,
        metadata: { version: 1 },
      });
    });

    it("should update a producer keychain", async () => {
      const producerKeychain: ProducerKeychain = {
        ...getMockProducerKeychain(),
        users: [generateId(), generateId()],
        eservices: [generateId(), generateId()],
        keys: [getMockKey(), getMockKey()],
      };

      await producerKeychainReadModelService.upsertProducerKeychain(
        producerKeychain,
        1
      );
      await producerKeychainReadModelService.upsertProducerKeychain(
        producerKeychain,
        2
      );

      const { producerKeychainSQL, usersSQL, eservicesSQL, keysSQL } =
        await checkCompleteProducerKeychain(producerKeychain);

      const retrievedProducerKeychain = aggregateProducerKeychain({
        producerKeychainSQL,
        usersSQL,
        eservicesSQL,
        keysSQL,
      });

      expect(retrievedProducerKeychain).toStrictEqual({
        data: producerKeychain,
        metadata: { version: 2 },
      });
    });
  });

  describe("Get a Producer Keychain", async () => {
    it("should get a producer keychain by id if present", async () => {
      const producerKeychain: ProducerKeychain = {
        ...getMockProducerKeychain(),
        users: [generateId(), generateId()],
        eservices: [generateId(), generateId()],
        keys: [getMockKey(), getMockKey()],
      };

      await producerKeychainReadModelService.upsertProducerKeychain(
        producerKeychain,
        1
      );

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

  describe("Delete a Producer Keychain", () => {
    it("should delete a producer keychain by id", async () => {
      const producerKeychain1: ProducerKeychain = {
        ...getMockProducerKeychain(),
        users: [generateId(), generateId()],
        eservices: [generateId(), generateId()],
        keys: [getMockKey(), getMockKey()],
      };
      await producerKeychainReadModelService.upsertProducerKeychain(
        producerKeychain1,
        1
      );
      await checkCompleteProducerKeychain(producerKeychain1);

      const producerKeychain2: ProducerKeychain = {
        ...getMockProducerKeychain(),
        users: [generateId(), generateId()],
        eservices: [generateId(), generateId()],
        keys: [getMockKey(), getMockKey()],
      };
      await producerKeychainReadModelService.upsertProducerKeychain(
        producerKeychain2,
        1
      );
      await checkCompleteProducerKeychain(producerKeychain2);

      await producerKeychainReadModelService.deleteProducerKeychainById(
        producerKeychain1.id,
        2
      );

      expect(
        await retrieveProducerKeychainSQLById(producerKeychain1.id, readModelDB)
      ).toBeUndefined();
      expect(
        await retrieveProducerKeychainUsersSQLById(
          producerKeychain1.id,
          readModelDB
        )
      ).toHaveLength(0);
      expect(
        await retrieveProducerKeychainEServicesSQLById(
          producerKeychain1.id,
          readModelDB
        )
      ).toHaveLength(0);
      expect(
        await retrieveProducerKeychainKeysSQLById(
          producerKeychain1.id,
          readModelDB
        )
      ).toHaveLength(0);

      await checkCompleteProducerKeychain(producerKeychain2);
    });
  });
});
