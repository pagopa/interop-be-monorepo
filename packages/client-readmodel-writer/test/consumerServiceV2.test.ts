/* eslint-disable @typescript-eslint/no-floating-promises */
import { describe } from "node:test";
import {
  getMockClient,
  getMockKey,
  writeInReadmodel,
} from "pagopa-interop-commons-test/index.js";
import {
  AuthorizationEventEnvelopeV2,
  Client,
  ClientAddedV2,
  ClientKeyAddedV2,
  ClientKeyDeletedV2,
  ClientPurposeAddedV2,
  ClientPurposeRemovedV2,
  ClientUserAddedV2,
  ClientUserDeletedV2,
  Key,
  PurposeId,
  UserId,
  generateId,
  toClientV2,
  toReadModelClient,
} from "pagopa-interop-models";
import { expect, it } from "vitest";
import { handleMessageV2 } from "../src/clientConsumerServiceV2.js";
import { clients } from "./utils.js";

describe("Events V2", async () => {
  const mockClient = getMockClient();
  const mockMessage: AuthorizationEventEnvelopeV2 = {
    event_version: 2,
    stream_id: mockClient.id,
    version: 1,
    sequence_num: 1,
    log_date: new Date(),
    type: "ClientAdded",
    data: {},
  };

  it("ClientAdded", async () => {
    const payload: ClientAddedV2 = {
      client: toClientV2(mockClient),
    };

    const message: AuthorizationEventEnvelopeV2 = {
      ...mockMessage,
      type: "ClientAdded",
      data: payload,
    };

    await handleMessageV2(message, clients);

    const retrievedClient = await clients.findOne({
      "data.id": mockClient.id,
    });

    expect(retrievedClient?.data).toEqual(toReadModelClient(mockClient));

    expect(retrievedClient?.metadata).toEqual({
      version: 1,
    });
  });

  it("ClientKeyAdded", async () => {
    await writeInReadmodel(toReadModelClient(mockClient), clients, 1);

    const key: Key = getMockKey();
    const updatedClient: Client = {
      ...mockClient,
      keys: [key],
    };
    const payload: ClientKeyAddedV2 = {
      client: toClientV2(updatedClient),
      kid: key.kid,
    };

    const message: AuthorizationEventEnvelopeV2 = {
      ...mockMessage,
      type: "ClientKeyAdded",
      data: payload,
      version: 2,
    };

    await handleMessageV2(message, clients);

    const retrievedClient = await clients.findOne({
      "data.id": mockClient.id,
    });

    expect(retrievedClient?.data).toEqual(toReadModelClient(updatedClient));
    expect(retrievedClient?.metadata).toEqual({
      version: 2,
    });
  });

  it("ClientKeyDeleted", async () => {
    const key: Key = getMockKey();
    const client: Client = {
      ...mockClient,
      keys: [key],
    };
    await writeInReadmodel(toReadModelClient(client), clients, 1);

    const updatedClient = mockClient;

    const payload: ClientKeyDeletedV2 = {
      client: toClientV2(updatedClient),
      kid: key.kid,
    };

    const message: AuthorizationEventEnvelopeV2 = {
      ...mockMessage,
      type: "ClientKeyDeleted",
      data: payload,
      version: 2,
    };

    await handleMessageV2(message, clients);

    const retrievedClient = await clients.findOne({
      "data.id": client.id,
    });

    expect(retrievedClient?.data.keys).toHaveLength(0);
  });

  it("ClientUserAdded", async () => {
    await writeInReadmodel(toReadModelClient(mockClient), clients, 1);

    const userId: UserId = generateId<UserId>();
    const updatedClient: Client = {
      ...mockClient,
      users: [userId],
    };

    const payload: ClientUserAddedV2 = {
      client: toClientV2(updatedClient),
      userId,
    };

    const message: AuthorizationEventEnvelopeV2 = {
      ...mockMessage,
      type: "ClientUserAdded",
      data: payload,
      version: 2,
    };

    await handleMessageV2(message, clients);

    const retrievedClient = await clients.findOne({
      "data.id": updatedClient.id,
    });

    expect(retrievedClient?.data).toEqual(toReadModelClient(updatedClient));
    expect(retrievedClient?.metadata).toEqual({
      version: 2,
    });
  });

  it("ClientUserDeleted", async () => {
    const userId: UserId = generateId<UserId>();
    const client: Client = {
      ...mockClient,
      users: [userId],
    };
    await writeInReadmodel(toReadModelClient(client), clients, 1);

    const updatedClient = mockClient;

    const payload: ClientUserDeletedV2 = {
      client: toClientV2(updatedClient),
      userId,
    };

    const message: AuthorizationEventEnvelopeV2 = {
      ...mockMessage,
      type: "ClientUserDeleted",
      data: payload,
      version: 2,
    };

    await handleMessageV2(message, clients);

    const retrievedClient = await clients.findOne({
      "data.id": client.id,
    });

    expect(retrievedClient?.data.users).toHaveLength(0);
  });

  it("ClientPurposeAdded", async () => {
    await writeInReadmodel(toReadModelClient(mockClient), clients, 1);

    const purposeId: PurposeId = generateId<PurposeId>();
    const updatedClient: Client = {
      ...mockClient,
      purposes: [purposeId],
    };

    const payload: ClientPurposeAddedV2 = {
      client: toClientV2(updatedClient),
      purposeId,
    };

    const message: AuthorizationEventEnvelopeV2 = {
      ...mockMessage,
      type: "ClientPurposeAdded",
      data: payload,
      version: 2,
    };

    await handleMessageV2(message, clients);

    const retrievedClient = await clients.findOne({
      "data.id": updatedClient.id,
    });

    expect(retrievedClient?.data).toEqual(toReadModelClient(updatedClient));
    expect(retrievedClient?.metadata).toEqual({
      version: 2,
    });
  });

  it("ClientPurposeRemoved", async () => {
    const purposeId: PurposeId = generateId<PurposeId>();
    const client: Client = {
      ...mockClient,
      purposes: [purposeId],
    };
    await writeInReadmodel(toReadModelClient(client), clients, 1);

    const updatedClient = mockClient;

    const payload: ClientPurposeRemovedV2 = {
      client: toClientV2(updatedClient),
      purposeId,
    };

    const message: AuthorizationEventEnvelopeV2 = {
      ...mockMessage,
      type: "ClientPurposeRemoved",
      data: payload,
      version: 2,
    };

    await handleMessageV2(message, clients);

    const retrievedClient = await clients.findOne({
      "data.id": client.id,
    });

    expect(retrievedClient?.data.purposes).toHaveLength(0);
  });
});
