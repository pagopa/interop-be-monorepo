/* eslint-disable @typescript-eslint/no-floating-promises */
import { genericLogger } from "pagopa-interop-commons";
import { Client, TenantId, generateId } from "pagopa-interop-models";
import { describe, it, expect } from "vitest";
import { getMockClient, getMockKey } from "pagopa-interop-commons-test";
import {
  clientNotFound,
  clientKeyNotFound,
  organizationNotAllowedOnClient,
} from "../src/model/domain/errors.js";
import { addOneClient, authorizationService } from "./utils.js";

describe("getClientKeyById", async () => {
  it("should get the client key if it exists", async () => {
    const consumerId: TenantId = generateId();
    const mockKey1 = getMockKey();
    const mockKey2 = getMockKey();
    const mockClient: Client = {
      ...getMockClient(),
      consumerId,
      keys: [mockKey1, mockKey2],
    };
    await addOneClient(mockClient);

    const retrievedKey = await authorizationService.getClientKeyById({
      clientId: mockClient.id,
      kid: mockKey1.kid,
      organizationId: consumerId,
      logger: genericLogger,
    });
    expect(retrievedKey).toEqual(mockKey1);
  });
  it("should throw organizationNotAllowedOnClient if the requester is not the consumer", async () => {
    const organizationId: TenantId = generateId();
    const mockKey = getMockKey();
    const mockClient: Client = {
      ...getMockClient(),
      consumerId: generateId(),
      keys: [mockKey],
    };
    await addOneClient(mockClient);

    expect(
      authorizationService.getClientKeyById({
        clientId: mockClient.id,
        kid: mockKey.kid,
        organizationId,
        logger: genericLogger,
      })
    ).rejects.toThrowError(
      organizationNotAllowedOnClient(organizationId, mockClient.id)
    );
  });
  it("should throw clientNotFound if the client doesn't exist", async () => {
    const consumerId: TenantId = generateId();
    const mockKey = getMockKey();
    const mockClient: Client = {
      ...getMockClient(),
      consumerId,
      keys: [mockKey],
    };

    expect(
      authorizationService.getClientKeyById({
        clientId: mockClient.id,
        kid: mockKey.kid,
        organizationId: consumerId,
        logger: genericLogger,
      })
    ).rejects.toThrowError(clientNotFound(mockClient.id));
  });
  it("should throw clientKeyNotFound if the key doesn't exist", async () => {
    const consumerId: TenantId = generateId();
    const mockKey = getMockKey();
    const mockClient: Client = {
      ...getMockClient(),
      consumerId,
      keys: [getMockKey()],
    };
    await addOneClient(mockClient);

    expect(
      authorizationService.getClientKeyById({
        clientId: mockClient.id,
        kid: mockKey.kid,
        organizationId: consumerId,
        logger: genericLogger,
      })
    ).rejects.toThrowError(clientKeyNotFound(mockKey.kid, mockClient.id));
  });
});
