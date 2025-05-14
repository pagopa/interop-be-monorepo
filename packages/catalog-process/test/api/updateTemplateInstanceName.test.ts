/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi } from "vitest";
import request from "supertest";
import { EService, EServiceId, generateId } from "pagopa-interop-models";
import { generateToken } from "pagopa-interop-commons-test";
import { authRole } from "pagopa-interop-commons";
import { catalogApi } from "pagopa-interop-api-clients";
import { api, catalogService } from "../vitest.api.setup.js";
import { getMockEService } from "../mockUtils.js";
import { eServiceNotFound } from "../../src/model/domain/errors.js";

describe("API /internal/templates/eservices/{eServiceId}/name/update authorization test", () => {
  const mockEService: EService = getMockEService();

  catalogService.internalUpdateTemplateInstanceName = vi
    .fn()
    .mockResolvedValue({});

  const mockEServiceNameUpdateSeed: catalogApi.EServiceNameUpdateSeed = {
    name: "New Name",
  };

  const makeRequest = async (
    token: string,
    eServiceId: EServiceId,
    body: catalogApi.EServiceNameUpdateSeed = mockEServiceNameUpdateSeed
  ) =>
    request(api)
      .post(`/internal/templates/eservices/${eServiceId}/name/update`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send(body);

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

  it("Should return $expectedStatus for $error.code", async () => {
    catalogService.internalUpdateTemplateInstanceName = vi
      .fn()
      .mockRejectedValue(eServiceNotFound(mockEService.id));

    const token = generateToken(authRole.INTERNAL_ROLE);
    const res = await makeRequest(token, mockEService.id);

    expect(res.status).toBe(404);
  });

  it.each([
    [{}, mockEService.id],
    [{ name: 123 }, mockEService.id],
    [{ ...mockEServiceNameUpdateSeed }, "invalidId"],
  ])(
    "Should return 400 if passed invalid params: %s (eServiceId: %s)",
    async (body, eServiceId) => {
      const token = generateToken(authRole.INTERNAL_ROLE);
      const res = await makeRequest(
        token,
        eServiceId as EServiceId,
        body as catalogApi.EServiceNameUpdateSeed
      );

      expect(res.status).toBe(400);
    }
  );
});
