/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ClientId, generateId } from "pagopa-interop-models";
import { generateToken } from "pagopa-interop-commons-test";
import { authRole } from "pagopa-interop-commons";
import request from "supertest";
import { bffApi } from "pagopa-interop-api-clients";
import { api, clients } from "../../vitest.api.setup.js";
import { appBasePath } from "../../../src/config/appBasePath.js";
import { createClientApiClient } from "../../../../api-clients/dist/generated/authorizationApi.js";
import { getMockBffApiPurposeAdditionDetailsSeed } from "../../mockUtils.js";

describe("API POST /clients/:clientId/purposes", () => {
  const mockClientId = generateId<ClientId>();
  const mockPurposeAdditionDetailsSeed =
    getMockBffApiPurposeAdditionDetailsSeed();

  const makeRequest = async (
    token: string,
    clientId: ClientId = mockClientId,
    body: bffApi.PurposeAdditionDetailsSeed = mockPurposeAdditionDetailsSeed
  ) =>
    request(api)
      .post(`${appBasePath}/clients/${clientId}/purposes`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send(body);

  beforeEach(() => {
    clients.authorizationClient.client = {} as ReturnType<
      typeof createClientApiClient
    >;
    clients.authorizationClient.client.addClientPurpose = vi
      .fn()
      .mockResolvedValue(undefined);
  });

  it("Should return 204 for user with role Admin", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toEqual(204);
  });

  it("Should return 400 if passed an invalid purpose id", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, "invalid" as ClientId);
    expect(res.status).toBe(400);
  });
});
