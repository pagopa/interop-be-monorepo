/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { generateId } from "pagopa-interop-models";
import request from "supertest";
import { generateToken } from "pagopa-interop-commons-test/index.js";
import { authRole } from "pagopa-interop-commons";
import { api, clients } from "../../vitest.api.setup.js";
import {
  getMockApiAgreement,
  getMockApiCreatedResource,
} from "../../mockUtils.js";
import { appBasePath } from "../../../src/config/appBasePath.js";

describe("API POST /agreements/:agreementId/clone", () => {
  const mockApiAgreement = getMockApiAgreement();
  const mockApiCreatedResource = getMockApiCreatedResource(mockApiAgreement.id);

  const makeRequest = async (
    token: string,
    agreementId: string = mockApiAgreement.id
  ) =>
    request(api)
      .post(`${appBasePath}/agreements/${agreementId}/clone`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send();

  beforeEach(() => {
    clients.agreementProcessClient.cloneAgreement = vi
      .fn()
      .mockResolvedValue(mockApiAgreement);
  });

  it("Should return 200 if no error is thrown", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(mockApiCreatedResource);
  });

  // TODO: why doesn't this method have a 404 error?
  // I can see it in the api, but not in the error mapper

  it("Should return 400 if passed an invalid parameter", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, "invalid");
    expect(res.status).toBe(400);
  });
});
