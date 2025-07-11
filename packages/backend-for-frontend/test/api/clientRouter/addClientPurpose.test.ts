/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ClientId, generateId } from "pagopa-interop-models";
import { generateToken } from "pagopa-interop-commons-test";
import { authRole } from "pagopa-interop-commons";
import request from "supertest";
import { bffApi } from "pagopa-interop-api-clients";
import { api, clients } from "../../vitest.api.setup.js";
import { appBasePath } from "../../../src/config/appBasePath.js";
import { getMockBffApiPurposeAdditionDetailsSeed } from "../../mockUtils.js";

describe("API POST /clients/:clientId/purposes", () => {
  const mockPurposeAdditionDetailsSeed =
    getMockBffApiPurposeAdditionDetailsSeed();

  beforeEach(() => {
    clients.authorizationClient.client.addClientPurpose = vi
      .fn()
      .mockResolvedValue(undefined);
  });

  const makeRequest = async (
    token: string,
    clientId: ClientId = generateId(),
    body: bffApi.PurposeAdditionDetailsSeed = mockPurposeAdditionDetailsSeed
  ) =>
    request(api)
      .post(`${appBasePath}/clients/${clientId}/purposes`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send(body);

  it("Should return 204 for user with role Admin", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toEqual(204);
  });

  it.each([
    { clientId: "invalid" as ClientId },
    { body: {} },
    { body: { ...mockPurposeAdditionDetailsSeed, extraField: 1 } },
    { body: { ...mockPurposeAdditionDetailsSeed, purposeId: "invalid" } },
  ])(
    "Should return 400 if passed an invalid data: %s",
    async ({ clientId, body }) => {
      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(
        token,
        clientId,
        body as bffApi.PurposeAdditionDetailsSeed
      );
      expect(res.status).toBe(400);
    }
  );
});
