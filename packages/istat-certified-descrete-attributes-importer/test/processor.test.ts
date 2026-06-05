/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi, afterEach } from "vitest";
import {
  Tenant,
  TenantId,
  generateId,
  unsafeBrandId,
} from "pagopa-interop-models";
import { genericLogger } from "pagopa-interop-commons";
import { importAttributes } from "../src/service/processor.js";

import {
  ISTAT_CERTIFIER_ORIGIN,
  ISTAT_POPULATION_ATTRIBUTE_CODE,
} from "../src/config/constants.js";
import {
  addOneAttribute,
  addOneTenant,
  cleanup,
  downloadCSVMock,
  getTenantsWithDiscreteAttributeMock,
  internalAssignCertifiedDiscreteAttributeMock,
  internalRevokeCertifiedDiscreteAttributeMock,
  persistentAttribute,
  readModelService,
} from "./helpers.js";

describe("ISTAT Certified Discrete Attributes Importer", () => {
  const tenantProcessMock = {
    internalAssignCertifiedDiscreteAttribute: vi.fn(),
    internalRevokeCertifiedDiscreteAttribute: vi.fn(),
  };

  const attributeProcessMock = {
    createInternalCertifiedDiscreteAttribute: vi.fn(),
  };

  const istatClientMock = {
    downloadNationalDataset: downloadCSVMock,
  };

  const readModelQueriesMock = {
    getAttributeByExternalId: vi.fn(),
    getTenantsWithDiscreteAttribute: vi.fn(),
    getTenantByIdWithMetadata: vi.fn(),
  } as any;

  const refreshableTokenMock = {
    get: vi.fn().mockResolvedValue({ serialized: "mock-token" }),
  } as any;

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should parse CSV correctly, handle polling via DB, and interact with Real Read Model for assignment and revocation", async () => {
    const attributeProcessMock = {
      createInternalCertifiedDiscreteAttribute: vi
        .fn()
        .mockImplementation(async () => {
          await addOneAttribute(persistentAttribute);
        }),
    };

    await addOneAttribute(persistentAttribute);

    const obsoleteTenantId = generateId();
    const obsoleteTenant: Tenant = {
      id: unsafeBrandId<TenantId>(obsoleteTenantId),
      externalId: { origin: "ISTAT", value: "999999" },
      name: "Comune Obsoleto",
      attributes: [],
      features: [],
      createdAt: new Date(),
      mails: [],
    };
    await addOneTenant(obsoleteTenant);

    const obsoleteTenantWithAttribute: Tenant = {
      ...obsoleteTenant,
      remoteIds: [
        {
          origin: ISTAT_CERTIFIER_ORIGIN,
          value: "999999",
          assignmentTimestamp: new Date(),
        },
      ],
      attributes: [
        {
          id: persistentAttribute.id,
          type: "PersistentCertifiedAttribute",
          assignmentTimestamp: new Date(),
        } as any,
      ],
    };
    await cleanup();
    await addOneAttribute(persistentAttribute);
    await addOneTenant(obsoleteTenantWithAttribute);

    await importAttributes(
      istatClientMock as any,
      readModelService,
      tenantProcessMock as any,
      attributeProcessMock as any,
      refreshableTokenMock,
      { defaultPollingMaxRetries: 3, defaultPollingRetryDelay: 1 },
      genericLogger,
      generateId()
    );

    expect(
      tenantProcessMock.internalAssignCertifiedDiscreteAttribute
    ).toHaveBeenCalledWith(
      ISTAT_CERTIFIER_ORIGIN,
      "015146",
      ISTAT_CERTIFIER_ORIGIN,
      ISTAT_POPULATION_ATTRIBUTE_CODE,
      1350000,
      expect.anything(),
      expect.anything()
    );

    expect(
      tenantProcessMock.internalAssignCertifiedDiscreteAttribute
    ).toHaveBeenCalledWith(
      ISTAT_CERTIFIER_ORIGIN,
      "090001",
      ISTAT_CERTIFIER_ORIGIN,
      ISTAT_POPULATION_ATTRIBUTE_CODE,
      2800000,
      expect.anything(),
      expect.anything()
    );

    expect(
      tenantProcessMock.internalAssignCertifiedDiscreteAttribute
    ).toHaveBeenCalledWith(
      ISTAT_CERTIFIER_ORIGIN,
      "028001",
      ISTAT_CERTIFIER_ORIGIN,
      ISTAT_POPULATION_ATTRIBUTE_CODE,
      227,
      expect.anything(),
      expect.anything()
    );

    expect(
      tenantProcessMock.internalRevokeCertifiedDiscreteAttribute
    ).toHaveBeenCalledWith(
      "ISTAT",
      "999999",
      ISTAT_CERTIFIER_ORIGIN,
      ISTAT_POPULATION_ATTRIBUTE_CODE,
      expect.anything(),
      expect.anything()
    );

    expect(
      tenantProcessMock.internalRevokeCertifiedDiscreteAttribute
    ).not.toHaveBeenCalledWith(
      expect.any(String),
      "015146",
      expect.any(String),
      expect.any(String),
      expect.any(Object),
      expect.any(Object)
    );
  });

  it("should create attribute if missing and assign values", async () => {
    readModelQueriesMock.getAttributeByExternalId
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce({ id: generateId() });

    tenantProcessMock.internalAssignCertifiedDiscreteAttribute.mockImplementation(
      internalAssignCertifiedDiscreteAttributeMock
    );
    readModelQueriesMock.getTenantsWithDiscreteAttribute.mockImplementation(
      getTenantsWithDiscreteAttributeMock
    );

    await importAttributes(
      istatClientMock as any,
      readModelQueriesMock as any,
      tenantProcessMock as any,
      attributeProcessMock as any,
      refreshableTokenMock,
      { defaultPollingMaxRetries: 2, defaultPollingRetryDelay: 1 },
      genericLogger,
      generateId()
    );

    expect(
      attributeProcessMock.createInternalCertifiedDiscreteAttribute
    ).toBeCalledTimes(1);
    expect(
      tenantProcessMock.internalAssignCertifiedDiscreteAttribute
    ).toHaveBeenCalled();
  });

  it("should revoke attribute for municipalities not in CSV", async () => {
    readModelQueriesMock.getAttributeByExternalId.mockResolvedValue({
      id: generateId(),
    });
    tenantProcessMock.internalAssignCertifiedDiscreteAttribute.mockImplementation(
      internalAssignCertifiedDiscreteAttributeMock
    );

    readModelQueriesMock.getTenantsWithDiscreteAttribute.mockResolvedValueOnce([
      {
        data: {
          id: "tenant-da-revocare",
          externalId: { origin: "ISTAT", value: "999999" },
          remoteIds: [{ origin: ISTAT_CERTIFIER_ORIGIN, value: "999999" }],
        },
        metadata: { version: 1 },
      },
    ]);

    tenantProcessMock.internalRevokeCertifiedDiscreteAttribute.mockImplementation(
      internalRevokeCertifiedDiscreteAttributeMock
    );

    await importAttributes(
      istatClientMock as any,
      readModelQueriesMock as any,
      tenantProcessMock as any,
      attributeProcessMock as any,
      refreshableTokenMock,
      { defaultPollingMaxRetries: 1, defaultPollingRetryDelay: 1 },
      genericLogger,
      generateId()
    );

    expect(
      tenantProcessMock.internalRevokeCertifiedDiscreteAttribute
    ).toHaveBeenCalledWith(
      "ISTAT",
      "999999",
      ISTAT_CERTIFIER_ORIGIN,
      ISTAT_POPULATION_ATTRIBUTE_CODE,
      expect.anything(),
      expect.anything()
    );
  });

  it("should throw a timeout error if attribute polling max retries are reached", async () => {
    readModelQueriesMock.getAttributeByExternalId.mockResolvedValue(undefined);

    await expect(
      importAttributes(
        istatClientMock as any,
        readModelQueriesMock as any,
        tenantProcessMock as any,
        attributeProcessMock as any,
        refreshableTokenMock,
        { defaultPollingMaxRetries: 2, defaultPollingRetryDelay: 1 },
        genericLogger,
        generateId()
      )
    ).rejects.toThrowError();

    expect(
      tenantProcessMock.internalAssignCertifiedDiscreteAttribute
    ).not.toHaveBeenCalled();
  });

  it("should continue processing other municipalities if one assignment fails", async () => {
    readModelQueriesMock.getAttributeByExternalId.mockResolvedValue({
      id: generateId(),
    });
    readModelQueriesMock.getTenantsWithDiscreteAttribute.mockResolvedValue([]);

    // Simuliamo che la prima chiamata di assegnazione vada in errore (es. Network error)
    // mentre le successive abbiano successo
    tenantProcessMock.internalAssignCertifiedDiscreteAttribute
      .mockRejectedValueOnce(new Error("Internal Server Error on API"))
      .mockImplementation(internalAssignCertifiedDiscreteAttributeMock);

    await importAttributes(
      istatClientMock as any,
      readModelQueriesMock as any,
      tenantProcessMock as any,
      attributeProcessMock as any,
      refreshableTokenMock,
      { defaultPollingMaxRetries: 1, defaultPollingRetryDelay: 1 },
      genericLogger,
      generateId()
    );

    expect(
      tenantProcessMock.internalAssignCertifiedDiscreteAttribute
    ).toHaveBeenCalledTimes(8);
  });

  it("should revoke a tenant if it possesses the attribute but lacks a valid ISTAT remoteId", async () => {
    readModelQueriesMock.getAttributeByExternalId.mockResolvedValue({
      id: generateId(),
    });
    tenantProcessMock.internalAssignCertifiedDiscreteAttribute.mockImplementation(
      internalAssignCertifiedDiscreteAttributeMock
    );

    readModelQueriesMock.getTenantsWithDiscreteAttribute.mockResolvedValueOnce([
      {
        data: {
          id: "tenant-malformed",
          externalId: { origin: "ISTAT", value: "12342" },
          remoteIds: [],
        },
        metadata: { version: 1 },
      },
    ]);

    tenantProcessMock.internalRevokeCertifiedDiscreteAttribute.mockImplementation(
      internalRevokeCertifiedDiscreteAttributeMock
    );

    await importAttributes(
      istatClientMock as any,
      readModelQueriesMock as any,
      tenantProcessMock as any,
      attributeProcessMock as any,
      refreshableTokenMock,
      { defaultPollingMaxRetries: 1, defaultPollingRetryDelay: 1 },
      genericLogger,
      generateId()
    );

    expect(
      tenantProcessMock.internalRevokeCertifiedDiscreteAttribute
    ).toHaveBeenCalledWith(
      "ISTAT",
      "12342",
      ISTAT_CERTIFIER_ORIGIN,
      ISTAT_POPULATION_ATTRIBUTE_CODE,
      expect.anything(),
      expect.anything()
    );
  });

  it("should continue revoking other tenants if one revocation fails", async () => {
    readModelQueriesMock.getAttributeByExternalId.mockResolvedValue({
      id: generateId(),
    });
    tenantProcessMock.internalAssignCertifiedDiscreteAttribute.mockImplementation(
      internalAssignCertifiedDiscreteAttributeMock
    );

    readModelQueriesMock.getTenantsWithDiscreteAttribute.mockResolvedValueOnce([
      {
        data: {
          id: "t1",
          externalId: { origin: "ISTAT", value: "999991" },
          remoteIds: [{ origin: ISTAT_CERTIFIER_ORIGIN, value: "999991" }],
        },
        metadata: { version: 1 },
      },
      {
        data: {
          id: "t2",
          externalId: { origin: "ISTAT", value: "999992" },
          remoteIds: [{ origin: ISTAT_CERTIFIER_ORIGIN, value: "999992" }],
        },
        metadata: { version: 1 },
      },
    ]);

    tenantProcessMock.internalRevokeCertifiedDiscreteAttribute
      .mockRejectedValueOnce(new Error("Timeout Gateway"))
      .mockImplementation(internalRevokeCertifiedDiscreteAttributeMock);

    await importAttributes(
      istatClientMock as any,
      readModelQueriesMock as any,
      tenantProcessMock as any,
      attributeProcessMock as any,
      refreshableTokenMock,
      { defaultPollingMaxRetries: 1, defaultPollingRetryDelay: 1 },
      genericLogger,
      generateId()
    );

    expect(
      tenantProcessMock.internalRevokeCertifiedDiscreteAttribute
    ).toHaveBeenCalledTimes(2);
  });
});
