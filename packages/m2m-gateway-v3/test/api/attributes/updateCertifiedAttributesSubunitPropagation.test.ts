import { m2mGatewayApiV3 } from "pagopa-interop-api-clients";
import { AuthRole, authRole } from "pagopa-interop-commons";
import { generateToken, getMockDPoPProof } from "pagopa-interop-commons-test";
import { generateId } from "pagopa-interop-models";
import request from "supertest";
import { describe, it, expect, vi } from "vitest";

import { appBasePath } from "../../../src/config/appBasePath.js";
import { api, mockAttributeService } from "../../vitest.api.setup.js";

describe("POST /certifiedAttributes/subunitPropagation/update router test", () => {
  const seed: m2mGatewayApiV3.AttributeSubunitPropagationUpdateSeed = {
    attributeIds: [generateId()],
  };

  const makeRequest = async (token: string, body: object) =>
    request(api)
      .post(`${appBasePath}/certifiedAttributes/subunitPropagation/update`)
      .set("Authorization", `DPoP ${token}`)
      .set("DPoP", (await getMockDPoPProof()).dpopProofJWS)
      .send(body);

  const authorizedRoles: AuthRole[] = [authRole.M2M_ADMIN_ROLE];
  it.each(authorizedRoles)(
    "Should return 200 and perform service calls for user with role %s",
    async (role) => {
      mockAttributeService.updateCertifiedAttributesSubunitPropagation =
        vi.fn();

      const token = generateToken(role);
      const res = await makeRequest(token, seed);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({});
      expect(
        mockAttributeService.updateCertifiedAttributesSubunitPropagation
      ).toHaveBeenCalledWith(seed, expect.any(Object)); // context
    }
  );

  it.each(
    Object.values(authRole).filter((role) => !authorizedRoles.includes(role))
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken(role);
    const res = await makeRequest(token, seed);
    expect(res.status).toBe(403);
  });

  it.each([
    {},
    { attributeIds: ["INVALID ID"] },
    { attributeIds: [generateId(), generateId()] },
    { ...seed, invalidParam: "invalidValue" },
  ])("Should return 400 if passed an invalid seed: %s", async (body) => {
    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(token, body);
    expect(res.status).toBe(400);
  });
});
