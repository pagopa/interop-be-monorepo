/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi } from "vitest";
import request from "supertest";
import { generateId, pollingMaxRetriesExceeded } from "pagopa-interop-models";
import { AuthRole, authRole } from "pagopa-interop-commons";
import { m2mGatewayApi } from "pagopa-interop-api-clients";
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

describe("PATCH /templates/{templateId}/versions/{versionId} router test", () => {
  const templateVersionSeed: m2mGatewayApi.EServiceTemplateVersionDraftUpdateSeed =
    {
      description: "Test Template Version",
      voucherLifespan: 100,
      dailyCallsPerConsumer: 10,
      dailyCallsTotal: 10,
      agreementApprovalPolicy: "AUTOMATIC",
    };

  const mockM2MTemplateVersionResponse: m2mGatewayApi.EServiceTemplateVersion =
    toM2MGatewayEServiceTemplateVersion(getMockedApiEserviceTemplateVersion());

  mockEServiceTemplateService.updateDraftEServiceTemplateVersion = vi
    .fn()
    .mockResolvedValue(mockM2MTemplateVersionResponse);

  const makeRequest = async (
    token: string,
    templateId: string = generateId(),
    versionId: string = generateId(),
    body: m2mGatewayApi.EServiceTemplateVersionDraftUpdateSeed = templateVersionSeed
  ) =>
    request(api)
      .patch(`${appBasePath}/templates/${templateId}/versions/${versionId}`)
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
  ] as m2mGatewayApi.EServiceTemplateVersionDraftUpdateSeed[])(
    "Should return 200 with partial seed (seed #%#)",
    async (seed) => {
      const token = generateToken(authRole.M2M_ADMIN_ROLE);
      const res = await makeRequest(token, generateId(), generateId(), seed);
      expect(res.status).toBe(200);
    }
  );

  it.each([
    { ...templateVersionSeed, agreementApprovalPolicy: "INVALID_POLICY" },
    {
      ...templateVersionSeed,
      dailyCallsPerConsumer: -1,
    },
    {
      ...templateVersionSeed,
      dailyCallsTotal: -1,
    },
    {
      ...templateVersionSeed,
      voucherLifespan: -1,
    },
  ])(
    "Should return 400 if passed an invalid Template Version seed (seed #%#)",
    async (body) => {
      const token = generateToken(authRole.M2M_ADMIN_ROLE);
      const res = await makeRequest(
        token,
        generateId(),
        generateId(),
        body as m2mGatewayApi.EServiceTemplateVersionDraftUpdateSeed
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
