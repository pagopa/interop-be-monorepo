import { describe, expect, it } from "vitest";
import {
  Client,
  generateId,
  UserId,
  WithMetadata,
} from "pagopa-interop-models";
import { getMockClient, getMockKey } from "pagopa-interop-commons-test";
import { upsertClient } from "../../src/testUtils.js";
import { readModelDB } from "../utils.js";
import { clientReadModelService } from "./clientUtils.js";

describe("Client queries", () => {
  describe("should get a client by id from the db", () => {
    it("client found", async () => {
      const client: WithMetadata<Client> = {
        data: getMockClient({
          purposes: [generateId(), generateId()],
          users: [generateId(), generateId()],
          keys: [getMockKey(), getMockKey()],
          adminId: generateId<UserId>(),
        }),
        metadata: { version: 1 },
      };
      await upsertClient(readModelDB, client.data, client.metadata.version);
      const retrievedClient = await clientReadModelService.getClientById(
        client.data.id
      );

      expect(retrievedClient).toStrictEqual(client);
    });

    it("client not found", async () => {
      const retrievedClient = await clientReadModelService.getClientById(
        generateId()
      );
      expect(retrievedClient).toBeUndefined();
    });
  });
});
