/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { generateId } from "pagopa-interop-models";
import { generateToken } from "pagopa-interop-commons-test";
import { authRole } from "pagopa-interop-commons";
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

describe("API GET /purposes/{purposeId} test", () => {
  const mockPurpose = getMockBffApiPurpose();

  beforeEach(() => {
    services.purposeService.getPurpose = vi.fn().mockResolvedValue(mockPurpose);
  });

  const makeRequest = async (
    token: string,
    purposeId: string = mockPurpose.id
  ) =>
    request(api)
      .get(`${appBasePath}/purposes/${purposeId}`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId());

  it("Should return 200 for user with role Admin", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(mockPurpose);
  });

  it("Should return 404 for tenantNotFound", async () => {
    services.purposeService.getPurpose = vi
      .fn()
      .mockRejectedValue(tenantNotFound(generateId()));
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(404);
  });

  it("Should return 404 for eServiceNotFound", async () => {
    services.purposeService.getPurpose = vi
      .fn()
      .mockRejectedValue(eServiceNotFound(generateId()));
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(404);
  });

  it("Should return 404 for agreementNotFound", async () => {
    services.purposeService.getPurpose = vi
      .fn()
      .mockRejectedValue(agreementNotFound(generateId()));
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(404);
  });

  it("Should return 404 for eserviceDescriptorNotFound", async () => {
    services.purposeService.getPurpose = vi
      .fn()
      .mockRejectedValue(
        eserviceDescriptorNotFound(generateId(), generateId())
      );
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(404);
  });

  it("Should return 400 if passed an invalid purpose id", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, "invalid");
    expect(res.status).toBe(400);
  });
});
