/* eslint-disable @typescript-eslint/no-explicit-any */

import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import {
  getMockTenant,
  getMockAttribute,
  getMockCertifiedTenantAttribute,
} from "pagopa-interop-commons-test";
import {
  Tenant,
  Attribute,
  attributeKind,
  generateId,
  SCP,
  CorrelationId,
} from "pagopa-interop-models";
import { genericLogger } from "pagopa-interop-commons";
import { importAttributes } from "../src/service/processor.js";
import {
  REGISTRY_ATTRIBUTES_SEEDS,
  generateCodeFromName,
} from "../src/service/attributeService.js";
import {
  cleanup,
  readModelService,
  addOneAttribute,
  addOneTenant,
} from "./helpers.js";

vi.mock("pagopa-interop-commons", async () => {
  const actual = await vi.importActual("pagopa-interop-commons");
  return {
    ...actual,
    waitForReadModelMetadataVersion: vi.fn().mockResolvedValue(undefined),
  };
});

const mockRefreshableToken = {
  get: vi.fn().mockResolvedValue({ serialized: "mocked-token" }),
};

const mockCorrelationId = generateId<CorrelationId>();
const mockHeaders = {
  "X-Correlation-Id": mockCorrelationId,
  Authorization: "Bearer mocked-token",
};

let attrAdesione: Attribute;
let attrSCP: Attribute;

beforeAll(() => {
  attrAdesione = {
    ...getMockAttribute(attributeKind.certified),
    id: generateId(),
    origin: REGISTRY_ATTRIBUTES_SEEDS.adesione.origin,
    code: generateCodeFromName(REGISTRY_ATTRIBUTES_SEEDS.adesione.name),
    name: REGISTRY_ATTRIBUTES_SEEDS.adesione.name,
  };

  attrSCP = {
    ...getMockAttribute(attributeKind.certified),
    id: generateId(),
    origin: REGISTRY_ATTRIBUTES_SEEDS.scp.origin,
    code: generateCodeFromName(REGISTRY_ATTRIBUTES_SEEDS.scp.name),
    name: REGISTRY_ATTRIBUTES_SEEDS.scp.name,
  };
});

afterEach(async () => {
  await cleanup();
  vi.restoreAllMocks();
});

