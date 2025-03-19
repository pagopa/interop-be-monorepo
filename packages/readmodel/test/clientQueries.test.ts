/* eslint-disable @typescript-eslint/no-empty-function */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { describe, expect, it } from "vitest";
import {
  clientReadModelService,
  getCustomMockClient,
  retrievedClientSQLObjects,
} from "./clientUtils.js";

describe("Client queries", () => {
  describe("should insert or update a client in the db", () => {
    it.only("should add a complete (*all* fields) client", async () => {
      const client = getCustomMockClient();
      await clientReadModelService.upsertClient(
        client.data,
        client.metadata.version
      );
      const retrievedClient = await clientReadModelService.getClientById(
        client.data.id
      );
      const { clientSQL, usersSQL, purposesSQL, keysSQL } =
        await retrievedClientSQLObjects(client);

      expect(retrievedClient).toStrictEqual(client);
      expect(clientSQL).toBeDefined();
      expect(usersSQL).toHaveLength(client.data.users.length);
      expect(purposesSQL).toHaveLength(client.data.purposes.length);
      expect(keysSQL).toHaveLength(client.data.keys.length);
    });

    it("should add an incomplete (*only* mandatory fields) client", async () => {});

    it("should update an client", async () => {});
  });

  describe("should get a client by id from the db", () => {
    it("client found", async () => {});

    it("client not found", async () => {});
  });
  describe("should delete a client from the db", () => {
    it("delete one client", async () => {});
  });
});
