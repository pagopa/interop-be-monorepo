/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi } from "vitest";
import request from "supertest";
import { generateId, pollingMaxRetriesExceeded } from "pagopa-interop-models";
import { AuthRole, authRole } from "pagopa-interop-commons";
import { m2mGatewayApiV3 } from "pagopa-interop-api-clients";
import {
  generateToken,
  getMockedApiEservice,
  getMockDPoPProof,
} from "pagopa-interop-commons-test";
import { api, mockEserviceService } from "../../vitest.api.setup.js";
import { toM2MGatewayApiEService } from "../../../src/api/eserviceApiConverter.js";
import { config } from "../../../src/config/config.js";
import { missingMetadata } from "../../../src/model/errors.js";
import { appBasePath } from "../../../src/config/appBasePath.js";

describe("POST /eserviceTemplates/{templateId}/eservices router test", () => {
  const seed: m2mGatewayApiV3.InstanceEServiceSeed = {
    isSignalHubEnabled: true,
    isConsumerDelegable: false,
    isClientAccessDelegable: false,
    instanceLabel: "label",
  };

  const mockResponse: m2mGatewayApiV3.EService = toM2MGatewayApiEService(
    getMockedApiEservice()
  );

  mockEserviceService.createEServiceInstanceFromTemplate = vi
    .fn()
    .mockResolvedValue(mockResponse);

  const makeRequest = async (
    token: string,
    templateId: string = generateId(),
    body: m2mGatewayApiV3.InstanceEServiceSeed = seed
  ) =>
    request(api)
      .post(`${appBasePath}/eserviceTemplates/${templateId}/eservices`)
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
    { ...seed, instanceLabel: "" },
    { ...seed, instanceLabel: "a".repeat(13) },
    { ...seed, extraField: "invalid" },
  ])("Should return 400 if passed an invalid seed (#%#)", async (body) => {
    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(
      token,
      generateId(),
      body as m2mGatewayApiV3.InstanceEServiceSeed
    );
    expect(res.status).toBe(400);
  });

  it.each([
    missingMetadata(),
    pollingMaxRetriesExceeded(
      config.defaultPollingMaxRetries,
      config.defaultPollingRetryDelay
    ),
  ])("Should return 500 in case of $code error", async (error) => {
    mockEserviceService.createEServiceInstanceFromTemplate = vi
      .fn()
      .mockRejectedValue(error);
    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(500);
  });
});
