import { getMockClient, getMockKey } from "pagopa-interop-commons-test";
import { Client, generateId, WithMetadata } from "pagopa-interop-models";
import { describe, it, expect } from "vitest";
import { splitClientIntoObjectsSQL } from "../src/authorization/clientSplitters.js";
import { clientSQLToClient } from "../src/authorization/clientAggregators.js";

describe("Client aggregator", () => {
  it("should convert a client into client SQL objects", () => {
    const client: WithMetadata<Client> = {
      data: {
        ...getMockClient(),
        users: [generateId(), generateId()],
        purposes: [generateId(), generateId()],
        keys: [getMockKey(), getMockKey()],
      },
      metadata: {
        version: 1,
      },
    };

    const { clientSQL, clientUsersSQL, clientPurposesSQL, clientKeysSQL } =
      splitClientIntoObjectsSQL(client.data, 1);

    const aggregatedClient = clientSQLToClient(
      clientSQL,
      clientUsersSQL,
      clientPurposesSQL,
      clientKeysSQL
    );

    expect(aggregatedClient).toMatchObject(client);
  });
});
