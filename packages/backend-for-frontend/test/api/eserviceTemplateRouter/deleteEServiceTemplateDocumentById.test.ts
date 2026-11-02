/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { authRole } from "pagopa-interop-commons";
import { generateToken } from "pagopa-interop-commons-test";
import {
  EServiceTemplateId,
  EServiceTemplateVersionId,
  generateId,
} from "pagopa-interop-models";
import request from "supertest";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { appBasePath } from "../../../src/config/appBasePath.js";
import { api, clients } from "../../vitest.api.setup.js";

describe("API DELETE /eservices/templates/:eServiceTemplateId/versions/:eServiceTemplateVersionId/documents/:documentId", () => {
  beforeEach(() => {
    clients.eserviceTemplateProcessClient.deleteEServiceTemplateDocumentById =
      vi.fn().mockResolvedValue(undefined);
  });

  const makeRequest = async (
    token: string,
    eServiceTemplateId: EServiceTemplateId = generateId(),
    eServiceTemplateVersionId: EServiceTemplateVersionId = generateId(),
    documentId: string = generateId()
  ) =>
    request(api)
      .delete(
        `${appBasePath}/eservices/templates/${eServiceTemplateId}/versions/${eServiceTemplateVersionId}/documents/${documentId}`
      )
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId());

  it("Should return 204 for user with role Admin", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(204);
  });

  it.each([
    { eServiceTemplateId: "invalid" as EServiceTemplateId },
    { eServiceTemplateVersionId: "invalid" as EServiceTemplateVersionId },
  ])(
    "Should return 400 if passed invalid data: %s",
    async ({ eServiceTemplateId, eServiceTemplateVersionId }) => {
      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(
        token,
        eServiceTemplateId,
        eServiceTemplateVersionId
      );
      expect(res.status).toBe(400);
    }
  );
});
