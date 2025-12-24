/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi } from "vitest";
import request from "supertest";
import { generateId, pollingMaxRetriesExceeded } from "pagopa-interop-models";
import { AuthRole, authRole } from "pagopa-interop-commons";
import { m2mGatewayApiV3 } from "pagopa-interop-api-clients";
import {
  generateToken,
  getMockedApiEserviceTemplateVersion,
} from "pagopa-interop-commons-test";
import { api, mockEServiceTemplateService } from "../../vitest.api.setup.js";
import { config } from "../../../src/config/config.js";
import {
  eserviceTemplateVersionNotFound,
  missingMetadata,
} from "../../../src/model/errors.js";
import { appBasePath } from "../../../src/config/appBasePath.js";
import { toM2MGatewayEServiceTemplateVersion } from "../../../src/api/eserviceTemplateApiConverter.js";

describe("POST /eserviceTemplates/:templateId/versions router test", () => {
  const versionSeed: m2mGatewayApiV3.EServiceTemplateVersionSeed = {
    description: "Test Version",
    voucherLifespan: 100,
    dailyCallsPerConsumer: 10,
    dailyCallsTotal: 10,
    agreementApprovalPolicy: "AUTOMATIC",
  };

  const mockM2MEserviceTemplateVersionResponse: m2mGatewayApiV3.EServiceTemplateVersion =
    toM2MGatewayEServiceTemplateVersion(getMockedApiEserviceTemplateVersion());

  mockEServiceTemplateService.createEServiceTemplateVersion = vi
    .fn()
    .mockResolvedValue(mockM2MEserviceTemplateVersionResponse);

  const makeRequest = async (
    token: string,
    templateId: string = generateId(),
    body: m2mGatewayApiV3.EServiceTemplateVersionSeed = versionSeed
  ) =>
    request(api)
      .post(`${appBasePath}/eserviceTemplates/${templateId}/versions`)
      .set("Authorization", `Bearer ${token}`)
      .send(body);

  const authorizedRoles: AuthRole[] = [authRole.M2M_ADMIN_ROLE];
  it.each(authorizedRoles)(
    "Should return 201 for user with role %s",
    async (role) => {
      const token = generateToken(role);
      const res = await makeRequest(token);
      expect(res.status).toBe(201);
      expect(res.body).toEqual(mockM2MEserviceTemplateVersionResponse);
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
    { ...versionSeed, voucherLifespan: undefined },
    { ...versionSeed, agreementApprovalPolicy: "INVALID_POLICY" },
    {
      ...versionSeed,
      docs: [],
    },
    {
      ...versionSeed,
      attributes: {},
    },
    {
      ...versionSeed,
      attributes: {
        declared: [],
        verified: [],
        certified: [],
      },
    },
  ])(
    "Should return 400 if passed an invalid Version seed (seed #%#)",
    async (body) => {
      const token = generateToken(authRole.M2M_ADMIN_ROLE);
      const res = await makeRequest(
        token,
        generateId(),
        body as m2mGatewayApiV3.EServiceTemplateVersionSeed
      );

      expect(res.status).toBe(400);
    }
  );

  it.each([
    eserviceTemplateVersionNotFound(generateId(), generateId()),
    missingMetadata(),
    pollingMaxRetriesExceeded(
      config.defaultPollingMaxRetries,
      config.defaultPollingRetryDelay
    ),
  ])("Should return 500 in case of $code error", async (error) => {
    mockEServiceTemplateService.createEServiceTemplateVersion = vi
      .fn()
      .mockRejectedValue(error);
    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(token, generateId());

    expect(res.status).toBe(500);
  });
});
