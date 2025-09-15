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
  unexpectedUndefinedAttributeOriginOrCode,
} from "../../../src/model/errors.js";
import { toM2MGatewayApiCertifiedAttribute } from "../../../src/api/attributeApiConverter.js";
import { config } from "../../../src/config/config.js";

describe("POST /certifiedAttributes router test", () => {
  const mockCertifiedAttributeSeed: m2mGatewayApi.CertifiedAttributeSeed =
    generateMock(m2mGatewayApi.CertifiedAttributeSeed);

  const mockApiCertifiedAttribute = getMockedApiAttribute({
    kind: attributeRegistryApi.AttributeKind.Values.CERTIFIED,
    code: mockCertifiedAttributeSeed.code,
    name: mockCertifiedAttributeSeed.name,
    description: mockCertifiedAttributeSeed.description,
  });

  const mockM2MCertifiedAttributeResponse: m2mGatewayApi.CertifiedAttribute =
    toM2MGatewayApiCertifiedAttribute({
      attribute: mockApiCertifiedAttribute,
      logger: genericLogger,
    });

  const makeRequest = async (
    token: string,
    body: m2mGatewayApi.CertifiedAttributeSeed
  ) =>
    request(api)
      .post(`${appBasePath}/certifiedAttributes`)
      .set("Authorization", `Bearer ${token}`)
      .send(body);

  const authorizedRoles: AuthRole[] = [authRole.M2M_ADMIN_ROLE];
  it.each(authorizedRoles)(
    "Should return 201 and perform service calls for user with role %s",
    async (role) => {
      mockAttributeService.createCertifiedAttribute = vi
        .fn()
        .mockResolvedValue(mockM2MCertifiedAttributeResponse);

      const token = generateToken(role);
      const res = await makeRequest(token, mockCertifiedAttributeSeed);

      expect(res.status).toBe(201);
      expect(res.body).toEqual(mockM2MCertifiedAttributeResponse);
    }
  );

  it.each(
    Object.values(authRole).filter((role) => !authorizedRoles.includes(role))
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken(role);
    const res = await makeRequest(token, mockCertifiedAttributeSeed);
    expect(res.status).toBe(403);
  });

  it.each([
    { ...mockCertifiedAttributeSeed, invalidParam: "invalidValue" },
    { ...mockCertifiedAttributeSeed, name: undefined },
    { ...mockCertifiedAttributeSeed, code: undefined },
    { ...mockCertifiedAttributeSeed, description: undefined },
  ])(
    "Should return 400 if passed an invalid certified attribute seed: %s",
    async (body) => {
      const token = generateToken(authRole.M2M_ADMIN_ROLE);
      const res = await makeRequest(
        token,
        body as m2mGatewayApi.CertifiedAttributeSeed
      );

      expect(res.status).toBe(400);
    }
  );

  it.each([
    { ...mockM2MCertifiedAttributeResponse, kind: "invalidKind" },
    { ...mockM2MCertifiedAttributeResponse, invalidParam: "invalidValue" },
    { ...mockM2MCertifiedAttributeResponse, createdAt: undefined },
  ])(
    "Should return 500 when API model parsing fails for response",
    async (resp) => {
      mockAttributeService.createCertifiedAttribute = vi
        .fn()
        .mockResolvedValueOnce(resp);
      const token = generateToken(authRole.M2M_ADMIN_ROLE);
      const res = await makeRequest(token, mockCertifiedAttributeSeed);

      expect(res.status).toBe(500);
    }
  );

  it.each([
    missingMetadata(),
    unexpectedAttributeKind(mockApiCertifiedAttribute),
    unexpectedUndefinedAttributeOriginOrCode(mockApiCertifiedAttribute),
    pollingMaxRetriesExceeded(
      config.defaultPollingMaxRetries,
      config.defaultPollingRetryDelay
    ),
  ])("Should return 500 in case of $code error", async (error) => {
    mockAttributeService.createCertifiedAttribute = vi
      .fn()
      .mockRejectedValue(error);
    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(token, mockCertifiedAttributeSeed);

    expect(res.status).toBe(500);
  });
});
