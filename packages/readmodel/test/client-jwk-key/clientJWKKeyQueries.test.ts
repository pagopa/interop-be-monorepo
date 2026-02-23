import { describe, it, expect } from "vitest";
import { ClientId, generateId } from "pagopa-interop-models";
import { getMockClientJWKKey } from "pagopa-interop-commons-test";
import { upsertClientJWKKey } from "../../src/testUtils.js";
import { readModelDB } from "../utils.js";
import { clientJWKKeyReadModelService } from "./clientJWKKeyUtils.js";

describe("Client JWK key queries", () => {
  describe("should get a client JWK key by client id and kid", () => {
    it("client JWK key found", async () => {
      const clientId = generateId<ClientId>();
      const clientJWKKey = getMockClientJWKKey(clientId);
      await upsertClientJWKKey(readModelDB, clientJWKKey, 1);

      const retrievedClientJWKKey =
        await clientJWKKeyReadModelService.getClientJWKKeyByClientIdAndKid(
          clientId,
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
});
