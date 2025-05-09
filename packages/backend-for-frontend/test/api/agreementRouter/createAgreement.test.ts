/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { generateId } from "pagopa-interop-models";
import request from "supertest";
import { bffApi } from "pagopa-interop-api-clients";
import { generateToken } from "pagopa-interop-commons-test/index.js";
import { authRole } from "pagopa-interop-commons";
import { api, clients } from "../../vitest.api.setup.js";
import {
  getMockApiAgreement,
  getMockApiAgreementPayload,
  getMockApiCreatedResource,
} from "../../mockUtils.js";
import { appBasePath } from "../../../src/config/appBasePath.js";

describe("API POST /agreements", () => {
  const mockAgreementPayload: bffApi.AgreementPayload =
    getMockApiAgreementPayload();
  const mockApiAgreement = getMockApiAgreement();
  const mockApiCreatedResource: bffApi.CreatedResource =
    getMockApiCreatedResource(mockApiAgreement.id);

  const makeRequest = async (token: string, payload = mockAgreementPayload) =>
    request(api)
      .post(`${appBasePath}/agreements`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send(payload);

  beforeEach(() => {
    clients.agreementProcessClient.createAgreement = vi
      .fn()
      .mockResolvedValue(mockApiAgreement);
  });

  it("Should return 200 if no error is thrown", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(mockApiCreatedResource);
  });

  it("Should return 400 if passed an invalid parameter", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, {
      ...mockAgreementPayload,
      eserviceId: "invalid",
    });
    expect(res.status).toBe(400);
  });
});
