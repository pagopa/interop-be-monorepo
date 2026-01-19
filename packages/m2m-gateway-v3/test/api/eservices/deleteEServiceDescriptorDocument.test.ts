import { describe, it, expect, vi } from "vitest";
import { generateToken } from "pagopa-interop-commons-test";
import { AuthRole, authRole } from "pagopa-interop-commons";
import request from "supertest";
import { generateId } from "pagopa-interop-models";
import { api, mockEserviceService } from "../../vitest.api.setup.js";
import { appBasePath } from "../../../src/config/appBasePath.js";

describe("DELETE /eservices/:eserviceId/descriptors/:descriptorId/documents/:documentId router test", () => {
  const eserviceId = generateId();
  const descriptorId = generateId();
  const documentId = generateId();

  const makeRequest = async (
    token: string,
    eserviceId: string,
    descriptorId: string,
    documentId: string
  ) =>
    request(api)
      .delete(
        `${appBasePath}/eservices/${eserviceId}/descriptors/${descriptorId}/documents/${documentId}`
      )
      .set("Authorization", `Bearer ${token}`);

  const authorizedRoles: AuthRole[] = [authRole.M2M_ADMIN_ROLE];

  it.each(authorizedRoles)(
    "Should return 204 and perform service calls for user with role %s",
    async (role) => {
      mockEserviceService.deleteEServiceDescriptorDocument = vi
        .fn()
        .mockResolvedValue(undefined);
      const token = generateToken(role);
      const res = await makeRequest(
        token,
        eserviceId,
        descriptorId,
        documentId
      );
      expect(res.status).toBe(204);
      expect(
        mockEserviceService.deleteEServiceDescriptorDocument
      ).toHaveBeenCalledWith(
        eserviceId,
        descriptorId,
        documentId,
        expect.any(Object)
      );
    }
  );

  it.each(
    Object.values(authRole).filter((role) => !authorizedRoles.includes(role))
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken(role);
    const res = await makeRequest(token, eserviceId, descriptorId, documentId);
    expect(res.status).toBe(403);
  });

  it("Should return 400 for incorrect value for eservice id", async () => {
    mockEserviceService.deleteEServiceDescriptorDocument = vi
      .fn()
      .mockResolvedValue(undefined);
    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(
      token,
      "INVALID ID",
      descriptorId,
      documentId
    );
    expect(res.status).toBe(400);
  });

  it("Should return 400 for incorrect value for descriptor id", async () => {
    mockEserviceService.deleteEServiceDescriptorDocument = vi
      .fn()
      .mockResolvedValue(undefined);
    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(token, eserviceId, "INVALID ID", documentId);
    expect(res.status).toBe(400);
  });

  it("Should return 400 for incorrect value for document id", async () => {
    mockEserviceService.deleteEServiceDescriptorDocument = vi
      .fn()
      .mockResolvedValue(undefined);
    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(
      token,
      eserviceId,
      descriptorId,
      "INVALID ID"
    );
    expect(res.status).toBe(400);
  });
});
