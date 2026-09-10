/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { AxiosError, AxiosHeaders } from "axios";
import { authRole } from "pagopa-interop-commons";
import {
  generateToken,
  getMockedApiFullProducerKeychain,
  getMockedApiTenant,
} from "pagopa-interop-commons-test";
import { generateId } from "pagopa-interop-models";
import request from "supertest";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { appBasePath } from "../../../src/config/appBasePath.js";
import { producerKeychainServiceBuilder } from "../../../src/services/producerKeychainService.js";
import { getMockBffApiProducerKeychain } from "../../mockUtils.js";
import { api, clients, services } from "../../vitest.api.setup.js";

describe("API GET /producerKeychains/{producerKeychainId} test", () => {
  const mockProducerKeychain = getMockBffApiProducerKeychain();
  const correlationId = generateId();

  beforeEach(() => {
    services.producerKeychainService.getProducerKeychainById = vi
      .fn()
      .mockResolvedValue(mockProducerKeychain);
  });

  const makeRequest = async (
    token: string,
    producerKeychainId: string = generateId()
  ) =>
    request(api)
      .get(`${appBasePath}/producerKeychains/${producerKeychainId}`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", correlationId);

  it("Should return 200 for user with role Admin", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(mockProducerKeychain);
  });

  it("Should return 400 if passed an invalid producer keychain id", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, "invalid");
    expect(res.status).toBe(400);
  });

  it("Should return a complete 404 Problem when the bulk catalog response omits an e-service", async () => {
    const eserviceId = generateId();
    const producer = getMockedApiTenant();
    const producerKeychain = {
      ...getMockedApiFullProducerKeychain({ eservices: [eserviceId] }),
      producerId: producer.id,
    };
    clients.authorizationClient.producerKeychain.getProducerKeychain = vi
      .fn()
      .mockResolvedValue(producerKeychain);
    clients.tenantProcessClient.tenant.getTenant = vi
      .fn()
      .mockResolvedValue(producer);
    clients.catalogProcessClient.getEServices = vi
      .fn()
      .mockResolvedValue({ results: [], totalCount: 0 });
    services.producerKeychainService.getProducerKeychainById =
      producerKeychainServiceBuilder(clients).getProducerKeychainById;

    const res = await makeRequest(
      generateToken(authRole.ADMIN_ROLE),
      producerKeychain.id
    );

    expect(res.status).toBe(404);
    expect(res.body).toEqual({
      type: "about:blank",
      title: "EService not found",
      status: 404,
      detail: `EService ${eserviceId} not found`,
      correlationId: res.headers["x-correlation-id"],
      errors: [
        { code: "008-0008", detail: `EService ${eserviceId} not found` },
      ],
    });
  });

  it("Should preserve the complete downstream 404 Problem", async () => {
    const problem = {
      type: "about:blank",
      title: "EService not found",
      status: 404,
      detail: "EService not found downstream",
      correlationId,
      errors: [{ code: "001-0005", detail: "EService not found downstream" }],
    };
    services.producerKeychainService.getProducerKeychainById = vi
      .fn()
      .mockRejectedValue(
        new AxiosError("Not Found", "404", undefined, undefined, {
          status: 404,
          statusText: "Not Found",
          data: problem,
          headers: {},
          config: { headers: new AxiosHeaders() },
        })
      );

    const res = await makeRequest(generateToken(authRole.ADMIN_ROLE));

    expect(res.status).toBe(404);
    expect(res.body).toEqual(problem);
  });

  it("Should keep unexpected errors as a generic 500 Problem", async () => {
    services.producerKeychainService.getProducerKeychainById = vi
      .fn()
      .mockRejectedValue(new Error("Internal failure"));

    const res = await makeRequest(generateToken(authRole.ADMIN_ROLE));

    expect(res.status).toBe(500);
    expect(res.body).toEqual({
      type: "about:blank",
      title: "Unexpected error",
      status: 500,
      detail: "Unexpected error",
      correlationId: res.headers["x-correlation-id"],
      errors: [{ code: "008-9991", detail: "Unexpected error" }],
    });
  });
});
