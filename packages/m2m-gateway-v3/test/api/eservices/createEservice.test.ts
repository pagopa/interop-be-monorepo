import { m2mGatewayApiV3 } from "pagopa-interop-api-clients";
import {
  generateToken,
  getMockedApiEservice,
  getMockDPoPProof,
} from "pagopa-interop-commons-test";
import request from "supertest";
import { authRole, AuthRole } from "pagopa-interop-commons";
import { describe, expect, it, vi } from "vitest";
import { pollingMaxRetriesExceeded } from "pagopa-interop-models";
import { toM2MGatewayApiEService } from "../../../src/api/eserviceApiConverter.js";
import { appBasePath } from "../../../src/config/appBasePath.js";
import { api, mockEserviceService } from "../../vitest.api.setup.js";
import { missingMetadata } from "../../../src/model/errors.js";
import { config } from "../../../src/config/config.js";

describe("POST /eservices router test", () => {
  const mockApiEservice = getMockedApiEservice();

  const mockApiEserviceWithDescriptor: m2mGatewayApiV3.DescriptorSeedForEServiceCreation =
    {
      audience: ["audience"],
      voucherLifespan: 1000,
      dailyCallsPerConsumer: 100,
      dailyCallsTotal: 100,
      agreementApprovalPolicy: "AUTOMATIC",
    };

  const mockEserviceSeed: m2mGatewayApiV3.EServiceSeed = {
    name: mockApiEservice.name,
    description: mockApiEservice.description,
    technology: mockApiEservice.technology,
    descriptor: mockApiEserviceWithDescriptor,
    mode: mockApiEservice.mode,
  };

  const mockM2MEserviceResponse: m2mGatewayApiV3.EService =
    toM2MGatewayApiEService(mockApiEservice);

  const makeRequest = async (
    token: string,
    body: m2mGatewayApiV3.EServiceSeed
  ) =>
    request(api)
      .post(`${appBasePath}/eservices`)
      .set("Authorization", `DPoP ${token}`)
      .set("DPoP", (await getMockDPoPProof()).dpopProofJWS)
      .send(body);

  const authorizedRoles: AuthRole[] = [authRole.M2M_ADMIN_ROLE];
  it.each(authorizedRoles)(
    "Should return 201 and perform service calls for user with role %s",
    async (role) => {
      mockEserviceService.createEService = vi
        .fn()
        .mockResolvedValue(mockM2MEserviceResponse);

      const token = generateToken(role);
      const res = await makeRequest(token, mockEserviceSeed);

      expect(res.status).toBe(201);
      expect(res.body).toEqual(mockM2MEserviceResponse);
    }
  );

  it.each(
    Object.values(authRole).filter((role) => !authorizedRoles.includes(role))
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken(role);
    const res = await makeRequest(token, mockEserviceSeed);
    expect(res.status).toBe(403);
  });

  it.each([
    { ...mockEserviceSeed, invalidParam: "invalidValue" },
    { ...mockEserviceSeed, name: undefined },
    { ...mockEserviceSeed, description: undefined },
    { ...mockEserviceSeed, technology: "invalid technology" },
    { ...mockEserviceSeed, mode: "invalid mode" },
    { ...mockEserviceSeed, descriptor: undefined },
    {
      ...mockEserviceSeed,
      descriptor: { ...mockApiEserviceWithDescriptor, audience: undefined },
    },
    {
      ...mockEserviceSeed,
      descriptor: {
        ...mockApiEserviceWithDescriptor,
        voucherLifespan: undefined,
      },
    },
    {
      ...mockEserviceSeed,
      descriptor: {
        ...mockApiEserviceWithDescriptor,
        dailyCallsPerConsumer: undefined,
      },
    },
    {
      ...mockEserviceSeed,
      descriptor: {
        ...mockApiEserviceWithDescriptor,
        dailyCallsTotal: undefined,
      },
    },
    {
      ...mockEserviceSeed,
      descriptor: {
        ...mockApiEserviceWithDescriptor,
        agreementApprovalPolicy: "invalid agreementApprovalPolicy",
      },
    },
    {
      ...mockEserviceSeed,
      descriptor: {
        audience: undefined,
      },
    },
    {
      ...mockEserviceSeed,
      descriptor: {
        audience: [],
      },
    },
    {
      ...mockEserviceSeed,
      descriptor: {
        audience: ["audience1", "audience2"],
        // We currently do not support multiple audiences for consistency with front-end
      },
    },
    { ...mockEserviceSeed, personalData: "invalidValue" },
  ])(
    "Should return 400 if passed an invalid Eservice seed (seed #%#)",
    async (body) => {
      const token = generateToken(authRole.M2M_ADMIN_ROLE);
      const res = await makeRequest(
        token,
        body as m2mGatewayApiV3.EServiceSeed
      );

      expect(res.status).toBe(400);
    }
  );

  it.each([
    missingMetadata(),
    pollingMaxRetriesExceeded(
      config.defaultPollingMaxRetries,
      config.defaultPollingRetryDelay
    ),
  ])("Should return 500 in case of $code error", async (error) => {
    mockEserviceService.createEService = vi.fn().mockRejectedValue(error);
    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(token, mockEserviceSeed);

    expect(res.status).toBe(500);
  });
});
