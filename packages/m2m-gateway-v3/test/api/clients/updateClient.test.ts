import { AxiosError, InternalAxiosRequestConfig } from "axios";
import { authorizationApi, m2mGatewayApiV3 } from "pagopa-interop-api-clients";
import { AuthRole, authRole } from "pagopa-interop-commons";
import {
  generateToken,
  getMockDPoPProof,
  getMockedApiConsumerFullClient,
} from "pagopa-interop-commons-test";
import { pollingMaxRetriesExceeded } from "pagopa-interop-models";
import request from "supertest";
import { beforeEach, describe, it, expect, vi } from "vitest";

import { toM2MGatewayApiConsumerClient } from "../../../src/api/clientApiConverter.js";
import { appBasePath } from "../../../src/config/appBasePath.js";
import { config } from "../../../src/config/config.js";
import { missingMetadata } from "../../../src/model/errors.js";
import { api, mockClientService } from "../../vitest.api.setup.js";

describe("PATCH /clients/:clientId router test", () => {
  const client = {
    ...getMockedApiConsumerFullClient({
      kind: authorizationApi.ClientKind.Values.CONSUMER,
    }),
    name: "Original client name",
    description: "Original client description",
  };
  const response = toM2MGatewayApiConsumerClient(client);
  const seed: m2mGatewayApiV3.ClientUpdateSeed = {
    name: "Updated client name",
    description: "Updated client description",
  };
  const makeRequest = async (
    role: AuthRole = authRole.M2M_ADMIN_ROLE,
    body: string | object = seed,
    clientId: string = client.id
  ) =>
    request(api)
      .patch(`${appBasePath}/clients/${clientId}`)
      .set("Authorization", `DPoP ${generateToken(role)}`)
      .set("DPoP", (await getMockDPoPProof()).dpopProofJWS)
      .set("Content-Type", "application/merge-patch+json")
      .send(body);

  beforeEach(() => {
    mockClientService.updateClient = vi.fn().mockResolvedValue(response);
  });

  it.each([
    seed,
    { name: seed.name },
    { description: seed.description },
    { name: client.name, description: client.description },
    { name: "a".repeat(5), description: "a".repeat(10) },
    { name: "a".repeat(60), description: "a".repeat(250) },
  ])("should update a client with valid seed %j as M2M_ADMIN", async (body) => {
    mockClientService.updateClient = vi.fn().mockResolvedValue(response);
    const res = await makeRequest(authRole.M2M_ADMIN_ROLE, body);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(response);
    expect(mockClientService.updateClient).toHaveBeenCalledExactlyOnceWith(
      client.id,
      body,
      expect.any(Object)
    );
  });

  it.each(
    Object.values(authRole).filter((role) => role !== authRole.M2M_ADMIN_ROLE)
  )("should reject role %s", async (role) => {
    const res = await makeRequest(role);
    expect(res.status).toBe(403);
    expect(mockClientService.updateClient).not.toHaveBeenCalled();
  });

  it.each([
    {},
    { name: "a".repeat(4) },
    { name: "a".repeat(61) },
    { description: "a".repeat(9) },
    { description: "a".repeat(251) },
    { name: null },
    { description: null },
    { name: 7 },
    { description: false },
    { extra: "unknown" },
    { ...seed, extra: "unknown" },
    { ...seed, members: [] },
  ])("should reject invalid seed %j", async (body) => {
    const res = await makeRequest(authRole.M2M_ADMIN_ROLE, body);
    expect(res.status).toBe(400);
    expect(mockClientService.updateClient).not.toHaveBeenCalled();
  });

  it("should reject an invalid client ID", async () => {
    const res = await makeRequest(authRole.M2M_ADMIN_ROLE, seed, "invalid");
    expect(res.status).toBe(400);
    expect(mockClientService.updateClient).not.toHaveBeenCalled();
  });

  it.each([400, 403, 404, 409])(
    "should propagate process status %s",
    async (status) => {
      const problem = {
        type: "about:blank",
        title: "Client update failed",
        detail: "Client update failed",
        status,
        errors: [{ code: "005-0001", detail: "Client update failed" }],
      };
      mockClientService.updateClient = vi.fn().mockRejectedValue(
        new AxiosError(
          "Client update failed",
          undefined,
          undefined,
          undefined,
          {
            status,
            statusText: "Client update failed",
            data: problem,
            headers: {},
            config: {} as InternalAxiosRequestConfig,
          }
        )
      );
      const res = await makeRequest();
      expect(res.status).toBe(status);
      expect(res.body.errors).toEqual(problem.errors);
    }
  );

  it.each([
    missingMetadata(),
    pollingMaxRetriesExceeded(
      config.defaultPollingMaxRetries,
      config.defaultPollingRetryDelay
    ),
  ])("should surface a polling failure", async (error) => {
    mockClientService.updateClient = vi.fn().mockRejectedValue(error);
    const res = await makeRequest();
    expect(res.status).toBe(500);
  });
});
