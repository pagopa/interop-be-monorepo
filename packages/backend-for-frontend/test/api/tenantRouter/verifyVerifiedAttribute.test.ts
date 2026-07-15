/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { bffApi } from "pagopa-interop-api-clients";
import { TenantId, generateId } from "pagopa-interop-models";
import { generateToken } from "pagopa-interop-commons-test";
import { authRole } from "pagopa-interop-commons";
import request, { Response as SupertestResponse } from "supertest";
import { AxiosError, InternalAxiosRequestConfig } from "axios";
import { api, clients } from "../../vitest.api.setup.js";
import { appBasePath } from "../../../src/config/appBasePath.js";
import { getMockBffApiVerifiedTenantAttributeSeed } from "../../mockUtils.js";

describe("API POST /tenants/{tenantId}/attributes/verified test", () => {
  const attributeSeed = getMockBffApiVerifiedTenantAttributeSeed();

  beforeEach(() => {
    clients.tenantProcessClient.tenantAttribute.verifyVerifiedAttribute = vi
      .fn()
      .mockResolvedValue(undefined);
  });

  const makeRequest = async (
    token: string,
    tenantId: TenantId = generateId(),
    body: bffApi.VerifiedTenantAttributeSeed = attributeSeed
  ) =>
    request(api)
      .post(`${appBasePath}/tenants/${tenantId}/attributes/verified`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send(body);

  it("Should return 204 for user with role Admin", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(204);
  });

  it("Should propagate 409 when the attribute is already verified by the same tenant", async () => {
    const upstreamStatus: number = 409;
    const upstreamError: AxiosError = new AxiosError(
      "upstream error",
      String(upstreamStatus),
      undefined,
      undefined,
      {
        status: upstreamStatus,
        data: {
          type: "about:blank",
          title: "Attribute is already verified",
          status: upstreamStatus,
          detail: "Attribute is already verified by the same tenant",
          correlationId: "test-correlation-id",
          errors: [
            {
              code: "001-0034",
              detail: "Attribute is already verified by the same tenant",
            },
          ],
        },
        statusText: "",
        config: {} as InternalAxiosRequestConfig,
        headers: {},
      }
    );
    clients.tenantProcessClient.tenantAttribute.verifyVerifiedAttribute = vi
      .fn()
      .mockRejectedValue(upstreamError);

    const token: string = generateToken(authRole.ADMIN_ROLE);
    const res: SupertestResponse = await makeRequest(token);

    expect(res.status).toBe(upstreamStatus);
  });

  it.each([
    { tenantId: "invalid" as TenantId },
    { body: {} },
    { body: { ...attributeSeed, id: undefined } },
    { body: { ...attributeSeed, id: "invalid" } },
    { body: { ...attributeSeed, agreementId: undefined } },
    { body: { ...attributeSeed, agreementId: "invalid" } },
    { body: { ...attributeSeed, expirationDate: "invalid" } },
    { body: { ...attributeSeed, extraField: true } },
  ])(
    "Should return 400 if passed invalid data: %s",
    async ({ tenantId, body }) => {
      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(
        token,
        tenantId,
        body as bffApi.VerifiedTenantAttributeSeed
      );
      expect(res.status).toBe(400);
    }
  );
});
