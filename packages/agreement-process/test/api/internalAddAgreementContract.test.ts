/* eslint-disable @typescript-eslint/explicit-function-return-type */
import {
  generateToken,
  getMockAgreement,
  getMockWithMetadata,
} from "pagopa-interop-commons-test";
import {
  Agreement,
  AgreementId,
  AgreementDocument,
  generateId,
} from "pagopa-interop-models";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthRole, authRole } from "pagopa-interop-commons";
import request from "supertest";
import { api, agreementService } from "../vitest.api.setup.js";
import { agreementNotFound } from "../../src/model/domain/errors.js";

const mockAgreementContract: AgreementDocument = {
  id: generateId(),
  path: "some/path/to/agreement-contract.pdf",
  contentType: "application/pdf",
  name: "name",
  prettyName: "agreement-contract.pdf",
  createdAt: new Date(),
};

describe("API POST /internal/agreement/:agreementId/contract test", () => {
  const mockAgreement: Agreement = getMockAgreement();
  const serviceResponse = getMockWithMetadata(mockAgreement);

  beforeEach(() => {
    agreementService.internalAddAgreementContract = vi
      .fn()
      .mockResolvedValue(serviceResponse);
  });

  const makeRequest = async (
    token: string,
    agreementId: AgreementId = mockAgreement.id,
    payload: AgreementDocument = mockAgreementContract
  ) =>
    request(api)
      .post(`/internal/agreement/${agreementId}/contract`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send(payload);

  const authorizedRoles: AuthRole[] = [authRole.INTERNAL_ROLE];

  it.each(authorizedRoles)(
    "Should return 204 for user with role %s on successful contract add",
    async (role) => {
      const token = generateToken(role);
      const res = await makeRequest(token);

      expect(
        agreementService.internalAddAgreementContract
      ).toHaveBeenCalledWith(
        mockAgreement.id,
        mockAgreementContract,
        expect.anything()
      );
      expect(res.status).toBe(204);
      expect(res.body).toEqual({});
      expect(res.headers["x-metadata-version"]).toBe(
        serviceResponse.metadata.version.toString()
      );
    }
  );

  it.each(
    Object.values(authRole).filter((role) => !authorizedRoles.includes(role))
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken(role);
    const res = await makeRequest(token);
    expect(res.status).toBe(403);
  });

  it.each([
    {
      error: agreementNotFound(mockAgreement.id),
      expectedStatus: 404,
      description: "agreementNotFound",
    },
  ])(
    "Should return $expectedStatus for $description error",
    async ({ error, expectedStatus }) => {
      agreementService.internalAddAgreementContract = vi
        .fn()
        .mockRejectedValue(error);
      const token = generateToken(authRole.INTERNAL_ROLE);
      const res = await makeRequest(token);
      expect(res.status).toBe(expectedStatus);
    }
  );

  it("Should return 400 if passed an invalid agreement id", async () => {
    const token = generateToken(authRole.INTERNAL_ROLE);
    const res = await makeRequest(token, "invalid" as AgreementId);
    expect(res.status).toBe(400);
  });

  it("Should return 400 if passed an invalid contract document payload", async () => {
    const token = generateToken(authRole.INTERNAL_ROLE);
    const invalidPayload = {
      id: generateId(),
      contentType: "application/pdf",
      name: "name",
      createdAt: new Date(),
    } as unknown as AgreementDocument;

    const res = await makeRequest(token, mockAgreement.id, invalidPayload);
    expect(res.status).toBe(400);
  });
});
