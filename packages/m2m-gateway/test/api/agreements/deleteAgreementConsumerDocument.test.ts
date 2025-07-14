import { describe, it, expect, vi } from "vitest";
import { generateToken } from "pagopa-interop-commons-test";
import { AuthRole, authRole } from "pagopa-interop-commons";
import request from "supertest";
import { generateId } from "pagopa-interop-models";
import { api, mockAgreementService } from "../../vitest.api.setup.js";
import { appBasePath } from "../../../src/config/appBasePath.js";

describe("DELETE /agreements/:agreementId/consumerDocuments/:documentId router test", () => {
  const agreementId = generateId();
  const documentId = generateId();

  const makeRequest = async (
    token: string,
    agreementId: string,
    documentId: string
  ) =>
    request(api)
      .delete(
        `${appBasePath}/agreements/${agreementId}/consumerDocuments/${documentId}`
      )
      .set("Authorization", `Bearer ${token}`);

  const authorizedRoles: AuthRole[] = [authRole.M2M_ADMIN_ROLE];

  it.each(authorizedRoles)(
    "Should return 204 and perform service calls for user with role %s",
    async (role) => {
      mockAgreementService.deleteAgreementConsumerDocument = vi
        .fn()
        .mockResolvedValue(undefined);
      const token = generateToken(role);
      const res = await makeRequest(token, agreementId, documentId);
      expect(res.status).toBe(204);
      expect(
        mockAgreementService.deleteAgreementConsumerDocument
      ).toHaveBeenCalledWith(agreementId, documentId, expect.any(Object));
    }
  );

  it.each(
    Object.values(authRole).filter((role) => !authorizedRoles.includes(role))
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken(role);
    const res = await makeRequest(token, agreementId, documentId);
    expect(res.status).toBe(403);
  });

  it("Should return 400 for incorrect value for agreement id", async () => {
    mockAgreementService.deleteAgreementConsumerDocument = vi
      .fn()
      .mockResolvedValue(undefined);
    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(token, "INVALID ID", documentId);
    expect(res.status).toBe(400);
  });

  it("Should return 400 for incorrect value for document id", async () => {
    mockAgreementService.deleteAgreementConsumerDocument = vi
      .fn()
      .mockResolvedValue(undefined);
    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(token, agreementId, "INVALID ID");
    expect(res.status).toBe(400);
  });
});
