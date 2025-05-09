/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { generateId } from "pagopa-interop-models";
import request from "supertest";
import { generateToken } from "pagopa-interop-commons-test/index.js";
import { authRole } from "pagopa-interop-commons";
import { api, clients } from "../../vitest.api.setup.js";
import {
  getMockApiAgreement,
  getMockApiAgreementRejectionPayload,
} from "../../mockUtils.js";
import { appBasePath } from "../../../src/config/appBasePath.js";

describe("API POST /agreements/:agreementId/archive", () => {
  const mockApiAgreement = getMockApiAgreement();
  const mockPayload = getMockApiAgreementRejectionPayload();

  const makeRequest = async (
    token: string,
    agreementId = mockApiAgreement.id
  ) =>
    request(api)
      .post(`${appBasePath}/agreements/${agreementId}/archive`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send(mockPayload);

  beforeEach(() => {
    clients.agreementProcessClient.archiveAgreement = vi
      .fn()
      .mockResolvedValue(undefined);
  });

  it("Should return 200 if no error is thrown", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(204);
  });

  it("Should return 400 if passed an invalid parameter", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, "invalid");
    expect(res.status).toBe(400);
  });
});
