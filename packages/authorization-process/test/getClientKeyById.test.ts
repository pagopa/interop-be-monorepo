/* eslint-disable @typescript-eslint/no-floating-promises */
import { AuthData, genericLogger } from "pagopa-interop-commons";
import {
  Client,
  TenantId,
  generateId,
  unsafeBrandId,
} from "pagopa-interop-models";
import { describe, it, expect } from "vitest";
import {
  getMockAuthData,
  getMockClient,
  getMockKey,
} from "pagopa-interop-commons-test";
import {
  clientNotFound,
  clientKeyNotFound,
  organizationNotAllowedOnClient,
} from "../src/model/domain/errors.js";
import { addOneClient, authorizationService } from "./utils.js";

describe("getClientKeyById", async () => {
  const consumerId: TenantId = generateId();
  const authData: AuthData = {
    ...getMockAuthData(),
    organizationId: unsafeBrandId(consumerId),
    userRoles: ["admin"],
  };

  it("should get the client key if it exists", async () => {
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
      ctx: {
        serviceName: "test",
        authData,
        correlationId: generateId(),
        logger: genericLogger,
      },
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

    const authData: AuthData = {
      ...getMockAuthData(),
      organizationId: unsafeBrandId(organizationId),
    };

    expect(
      authorizationService.getClientKeyById({
        clientId: mockClient.id,
        kid: mockKey.kid,
        ctx: {
          serviceName: "test",
          authData,
          correlationId: generateId(),
          logger: genericLogger,
        },
      })
    ).rejects.toThrowError(
      organizationNotAllowedOnClient(organizationId, mockClient.id)
    );
  });
  it("should throw clientNotFound if the client doesn't exist", async () => {
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
        ctx: {
          serviceName: "test",
          authData,
          correlationId: generateId(),
          logger: genericLogger,
        },
      })
    ).rejects.toThrowError(clientNotFound(mockClient.id));
  });
  it("should throw clientKeyNotFound if the key doesn't exist", async () => {
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
        ctx: {
          serviceName: "test",
          authData,
          correlationId: generateId(),
          logger: genericLogger,
        },
      })
    ).rejects.toThrowError(clientKeyNotFound(mockKey.kid, mockClient.id));
  });
});
