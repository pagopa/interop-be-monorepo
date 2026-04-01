import { describe, expect, it, vi } from "vitest";
import { getMockAuthData, getMockContext } from "pagopa-interop-commons-test";
import { genericLogger } from "pagopa-interop-commons";
import {
  bffApi,
  selfcareV2ClientApi,
  SelfcareV2InstitutionClient,
  SelfcareV2UsersClient,
} from "pagopa-interop-api-clients";
import type { PagoPAInteropBeClients } from "../src/clients/clientsProvider.js";
import { selfcareServiceBuilder } from "../src/services/selfcareService.js";

describe("selfcareService", () => {
  it("should skip incomplete institutions instead of failing the whole response", async () => {
    const v2getUserInstitution =
      vi.fn<SelfcareV2UsersClient["v2getUserInstitution"]>();
    const warn = vi.fn();

    const clients = {
      selfcareV2UserClient: {
        v2getUserInstitution,
      } as unknown as SelfcareV2UsersClient,
      selfcareV2InstitutionClient: {} as unknown as SelfcareV2InstitutionClient,
      tenantProcessClient: {
        tenant: {},
        tenantAttribute: {},
        selfcare: {},
      },
    } as unknown as PagoPAInteropBeClients;

    const service = selfcareServiceBuilder(clients);
    const authData = getMockAuthData();
    const baseContext = getMockContext({ authData });
    const ctx = {
      ...baseContext,
      headers: {
        "X-Correlation-Id": baseContext.correlationId,
        Authorization: "authorization",
        "X-Forwarded-For": "x-forwarded-for",
      },
      logger: {
        ...genericLogger,
        warn,
        info: vi.fn(),
        error: vi.fn(),
      },
    };

    const validInstitution: selfcareV2ClientApi.UserInstitutionResource = {
      userId: authData.userId,
      institutionId: authData.organizationId,
      institutionDescription: "Valid institution",
      products: [{ productRole: "ADMIN" }],
    };
    const invalidInstitution: selfcareV2ClientApi.UserInstitutionResource = {
      userId: authData.userId,
      institutionId: authData.organizationId,
      products: [{ productRole: "LIMITED" }],
    };

    const expectedInstitution: bffApi.SelfcareInstitution = {
      id: authData.organizationId,
      description: "Valid institution",
      userProductRoles: ["ADMIN"],
    };

    v2getUserInstitution.mockResolvedValue([
      validInstitution,
      invalidInstitution,
    ]);

    const result = await service.getSelfcareInstitutions(ctx);

    expect(result).toEqual([expectedInstitution]);
    expect(warn).toHaveBeenCalledOnce();
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("Skipping incomplete selfcare institution")
    );
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("institutionDescription")
    );
  });
});
