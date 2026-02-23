/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { describe, it, expect } from "vitest";
import { ClientId, generateId } from "pagopa-interop-models";
import { getMockClientJWKKey } from "pagopa-interop-commons-test";
import { aggregateClientJWKKey } from "pagopa-interop-readmodel";
import {
  clientJWKKeyWriterService,
  readModelDB,
  retrieveClientJWKKeySQLByClientIdAndKid,
} from "./utils.js";

describe("Client JWK key queries", () => {
  describe("should insert or update a client JWK key", () => {
    it("should add a client JWK key", async () => {
      const clientId = generateId<ClientId>();
      const clientJWKKey = getMockClientJWKKey(clientId);
      await clientJWKKeyWriterService.upsertClientJWKKey(clientJWKKey, 1);

      const clientJWKKeySQL = await retrieveClientJWKKeySQLByClientIdAndKid(
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
      await clientJWKKeyWriterService.upsertClientJWKKey(clientJWKKey, 1);
      await clientJWKKeyWriterService.upsertClientJWKKey(clientJWKKey, 2);

      const clientJWKKeySQL = await retrieveClientJWKKeySQLByClientIdAndKid(
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

  describe("should delete a client JWK key by client id and kid", () => {
    it("delete one client JWK key", async () => {
      const clientId1 = generateId<ClientId>();
      const clientJWKKey1 = getMockClientJWKKey(clientId1);
      await clientJWKKeyWriterService.upsertClientJWKKey(clientJWKKey1, 1);

      const clientId2 = generateId<ClientId>();
      const clientJWKKey2 = getMockClientJWKKey(clientId2);
      await clientJWKKeyWriterService.upsertClientJWKKey(clientJWKKey2, 1);

      expect(
        await retrieveClientJWKKeySQLByClientIdAndKid(
          clientId1,
          clientJWKKey1.kid,
          readModelDB
        )
      ).toBeDefined();
      expect(
        await retrieveClientJWKKeySQLByClientIdAndKid(
          clientId2,
          clientJWKKey2.kid,
          readModelDB
        )
      ).toBeDefined();

      await clientJWKKeyWriterService.deleteClientJWKKeyByClientIdAndKid(
        clientId1,
        clientJWKKey1.kid,
        2
      );

      expect(
        await retrieveClientJWKKeySQLByClientIdAndKid(
          clientId1,
          clientJWKKey1.kid,
          readModelDB
        )
      ).toBeUndefined();
      expect(
        await retrieveClientJWKKeySQLByClientIdAndKid(
          clientId2,
          clientJWKKey2.kid,
          readModelDB
        )
      ).toBeDefined();
    });
  });
});
