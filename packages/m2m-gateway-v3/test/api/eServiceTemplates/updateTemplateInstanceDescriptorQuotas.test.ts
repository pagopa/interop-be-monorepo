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

describe("POST /eserviceTemplates/eservices/{eserviceId}/descriptors/{descriptorId}/quotas router test", () => {
  const seed: m2mGatewayApiV3.UpdateEServiceTemplateInstanceDescriptorQuotasSeed =
    {
      dailyCallsPerConsumer: 1000,
      dailyCallsTotal: 10000,
    };

  const mockResponse: m2mGatewayApiV3.EServiceDescriptor =
    toM2MGatewayApiEServiceDescriptor(getMockedApiEserviceDescriptor());

  mockEserviceService.updateTemplateInstanceDescriptorQuotas = vi
    .fn()
    .mockResolvedValue(mockResponse);

  const makeRequest = async (
    token: string,
    eserviceId: string = generateId(),
    descriptorId: string = generateId(),
    body: m2mGatewayApiV3.UpdateEServiceTemplateInstanceDescriptorQuotasSeed = seed
  ) =>
    request(api)
      .post(
        `${appBasePath}/eserviceTemplates/eservices/${eserviceId}/descriptors/${descriptorId}/quotas`
      )
      .set("Authorization", `DPoP ${token}`)
      .set("DPoP", (await getMockDPoPProof()).dpopProofJWS)
      .send(body);

  const authorizedRoles: AuthRole[] = [authRole.M2M_ADMIN_ROLE];
  it.each(authorizedRoles)(
    "Should return 200 for user with role %s",
    async (role) => {
      const token = generateToken(role);
      const res = await makeRequest(token);
      expect(res.status).toBe(200);
      expect(res.body).toEqual(mockResponse);
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
    { ...seed, dailyCallsPerConsumer: undefined },
    { ...seed, dailyCallsTotal: undefined },
    { ...seed, dailyCallsPerConsumer: 0 },
    { ...seed, extraField: "invalid" },
  ])("Should return 400 if passed an invalid seed (#%#)", async (body) => {
    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(
      token,
      generateId(),
      generateId(),
      body as m2mGatewayApiV3.UpdateEServiceTemplateInstanceDescriptorQuotasSeed
    );
    expect(res.status).toBe(400);
  });

  it.each([
    eserviceDescriptorNotFound(generateId(), generateId()),
    missingMetadata(),
    pollingMaxRetriesExceeded(
      config.defaultPollingMaxRetries,
      config.defaultPollingRetryDelay
    ),
  ])("Should return 500 in case of $code error", async (error) => {
    mockEserviceService.updateTemplateInstanceDescriptorQuotas = vi
      .fn()
      .mockRejectedValue(error);
    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(500);
  });
});
