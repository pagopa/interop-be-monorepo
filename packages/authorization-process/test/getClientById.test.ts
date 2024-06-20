import { genericLogger } from "pagopa-interop-commons";
import {
  Client,
  ClientId,
  TenantId,
  UserId,
  generateId,
} from "pagopa-interop-models";
import { describe, it, expect } from "vitest";
import { getMockClient } from "pagopa-interop-commons-test";
import { clientNotFound } from "../src/model/domain/errors.js";
import { addOneClient, authorizationService } from "./utils.js";

describe("getClientById", async () => {
  const consumerId: TenantId = generateId();

  it("should get from the readModel the client with the specified Id with users", async () => {
    const userId1: UserId = generateId();
    const userId2: UserId = generateId();

    const expectedClient: Client = {
      ...getMockClient(),
      consumerId,
      users: [userId1, userId2],
    };
    await addOneClient(expectedClient);

    const { client } = await authorizationService.getClientById(
      expectedClient.id,
      consumerId,
      genericLogger
    );
    expect(client).toEqual(expectedClient);
  });
  it("should get from the readModel the client with the specified Id without users", async () => {
    const expectedClientWithoutUser: Client = {
      ...getMockClient(),
      users: [],
      consumerId,
    };

    await addOneClient(expectedClientWithoutUser);

    const { client } = await authorizationService.getClientById(
      expectedClientWithoutUser.id,
      consumerId,
      genericLogger
    );
    expect(client).toEqual(expectedClientWithoutUser);
  });
  it("should throw clientNotFound if the client with the specified Id doesn't exist", async () => {
    await addOneClient(getMockClient());
    const clientId: ClientId = generateId();
    await expect(
      authorizationService.getClientById(clientId, consumerId, genericLogger)
    ).rejects.toThrowError(clientNotFound(clientId));
  });
});
