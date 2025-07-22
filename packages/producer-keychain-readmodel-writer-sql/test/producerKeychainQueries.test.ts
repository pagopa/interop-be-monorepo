import {
  getMockProducerKeychain,
  getMockKey,
} from "pagopa-interop-commons-test/index.js";
import { ProducerKeychain, generateId } from "pagopa-interop-models";
import { aggregateProducerKeychain } from "pagopa-interop-readmodel";
import { describe, expect, it } from "vitest";
import {
  checkCompleteProducerKeychain,
  producerKeychainWriterService,
  readModelDB,
  retrieveProducerKeychainEServicesSQLById,
  retrieveProducerKeychainKeysSQLById,
  retrieveProducerKeychainSQLById,
  retrieveProducerKeychainUsersSQLById,
} from "./utils.js";

describe("Producer Keychain queries", () => {
  describe("Upsert Producer Keychain", () => {
    it("should add a producer keychain", async () => {
      const producerKeychain: ProducerKeychain = {
        ...getMockProducerKeychain(),
        users: [generateId(), generateId()],
        eservices: [generateId(), generateId()],
        keys: [getMockKey(), getMockKey()],
      };

      await producerKeychainWriterService.upsertProducerKeychain(
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

      await producerKeychainWriterService.upsertProducerKeychain(
        producerKeychain,
        1
      );
      await producerKeychainWriterService.upsertProducerKeychain(
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

  describe("Delete a Producer Keychain", () => {
    it("should delete a producer keychain by id", async () => {
      const producerKeychain1: ProducerKeychain = {
        ...getMockProducerKeychain(),
        users: [generateId(), generateId()],
        eservices: [generateId(), generateId()],
        keys: [getMockKey(), getMockKey()],
      };
      await producerKeychainWriterService.upsertProducerKeychain(
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
      await producerKeychainWriterService.upsertProducerKeychain(
        producerKeychain2,
        1
      );
      await checkCompleteProducerKeychain(producerKeychain2);

      await producerKeychainWriterService.deleteProducerKeychainById(
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
