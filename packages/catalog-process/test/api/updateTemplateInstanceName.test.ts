/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi } from "vitest";
import request from "supertest";
import { EService, generateId } from "pagopa-interop-models";
import { generateToken } from "pagopa-interop-commons-test";
import { authRole } from "pagopa-interop-commons";
import { api, catalogService } from "../vitest.api.setup.js";
import { getMockEService } from "../mockUtils.js";

describe("API /internal/templates/eservices/{eServiceId}/name/update authorization test", () => {
  const mockEService: EService = getMockEService();

  catalogService.internalUpdateTemplateInstanceName = vi
    .fn()
    .mockResolvedValue({});

  const makeRequest = async (token: string, eServiceId: string) =>
    request(api)
      .post(`/internal/templates/eservices/${eServiceId}/name/update`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send({
        name: "New Name",
      });

  it("Should return 204 for user with role internal", async () => {
    const token = generateToken(authRole.INTERNAL_ROLE);
    const res = await makeRequest(token, mockEService.id);
    expect(res.status).toBe(204);
  });

  it.each(
    Object.values(authRole).filter((role) => role !== authRole.INTERNAL_ROLE)
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken(role);
    const res = await makeRequest(token, mockEService.id);

    expect(res.status).toBe(403);
  });

  it("Should return 404 not found", async () => {
    const res = await makeRequest(generateToken(authRole.INTERNAL_ROLE), "");
    expect(res.status).toBe(404);
  });
});
