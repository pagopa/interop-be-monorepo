/* eslint-disable @typescript-eslint/explicit-function-return-type */
import {
  generateToken,
  getMockDelegation,
  getMockWithMetadata,
} from "pagopa-interop-commons-test";
import {
  Delegation,
  DelegationId,
  delegationKind,
  generateId,
  DelegationContractDocument,
  DelegationContractId,
} from "pagopa-interop-models";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthRole, authRole } from "pagopa-interop-commons";
import request from "supertest";
import { api, delegationService } from "../vitest.api.setup.js";
import { delegationNotFound } from "../../src/model/domain/errors.js";

const mockDelegationContract: DelegationContractDocument = {
  id: generateId<DelegationContractId>(),
  path: "some/path/to/contract.pdf",
  contentType: "application/pdf",
  name: "name",
  prettyName: "contract.pdf",
  createdAt: new Date(),
};

describe("API POST /internal/delegations/:delegationId/contract test", () => {
  const mockDelegation: Delegation = getMockDelegation({
    kind: delegationKind.delegatedProducer,
  });
  const serviceResponse = getMockWithMetadata(mockDelegation);

  beforeEach(() => {
    delegationService.internalAddDelegationContract = vi
      .fn()
      .mockResolvedValue(serviceResponse);
  });

  const makeRequest = async (
    token: string,
    delegationId: DelegationId = mockDelegation.id,
    payload: DelegationContractDocument = mockDelegationContract
  ) =>
    request(api)
      .post(`/internal/delegations/${delegationId}/contract`)
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
        delegationService.internalAddDelegationContract
      ).toHaveBeenCalledWith(
        mockDelegation.id,
        mockDelegationContract,
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
      error: delegationNotFound(mockDelegation.id),
      expectedStatus: 404,
      description: "delegationNotFound",
    },
  ])(
    "Should return $expectedStatus for $description error",
    async ({ error, expectedStatus }) => {
      delegationService.internalAddDelegationContract = vi
        .fn()
        .mockRejectedValue(error);
      const token = generateToken(authRole.INTERNAL_ROLE);
      const res = await makeRequest(token);
      expect(res.status).toBe(expectedStatus);
    }
  );

  it("Should return 400 if passed an invalid delegation id", async () => {
    const token = generateToken(authRole.INTERNAL_ROLE);
    const res = await makeRequest(token, "invalid" as DelegationId);
    expect(res.status).toBe(400);
  });

  it("Should return 400 if passed an invalid contract document payload", async () => {
    const token = generateToken(authRole.INTERNAL_ROLE);
    const invalidPayload = {
      id: generateId(),
      contentType: "application/pdf",
      fileName: "contract.pdf",
      uploadDate: new Date(),
    } as unknown as DelegationContractDocument;

    const res = await makeRequest(token, mockDelegation.id, invalidPayload);
    expect(res.status).toBe(400);
  });
});
