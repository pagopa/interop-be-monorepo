import { describe, it, expect, vi } from "vitest";
import {
  generateToken,
  getMockedApiAttribute,
} from "pagopa-interop-commons-test";
import { AuthRole, authRole, genericLogger } from "pagopa-interop-commons";
import request from "supertest";
import {
  attributeRegistryApi,
  m2mGatewayApi,
} from "pagopa-interop-api-clients";
import { generateMock } from "@anatine/zod-mock";
import { pollingMaxRetriesExceeded } from "pagopa-interop-models";
import { api, mockAttributeService } from "../../vitest.api.setup.js";
import { appBasePath } from "../../../src/config/appBasePath.js";
import {
  missingMetadata,
  unexpectedAttributeKind,
} from "../../../src/model/errors.js";
import { toM2MGatewayApiDeclaredAttribute } from "../../../src/api/attributeApiConverter.js";
import { config } from "../../../src/config/config.js";

describe("POST /declaredAttributes router test", () => {
  const mockDeclaredAttributeSeed: m2mGatewayApi.DeclaredAttributeSeed =
    generateMock(m2mGatewayApi.DeclaredAttributeSeed);

  const mockApiDeclaredAttribute = getMockedApiAttribute({
    kind: attributeRegistryApi.AttributeKind.Values.DECLARED,
    name: mockDeclaredAttributeSeed.name,
    description: mockDeclaredAttributeSeed.description,
  });

  const mockM2MDeclaredAttributeResponse: m2mGatewayApi.DeclaredAttribute =
    toM2MGatewayApiDeclaredAttribute({
      attribute: mockApiDeclaredAttribute,
      logger: genericLogger,
    });

  const makeRequest = async (
    token: string,
    body: m2mGatewayApi.DeclaredAttributeSeed
  ) =>
    request(api)
      .post(`${appBasePath}/declaredAttributes`)
      .set("Authorization", `Bearer ${token}`)
      .send(body);

  const authorizedRoles: AuthRole[] = [authRole.M2M_ADMIN_ROLE];
  it.each(authorizedRoles)(
    "Should return 201 and perform service calls for user with role %s",
    async (role) => {
      mockAttributeService.createDeclaredAttribute = vi
        .fn()
        .mockResolvedValue(mockM2MDeclaredAttributeResponse);

      const token = generateToken(role);
      const res = await makeRequest(token, mockDeclaredAttributeSeed);

      expect(res.status).toBe(201);
      expect(res.body).toEqual(mockM2MDeclaredAttributeResponse);
    }
  );

  it.each(
    Object.values(authRole).filter((role) => !authorizedRoles.includes(role))
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken(role);
    const res = await makeRequest(token, mockDeclaredAttributeSeed);
    expect(res.status).toBe(403);
  });

  it.each([
    { ...mockDeclaredAttributeSeed, invalidParam: "invalidValue" },
    { ...mockDeclaredAttributeSeed, name: undefined },
    { ...mockDeclaredAttributeSeed, description: undefined },
  ])(
    "Should return 400 if passed an invalid declared attribute seed: %s",
    async (body) => {
      const token = generateToken(authRole.M2M_ADMIN_ROLE);
      const res = await makeRequest(
        token,
        body as m2mGatewayApi.DeclaredAttributeSeed
      );

      expect(res.status).toBe(400);
    }
  );

  it.each([
    { ...mockM2MDeclaredAttributeResponse, kind: "invalidKind" },
    { ...mockM2MDeclaredAttributeResponse, invalidParam: "invalidValue" },
    { ...mockM2MDeclaredAttributeResponse, createdAt: undefined },
  ])(
    "Should return 500 when API model parsing fails for response",
    async (resp) => {
      mockAttributeService.createDeclaredAttribute = vi
        .fn()
        .mockResolvedValueOnce(resp);
      const token = generateToken(authRole.M2M_ADMIN_ROLE);
      const res = await makeRequest(token, mockDeclaredAttributeSeed);

      expect(res.status).toBe(500);
    }
  );

  it.each([
    missingMetadata(),
    unexpectedAttributeKind(mockApiDeclaredAttribute),
    pollingMaxRetriesExceeded(
      config.defaultPollingMaxRetries,
      config.defaultPollingRetryDelay
    ),
  ])("Should return 500 in case of $code error", async (error) => {
    mockAttributeService.createDeclaredAttribute = vi
      .fn()
      .mockRejectedValue(error);
    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(token, mockDeclaredAttributeSeed);

    expect(res.status).toBe(500);
  });
});
