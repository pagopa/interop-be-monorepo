/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi } from "vitest";
import request from "supertest";
import {
  EService,
  EServiceId,
  generateId,
  operationForbidden,
} from "pagopa-interop-models";
import { authRole } from "pagopa-interop-commons";
import { generateToken, getMockEService } from "pagopa-interop-commons-test";
import { api, catalogService } from "../vitest.api.setup.js";
import {
  eServiceNotFound,
  eServiceAlreadyArchived,
} from "../../src/model/domain/errors.js";

describe("API /internal/eservices/{eServiceId}/archive authorization test", () => {
  const mockEService: EService = {
    ...getMockEService(),
    descriptors: [],
  };

  catalogService.archiveEService = vi.fn().mockResolvedValue({});

  const makeRequest = async (token: string, eServiceId: EServiceId) =>
    request(api)
      .post(`/internal/eservices/${eServiceId}/archive`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send();

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

  it.each([
    {
      error: operationForbidden,
      expectedStatus: 403,
    },
    {
      error: eServiceNotFound(mockEService.id),
      expectedStatus: 404,
    },
    {
      error: eServiceAlreadyArchived(mockEService.id),
      expectedStatus: 409,
    },
  ])(
    "Should return $expectedStatus for $error.code",
    async ({ error, expectedStatus }) => {
      catalogService.archiveEService = vi.fn().mockRejectedValue(error);

      const token = generateToken(authRole.INTERNAL_ROLE);
      const res = await makeRequest(token, mockEService.id);
      expect(res.status).toBe(expectedStatus);
    }
  );

  it("Should return 400 if passed invalid eserviceId", async () => {
    const token = generateToken(authRole.INTERNAL_ROLE);
    const res = await makeRequest(token, "eServiceId" as EServiceId);

    expect(res.status).toBe(400);
  });
});
