/* eslint-disable @typescript-eslint/no-floating-promises */
import {
  getMockContext,
  getMockEService,
  getMockTenant,
  getMockAuthData,
  randomArrayItem,
} from "pagopa-interop-commons-test";
import {
  EServiceId,
  TenantId,
  eserviceMode,
  generateId,
  tenantKind,
} from "pagopa-interop-models";
import { describe, expect, it } from "vitest";
import { getFormRulesByVersion } from "pagopa-interop-commons";
import {
  riskAnalysisConfigVersionNotFound,
  eserviceNotFound,
  tenantKindNotFound,
  tenantNotFound,
} from "../../src/model/domain/errors.js";
import {
  addOneEService,
  addOneTenant,
  purposeService,
} from "../integrationUtils.js";

describe("retrieveRiskAnalysisConfigurationByVersion", async () => {
  it("should retrieve risk analysis configuration by version (Eservice mode: deliver)", async () => {
    const mockEservice = { ...getMockEService(), mode: eserviceMode.deliver };
    const kind = randomArrayItem(Object.values(tenantKind));
    const mockTenant = {
      ...getMockTenant(),
      kind,
    };
    await addOneEService(mockEservice);
    await addOneTenant(mockTenant);

    const riskAnalysisVersion = "1.0";

    const result =
      await purposeService.retrieveRiskAnalysisConfigurationByVersion({
        eserviceId: mockEservice.id,
        riskAnalysisVersion,
        ctx: getMockContext({ authData: getMockAuthData(mockTenant.id) }),
      });

    expect(result).toEqual(getFormRulesByVersion(kind, riskAnalysisVersion));
  });
  it("should retrieve risk analysis configuration by version (Eservice mode: receive)", async () => {
    const mockEservice = { ...getMockEService(), mode: eserviceMode.receive };
    const kind = randomArrayItem(Object.values(tenantKind));
    const mockTenant = {
      ...getMockTenant(mockEservice.producerId),
      kind,
    };
    await addOneEService(mockEservice);
    await addOneTenant(mockTenant);

    const riskAnalysisVersion = "1.0";

    const result =
      await purposeService.retrieveRiskAnalysisConfigurationByVersion({
        eserviceId: mockEservice.id,
        riskAnalysisVersion,
        ctx: getMockContext({ authData: getMockAuthData(mockTenant.id) }),
      });

    expect(result).toEqual(getFormRulesByVersion(kind, riskAnalysisVersion));
  });
  it("should throw eserviceNotFound if the eservice doesn't exist", async () => {
    const mockTenant = getMockTenant();
    const randomId = generateId<EServiceId>();
    await addOneTenant(mockTenant);

    expect(
      purposeService.retrieveRiskAnalysisConfigurationByVersion({
        eserviceId: randomId,
        riskAnalysisVersion: "1.0",
        ctx: getMockContext({
          authData: getMockAuthData(mockTenant.id),
        }),
      })
    ).rejects.toThrowError(eserviceNotFound(randomId));
  });
  it("should throw tenantNotFound if the tenant doesn't exist", async () => {
    const mockEservice = { ...getMockEService(), mode: eserviceMode.deliver };
    const randomTenantId = generateId<TenantId>();
    await addOneEService(mockEservice);

    expect(
      purposeService.retrieveRiskAnalysisConfigurationByVersion({
        eserviceId: mockEservice.id,
        riskAnalysisVersion: "1.0",
        ctx: getMockContext({
          authData: getMockAuthData(randomTenantId),
        }),
      })
    ).rejects.toThrowError(tenantNotFound(randomTenantId));
  });
  it("should throw tenantKindNotFound if the tenant kind is undefined", async () => {
    const mockEservice = { ...getMockEService(), mode: eserviceMode.deliver };
    const mockTenant = {
      ...getMockTenant(),
      kind: undefined,
    };
    await addOneEService(mockEservice);
    await addOneTenant(mockTenant);

    expect(
      purposeService.retrieveRiskAnalysisConfigurationByVersion({
        eserviceId: mockEservice.id,
        riskAnalysisVersion: "1.0",
        ctx: getMockContext({
          authData: getMockAuthData(mockTenant.id),
        }),
      })
    ).rejects.toThrowError(tenantKindNotFound(mockTenant.id));
  });
  it("should throw RiskAnalysisConfigVersionNotFound if a config with that version doesn't exist", async () => {
    const mockEservice = { ...getMockEService(), mode: eserviceMode.deliver };
    const mockTenant = {
      ...getMockTenant(),
      kind: tenantKind.PA,
    };
    await addOneEService(mockEservice);
    await addOneTenant(mockTenant);

    const wrongRiskAnalysisVersion = "0.0";

    expect(
      purposeService.retrieveRiskAnalysisConfigurationByVersion({
        eserviceId: mockEservice.id,
        riskAnalysisVersion: wrongRiskAnalysisVersion,
        ctx: getMockContext({ authData: getMockAuthData(mockTenant.id) }),
      })
    ).rejects.toThrowError(
      riskAnalysisConfigVersionNotFound(
        wrongRiskAnalysisVersion,
        mockTenant.kind
      )
    );
  });
});
