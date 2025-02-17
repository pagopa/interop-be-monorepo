import { getMockClient, getMockKey } from "pagopa-interop-commons-test";
import {
  Client,
  ClientId,
  clientKind,
  generateId,
  PurposeId,
  UserId,
  WithMetadata,
} from "pagopa-interop-models";
import { describe, it, expect } from "vitest";
import {
  ClientKeySQL,
  ClientPurposeSQL,
  ClientSQL,
  ClientUserSQL,
} from "../src/types.js";
import { clientSQLToClient } from "./../src/authorization/clientAggregators.js";

describe("Client Aggregator", () => {
  it("should convert a Client object as data model into a Client object as business model ", () => {
    const clientId = generateId<ClientId>();
    const userId1 = generateId<UserId>();
    const userId2 = generateId<UserId>();
    const purposeId1 = generateId<PurposeId>();
    const purposeId2 = generateId<PurposeId>();
    const key1 = getMockKey();
    const key2 = getMockKey();
    const mockClient = getMockClient();

    const clientSQL: ClientSQL = {
      ...mockClient,
      id: clientId,
      createdAt: mockClient.createdAt.toISOString(),
      description: "description",
      kind: clientKind.consumer,
      metadataVersion: 1,
    };

    const clientUserSQL1: ClientUserSQL = {
      metadataVersion: 1,
      clientId,
      userId: userId1,
    };
    const clientUserSQL2: ClientUserSQL = {
      metadataVersion: 1,
      clientId,
      userId: userId2,
    };
    const clientPurposeSQL1: ClientPurposeSQL = {
      metadataVersion: 1,
      clientId,
      purposeId: purposeId1,
    };
    const clientPurposeSQL2: ClientPurposeSQL = {
      metadataVersion: 1,
      clientId,
      purposeId: purposeId2,
    };
    const clientKeySQL1: ClientKeySQL = {
      ...key1,
      metadataVersion: 1,
      clientId,
      createdAt: key1.createdAt.toISOString(),
    };
    const clientKeySQL2: ClientKeySQL = {
      ...key2,
      metadataVersion: 1,
      clientId,
      createdAt: key2.createdAt.toISOString(),
    };
    const clientUsersSQL: ClientUserSQL[] = [clientUserSQL1, clientUserSQL2];
    const clientPurposesSQL: ClientPurposeSQL[] = [
      clientPurposeSQL1,
      clientPurposeSQL2,
    ];
    const clientKeysSQL: ClientKeySQL[] = [clientKeySQL1, clientKeySQL2];

    const client: WithMetadata<Client> = clientSQLToClient(
      clientSQL,
      clientUsersSQL,
      clientPurposesSQL,
      clientKeysSQL
    );

    const expectedClient: WithMetadata<Client> = {
      data: {
        ...mockClient,
        id: clientId,
        description: "description",
        kind: clientKind.consumer,
        purposes: [purposeId1, purposeId2],
        users: [userId1, userId2],
        keys: [key1, key2],
      },
      metadata: { version: 1 },
    };
    expect(client).toEqual(expectedClient);
  });
});
