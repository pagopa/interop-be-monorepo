import { describe, it, expect, vi } from "vitest";
import { generateToken } from "pagopa-interop-commons-test";
import { AuthRole, authRole } from "pagopa-interop-commons";
import request from "supertest";
import { generateId, PurposeId } from "pagopa-interop-models";
import { purposeApi } from "pagopa-interop-api-clients";
import { api, mockPurposeService } from "../../vitest.api.setup.js";
import { appBasePath } from "../../../src/config/appBasePath.js";
import {
  missingPurposeVersionWithState,
  missingMetadata,
  resourcePollingTimeout,
} from "../../../src/model/errors.js";

describe("POST /purposes/:purposeId/activate router test", () => {
  const makeRequest = async (token: string, purposeId: string) =>
    request(api)
      .post(`${appBasePath}/purposes/${purposeId}/activate`)
      .set("Authorization", `Bearer ${token}`);

  const authorizedRoles: AuthRole[] = [authRole.M2M_ADMIN_ROLE];
  it.each(authorizedRoles)(
    "Should return 204 and perform service calls for user with role %s",
    async (role) => {
      mockPurposeService.activateDraftPurpose = vi.fn();

      const token = generateToken(role);
      const res = await makeRequest(token, generateId());

      expect(res.status).toBe(204);
    }
  );

  it("Should return 409 for missing draft purpose version", async () => {
    mockPurposeService.activateDraftPurpose = vi
      .fn()
      .mockRejectedValue(
        missingPurposeVersionWithState(
          generateId<PurposeId>(),
          purposeApi.PurposeVersionState.Enum.DRAFT
        )
      );

    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(token, generateId());
    expect(res.status).toBe(409);
  });

  it("Should return 400 for invalid purpose id", async () => {
    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(token, "INVALID_ID");
    expect(res.status).toBe(400);
  });

  it.each(
    Object.values(authRole).filter((role) => !authorizedRoles.includes(role))
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken(role);
    const res = await makeRequest(token, generateId());
    expect(res.status).toBe(403);
  });

  it.each([missingMetadata(), resourcePollingTimeout(3)])(
    "Should return 500 in case of $code error",
    async (error) => {
      mockPurposeService.activateDraftPurpose = vi
        .fn()
        .mockRejectedValue(error);
      const token = generateToken(authRole.M2M_ADMIN_ROLE);
      const res = await makeRequest(token, generateId());

      expect(res.status).toBe(500);
    }
  );
});
