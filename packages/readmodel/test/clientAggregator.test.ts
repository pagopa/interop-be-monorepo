import { getMockClient, getMockKey } from "pagopa-interop-commons-test";
import { Client, generateId, WithMetadata } from "pagopa-interop-models";
import { describe, it, expect } from "vitest";
import { splitClientIntoObjectsSQL } from "../src/authorization/clientSplitters.js";
import { aggregateClientSQL } from "../src/authorization/clientAggregators.js";

describe("Client aggregator", () => {
  it("should convert client SQL objects into a business logic client", () => {
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

    const { clientSQL, usersSQL, purposesSQL, keysSQL } =
      splitClientIntoObjectsSQL(client.data, 1);

    const aggregatedClient = aggregateClientSQL({
      clientSQL,
      usersSQL,
      purposesSQL,
      keysSQL,
    });

    expect(aggregatedClient).toMatchObject(client);
  });
});
