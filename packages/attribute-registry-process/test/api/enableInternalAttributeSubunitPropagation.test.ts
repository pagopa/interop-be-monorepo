/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { authRole } from "pagopa-interop-commons";
import { generateToken } from "pagopa-interop-commons-test";
import { generateId } from "pagopa-interop-models";
import request from "supertest";
import { describe, it, expect, vi } from "vitest";

import { attributeNotFound } from "../../src/model/domain/errors.js";
import { api, attributeRegistryService } from "../vitest.api.setup.js";

describe("API POST /internal/certifiedAttributes/{attributeId}/subunitPropagation/enable", () => {
  const attributeId = generateId();

  const makeRequest = async (token: string, id: string = attributeId) =>
    request(api)
      .post(`/internal/certifiedAttributes/${id}/subunitPropagation/enable`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId());

  it("Should return 204 for user with role Internal", async () => {
    attributeRegistryService.internalEnableAttributeSubunitPropagation = vi
      .fn()
      .mockResolvedValue(undefined);

    const res = await makeRequest(generateToken(authRole.INTERNAL_ROLE));

    expect(res.status).toBe(204);
    expect(
      attributeRegistryService.internalEnableAttributeSubunitPropagation
    ).toHaveBeenCalledWith(attributeId, expect.anything());
  });

  it.each(
    Object.values(authRole).filter((role) => role !== authRole.INTERNAL_ROLE)
  )("Should return 403 for user with role %s", async (role) => {
    const res = await makeRequest(generateToken(role));
    expect(res.status).toBe(403);
  });

  it("Should return 404 if the attribute does not exist", async () => {
    attributeRegistryService.internalEnableAttributeSubunitPropagation = vi
      .fn()
      .mockRejectedValue(attributeNotFound(attributeId));

    const res = await makeRequest(generateToken(authRole.INTERNAL_ROLE));

    expect(res.status).toBe(404);
  });
});
