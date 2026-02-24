import { describe, expect, it } from "vitest";
import { Client, WithMetadata } from "pagopa-interop-models";
import {
  clientReadModelService,
  clientWriterService,
  getCustomMockClient,
  retrievedClientSQLObjects,
} from "./utils.js";

describe("Client queries", () => {
  describe("should insert or update a client in the db", () => {
    it("should add a complete (*all* fields) client", async () => {
      const client = getCustomMockClient({
        isClientComplete: true,
      });
      await clientWriterService.upsertClient(
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

    it("should add an incomplete (*only* mandatory fields) client", async () => {
      const client = getCustomMockClient({
        isClientComplete: false,
      });
      await clientWriterService.upsertClient(
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

    it("should update an client", async () => {
      const client = getCustomMockClient({
        isClientComplete: true,
      });
      const updatedClient: WithMetadata<Client> = {
        data: {
          ...client.data,
          description: "an updated description",
        },
        metadata: { version: 2 },
      };
      await clientWriterService.upsertClient(
        client.data,
        client.metadata.version
      );
      await clientWriterService.upsertClient(
        updatedClient.data,
        updatedClient.metadata.version
      );
      const retrievedClient = await clientReadModelService.getClientById(
        updatedClient.data.id
      );
      const { clientSQL, usersSQL, purposesSQL, keysSQL } =
        await retrievedClientSQLObjects(client);
      expect(retrievedClient).toStrictEqual(updatedClient);
      expect(clientSQL).toBeDefined();
      expect(usersSQL).toHaveLength(client.data.users.length);
      expect(purposesSQL).toHaveLength(client.data.purposes.length);
      expect(keysSQL).toHaveLength(client.data.keys.length);
    });
  });

  describe("should delete a client from the db", () => {
    it("delete one client", async () => {
      const client = getCustomMockClient({
        isClientComplete: true,
      });
      await clientWriterService.upsertClient(
        client.data,
        client.metadata.version
      );

      const {
        clientSQL: clientInsertedSQL,
        usersSQL: usersInsertedSQL,
        purposesSQL: purposesInsertedSQL,
        keysSQL: keysInsertedSQL,
      } = await retrievedClientSQLObjects(client);
      expect(clientInsertedSQL).toBeDefined();
      expect(usersInsertedSQL).toHaveLength(client.data.users.length);
      expect(purposesInsertedSQL).toHaveLength(client.data.purposes.length);
      expect(keysInsertedSQL).toHaveLength(client.data.keys.length);

      await clientWriterService.deleteClientById(
        client.data.id,
        client.metadata.version
      );

      const retrievedClient = await clientReadModelService.getClientById(
        client.data.id
      );
      expect(retrievedClient).toBeUndefined();

      const { clientSQL, usersSQL, purposesSQL, keysSQL } =
        await retrievedClientSQLObjects(client);
      expect(retrievedClient).toBeUndefined();
      expect(clientSQL).toBeUndefined();
      expect(usersSQL).toHaveLength(0);
      expect(purposesSQL).toHaveLength(0);
      expect(keysSQL).toHaveLength(0);
    });
  });
});
