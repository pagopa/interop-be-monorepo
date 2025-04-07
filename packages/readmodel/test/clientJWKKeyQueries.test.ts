/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { describe, it, expect } from "vitest";
import { ClientId, generateId } from "pagopa-interop-models";
import { aggregateClientJWKKey } from "../src/authorization/clientJWKKeyAggregators.js";
import { readModelDB } from "./utils.js";
import {
  clientJWKKeyReadModelService,
  getMockClientJWKKey,
  retrieveClientJWKKeySQLByKid,
} from "./clientJWKKeyUtils.js";

describe("Client JWK key queries", () => {
  describe("should insert or update a client JWK key", () => {
    it("should add a client JWK key", async () => {
      const clientId = generateId<ClientId>();
      const clientJWKKey = getMockClientJWKKey(clientId);
      await clientJWKKeyReadModelService.upsertClientJWKKey(clientJWKKey, 1);

      const clientJWKKeySQL = await retrieveClientJWKKeySQLByKid(
        clientId,
        clientJWKKey.kid,
        readModelDB
      );
      expect(clientJWKKeySQL).toBeDefined();

      const retrievedClientJWKKey = aggregateClientJWKKey(clientJWKKeySQL!);
      expect(retrievedClientJWKKey).toStrictEqual({
        data: clientJWKKey,
        metadata: { version: 1 },
      });
    });

    it("should update a client JWK key", async () => {
      const clientId = generateId<ClientId>();
      const clientJWKKey = getMockClientJWKKey(clientId);
      await clientJWKKeyReadModelService.upsertClientJWKKey(clientJWKKey, 1);
      await clientJWKKeyReadModelService.upsertClientJWKKey(clientJWKKey, 2);

      const clientJWKKeySQL = await retrieveClientJWKKeySQLByKid(
        clientId,
        clientJWKKey.kid,
        readModelDB
      );
      expect(clientJWKKeySQL).toBeDefined();

      const retrievedClientJWKKey = aggregateClientJWKKey(clientJWKKeySQL!);
      expect(retrievedClientJWKKey).toStrictEqual({
        data: clientJWKKey,
        metadata: { version: 2 },
      });
    });
  });

  describe("should get a client JWK key by client id and kid", () => {
    it("client JWK key found", async () => {
      const clientKeychainId = generateId<ClientId>();
      const clientJWKKey = getMockClientJWKKey(clientKeychainId);
      await clientJWKKeyReadModelService.upsertClientJWKKey(clientJWKKey, 1);

      const retrievedClientJWKKey =
        await clientJWKKeyReadModelService.getClientJWKKeyByClientIdAndKid(
          clientKeychainId,
          clientJWKKey.kid
        );
      expect(retrievedClientJWKKey).toStrictEqual({
        data: clientJWKKey,
        metadata: { version: 1 },
      });
    });

    it("client JWK key NOT found", async () => {
      const clientId = generateId<ClientId>();
      const retrievedClientJWKKey =
        await clientJWKKeyReadModelService.getClientJWKKeyByClientIdAndKid(
          clientId,
          "fake kid"
        );
      expect(retrievedClientJWKKey).toBeUndefined();
    });
  });

  describe("should delete a client JWK key by client id and kid", () => {
    it("delete one client JWK key", async () => {
      const clientId1 = generateId<ClientId>();
      const clientJWKKey1 = getMockClientJWKKey(clientId1);
      await clientJWKKeyReadModelService.upsertClientJWKKey(clientJWKKey1, 1);

      const clientId2 = generateId<ClientId>();
      const clientJWKKey2 = getMockClientJWKKey(clientId2);
      await clientJWKKeyReadModelService.upsertClientJWKKey(clientJWKKey2, 1);

      expect(
        await retrieveClientJWKKeySQLByKid(
          clientId1,
          clientJWKKey1.kid,
          readModelDB
        )
      ).toBeDefined();
      expect(
        await retrieveClientJWKKeySQLByKid(
          clientId2,
          clientJWKKey2.kid,
          readModelDB
        )
      ).toBeDefined();

      await clientJWKKeyReadModelService.deleteClientJWKKeyByClientIdAndKid(
        clientId1,
        clientJWKKey1.kid,
        2
      );

      expect(
        await retrieveClientJWKKeySQLByKid(
          clientId1,
          clientJWKKey1.kid,
          readModelDB
        )
      ).toBeUndefined();
      expect(
        await retrieveClientJWKKeySQLByKid(
          clientId2,
          clientJWKKey2.kid,
          readModelDB
        )
      ).toBeDefined();
    });
  });
});
