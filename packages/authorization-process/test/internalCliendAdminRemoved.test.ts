/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { describe, expect, it } from "vitest";
import {
  getMockClient,
  getMockContextInternal,
} from "pagopa-interop-commons-test";
import {
  Client,
  ClientId,
  clientKind,
  generateId,
  UserId,
} from "pagopa-interop-models";
import {
  clientAdminIdNotFound,
  clientKindNotAllowed,
  clientNotFound,
} from "../src/model/domain/errors.js";
import {
  addOneClient,
  authorizationService,
  readLastAuthorizationEvent,
} from "./utils.js";

describe("internalCliendAdminRemoved", () => {
  it("should write on event-store for the remove of an admin in a client", async () => {
    const mockClient: Client = {
      ...getMockClient(),
      adminId: generateId<UserId>(),
      kind: clientKind.api,
    };

    await addOneClient(mockClient);

    await authorizationService.internalRemoveClientAdmin(
      mockClient.id,
      mockClient.adminId!,
      getMockContextInternal({})
    );

    const writtenEvent = await readLastAuthorizationEvent(mockClient.id);

    expect(writtenEvent).toMatchObject({
      stream_id: mockClient.id,
      version: "1",
      type: "ClientAdminRemoved",
      event_version: 2,
    });
  });
  it("should throw clientNotFound if the client does not exist", async () => {
    const clientId = generateId<ClientId>();

    await expect(
      authorizationService.internalRemoveClientAdmin(
        clientId,
        generateId<UserId>(),
        getMockContextInternal({})
      )
    ).rejects.toThrowError(clientNotFound(clientId));
  });
  it("should throw clientKindNotAllowed if the client is not of kind api", async () => {
    const mockClient: Client = {
      ...getMockClient(),
      kind: clientKind.consumer,
    };

    await addOneClient(mockClient);

    await expect(
      authorizationService.internalRemoveClientAdmin(
        mockClient.id,
        generateId<UserId>(),
        getMockContextInternal({})
      )
    ).rejects.toThrowError(clientKindNotAllowed(mockClient.id));
  });
  it("should throw clientAdminIdNotFound if the adminId is not found", async () => {
    const adminId = generateId<UserId>();

    const mockClient1: Client = {
      ...getMockClient(),
      kind: clientKind.api,
    };

    const mockClient2: Client = {
      ...getMockClient(),
      kind: clientKind.api,
      adminId: generateId<UserId>(),
    };

    await addOneClient(mockClient1);
    await addOneClient(mockClient2);

    await expect(
      authorizationService.internalRemoveClientAdmin(
        mockClient1.id,
        adminId,
        getMockContextInternal({})
      )
    ).rejects.toThrowError(clientAdminIdNotFound(mockClient1.id, adminId));

    await expect(
      authorizationService.internalRemoveClientAdmin(
        mockClient2.id,
        adminId,
        getMockContextInternal({})
      )
    ).rejects.toThrowError(clientAdminIdNotFound(mockClient2.id, adminId));
  });
});
