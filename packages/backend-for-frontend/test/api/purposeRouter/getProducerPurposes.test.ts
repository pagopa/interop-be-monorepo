/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { generateId } from "pagopa-interop-models";
import { generateToken } from "pagopa-interop-commons-test";
import { authRole } from "pagopa-interop-commons";
import { bffApi } from "pagopa-interop-api-clients";
import request from "supertest";
import { api, services } from "../../vitest.api.setup.js";
import { appBasePath } from "../../../src/config/appBasePath.js";
import { getMockBffApiPurpose } from "../../mockUtils.js";
import {
  agreementNotFound,
  eServiceNotFound,
  eserviceDescriptorNotFound,
  tenantNotFound,
} from "../../../src/model/errors.js";

describe("API GET /producers/purposes test", () => {
  const mockPurposes: bffApi.Purposes = {
    results: [getMockBffApiPurpose(), getMockBffApiPurpose()],
    pagination: { offset: 0, limit: 10, totalCount: 20 },
  };

  beforeEach(() => {
    services.purposeService.getProducerPurposes = vi
      .fn()
      .mockResolvedValue(mockPurposes);
  });

  const makeRequest = async (token: string, limit: unknown = 5) =>
    request(api)
      .get(`${appBasePath}/producers/purposes`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .query({
        offset: 0,
        limit,
      })
      .send();

  it("Should return 200 for user with role Admin", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(mockPurposes);
  });

  it("Should return 404 for tenantNotFound", async () => {
    services.purposeService.getProducerPurposes = vi
      .fn()
      .mockRejectedValue(tenantNotFound(generateId()));
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(404);
  });

  it("Should return 404 for eServiceNotFound", async () => {
    services.purposeService.getProducerPurposes = vi
      .fn()
      .mockRejectedValue(eServiceNotFound(generateId()));
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(404);
  });

  it("Should return 404 for agreementNotFound", async () => {
    services.purposeService.getProducerPurposes = vi
      .fn()
      .mockRejectedValue(agreementNotFound(generateId()));
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(404);
  });

  it("Should return 404 for eserviceDescriptorNotFound", async () => {
    services.purposeService.getProducerPurposes = vi
      .fn()
      .mockRejectedValue(
        eserviceDescriptorNotFound(generateId(), generateId())
      );
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(404);
  });

  it("Should return 400 if passed an invalid limit", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, "invalid");
    expect(res.status).toBe(400);
  });
});
