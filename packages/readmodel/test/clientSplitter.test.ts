import { getMockClient, getMockKey } from "pagopa-interop-commons-test";
import { Client, generateId, PurposeId, UserId } from "pagopa-interop-models";
import { describe, it, expect } from "vitest";
import {
  ClientKeySQL,
  ClientPurposeSQL,
  ClientSQL,
  ClientUserSQL,
} from "pagopa-interop-readmodel-models";
import { splitClientIntoObjectsSQL } from "../src/client/splitters.js";

describe("Client splitter", () => {
  it("should convert a client into client SQL objects", () => {
    const userId1 = generateId<UserId>();
    const userId2 = generateId<UserId>();
    const purposeId1 = generateId<PurposeId>();
    const purposeId2 = generateId<PurposeId>();
    const key1 = getMockKey();
    const key2 = getMockKey();

    const client: Client = {
      ...getMockClient(),
      adminId: generateId<UserId>(),
      users: [userId1, userId2],
      purposes: [purposeId1, purposeId2],
      keys: [key1, key2],
      description: undefined,
    };

    const { clientSQL, usersSQL, purposesSQL, keysSQL } =
      splitClientIntoObjectsSQL(client, 1);

    const expectedClientSQL: ClientSQL = {
      id: client.id,
      consumerId: client.consumerId,
      adminId: client.adminId ? client.adminId : null,
      name: client.name,
      createdAt: client.createdAt.toISOString(),
      description: null,
      kind: client.kind,
      metadataVersion: 1,
    };

    const expectedClientUserSQL1: ClientUserSQL = {
      metadataVersion: 1,
      clientId: client.id,
      userId: userId1,
    };
    const expectedClientUserSQL2: ClientUserSQL = {
      metadataVersion: 1,
      clientId: client.id,
      userId: userId2,
    };

    const expectedClientEServicesSQL1: ClientPurposeSQL = {
      metadataVersion: 1,
      clientId: client.id,
      purposeId: purposeId1,
    };
    const expectedClientEServicesSQL2: ClientPurposeSQL = {
      metadataVersion: 1,
      clientId: client.id,
      purposeId: purposeId2,
    };

    const expectedClientKeySQL1: ClientKeySQL = {
      ...key1,
      metadataVersion: 1,
      clientId: client.id,
      createdAt: key1.createdAt.toISOString(),
    };
    const expectedClientKeySQL2: ClientKeySQL = {
      ...key2,
      metadataVersion: 1,
      clientId: client.id,
      createdAt: key2.createdAt.toISOString(),
    };

    expect(clientSQL).toEqual(expectedClientSQL);
    expect(usersSQL).toEqual(
      expect.arrayContaining([expectedClientUserSQL1, expectedClientUserSQL2])
    );
    expect(purposesSQL).toEqual(
      expect.arrayContaining([
        expectedClientEServicesSQL1,
        expectedClientEServicesSQL2,
      ])
    );
    expect(keysSQL).toEqual(
      expect.arrayContaining([expectedClientKeySQL1, expectedClientKeySQL2])
    );
  });
});