describe("private-certified-attributes-importer", () => {
  it("should create attributes via API if they are not present in the ReadModel", async () => {
    const attributeRegistryClientMock = {
      createInternalCertifiedAttribute: vi.fn().mockResolvedValue(undefined),
    };

    const getAttrSpy = vi
      .spyOn(readModelService, "getAttributeByExternalId")
      .mockImplementation(async (_origin, code) => {
        if (code === attrAdesione.code) return attrAdesione;
        if (code === attrSCP.code) return attrSCP;
        return undefined;
      });

    await importAttributes(
      readModelService,
      {
        attributeRegistryClient: attributeRegistryClientMock as any,
        tenantProcessClient: {
          internalAssignCertifiedAttribute: vi.fn(),
          internalRevokeCertifiedAttribute: vi.fn(),
        } as any,
      },
      mockRefreshableToken as any,
      genericLogger,
      mockHeaders,
      mockCorrelationId
    );

    expect(
      attributeRegistryClientMock.createInternalCertifiedAttribute
    ).not.toHaveBeenCalled();
    expect(getAttrSpy).toHaveBeenCalled();
  });

  it("should assign 'Adesione' attribute to PDND_INFOCAMERE tenants without SCP", async () => {
    await addOneAttribute(attrAdesione);
    await addOneAttribute(attrSCP);

    const tenant: Tenant = {
      ...getMockTenant(),
      externalId: { origin: "PDND_INFOCAMERE", value: "T-A" },
      selfcareInstitutionType: "PA",
      attributes: [],
    };
    await addOneTenant(tenant);

    const tenantProcessClientMock = {
      internalAssignCertifiedAttribute: vi.fn().mockResolvedValue(undefined),
      internalRevokeCertifiedAttribute: vi.fn(),
    };

    await importAttributes(
      readModelService,
      {
        attributeRegistryClient: {
          createInternalCertifiedAttribute: vi.fn(),
        } as any,
        tenantProcessClient: tenantProcessClientMock as any,
      },
      mockRefreshableToken as any,
      genericLogger,
      mockHeaders,
      mockCorrelationId
    );

    expect(
      tenantProcessClientMock.internalAssignCertifiedAttribute
    ).toHaveBeenCalledWith(
      undefined,
      expect.objectContaining({
        params: expect.objectContaining({
          tExternalId: "T-A",
          aExternalId: attrAdesione.code,
        }),
      })
    );
  });

  it("should assign both 'Adesione' and 'SCP' attributes to PDND_INFOCAMERE tenants with SCP", async () => {
    await addOneAttribute(attrAdesione);
    await addOneAttribute(attrSCP);

    const tenant: Tenant = {
      ...getMockTenant(),
      externalId: { origin: "PDND_INFOCAMERE_SCP", value: "T-B" },
      selfcareInstitutionType: SCP,
      attributes: [],
    };
    await addOneTenant(tenant);

    const tenantProcessClientMock = {
      internalAssignCertifiedAttribute: vi.fn().mockResolvedValue(undefined),
      internalRevokeCertifiedAttribute: vi.fn(),
    };

    await importAttributes(
      readModelService,
      {
        attributeRegistryClient: {
          createInternalCertifiedAttribute: vi.fn(),
        } as any,
        tenantProcessClient: tenantProcessClientMock as any,
      },
      mockRefreshableToken as any,
      genericLogger,
      mockHeaders,
      mockCorrelationId
    );

    expect(
      tenantProcessClientMock.internalAssignCertifiedAttribute
    ).toHaveBeenCalledTimes(2);
  });

  it("should revoke attributes from non-Infocamere tenants that wrongly possess them (SelfCare edge case)", async () => {
    await addOneAttribute(attrAdesione);
    await addOneAttribute(attrSCP);

    const tenant: Tenant = {
      ...getMockTenant(),
      externalId: { origin: "IPA", value: "T-C" },
      attributes: [
        {
          ...getMockCertifiedTenantAttribute(attrAdesione.id),
          revocationTimestamp: undefined,
        },
        {
          ...getMockCertifiedTenantAttribute(attrSCP.id),
          revocationTimestamp: undefined,
        },
      ],
    };
    await addOneTenant(tenant);

    const tenantProcessClientMock = {
      internalAssignCertifiedAttribute: vi.fn(),
      internalRevokeCertifiedAttribute: vi.fn().mockResolvedValue(undefined),
    };

    await importAttributes(
      readModelService,
      {
        attributeRegistryClient: {
          createInternalCertifiedAttribute: vi.fn(),
        } as any,
        tenantProcessClient: tenantProcessClientMock as any,
      },
      mockRefreshableToken as any,
      genericLogger,
      mockHeaders,
      mockCorrelationId
    );

    expect(
      tenantProcessClientMock.internalRevokeCertifiedAttribute
    ).toHaveBeenCalledTimes(2);
  });

  it("should do nothing if the tenant is already perfectly aligned (no-op)", async () => {
    await addOneAttribute(attrAdesione);
    await addOneAttribute(attrSCP);

    const tenant: Tenant = {
      ...getMockTenant(),
      externalId: { origin: "PDND_INFOCAMERE", value: "T-D" },
      selfcareInstitutionType: SCP,
      attributes: [
        {
          ...getMockCertifiedTenantAttribute(attrAdesione.id),
          revocationTimestamp: undefined,
        },
        {
          ...getMockCertifiedTenantAttribute(attrSCP.id),
          revocationTimestamp: undefined,
        },
      ],
    };
    await addOneTenant(tenant);

    const tenantProcessClientMock = {
      internalAssignCertifiedAttribute: vi.fn(),
      internalRevokeCertifiedAttribute: vi.fn(),
    };

    await importAttributes(
      readModelService,
      {
        attributeRegistryClient: {
          createInternalCertifiedAttribute: vi.fn(),
        } as any,
        tenantProcessClient: tenantProcessClientMock as any,
      },
      mockRefreshableToken as any,
      genericLogger,
      mockHeaders,
      mockCorrelationId
    );

    expect(
      tenantProcessClientMock.internalAssignCertifiedAttribute
    ).not.toHaveBeenCalled();
    expect(
      tenantProcessClientMock.internalRevokeCertifiedAttribute
    ).not.toHaveBeenCalled();
  });
});
