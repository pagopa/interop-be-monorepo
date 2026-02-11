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
import { toM2MGatewayEServiceTemplateVersion } from "../../../src/api/eserviceTemplateApiConverter.js";
import {
  eserviceTemplateVersionNotFound,
  missingMetadata,
} from "../../../src/model/errors.js";
import { appBasePath } from "../../../src/config/appBasePath.js";
import { config } from "../../../src/config/config.js";

describe("PATCH /eserviceTemplates/:templateId/versions/:versionId/ router test", () => {
  const versionSeed: m2mGatewayApiV3.EServiceTemplateVersionDraftUpdateSeed = {
    description: "Test Version Description",
    voucherLifespan: 100,
    dailyCallsPerConsumer: 10,
    dailyCallsTotal: 10,
    agreementApprovalPolicy: "AUTOMATIC",
  };

  const mockM2MTemplateVersionResponse: m2mGatewayApiV3.EServiceTemplateVersion =
    toM2MGatewayEServiceTemplateVersion(getMockedApiEserviceTemplateVersion());

  mockEServiceTemplateService.updateDraftEServiceTemplateVersion = vi
    .fn()
    .mockResolvedValue(mockM2MTemplateVersionResponse);

  const makeRequest = async (
    token: string,
    templateId: string = generateId(),
    versionId: string = generateId(),
    body: m2mGatewayApiV3.EServiceTemplateVersionDraftUpdateSeed = versionSeed
  ) =>
    request(api)
      .patch(
        `${appBasePath}/eserviceTemplates/${templateId}/versions/${versionId}`
      )
      .set("Authorization", `Bearer ${token}`)
      .send(body);

  const authorizedRoles: AuthRole[] = [authRole.M2M_ADMIN_ROLE];
  it.each(authorizedRoles)(
    "Should return 200 for user with role %s",
    async (role) => {
      const token = generateToken(role);
      const res = await makeRequest(token);
      expect(res.status).toBe(200);
      expect(res.body).toEqual(mockM2MTemplateVersionResponse);
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
      voucherLifespan: 300,
    },
    {
      description: "Yet Another Updated Description",
      voucherLifespan: 300,
      dailyCallsPerConsumer: 30,
      dailyCallsTotal: 30,
    },
    {
      description: "Yet Another Updated Description",
      voucherLifespan: 300,
      dailyCallsPerConsumer: 30,
      dailyCallsTotal: 30,
      agreementApprovalPolicy: "AUTOMATIC",
    },
    {
      dailyCallsPerConsumer: null,
    },
    {
      dailyCallsTotal: null,
    },
    {
      agreementApprovalPolicy: null,
    },
  ] as m2mGatewayApiV3.EServiceTemplateVersionDraftUpdateSeed[])(
    "Should return 200 with partial seed and nullable fields (seed #%#)",
    async (seed) => {
      const token = generateToken(authRole.M2M_ADMIN_ROLE);
      const res = await makeRequest(token, generateId(), generateId(), seed);
      expect(res.status).toBe(200);
    }
  );

  it.each([
    { ...versionSeed, agreementApprovalPolicy: "INVALID_POLICY" },
    {
      ...versionSeed,
      voucherLifespan: -1,
    },
    {
      ...versionSeed,
      dailyCallsPerConsumer: -1,
    },
    {
      ...versionSeed,
      dailyCallsTotal: -1,
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
        generateId(),
        body as typeof versionSeed
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
    mockEServiceTemplateService.updateDraftEServiceTemplateVersion = vi
      .fn()
      .mockRejectedValueOnce(error);
    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(token, generateId());

    expect(res.status).toBe(500);
  });

  it.each([
    { ...mockM2MTemplateVersionResponse, id: undefined },
    { ...mockM2MTemplateVersionResponse, invalidParam: "invalidValue" },
    { ...mockM2MTemplateVersionResponse, state: undefined },
  ])(
    "Should return 500 when API model parsing fails for response",
    async (resp) => {
      mockEServiceTemplateService.updateDraftEServiceTemplateVersion = vi
        .fn()
        .mockResolvedValueOnce(resp);
      const token = generateToken(authRole.M2M_ADMIN_ROLE);
      const res = await makeRequest(token);

      expect(res.status).toBe(500);
    }
  );
});
