/* eslint-disable @typescript-eslint/no-floating-promises */
import {
  decodeProtobufPayload,
  getMockClient,
  getRandomAuthData,
} from "pagopa-interop-commons-test";
import {
  Client,
  ClientUserAddedV2,
  TenantId,
  UserId,
  generateId,
  toClientV2,
  unsafeBrandId,
} from "pagopa-interop-models";
import { describe, expect, it } from "vitest";
import { genericLogger } from "pagopa-interop-commons";
import {
  clientNotFound,
  organizationNotAllowedOnClient,
  securityUserNotFound,
  userAlreadyAssigned,
} from "../src/model/domain/errors.js";
import {
  addOneClient,
  authorizationService,
  readLastAuthorizationEvent,
} from "./utils.js";

describe("addUser", () => {
  it.only("should write on event-store for adding a user from a client", async () => {
    const consumerId: TenantId = generateId();
    const userIdToAdd: UserId = generateId();
    const userId: UserId = generateId();

    const mockClient: Client = {
      ...getMockClient(),
      consumerId,
      users: [userId],
    };

    await addOneClient(mockClient);
    await authorizationService.addUser(
      {
        clientId: mockClient.id,
        userId: userIdToAdd,
        authData: getRandomAuthData(consumerId),
      },
      generateId(),
      genericLogger
    );

    const writtenEvent = await readLastAuthorizationEvent(mockClient.id);

    expect(writtenEvent).toMatchObject({
      stream_id: mockClient.id,
      version: "1",
      type: "ClientUserAdded",
      event_version: 2,
    });

    const writtenPayload = decodeProtobufPayload({
      messageType: ClientUserAddedV2,
      payload: writtenEvent.data,
    });

    expect(writtenPayload).toEqual({
      userId: userIdToAdd,
      client: toClientV2({ ...mockClient, users: [userId, userIdToAdd] }),
    });
  });
  it("should throw clientNotFound if the client doesn't exist", async () => {
    const userIdToAdd: UserId = generateId();
    const consumerId: TenantId = generateId();

    const mockClient: Client = {
      ...getMockClient(),
      consumerId,
      users: [],
    };

    await addOneClient(getMockClient());
    expect(
      authorizationService.addUser(
        {
          clientId: mockClient.id,
          userId: userIdToAdd,
          authData: getRandomAuthData(consumerId),
        },
        generateId(),
        genericLogger
      )
    ).rejects.toThrowError(clientNotFound(mockClient.id));
  });
  it("should throw userAlreadyAssigned if the user already exist in the client", async () => {
    const consumerId: TenantId = generateId();
    const userId: UserId = generateId();

    const mockClient: Client = {
      ...getMockClient(),
      consumerId,
      users: [userId],
    };

    await addOneClient(mockClient);

    expect(
      authorizationService.addUser(
        {
          clientId: mockClient.id,
          userId,
          authData: getRandomAuthData(consumerId),
        },
        generateId(),
        genericLogger
      )
    ).rejects.toThrowError(userAlreadyAssigned(mockClient.id, userId));
  });
  it("should throw organizationNotAllowedOnClient if the requester is not the consumer", async () => {
    const userIdToAdd: UserId = generateId();
    const organizationId: TenantId = generateId();
    const mockClient: Client = {
      ...getMockClient(),
      consumerId: generateId(),
      users: [],
    };

    await addOneClient(mockClient);

    expect(
      authorizationService.addUser(
        {
          clientId: mockClient.id,
          userId: userIdToAdd,
          authData: getRandomAuthData(organizationId),
        },
        generateId(),
        genericLogger
      )
    ).rejects.toThrowError(
      organizationNotAllowedOnClient(organizationId, mockClient.id)
    );
  });
  it("should throw securityUserNotFound if the Security user is not found", async () => {
    const userIdToAdd: UserId = generateId();
    const consumerId: TenantId = generateId();

    const mockClient: Client = {
      ...getMockClient(),
      consumerId,
      users: [],
    };

    await addOneClient(getMockClient());
    expect(
      authorizationService.addUser(
        {
          clientId: mockClient.id,
          userId: userIdToAdd,
          authData: getRandomAuthData(),
        },
        generateId(),
        genericLogger
      )
    ).rejects.toThrowError(
      securityUserNotFound(unsafeBrandId(consumerId), userIdToAdd)
    );
  });
});
