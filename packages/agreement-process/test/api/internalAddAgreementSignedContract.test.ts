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
  AgreementSignedContract,
  agreementState,
} from "pagopa-interop-models";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthRole, authRole } from "pagopa-interop-commons";
import request from "supertest";
import { api, agreementService } from "../vitest.api.setup.js";
import {
  agreementNotFound,
  agreementNotInExpectedState,
} from "../../src/model/domain/errors.js";

const mockAgreementContract: AgreementSignedContract = {
  id: generateId(),
  path: "some/path/to/signed-contract.pdf",
  contentType: "application/pdf",
  name: "name",
  prettyName: "signed-contract.pdf",
  createdAt: new Date(),
  signedAt: new Date(),
};

describe("API POST /internal/agreement/:agreementId/signedContract test", () => {
  const mockAgreement: Agreement = getMockAgreement();
  const serviceResponse = getMockWithMetadata(mockAgreement);

  beforeEach(() => {
    agreementService.internalAddAgreementSignedContract = vi
      .fn()
      .mockResolvedValue(serviceResponse);
  });

  const makeRequest = async (
    token: string,
    agreementId: AgreementId = mockAgreement.id,
    payload: AgreementSignedContract = mockAgreementContract,
  ) =>
    request(api)
      .post(`/internal/agreement/${agreementId}/signedContract`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send(payload);

  const authorizedRoles: AuthRole[] = [authRole.INTERNAL_ROLE];

  it.each(authorizedRoles)(
    "Should return 204 for user with role %s on successful signed contract add",
    async (role) => {
      const token = generateToken(role);
      const res = await makeRequest(token);

      expect(
        agreementService.internalAddAgreementSignedContract,
      ).toHaveBeenCalledWith(
        mockAgreement.id,
        mockAgreementContract,
        expect.anything(),
      );
      expect(res.status).toBe(204);
      expect(res.body).toEqual({});
    },
  );

  it.each(
    Object.values(authRole).filter((role) => !authorizedRoles.includes(role)),
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
    {
      error: agreementNotInExpectedState(
        mockAgreement.id,
        agreementState.draft,
      ),
      expectedStatus: 400,
    },
  ])(
    "Should return $expectedStatus for $description error",
    async ({ error, expectedStatus }) => {
      agreementService.internalAddAgreementSignedContract = vi
        .fn()
        .mockRejectedValue(error);
      const token = generateToken(authRole.INTERNAL_ROLE);
      const res = await makeRequest(token);
      expect(res.status).toBe(expectedStatus);
    },
  );

  it("Should return 400 if passed an invalid agreement id", async () => {
    const token = generateToken(authRole.INTERNAL_ROLE);
    const res = await makeRequest(token, "invalid" as AgreementId);
    expect(res.status).toBe(400);
  });

  it("Should return 400 if passed an invalid contract document payload (missing path/prettyName)", async () => {
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
