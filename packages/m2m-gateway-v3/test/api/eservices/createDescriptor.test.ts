/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi } from "vitest";
import request from "supertest";
import { generateId, pollingMaxRetriesExceeded } from "pagopa-interop-models";
import { AuthRole, authRole } from "pagopa-interop-commons";
import { m2mGatewayApiV3 } from "pagopa-interop-api-clients";
import {
  generateToken,
  getMockedApiEserviceDescriptor,
  getMockDPoPProof,
} from "pagopa-interop-commons-test";
import { api, mockEserviceService } from "../../vitest.api.setup.js";
import { toM2MGatewayApiEServiceDescriptor } from "../../../src/api/eserviceApiConverter.js";
import { config } from "../../../src/config/config.js";
import {
  eserviceDescriptorNotFound,
  missingMetadata,
} from "../../../src/model/errors.js";
import { appBasePath } from "../../../src/config/appBasePath.js";

describe("POST /eservices/{eServiceId}/descriptors router test", () => {
  const descriptorSeed: m2mGatewayApiV3.EServiceDescriptorSeed = {
    description: "Test Descriptor",
    audience: ["http/test.test"],
    voucherLifespan: 100,
    dailyCallsPerConsumer: 10,
    dailyCallsTotal: 10,
    agreementApprovalPolicy: "AUTOMATIC",
  };

  const mockM2MEserviceDescriptorResponse: m2mGatewayApiV3.EServiceDescriptor =
    toM2MGatewayApiEServiceDescriptor(getMockedApiEserviceDescriptor());

  mockEserviceService.createDescriptor = vi
    .fn()
    .mockResolvedValue(mockM2MEserviceDescriptorResponse);

  const makeRequest = async (
    token: string,
    eserviceId: string = generateId(),
    body: m2mGatewayApiV3.EServiceDescriptorSeed = descriptorSeed
  ) =>
    request(api)
      .post(`${appBasePath}/eservices/${eserviceId}/descriptors`)
      .set("Authorization", `DPoP ${token}`)
      .set("DPoP", (await getMockDPoPProof()).dpopProofJWS)
      .send(body);

  const authorizedRoles: AuthRole[] = [authRole.M2M_ADMIN_ROLE];
  it.each(authorizedRoles)(
    "Should return 201 for user with role %s",
    async (role) => {
      const token = generateToken(role);
      const res = await makeRequest(token);
      expect(res.status).toBe(201);
      expect(res.body).toEqual(mockM2MEserviceDescriptorResponse);
    }
  );

  it.each(
    Object.values(authRole).filter((role) => !authorizedRoles.includes(role))
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken(role);
    const res = await makeRequest(token);

    expect(res.status).toBe(403);
  });

  it.each([
    { ...descriptorSeed, audience: undefined },
    { ...descriptorSeed, voucherLifespan: undefined },
    { ...descriptorSeed, dailyCallsPerConsumer: undefined },
    { ...descriptorSeed, dailyCallsTotal: undefined },
    { ...descriptorSeed, agreementApprovalPolicy: "INVALID_POLICY" },
    {
      ...descriptorSeed,
      docs: [],
    },
    {
      ...descriptorSeed,
      attributes: {},
    },
    {
      ...descriptorSeed,
      attributes: {
        declared: [],
        verified: [],
        certified: [],
      },
    },
    {
      ...descriptorSeed,
      audience: undefined,
    },
    {
      ...descriptorSeed,
      audience: [],
    },
    {
      ...descriptorSeed,
      audience: ["audience1", "audience2"],
      // We currently do not support multiple audiences for consistency with front-end
    },
  ])(
    "Should return 400 if passed an invalid Descriptor seed (seed #%#)",
    async (body) => {
      const token = generateToken(authRole.M2M_ADMIN_ROLE);
      const res = await makeRequest(
        token,
        generateId(),
        body as m2mGatewayApiV3.EServiceDescriptorSeed
      );

      expect(res.status).toBe(400);
    }
  );

  it.each([
    eserviceDescriptorNotFound(generateId(), generateId()),
    missingMetadata(),
    pollingMaxRetriesExceeded(
      config.defaultPollingMaxRetries,
      config.defaultPollingRetryDelay
    ),
  ])("Should return 500 in case of $code error", async (error) => {
    mockEserviceService.createDescriptor = vi.fn().mockRejectedValue(error);
    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(token, generateId());

    expect(res.status).toBe(500);
  });

  it.each([
    { ...mockM2MEserviceDescriptorResponse, id: undefined },
    { ...mockM2MEserviceDescriptorResponse, invalidParam: "invalidValue" },
    { ...mockM2MEserviceDescriptorResponse, state: undefined },
  ])(
    "Should return 500 when API model parsing fails for response",
    async (resp) => {
      mockEserviceService.getEServiceDescriptor = vi
        .fn()
        .mockResolvedValueOnce(resp);
      const token = generateToken(authRole.M2M_ADMIN_ROLE);
      const res = await makeRequest(token);

      expect(res.status).toBe(500);
    }
  );
});
