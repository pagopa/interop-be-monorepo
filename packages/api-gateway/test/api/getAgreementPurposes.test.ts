/* eslint-disable functional/immutable-data */
/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi } from "vitest";
import { generateToken } from "pagopa-interop-commons-test";
import { AuthRole, authRole } from "pagopa-interop-commons";
import request from "supertest";
import { agreementApi, apiGatewayApi } from "pagopa-interop-api-clients";
import { generateId } from "pagopa-interop-models";
import { api, mockAgreementService } from "../vitest.api.setup.js";
import { appBasePath } from "../../src/config/appBasePath.js";
import { agreementNotFound } from "../../src/models/errors.js";

describe("GET /agreements/:agreementId/purposes route test", () => {
  const agreementId: agreementApi.Agreement["id"] = generateId();

  const purpose: apiGatewayApi.Purpose = {
    id: generateId(),
    throughput: 10,
    state: "ACTIVE",
  };

  const purposes: apiGatewayApi.Purposes = {
    purposes: [purpose],
  };

  const makeRequest = async (
    token: string,
    id: agreementApi.Agreement["id"] = agreementId
  ) =>
    request(api)
      .get(`${appBasePath}/agreements/${id}/purposes`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId());

  const authorizedRoles: AuthRole[] = [authRole.M2M_ROLE];

  it.each(authorizedRoles)(
    "Should return 200 and perform service calls for user with role %s",
    async (role) => {
      mockAgreementService.getAgreementPurposes = vi
        .fn()
        .mockResolvedValue(purposes);

      const token = generateToken(role);
      const res = await makeRequest(token);

      expect(res.status).toBe(200);
      expect(res.body).toEqual(purposes);
    }
  );

  it.each(
    Object.values(authRole).filter((role) => !authorizedRoles.includes(role))
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken(role);
    const res = await makeRequest(token);
    expect(res.status).toBe(403);
  });

  it("Should return 400 if agreementId is not a valid UUID", async () => {
    const token = generateToken(authRole.M2M_ROLE);
    const res = await makeRequest(token, "not-a-uuid");
    expect(res.status).toBe(400);
  });

  it("Should return 404 if agreement is not found", async () => {
    // eslint-disable-next-line functional/immutable-data
    mockAgreementService.getAgreementPurposes = vi
      .fn()
      .mockRejectedValue(agreementNotFound(agreementId));

    const token = generateToken(authRole.M2M_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(404);
  });

  it.each([
    {
      purposes: [
        {
          ...purpose,
          id: "not-a-uuid",
        },
      ],
    },
    {
      purposes: [
        {
          ...purpose,
          throughput: "not-a-number",
        },
      ],
    },
    {
      purposes: [
        {
          ...purpose,
          state: "INVALID-STATE",
        },
      ],
    },
  ])(
    "Should return 500 when API model parsing fails for response %s",
    async (resp) => {
      // eslint-disable-next-line functional/immutable-data
      mockAgreementService.getAgreementPurposes = vi
        .fn()
        .mockResolvedValue(resp);
      const token = generateToken(authRole.M2M_ROLE);
      const res = await makeRequest(token);

      expect(res.status).toBe(500);
    }
  );
});
