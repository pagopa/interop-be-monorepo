/* eslint-disable @typescript-eslint/no-floating-promises */
import {
  getMockContext,
  getMockTenant,
  getMockAuthData,
} from "pagopa-interop-commons-test";
import {
  TenantId,
  TenantKind,
  generateId,
  tenantKind,
} from "pagopa-interop-models";
import { describe, expect, it } from "vitest";
import { getLatestVersionFormRules } from "pagopa-interop-commons";
import {
  tenantKindNotFound,
  tenantNotFound,
  riskAnalysisConfigLatestVersionNotFound,
} from "../src/model/domain/errors.js";
import { purposeService, addOneTenant } from "./utils.js";

describe("retrieveLatestRiskAnalysisConfiguration", async () => {
  it.each(Object.values(tenantKind))(
    "should retrieve latest risk analysis configuration for kind %s",
    async (kind) => {
      const mockTenant = {
        ...getMockTenant(),
        kind,
      };
      await addOneTenant(mockTenant);

      const result =
        await purposeService.retrieveLatestRiskAnalysisConfiguration({
          tenantKind: kind,
          ctx: getMockContext({
            authData: getMockAuthData(mockTenant.id),
          }),
        });

      expect(result).toEqual(getLatestVersionFormRules(kind));
    }
  );
  it("should throw tenantNotFound if the tenant doesn't exist", async () => {
    const randomTenantId = generateId<TenantId>();

    expect(
      purposeService.retrieveLatestRiskAnalysisConfiguration({
        tenantKind: undefined,
        ctx: getMockContext({ authData: getMockAuthData(randomTenantId) }),
      })
    ).rejects.toThrowError(tenantNotFound(randomTenantId));
  });
  it("should throw tenantKindNotFound if the tenant kind is undefined", async () => {
    const mockTenant = {
      ...getMockTenant(),
      kind: undefined,
    };
    await addOneTenant(mockTenant);

    expect(
      purposeService.retrieveLatestRiskAnalysisConfiguration({
        tenantKind: undefined,
        ctx: getMockContext({ authData: getMockAuthData(mockTenant.id) }),
      })
    ).rejects.toThrowError(tenantKindNotFound(mockTenant.id));
  });
  it("should throw riskAnalysisConfigLatestVersionNotFound if a config with that kind doesn't exist", async () => {
    const mockTenant = {
      ...getMockTenant(),
      kind: tenantKind.PA,
    };
    await addOneTenant(mockTenant);

    const kind = "unknown" as TenantKind;

    expect(
      purposeService.retrieveLatestRiskAnalysisConfiguration({
        tenantKind: kind,
        ctx: getMockContext({
          authData: getMockAuthData(mockTenant.id),
        }),
      })
    ).rejects.toThrowError(riskAnalysisConfigLatestVersionNotFound(kind));
  });
});
