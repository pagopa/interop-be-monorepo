/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { AxiosError, InternalAxiosRequestConfig } from "axios";
import { AuthRole, authRole } from "pagopa-interop-commons";
import { generateToken } from "pagopa-interop-commons-test";
import { generateId } from "pagopa-interop-models";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { appBasePath } from "../../../src/config/appBasePath.js";
import { api, clients } from "../../vitest.api.setup.js";

describe("API PATCH /clients/{clientId}", () => {
  const clientId = generateId();
  const seed = { name: "Updated client", description: "Updated description" };
  const makeRequest = async (
    role: AuthRole,
    body: object = seed,
    id: string = clientId
  ) =>
    request(api)
      .patch(`${appBasePath}/clients/${id}`)
      .set("Authorization", `Bearer ${generateToken(role)}`)
      .set("X-Correlation-Id", generateId())
      .send(body);

  beforeEach(() => {
    clients.authorizationClient.client.updateClient = vi
      .fn()
      .mockResolvedValue({});
  });

  it.each([
    seed,
    { name: "n".repeat(5) },
    { name: "n".repeat(60) },
    { description: "d".repeat(10) },
    { description: "d".repeat(250) },
  ])(
    "should forward one command and return 204 for ADMIN: %s",
    async (body) => {
      const res = await makeRequest(authRole.ADMIN_ROLE, body);
      expect(res.status).toBe(204);
      expect(
        clients.authorizationClient.client.updateClient
      ).toHaveBeenCalledExactlyOnceWith(body, {
        params: { clientId },
        headers: expect.anything(),
      });
    }
  );

  it.each(
    Object.values(authRole).filter((role) => role !== authRole.ADMIN_ROLE)
  )("should reject %s without calling the process", async (role) => {
    const res = await makeRequest(role);
    expect(res.status).toBe(403);
    expect(
      clients.authorizationClient.client.updateClient
    ).not.toHaveBeenCalled();
  });

  it.each([
    {},
    { name: "n".repeat(4) },
    { name: "n".repeat(61) },
    { description: "d".repeat(9) },
    { description: "d".repeat(251) },
    { name: null },
    { description: null },
    { name: 42 },
    { description: true },
    { ...seed, consumerId: generateId() },
    { ...seed, kind: "API" },
    { ...seed, members: [] },
    { name: seed.name, description: null },
  ])("should reject invalid payload: %s", async (body) => {
    const res = await makeRequest(authRole.ADMIN_ROLE, body);
    expect(res.status).toBe(400);
    expect(
      clients.authorizationClient.client.updateClient
    ).not.toHaveBeenCalled();
  });

  it("should reject an invalid client id", async () => {
    const res = await makeRequest(authRole.ADMIN_ROLE, seed, "invalid");
    expect(res.status).toBe(400);
    expect(
      clients.authorizationClient.client.updateClient
    ).not.toHaveBeenCalled();
  });

  it.each([400, 403, 404, 409])(
    "should preserve an upstream %s",
    async (status) => {
      const upstreamProblem = {
        type: "about:blank",
        title: "Client update failed",
        status,
        detail: "Client update failed",
        errors: [{ code: "005-0001", detail: "Client update failed" }],
      };
      clients.authorizationClient.client.updateClient = vi
        .fn()
        .mockRejectedValue(
          new AxiosError(
            "upstream error",
            String(status),
            undefined,
            undefined,
            {
              status,
              data: upstreamProblem,
              statusText: "Client update failed",
              config: {} as InternalAxiosRequestConfig,
              headers: {},
            }
          )
        );
      const res = await makeRequest(authRole.ADMIN_ROLE);
      expect(res.status).toBe(status);
      expect(res.body).toMatchObject({
        status,
        errors: upstreamProblem.errors,
      });
    }
  );
});
