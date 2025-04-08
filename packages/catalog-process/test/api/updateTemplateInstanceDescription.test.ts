/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import { EService, generateId } from "pagopa-interop-models";
import { createPayload, getMockAuthData } from "pagopa-interop-commons-test";
import { userRoles, AuthData } from "pagopa-interop-commons";
import { api } from "../vitest.api.setup.js";
import { getMockEService } from "../mockUtils.js";
import { catalogService } from "../../src/routers/EServiceRouter.js";

describe("API /internal/templates/eservices/{eServiceId}/description/update authorization test", () => {
  const mockEService: EService = getMockEService();

  vi.spyOn(
    catalogService,
    "internalUpdateTemplateInstanceDescription"
  ).mockResolvedValue();

  const generateToken = (authData: AuthData) =>
    jwt.sign(createPayload(authData), "test-secret");

  const makeRequest = async (token: string, eServiceId: string) =>
    request(api)
      .post(`/internal/templates/eservices/${eServiceId}/description/update`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send({
        description: "New Description",
      });

  it.each([userRoles.INTERNAL_ROLE])(
    "Should return 204 for user with role %s",
    async (role) => {
      const token = generateToken({ ...getMockAuthData(), userRoles: [role] });
      const res = await makeRequest(token, mockEService.id);
      expect(res.status).toBe(204);
    }
  );

  it.each(
    Object.values(userRoles).filter((role) => role !== userRoles.INTERNAL_ROLE)
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken({ ...getMockAuthData(), userRoles: [role] });
    const res = await makeRequest(token, mockEService.id);

    expect(res.status).toBe(403);
  });

  it("Should return 404 not found", async () => {
    const res = await makeRequest(generateToken(getMockAuthData()), "");
    expect(res.status).toBe(404);
  });
});
