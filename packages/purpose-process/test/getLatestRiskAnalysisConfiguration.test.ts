/* eslint-disable @typescript-eslint/no-floating-promises */
import {
  getMockTenant,
  writeInReadmodel,
} from "pagopa-interop-commons-test/index.js";
import {
  TenantId,
  TenantKind,
  generateId,
  tenantKind,
  toReadModelTenant,
} from "pagopa-interop-models";
import { describe, expect, it } from "vitest";
import {
  genericLogger,
  getLatestVersionFormRules,
} from "pagopa-interop-commons";
import {
  tenantKindNotFound,
  tenantNotFound,
  riskAnalysisConfigLatestVersionNotFound,
} from "../src/model/domain/errors.js";
import { tenants, purposeService } from "./utils.js";

describe("retrieveLatestRiskAnalysisConfiguration", async () => {
  it.each(Object.values(tenantKind))(
    "should retrieve latest risk analysis configuration for kind %s",
    async (kind) => {
      const mockTenant = {
        ...getMockTenant(),
        kind,
      };
      await writeInReadmodel(toReadModelTenant(mockTenant), tenants);

      const result =
        await purposeService.retrieveLatestRiskAnalysisConfiguration({
          tenantKind: kind,
          organizationId: mockTenant.id,
          logger: genericLogger,
        });

      expect(result).toEqual(getLatestVersionFormRules(kind));
    }
  );
  it("should throw tenantNotFound if the tenant doesn't exist", async () => {
    const randomId = generateId<TenantId>();

    expect(
      purposeService.retrieveLatestRiskAnalysisConfiguration({
        tenantKind: undefined,
        organizationId: randomId,
        logger: genericLogger,
      })
    ).rejects.toThrowError(tenantNotFound(randomId));
  });
  it("should throw tenantKindNotFound if the tenant kind is undefined", async () => {
    const mockTenant = {
      ...getMockTenant(),
      kind: undefined,
    };
    await writeInReadmodel(toReadModelTenant(mockTenant), tenants);

    expect(
      purposeService.retrieveLatestRiskAnalysisConfiguration({
        tenantKind: undefined,
        organizationId: mockTenant.id,
        logger: genericLogger,
      })
    ).rejects.toThrowError(tenantKindNotFound(mockTenant.id));
  });
  it("should throw riskAnalysisConfigLatestVersionNotFound if a config with that kind doesn't exist", async () => {
    const mockTenant = {
      ...getMockTenant(),
      kind: tenantKind.PA,
    };
    await writeInReadmodel(toReadModelTenant(mockTenant), tenants);

    const kind = "unkown" as TenantKind;

    expect(
      purposeService.retrieveLatestRiskAnalysisConfiguration({
        tenantKind: kind,
        organizationId: mockTenant.id,
        logger: genericLogger,
      })
    ).rejects.toThrowError(riskAnalysisConfigLatestVersionNotFound(kind));
  });
});
