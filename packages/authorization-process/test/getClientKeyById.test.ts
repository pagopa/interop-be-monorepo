/* eslint-disable @typescript-eslint/no-floating-promises */
import { AuthData } from "pagopa-interop-commons";
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
  getMockContext,
  getMockKey,
} from "pagopa-interop-commons-test";
import {
  clientNotFound,
  clientKeyNotFound,
  organizationNotAllowedOnClient,
  securityUserNotMember,
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
      ctx: getMockContext({ authData }),
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
        ctx: getMockContext({ authData }),
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
        ctx: getMockContext({ authData }),
      })
    ).rejects.toThrowError(clientNotFound(mockClient.id));
  });
  it("should throw securityUserNotMember if the requester has SECURITY_ROLE and the user is not a member of the organization", async () => {
    const mockKey = getMockKey();
    const mockClient: Client = {
      ...getMockClient(),
      consumerId,
      keys: [getMockKey()],
    };
    await addOneClient(mockClient);

    const authData: AuthData = {
      ...getMockAuthData(),
      userRoles: ["security"],
    };

    expect(
      authorizationService.getClientKeyById({
        clientId: mockClient.id,
        kid: mockKey.kid,
        ctx: getMockContext({ authData }),
      })
    ).rejects.toThrowError(securityUserNotMember(authData.userId));
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
        ctx: getMockContext({ authData }),
      })
    ).rejects.toThrowError(clientKeyNotFound(mockKey.kid, mockClient.id));
  });
});
