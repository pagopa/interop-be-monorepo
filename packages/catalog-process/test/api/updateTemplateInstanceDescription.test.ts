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

describe("API /internal/templates/eservices/{eServiceId}/description/update authorization test", () => {
  const mockEService: EService = getMockEService();

  catalogService.internalUpdateTemplateInstanceDescription = vi
    .fn()
    .mockResolvedValue({});

  const mockEServiceDescriptionUpdateSeed: catalogApi.EServiceDescriptionUpdateSeed =
    {
      description: "New Description",
    };

  const makeRequest = async (
    token: string,
    eServiceId: string,
    body: catalogApi.EServiceDescriptionUpdateSeed = mockEServiceDescriptionUpdateSeed
  ) =>
    request(api)
      .post(`/internal/templates/eservices/${eServiceId}/description/update`)
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
    catalogService.internalUpdateTemplateInstanceDescription = vi
      .fn()
      .mockRejectedValue(eServiceNotFound(mockEService.id));

    const token = generateToken(authRole.INTERNAL_ROLE);
    const res = await makeRequest(token, mockEService.id);

    expect(res.status).toBe(404);
  });

  it.each([
    [{}, mockEService.id],
    [{ description: 123 }, mockEService.id],
    [{ ...mockEServiceDescriptionUpdateSeed }, "invalidId"],
  ])(
    "Should return 400 if passed invalid params: %s (eserviceId: %s)",
    async (body, eServiceId) => {
      const token = generateToken(authRole.INTERNAL_ROLE);
      const res = await makeRequest(
        token,
        eServiceId as EServiceId,
        body as catalogApi.EServiceDescriptionUpdateSeed
      );

      expect(res.status).toBe(400);
    }
  );
});
