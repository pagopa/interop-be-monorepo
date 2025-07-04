/* eslint-disable @typescript-eslint/no-floating-promises */
import { describe, expect, it } from "vitest";
import {
  decodeProtobufPayload,
  getMockAuthData,
  getMockClient,
  getMockContext,
  getMockTenant,
} from "pagopa-interop-commons-test";
import { Client, ClientDeletedV2, toClientV2 } from "pagopa-interop-models";
import {
  clientNotFound,
  tenantNotAllowedOnClient,
} from "../../src/model/domain/errors.js";
import {
  addOneClient,
  authorizationService,
  readLastAuthorizationEvent,
} from "../integrationUtils.js";

describe("delete client", () => {
  it("should write on event-store for the deletion of a client", async () => {
    const mockConsumer = getMockTenant();
    const mockClient: Client = {
      ...getMockClient(),
      consumerId: mockConsumer.id,
    };

    await addOneClient(mockClient);

    await authorizationService.deleteClient(
      {
        clientId: mockClient.id,
      },
      getMockContext({ authData: getMockAuthData(mockConsumer.id) })
    );

    const writtenEvent = await readLastAuthorizationEvent(mockClient.id);

    expect(writtenEvent).toMatchObject({
      stream_id: mockClient.id,
      version: "1",
      type: "ClientDeleted",
      event_version: 2,
    });

    const writtenPayload = decodeProtobufPayload({
      messageType: ClientDeletedV2,
      payload: writtenEvent.data,
    });

    expect(writtenPayload).toEqual({
      clientId: mockClient.id,
      client: toClientV2(mockClient),
    });
  });
  it("should throw clientNotFound if the client doesn't exist", async () => {
    const mockClient = getMockClient();
    const notExistingClient = getMockClient();

    await addOneClient(mockClient);

    expect(
      authorizationService.deleteClient(
        {
          clientId: notExistingClient.id,
        },
        getMockContext({})
      )
    ).rejects.toThrowError(clientNotFound(notExistingClient.id));
  });
  it("should throw tenantNotAllowedOnClient if the requester is not the consumer", async () => {
    const mockConsumer1 = getMockTenant();
    const mockConsumer2 = getMockTenant();
    const mockClient: Client = {
      ...getMockClient(),
      consumerId: mockConsumer1.id,
    };

    await addOneClient(mockClient);

    expect(
      authorizationService.deleteClient(
        {
          clientId: mockClient.id,
        },
        getMockContext({ authData: getMockAuthData(mockConsumer2.id) })
      )
    ).rejects.toThrowError(
      tenantNotAllowedOnClient(mockConsumer2.id, mockClient.id)
    );
  });
});
