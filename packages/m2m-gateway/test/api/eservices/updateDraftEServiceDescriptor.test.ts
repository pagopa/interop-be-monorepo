/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi } from "vitest";
import request from "supertest";
import { generateId, pollingMaxRetriesExceeded } from "pagopa-interop-models";
import { AuthRole, authRole } from "pagopa-interop-commons";
import { m2mGatewayApi } from "pagopa-interop-api-clients";
import {
  generateToken,
  getMockedApiEserviceDescriptor,
} from "pagopa-interop-commons-test";
import { api, mockEserviceService } from "../../vitest.api.setup.js";
import { toM2MGatewayApiEServiceDescriptor } from "../../../src/api/eserviceApiConverter.js";
import {
  eserviceDescriptorNotFound,
  missingMetadata,
} from "../../../src/model/errors.js";
import { appBasePath } from "../../../src/config/appBasePath.js";
import { config } from "../../../src/config/config.js";

describe("PATCH /eservices/{eServiceId}/descriptors/{descriptorId} router test", () => {
  const descriptorSeed: m2mGatewayApi.EServiceDescriptorDraftUpdateSeed = {
    description: "Test Descriptor",
    audience: ["http/test.test"],
    voucherLifespan: 100,
    dailyCallsPerConsumer: 10,
    dailyCallsTotal: 10,
    agreementApprovalPolicy: "AUTOMATIC",
  };

  const mockM2MEserviceDescriptorResponse: m2mGatewayApi.EServiceDescriptor =
    toM2MGatewayApiEServiceDescriptor(getMockedApiEserviceDescriptor());

  mockEserviceService.updateDraftEServiceDescriptor = vi
    .fn()
    .mockResolvedValue(mockM2MEserviceDescriptorResponse);

  const makeRequest = async (
    token: string,
    eserviceId: string = generateId(),
    descriptorId: string = generateId(),
    body: m2mGatewayApi.EServiceDescriptorDraftUpdateSeed = descriptorSeed
  ) =>
    request(api)
      .patch(
        `${appBasePath}/eservices/${eserviceId}/descriptors/${descriptorId}`
      )
      .set("Authorization", `Bearer ${token}`)
      .set("Content-Type", "application/merge-patch+json")
      .send(body);

  const authorizedRoles: AuthRole[] = [authRole.M2M_ADMIN_ROLE];
  it.each(authorizedRoles)(
    "Should return 200 for user with role %s",
    async (role) => {
      const token = generateToken(role);
      const res = await makeRequest(token);
      expect(res.status).toBe(200);
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
    {},
    {
      description: "Updated Description",
    },
    {
      description: "Another Updated Description",
      audience: ["http/test.test"],
    },
    {
      description: "Yet Another Updated Description",
      audience: ["http/test.test"],
      voucherLifespan: 300,
      dailyCallsPerConsumer: 30,
      dailyCallsTotal: 30,
    },
  ] as m2mGatewayApi.EServiceDescriptorDraftUpdateSeed[])(
    "Should return 200 with partial seed (seed #%#)",
    async (seed) => {
      const token = generateToken(authRole.M2M_ADMIN_ROLE);
      const res = await makeRequest(token, generateId(), generateId(), seed);
      expect(res.status).toBe(200);
    }
  );

  it.each([
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
        generateId(),
        body as m2mGatewayApi.EServiceDescriptorDraftUpdateSeed
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
    mockEserviceService.updateDraftEServiceDescriptor = vi
      .fn()
      .mockRejectedValueOnce(error);
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
      mockEserviceService.updateDraftEServiceDescriptor = vi
        .fn()
        .mockResolvedValueOnce(resp);
      const token = generateToken(authRole.M2M_ADMIN_ROLE);
      const res = await makeRequest(token);

      expect(res.status).toBe(500);
    }
  );
});
