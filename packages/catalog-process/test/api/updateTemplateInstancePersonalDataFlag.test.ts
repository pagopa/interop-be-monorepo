/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { catalogApi } from "pagopa-interop-api-clients";
import { authRole } from "pagopa-interop-commons";
import { generateToken, getMockEService } from "pagopa-interop-commons-test";
import { EService, EServiceId, generateId } from "pagopa-interop-models";
import request from "supertest";
import { describe, it, expect, vi } from "vitest";

import { eServiceNotFound } from "../../src/model/domain/errors.js";
import { api, catalogService } from "../vitest.api.setup.js";

describe("API /internal/templates/eservices/{eServiceId}/personalDataFlag authorization test", () => {
  const mockEService: EService = getMockEService();

  catalogService.internalUpdateTemplateInstancePersonalDataFlag = vi
    .fn()
    .mockResolvedValue({});

  const mockEServicePersonalDataFlagUpdateSeed: catalogApi.EServicePersonalDataFlagUpdateSeed =
    {
      personalData: true,
    };

  const makeRequest = async (
    token: string,
    eServiceId: EServiceId,
    body: catalogApi.EServicePersonalDataFlagUpdateSeed = mockEServicePersonalDataFlagUpdateSeed
  ) =>
    request(api)
      .post(`/internal/templates/eservices/${eServiceId}/personalDataFlag`)
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
    catalogService.internalUpdateTemplateInstancePersonalDataFlag = vi
      .fn()
      .mockRejectedValue(eServiceNotFound(mockEService.id));

    const token = generateToken(authRole.INTERNAL_ROLE);
    const res = await makeRequest(token, mockEService.id);

    expect(res.status).toBe(404);
  });

  it.each([
    [{}, mockEService.id],
    [{ personalDataFlag: "123" }, mockEService.id],
    [{ ...mockEServicePersonalDataFlagUpdateSeed }, "invalidId"],
  ])(
    "Should return 400 if passed invalid params: %s (eserviceId: %s)",
    async (body, eServiceId) => {
      const token = generateToken(authRole.INTERNAL_ROLE);
      const res = await makeRequest(
        token,
        eServiceId as EServiceId,
        body as catalogApi.EServicePersonalDataFlagUpdateSeed
      );

      expect(res.status).toBe(400);
    }
  );
});
