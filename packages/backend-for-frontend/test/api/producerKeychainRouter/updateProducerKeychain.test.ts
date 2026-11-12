/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { AxiosError, InternalAxiosRequestConfig } from "axios";
import { AuthRole, authRole } from "pagopa-interop-commons";
import { generateToken } from "pagopa-interop-commons-test";
import { generateId } from "pagopa-interop-models";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { appBasePath } from "../../../src/config/appBasePath.js";
import { api, clients } from "../../vitest.api.setup.js";

describe("API PATCH /producerKeychains/{producerKeychainId}", () => {
  const producerKeychainId = generateId();
  const seed = { name: "Updated name", description: "Updated description" };
  const makeRequest = async (
    role: AuthRole,
    body: object = seed,
    id: string = producerKeychainId
  ) =>
    request(api)
      .patch(`${appBasePath}/producerKeychains/${id}`)
      .set("Authorization", `Bearer ${generateToken(role)}`)
      .set("X-Correlation-Id", generateId())
      .send(body);

  beforeEach(() => {
    clients.authorizationClient.producerKeychain.updateProducerKeychain = vi
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
    "should forward a single command and return 204 for ADMIN: %s",
    async (body) => {
      const res = await makeRequest(authRole.ADMIN_ROLE, body);
      expect(res.status).toBe(204);
      expect(
        clients.authorizationClient.producerKeychain.updateProducerKeychain
      ).toHaveBeenCalledExactlyOnceWith(body, {
        params: { producerKeychainId },
        headers: expect.anything(),
      });
    }
  );

  it.each(
    Object.values(authRole).filter((role) => role !== authRole.ADMIN_ROLE)
  )("should reject %s without calling the process", async (role) => {
    expect((await makeRequest(role)).status).toBe(403);
    expect(
      clients.authorizationClient.producerKeychain.updateProducerKeychain
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
    { ...seed, producerId: generateId() },
    { ...seed, members: [] },
    { ...seed, keys: [] },
    { ...seed, eservices: [] },
    { name: seed.name, description: null },
    { description: seed.description, name: null },
    { name: seed.name, extra: true },
    { description: seed.description, extra: true },
  ])("should reject invalid payload: %s", async (body) => {
    expect((await makeRequest(authRole.ADMIN_ROLE, body)).status).toBe(400);
    expect(
      clients.authorizationClient.producerKeychain.updateProducerKeychain
    ).not.toHaveBeenCalled();
  });

  it("should reject an invalid id", async () => {
    expect(
      (await makeRequest(authRole.ADMIN_ROLE, seed, "invalid")).status
    ).toBe(400);
    expect(
      clients.authorizationClient.producerKeychain.updateProducerKeychain
    ).not.toHaveBeenCalled();
  });

  it.each([400, 403, 404, 409])(
    "should preserve an upstream %s",
    async (status) => {
      const upstreamProblem = {
        type: "about:blank",
        title: "Producer keychain update failed",
        status,
        detail: "Producer keychain update failed",
        errors: [
          { code: "005-0019", detail: "Producer keychain update failed" },
        ],
      };
      clients.authorizationClient.producerKeychain.updateProducerKeychain = vi
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
              statusText: "Producer keychain update failed",
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
