/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  EServiceTemplateId,
  EServiceTemplateVersionId,
  generateId,
} from "pagopa-interop-models";
import { generateToken } from "pagopa-interop-commons-test";
import { authRole } from "pagopa-interop-commons";
import request from "supertest";
import { bffApi } from "pagopa-interop-api-clients";
import { api, clients } from "../../vitest.api.setup.js";
import { appBasePath } from "../../../src/config/appBasePath.js";
import { getMockBffApiUpdateEServiceTemplateVersionSeed } from "../../mockUtils.js";

describe("API POST /eservices/templates/:eServiceTemplateId/versions/:eServiceTemplateVersionId", () => {
  const mockUpdateEServiceTemplateVersionSeed =
    getMockBffApiUpdateEServiceTemplateVersionSeed();

  beforeEach(() => {
    clients.eserviceTemplateProcessClient.updateDraftTemplateVersion = vi
      .fn()
      .mockResolvedValue(undefined);
  });

  const makeRequest = async (
    token: string,
    eServiceTemplateId: EServiceTemplateId = generateId(),
    eServiceTemplateVersionId: EServiceTemplateVersionId = generateId(),
    body: bffApi.UpdateEServiceTemplateVersionSeed = mockUpdateEServiceTemplateVersionSeed
  ) =>
    request(api)
      .post(
        `${appBasePath}/eservices/templates/${eServiceTemplateId}/versions/${eServiceTemplateVersionId}`
      )
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send(body);

  it("Should return 204 for user with role Admin", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(204);
  });

  it.each([
    { eServiceTemplateId: "invalid" as EServiceTemplateId },
    { eServiceTemplateVersionId: "invalid" as EServiceTemplateVersionId },
    { body: {} },
    {
      body: {
        ...mockUpdateEServiceTemplateVersionSeed,
        extraField: 1,
      },
    },
    {
      body: {
        ...mockUpdateEServiceTemplateVersionSeed,
        description: "a".repeat(9),
      },
    },
    {
      body: {
        ...mockUpdateEServiceTemplateVersionSeed,
        description: "a".repeat(251),
      },
    },
    {
      body: {
        ...mockUpdateEServiceTemplateVersionSeed,
        voucherLifespan: 59,
      },
    },
    {
      body: {
        ...mockUpdateEServiceTemplateVersionSeed,
        voucherLifespan: 86401,
      },
    },
    {
      body: {
        ...mockUpdateEServiceTemplateVersionSeed,
        dailyCallsPerConsumer: 0,
      },
    },
    {
      body: {
        ...mockUpdateEServiceTemplateVersionSeed,
        dailyCallsTotal: 0,
      },
    },
    {
      body: {
        ...mockUpdateEServiceTemplateVersionSeed,
        agreementApprovalPolicy: {},
      },
    },
    {
      body: {
        ...mockUpdateEServiceTemplateVersionSeed,
        attributes: {},
      },
    },
  ])(
    "Should return 400 if passed invalid data: %s",
    async ({ eServiceTemplateId, eServiceTemplateVersionId, body }) => {
      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(
        token,
        eServiceTemplateId,
        eServiceTemplateVersionId,
        body as bffApi.UpdateEServiceTemplateVersionSeed
      );
      expect(res.status).toBe(400);
    }
  );
});
