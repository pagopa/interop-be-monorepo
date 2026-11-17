import { AxiosError, InternalAxiosRequestConfig } from "axios";
import { m2mGatewayApiV3 } from "pagopa-interop-api-clients";
import { AuthRole, authRole } from "pagopa-interop-commons";
import {
  generateToken,
  getMockDPoPProof,
  getMockedApiFullProducerKeychain,
} from "pagopa-interop-commons-test";
import { pollingMaxRetriesExceeded } from "pagopa-interop-models";
import request from "supertest";
import { beforeEach, describe, it, expect, vi } from "vitest";

import { toM2MGatewayApiProducerKeychain } from "../../../src/api/producerKeychainApiConverter.js";
import { appBasePath } from "../../../src/config/appBasePath.js";
import { config } from "../../../src/config/config.js";
import { missingMetadata } from "../../../src/model/errors.js";
import { api, mockProducerKeychainService } from "../../vitest.api.setup.js";

describe("PATCH /producerKeychains/:keychainId router test", () => {
  const producerKeychain = {
    ...getMockedApiFullProducerKeychain(),
    name: "Original producer keychain name",
    description: "Original producer keychain description",
  };
  const response = toM2MGatewayApiProducerKeychain(producerKeychain);
  const seed: m2mGatewayApiV3.ProducerKeychainUpdateSeed = {
    name: "Updated producer keychain name",
    description: "Updated producer keychain description",
  };
  const makeRequest = async (
    role: AuthRole = authRole.M2M_ADMIN_ROLE,
    body: string | object = seed,
    keychainId: string = producerKeychain.id
  ) =>
    request(api)
      .patch(`${appBasePath}/producerKeychains/${keychainId}`)
      .set("Authorization", `DPoP ${generateToken(role)}`)
      .set("DPoP", (await getMockDPoPProof()).dpopProofJWS)
      .set("Content-Type", "application/merge-patch+json")
      .send(body);

  beforeEach(() => {
    mockProducerKeychainService.updateProducerKeychain = vi
      .fn()
      .mockResolvedValue(response);
  });

  it.each([
    seed,
    { name: seed.name },
    { description: seed.description },
    { name: producerKeychain.name, description: producerKeychain.description },
    { name: "a".repeat(5), description: "a".repeat(10) },
    { name: "a".repeat(60), description: "a".repeat(250) },
  ])(
    "should update a producer keychain with valid seed %j as M2M_ADMIN",
    async (body) => {
      const res = await makeRequest(authRole.M2M_ADMIN_ROLE, body);
      expect(res.status).toBe(200);
      expect(res.body).toEqual(response);
      expect(
        mockProducerKeychainService.updateProducerKeychain
      ).toHaveBeenCalledExactlyOnceWith(
        producerKeychain.id,
        body,
        expect.any(Object)
      );
    }
  );

  it.each(
    Object.values(authRole).filter((role) => role !== authRole.M2M_ADMIN_ROLE)
  )("should reject role %s", async (role) => {
    const res = await makeRequest(role);
    expect(res.status).toBe(403);
    expect(
      mockProducerKeychainService.updateProducerKeychain
    ).not.toHaveBeenCalled();
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
    expect(
      mockProducerKeychainService.updateProducerKeychain
    ).not.toHaveBeenCalled();
  });

  it("should reject an invalid producer keychain ID", async () => {
    const res = await makeRequest(authRole.M2M_ADMIN_ROLE, seed, "invalid");
    expect(res.status).toBe(400);
    expect(
      mockProducerKeychainService.updateProducerKeychain
    ).not.toHaveBeenCalled();
  });

  it.each([400, 403, 404, 409])(
    "should propagate process status %s",
    async (status) => {
      const problem = {
        type: "about:blank",
        title: "Producer keychain update failed",
        detail: "Producer keychain update failed",
        status,
        errors: [
          { code: "005-0001", detail: "Producer keychain update failed" },
        ],
      };
      mockProducerKeychainService.updateProducerKeychain = vi
        .fn()
        .mockRejectedValue(
          new AxiosError(
            "Producer keychain update failed",
            undefined,
            undefined,
            undefined,
            {
              status,
              statusText: "Producer keychain update failed",
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
    mockProducerKeychainService.updateProducerKeychain = vi
      .fn()
      .mockRejectedValue(error);
    const res = await makeRequest();
    expect(res.status).toBe(500);
  });
});
