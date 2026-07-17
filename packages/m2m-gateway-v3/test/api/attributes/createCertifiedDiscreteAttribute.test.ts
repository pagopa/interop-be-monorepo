import { describe, it, expect, vi } from "vitest";
import {
  generateToken,
  getMockedApiAttribute,
  getMockDPoPProof,
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
  unexpectedUndefinedAttributeOriginOrCode,
} from "../../../src/model/errors.js";
import { toM2MGatewayApiCertifiedDiscreteAttribute } from "../../../src/api/attributeApiConverter.js";
import { config } from "../../../src/config/config.js";

describe("POST /certifiedDiscreteAttributes router test", () => {
  const mockCertifiedDiscreteAttributeSeed: m2mGatewayApiV3.CertifiedDiscreteAttributeSeed =
    generateMock(m2mGatewayApiV3.CertifiedDiscreteAttributeSeed);

  const mockApiCertifiedDiscreteAttribute = getMockedApiAttribute({
    kind: attributeRegistryApi.AttributeKind.Values.CERTIFIED_DISCRETE,
    code: mockCertifiedDiscreteAttributeSeed.code,
    name: mockCertifiedDiscreteAttributeSeed.name,
    description: mockCertifiedDiscreteAttributeSeed.description,
  });

  const mockM2MCertifiedDiscreteAttributeResponse: m2mGatewayApiV3.CertifiedDiscreteAttribute =
    toM2MGatewayApiCertifiedDiscreteAttribute({
      attribute: mockApiCertifiedDiscreteAttribute,
      logger: genericLogger,
    });

  const makeRequest = async (
    token: string,
    body: m2mGatewayApiV3.CertifiedDiscreteAttributeSeed
  ) =>
    request(api)
      .post(`${appBasePath}/certifiedDiscreteAttributes`)
      .set("Authorization", `DPoP ${token}`)
      .set("DPoP", (await getMockDPoPProof()).dpopProofJWS)
      .send(body);

  const authorizedRoles: AuthRole[] = [authRole.M2M_ADMIN_ROLE];
  it.each(authorizedRoles)(
    "Should return 201 and perform service calls for user with role %s",
    async (role) => {
      mockAttributeService.createCertifiedDiscreteAttribute = vi
        .fn()
        .mockResolvedValue(mockM2MCertifiedDiscreteAttributeResponse);

      const token = generateToken(role);
      const res = await makeRequest(token, mockCertifiedDiscreteAttributeSeed);

      expect(res.status).toBe(201);
      expect(res.body).toEqual(mockM2MCertifiedDiscreteAttributeResponse);
    }
  );

  it.each(
    Object.values(authRole).filter((role) => !authorizedRoles.includes(role))
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken(role);
    const res = await makeRequest(token, mockCertifiedDiscreteAttributeSeed);
    expect(res.status).toBe(403);
  });

  it.each([
    { ...mockCertifiedDiscreteAttributeSeed, invalidParam: "invalidValue" },
    { ...mockCertifiedDiscreteAttributeSeed, name: undefined },
    { ...mockCertifiedDiscreteAttributeSeed, code: undefined },
    { ...mockCertifiedDiscreteAttributeSeed, description: undefined },
  ])(
    "Should return 400 if passed an invalid certified discrete attribute seed: %s",
    async (body) => {
      const token = generateToken(authRole.M2M_ADMIN_ROLE);
      const res = await makeRequest(
        token,
        body as m2mGatewayApiV3.CertifiedAttributeSeed
      );

      expect(res.status).toBe(400);
    }
  );

  it.each([
    { ...mockM2MCertifiedDiscreteAttributeResponse, kind: "invalidKind" },
    {
      ...mockM2MCertifiedDiscreteAttributeResponse,
      invalidParam: "invalidValue",
    },
    { ...mockM2MCertifiedDiscreteAttributeResponse, createdAt: undefined },
  ])(
    "Should return 500 when API model parsing fails for response",
    async (resp) => {
      mockAttributeService.createCertifiedDiscreteAttribute = vi
        .fn()
        .mockResolvedValueOnce(resp);
      const token = generateToken(authRole.M2M_ADMIN_ROLE);
      const res = await makeRequest(token, mockCertifiedDiscreteAttributeSeed);

      expect(res.status).toBe(500);
    }
  );

  it.each([
    missingMetadata(),
    unexpectedAttributeKind(mockApiCertifiedDiscreteAttribute),
    unexpectedUndefinedAttributeOriginOrCode(mockApiCertifiedDiscreteAttribute),
    pollingMaxRetriesExceeded(
      config.defaultPollingMaxRetries,
      config.defaultPollingRetryDelay
    ),
  ])("Should return 500 in case of $code error", async (error) => {
    mockAttributeService.createCertifiedDiscreteAttribute = vi
      .fn()
      .mockRejectedValue(error);
    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(token, mockCertifiedDiscreteAttributeSeed);

    expect(res.status).toBe(500);
  });
});
