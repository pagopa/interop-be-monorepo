/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AgreementId, generateId } from "pagopa-interop-models";
import request from "supertest";
import { generateToken } from "pagopa-interop-commons-test/index.js";
import { authRole } from "pagopa-interop-commons";
import { bffApi } from "pagopa-interop-api-clients";
import { services, api } from "../../vitest.api.setup.js";
import {
  getMockBffApiAgreement,
  getMockBffApiAgreementRejectionPayload,
} from "../../mockUtils.js";
import { appBasePath } from "../../../src/config/appBasePath.js";

describe("API POST /agreements/:agreementId/reject", () => {
  const mockApiAgreement = getMockBffApiAgreement();
  const mockAgreementRejectionPayload =
    getMockBffApiAgreementRejectionPayload();

  beforeEach(() => {
    services.agreementService.rejectAgreement = vi
      .fn()
      .mockResolvedValue(mockApiAgreement);
  });

  const makeRequest = async (
    token: string,
    agreementId: AgreementId = mockApiAgreement.id,
    body: bffApi.AgreementRejectionPayload = mockAgreementRejectionPayload
  ) =>
    request(api)
      .post(`${appBasePath}/agreements/${agreementId}/reject`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send(body);

  it("Should return 200 if no error is thrown", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(mockApiAgreement);
  });

  it.each([
    { agreementId: "invalid" as AgreementId },
    { body: {} },
    { body: { ...mockAgreementRejectionPayload, extraField: 1 } },
  ])(
    "Should return 400 if passed an invalid parameter",
    async ({ agreementId, body }) => {
      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(
        token,
        agreementId,
        body as bffApi.AgreementRejectionPayload
      );
      expect(res.status).toBe(400);
    }
  );
});
