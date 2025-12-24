import { describe, it, expect, vi } from "vitest";
import {
  generateToken,
  getMockedApiAttribute,
} from "pagopa-interop-commons-test";
import { AuthRole, authRole, genericLogger } from "pagopa-interop-commons";
import request from "supertest";
import {
  attributeRegistryApi,
  m2mGatewayApiV3,
} from "pagopa-interop-api-clients";
import { generateMock } from "@anatine/zod-mock";
import { pollingMaxRetriesExceeded } from "pagopa-interop-models";
import { api, mockAttributeService } from "../../vitest.api.setup.js";
import { appBasePath } from "../../../src/config/appBasePath.js";
import {
  missingMetadata,
  unexpectedAttributeKind,
} from "../../../src/model/errors.js";
import { toM2MGatewayApiVerifiedAttribute } from "../../../src/api/attributeApiConverter.js";
import { config } from "../../../src/config/config.js";

describe("POST /verifiedAttributes router test", () => {
  const mockVerifiedAttributeSeed: m2mGatewayApiV3.VerifiedAttributeSeed =
    generateMock(m2mGatewayApiV3.VerifiedAttributeSeed);

  const mockApiVerifiedAttribute = getMockedApiAttribute({
    kind: attributeRegistryApi.AttributeKind.Values.VERIFIED,
    name: mockVerifiedAttributeSeed.name,
    description: mockVerifiedAttributeSeed.description,
  });

  const mockM2MVerifiedAttributeResponse: m2mGatewayApiV3.VerifiedAttribute =
    toM2MGatewayApiVerifiedAttribute({
      attribute: mockApiVerifiedAttribute,
      logger: genericLogger,
    });

  const makeRequest = async (
    token: string,
    body: m2mGatewayApiV3.VerifiedAttributeSeed
  ) =>
    request(api)
      .post(`${appBasePath}/verifiedAttributes`)
      .set("Authorization", `Bearer ${token}`)
      .send(body);

  const authorizedRoles: AuthRole[] = [authRole.M2M_ADMIN_ROLE];
  it.each(authorizedRoles)(
    "Should return 201 and perform service calls for user with role %s",
    async (role) => {
      mockAttributeService.createVerifiedAttribute = vi
        .fn()
        .mockResolvedValue(mockM2MVerifiedAttributeResponse);

      const token = generateToken(role);
      const res = await makeRequest(token, mockVerifiedAttributeSeed);

      expect(res.status).toBe(201);
      expect(res.body).toEqual(mockM2MVerifiedAttributeResponse);
    }
  );

  it.each(
    Object.values(authRole).filter((role) => !authorizedRoles.includes(role))
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken(role);
    const res = await makeRequest(token, mockVerifiedAttributeSeed);
    expect(res.status).toBe(403);
  });

  it.each([
    { ...mockVerifiedAttributeSeed, invalidParam: "invalidValue" },
    { ...mockVerifiedAttributeSeed, name: undefined },
    { ...mockVerifiedAttributeSeed, description: undefined },
  ])(
    "Should return 400 if passed an invalid Verified attribute seed: %s",
    async (body) => {
      const token = generateToken(authRole.M2M_ADMIN_ROLE);
      const res = await makeRequest(
        token,
        body as m2mGatewayApiV3.VerifiedAttributeSeed
      );

      expect(res.status).toBe(400);
    }
  );

  it.each([
    { ...mockM2MVerifiedAttributeResponse, kind: "invalidKind" },
    { ...mockM2MVerifiedAttributeResponse, invalidParam: "invalidValue" },
    { ...mockM2MVerifiedAttributeResponse, createdAt: undefined },
  ])(
    "Should return 500 when API model parsing fails for response",
    async (resp) => {
      mockAttributeService.createVerifiedAttribute = vi
        .fn()
        .mockResolvedValueOnce(resp);
      const token = generateToken(authRole.M2M_ADMIN_ROLE);
      const res = await makeRequest(token, mockVerifiedAttributeSeed);

      expect(res.status).toBe(500);
    }
  );

  it.each([
    missingMetadata(),
    unexpectedAttributeKind(mockApiVerifiedAttribute),
    pollingMaxRetriesExceeded(
      config.defaultPollingMaxRetries,
      config.defaultPollingRetryDelay
    ),
  ])("Should return 500 in case of $code error", async (error) => {
    mockAttributeService.createVerifiedAttribute = vi
      .fn()
      .mockRejectedValue(error);
    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(token, mockVerifiedAttributeSeed);

    expect(res.status).toBe(500);
  });
});
