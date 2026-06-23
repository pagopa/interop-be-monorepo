/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import {
  Tenant,
  TenantId,
  generateId,
  unsafeBrandId,
} from "pagopa-interop-models";
import { genericLogger } from "pagopa-interop-commons";
import { importAttributes } from "../src/service/processor.js";

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
import { ISTAT_ATTRIBUTE_SEED } from "../src/config/constants.js";

describe("ISTAT Certified Discrete Attributes Importer", () => {
  const tenantProcessMock = {
    internalAssignCertifiedDiscreteAttribute: vi.fn(),
    internalRevokeCertifiedDiscreteAttribute: vi.fn(),
    internalUpdateCertifiedDiscreteAttribute: vi.fn(),
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
    getAllIstatRemoteIds: vi.fn(),
  } as any;

  const refreshableTokenMock = {
    get: vi.fn().mockResolvedValue({ serialized: "mock-token" }),
  } as any;

  const csvChunkSize = 100;

  beforeEach(() => {
    readModelQueriesMock.getAllIstatRemoteIds.mockResolvedValue([
      "015146",
      "090001",
      "028001",
      "001001",
      "001002",
    ]);
  });

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
    const t1: Tenant = {
      id: unsafeBrandId<TenantId>(generateId()),
      externalId: { origin: "ISTAT", value: "015146" },
      name: "Comune 015146",
      attributes: [],
      features: [],
      createdAt: new Date(),
      mails: [],
      remoteIds: [
        { origin: "ISTAT", value: "015146", assignmentTimestamp: new Date() },
      ],
    };
    const t2: Tenant = {
      id: unsafeBrandId<TenantId>(generateId()),
      externalId: { origin: "ISTAT", value: "090001" },
      name: "Comune 090001",
      attributes: [],
      features: [],
      createdAt: new Date(),
      mails: [],
      remoteIds: [
        { origin: "ISTAT", value: "090001", assignmentTimestamp: new Date() },
      ],
    };
    const t3: Tenant = {
      id: unsafeBrandId<TenantId>(generateId()),
      externalId: { origin: "ISTAT", value: "028001" },
      name: "Comune 028001",
      attributes: [],
      features: [],
      createdAt: new Date(),
      mails: [],
      remoteIds: [
        { origin: "ISTAT", value: "028001", assignmentTimestamp: new Date() },
      ],
    };

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
          origin: ISTAT_ATTRIBUTE_SEED.origin,
          value: "999999",
          assignmentTimestamp: new Date(),
        },
      ],
      attributes: [
        {
          id: persistentAttribute.id,
          type: "PersistentCertifiedDiscreteAttribute",
          assignmentTimestamp: new Date(),
          discreteValue: 100,
        } as any,
      ],
    };
    await cleanup();
    await addOneAttribute(persistentAttribute);
    await addOneTenant(obsoleteTenantWithAttribute);
    await addOneTenant(t1);
    await addOneTenant(t2);
    await addOneTenant(t3);
    await importAttributes(
      istatClientMock as any,
      readModelService,
      tenantProcessMock as any,
      attributeProcessMock as any,
      refreshableTokenMock,
      { defaultPollingMaxRetries: 3, defaultPollingRetryDelay: 1 },
      csvChunkSize,
      genericLogger,
      generateId()
    );

    expect(
      tenantProcessMock.internalAssignCertifiedDiscreteAttribute
    ).toHaveBeenCalledWith(
      ISTAT_ATTRIBUTE_SEED.origin,
      "015146",
      ISTAT_ATTRIBUTE_SEED.origin,
      ISTAT_ATTRIBUTE_SEED.code,
      1350000,
      expect.anything(),
      expect.anything()
    );

    expect(
      tenantProcessMock.internalAssignCertifiedDiscreteAttribute
    ).toHaveBeenCalledWith(
      ISTAT_ATTRIBUTE_SEED.origin,
      "090001",
      ISTAT_ATTRIBUTE_SEED.origin,
      ISTAT_ATTRIBUTE_SEED.code,
      2800000,
      expect.anything(),
      expect.anything()
    );

    expect(
      tenantProcessMock.internalAssignCertifiedDiscreteAttribute
    ).toHaveBeenCalledWith(
      ISTAT_ATTRIBUTE_SEED.origin,
      "028001",
      ISTAT_ATTRIBUTE_SEED.origin,
      ISTAT_ATTRIBUTE_SEED.code,
      227,
      expect.anything(),
      expect.anything()
    );

    expect(
      tenantProcessMock.internalRevokeCertifiedDiscreteAttribute
    ).toHaveBeenCalledWith(
      "ISTAT",
      "999999",
      ISTAT_ATTRIBUTE_SEED.origin,
      ISTAT_ATTRIBUTE_SEED.code,
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
  it("should exclusively process rows where Età is 999 and ignore specific ages", async () => {
    const specificAgesCsv = `"Popolazione residente per età e sesso al 1° gennaio 2026 (stima)"
  "Codice comune";"Comune";"Età";"Totale maschi";"Totale femmine";"Totale"
  "001001";"Trapani";0;10;10;20
  "001001";"Trapani";1;15;15;30
  "001001";"Trapani";999;50;50;100
  "001002";"Roma";5;5;5;10
  "001002";"Roma";999;200;200;400`;

    istatClientMock.downloadNationalDataset.mockResolvedValueOnce(
      specificAgesCsv
    );
    readModelQueriesMock.getAttributeByExternalId.mockResolvedValue({
      data: { id: generateId() },
      metadata: { version: 1 },
    });
    readModelQueriesMock.getTenantsWithDiscreteAttribute.mockResolvedValue([]);

    tenantProcessMock.internalAssignCertifiedDiscreteAttribute.mockImplementation(
      internalAssignCertifiedDiscreteAttributeMock
    );

    await importAttributes(
      istatClientMock as any,
      readModelQueriesMock as any,
      tenantProcessMock as any,
      attributeProcessMock as any,
      refreshableTokenMock,
      { defaultPollingMaxRetries: 1, defaultPollingRetryDelay: 1 },
      csvChunkSize,
      genericLogger,
      generateId()
    );

    expect(
      tenantProcessMock.internalAssignCertifiedDiscreteAttribute
    ).toHaveBeenCalledTimes(2);

    expect(
      tenantProcessMock.internalAssignCertifiedDiscreteAttribute
    ).toHaveBeenCalledWith(
      ISTAT_ATTRIBUTE_SEED.origin,
      "001001",
      ISTAT_ATTRIBUTE_SEED.origin,
      ISTAT_ATTRIBUTE_SEED.code,
      100,
      expect.anything(),
      expect.anything()
    );

    expect(
      tenantProcessMock.internalAssignCertifiedDiscreteAttribute
    ).toHaveBeenCalledWith(
      ISTAT_ATTRIBUTE_SEED.origin,
      "001002",
      ISTAT_ATTRIBUTE_SEED.origin,
      ISTAT_ATTRIBUTE_SEED.code,
      400,
      expect.anything(),
      expect.anything()
    );
  });
  it("should create attribute if missing and assign values", async () => {
    readModelQueriesMock.getAttributeByExternalId
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce({
        data: { id: generateId() },
        metadata: { version: 1 },
      });

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
      csvChunkSize,
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
  it("should process municipalities in chunks successfully", async () => {
    readModelQueriesMock.getAttributeByExternalId.mockResolvedValue({
      data: { id: generateId() },
      metadata: { version: 1 },
    });
    readModelQueriesMock.getTenantsWithDiscreteAttribute.mockResolvedValue([]);
    tenantProcessMock.internalAssignCertifiedDiscreteAttribute.mockImplementation(
      internalAssignCertifiedDiscreteAttributeMock
    );
    const fakeIds = Array.from({ length: 1200 }, (_, i) =>
      String(i).padStart(6, "0")
    );
    readModelQueriesMock.getAllIstatRemoteIds.mockResolvedValue(fakeIds);
    const largePopulationMap = new Map<string, number>();
    for (let i = 0; i < 1200; i++) {
      largePopulationMap.set(`COMUNE_${i}`, 1000 + i);
    }

    let hugeCsv = `"Popolazione residente"\n"Codice comune";"Comune";"Età";"Totale maschi";"Totale femmine";"Totale"\n`;
    for (let i = 0; i < 1200; i++) {
      hugeCsv += `"${String(i).padStart(
        6,
        "0"
      )}";"Comune ${i}";999;50;50;100\n`;
    }

    istatClientMock.downloadNationalDataset.mockResolvedValueOnce(hugeCsv);

    await importAttributes(
      istatClientMock as any,
      readModelQueriesMock,
      tenantProcessMock as any,
      attributeProcessMock as any,
      refreshableTokenMock,
      { defaultPollingMaxRetries: 1, defaultPollingRetryDelay: 1 },
      csvChunkSize,
      genericLogger,
      generateId()
    );

    expect(
      tenantProcessMock.internalAssignCertifiedDiscreteAttribute
    ).toHaveBeenCalledTimes(1200);
  });
  it("should attempt an update if an assignment conflict (409) occurs", async () => {
    readModelQueriesMock.getAttributeByExternalId.mockResolvedValue({
      data: { id: generateId() },
      metadata: { version: 1 },
    });
    readModelQueriesMock.getTenantsWithDiscreteAttribute.mockResolvedValue([]);
    const axiosError = new Error("Conflict") as any;
    axiosError.isAxiosError = true;
    axiosError.response = { status: 409 };

    tenantProcessMock.internalAssignCertifiedDiscreteAttribute.mockRejectedValueOnce(
      axiosError
    );
    tenantProcessMock.internalAssignCertifiedDiscreteAttribute
      .mockRejectedValueOnce({
        response: {
          status: 409,
          code: "certifiedDiscreteAttributeAlreadyAssigned",
        },
      })
      .mockResolvedValueOnce({ version: 1 });

    tenantProcessMock.internalUpdateCertifiedDiscreteAttribute.mockResolvedValue(
      {
        version: 1,
      }
    );

    const csvContent = `"Popolazione residente per età e sesso"
    "Codice comune";"Comune";"Età";"Totale maschi";"Totale femmine";"Totale"
    "001001";"Trapani";999;50;50;100
    "001002";"Roma";999;200;200;400`;
    istatClientMock.downloadNationalDataset.mockResolvedValueOnce(csvContent);

    await importAttributes(
      istatClientMock as any,
      readModelQueriesMock as any,
      tenantProcessMock as any,
      attributeProcessMock as any,
      refreshableTokenMock,
      { defaultPollingMaxRetries: 1, defaultPollingRetryDelay: 1 },
      csvChunkSize,
      genericLogger,
      generateId()
    );

    expect(
      tenantProcessMock.internalAssignCertifiedDiscreteAttribute
    ).toHaveBeenCalled();

    expect(
      tenantProcessMock.internalUpdateCertifiedDiscreteAttribute
    ).toHaveBeenCalledWith(
      ISTAT_ATTRIBUTE_SEED.origin,
      "001001",
      ISTAT_ATTRIBUTE_SEED.origin,
      ISTAT_ATTRIBUTE_SEED.code,
      100,
      expect.anything(),
      expect.anything()
    );
  });
  it("should skip assignment if the tenant is not found in the read model", async () => {
    const debugSpy = vi.spyOn(genericLogger, "debug");
    const infoSpy = vi.spyOn(genericLogger, "info");
    readModelQueriesMock.getAttributeByExternalId.mockResolvedValue({
      data: { id: generateId() },
      metadata: { version: 1 },
    });
    readModelQueriesMock.getTenantsWithDiscreteAttribute.mockResolvedValue([]);

    readModelQueriesMock.getAllIstatRemoteIds.mockResolvedValue(["001001"]);

    tenantProcessMock.internalAssignCertifiedDiscreteAttribute.mockImplementation(
      internalAssignCertifiedDiscreteAttributeMock
    );

    const csvContent = `"Popolazione residente per età e sesso"
    "Codice comune";"Comune";"Età";"Totale maschi";"Totale femmine";"Totale"
    "001001";"Trapani";999;50;50;100
    "001002";"Roma";999;200;200;400`;

    istatClientMock.downloadNationalDataset.mockResolvedValueOnce(csvContent);

    await importAttributes(
      istatClientMock as any,
      readModelQueriesMock as any,
      tenantProcessMock as any,
      attributeProcessMock as any,
      refreshableTokenMock,
      { defaultPollingMaxRetries: 1, defaultPollingRetryDelay: 1 },
      csvChunkSize,
      genericLogger,
      generateId()
    );

    expect(
      tenantProcessMock.internalAssignCertifiedDiscreteAttribute
    ).toHaveBeenCalledTimes(1);

    expect(
      tenantProcessMock.internalAssignCertifiedDiscreteAttribute
    ).toHaveBeenCalledWith(
      ISTAT_ATTRIBUTE_SEED.origin,
      "001001",
      expect.anything(),
      expect.anything(),
      100,
      expect.anything(),
      expect.anything()
    );

    expect(
      tenantProcessMock.internalAssignCertifiedDiscreteAttribute
    ).not.toHaveBeenCalledWith(
      expect.anything(),
      "001002",
      expect.anything(),
      expect.anything(),
      expect.anything(),
      expect.anything(),
      expect.anything()
    );
    expect(debugSpy).toHaveBeenCalledWith(
      "Tenant with remoteId: 001002 not found in DB. Skipping."
    );

    expect(infoSpy).toHaveBeenCalledWith(
      expect.stringContaining(
        "Process complete. Processed: 2, Success: 1, Updated: 0, Skipped: 1, Revoked: 0, Error: 0"
      )
    );
  });
  it("should skip municipality and increment errors if 'Totale' in CSV is not a valid number", async () => {
    const infoSpy = vi.spyOn(genericLogger, "info");
    const warnSpy = vi.spyOn(genericLogger, "warn");

    readModelQueriesMock.getAttributeByExternalId.mockResolvedValue({
      data: { id: generateId() },
      metadata: { version: 1 },
    });
    readModelQueriesMock.getTenantsWithDiscreteAttribute.mockResolvedValue([
      {
        data: {
          id: generateId(),
          remoteIds: [{ origin: ISTAT_ATTRIBUTE_SEED.origin, value: "001002" }],
        },
        metadata: { version: 1 },
      },
    ]);
    readModelQueriesMock.getAllIstatRemoteIds.mockResolvedValue([
      "001001",
      "001002",
    ]);

    tenantProcessMock.internalAssignCertifiedDiscreteAttribute.mockImplementation(
      internalAssignCertifiedDiscreteAttributeMock
    );

    const csvContent = `"Popolazione residente per età e sesso"
    "Codice comune";"Comune";"Età";"Totale maschi";"Totale femmine";"Totale"
    "001001";"Trapani";999;50;50;100
    "001002";"Roma";999;200;200;abcde`;

    istatClientMock.downloadNationalDataset.mockResolvedValueOnce(csvContent);

    await importAttributes(
      istatClientMock as any,
      readModelQueriesMock as any,
      tenantProcessMock as any,
      attributeProcessMock as any,
      refreshableTokenMock,
      { defaultPollingMaxRetries: 1, defaultPollingRetryDelay: 1 },
      csvChunkSize,
      genericLogger,
      generateId()
    );

    expect(
      tenantProcessMock.internalAssignCertifiedDiscreteAttribute
    ).toHaveBeenCalledWith(
      ISTAT_ATTRIBUTE_SEED.origin,
      "001001",
      expect.anything(),
      expect.anything(),
      100,
      expect.anything(),
      expect.anything()
    );

    expect(
      tenantProcessMock.internalAssignCertifiedDiscreteAttribute
    ).not.toHaveBeenCalledWith(
      expect.anything(),
      "001002",
      expect.anything(),
      expect.anything(),
      expect.anything(),
      expect.anything(),
      expect.anything()
    );
    expect(
      tenantProcessMock.internalRevokeCertifiedDiscreteAttribute
    ).not.toHaveBeenCalled();

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("Value 'Totale' for municipality 001002")
    );

    expect(infoSpy).toHaveBeenCalledWith(expect.stringContaining("Error: 1"));
  });
  it("should revoke attribute for municipalities not in CSV", async () => {
    readModelQueriesMock.getAttributeByExternalId.mockResolvedValue({
      data: { id: generateId() },
      metadata: { version: 1 },
    });
    tenantProcessMock.internalAssignCertifiedDiscreteAttribute.mockImplementation(
      internalAssignCertifiedDiscreteAttributeMock
    );

    readModelQueriesMock.getTenantsWithDiscreteAttribute.mockResolvedValueOnce([
      {
        data: {
          id: "tenant-da-revocare",
          externalId: { origin: "ISTAT", value: "999999" },
          remoteIds: [{ origin: ISTAT_ATTRIBUTE_SEED.origin, value: "999999" }],
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
      csvChunkSize,
      genericLogger,
      generateId()
    );

    expect(
      tenantProcessMock.internalRevokeCertifiedDiscreteAttribute
    ).toHaveBeenCalledWith(
      "ISTAT",
      "999999",
      ISTAT_ATTRIBUTE_SEED.origin,
      ISTAT_ATTRIBUTE_SEED.code,
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
        csvChunkSize,
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
      data: { id: generateId() },
      metadata: { version: 1 },
    });
    readModelQueriesMock.getTenantsWithDiscreteAttribute.mockResolvedValue([]);

    tenantProcessMock.internalAssignCertifiedDiscreteAttribute
      .mockRejectedValueOnce(new Error("Internal Server Error on API"))
      .mockImplementation(internalAssignCertifiedDiscreteAttributeMock);

    readModelQueriesMock.getAllIstatRemoteIds.mockResolvedValue([
      "028001",
      "001002",
      "003003",
      "004004",
      "015146",
      "102050",
      "090001",
      "048017",
    ]);
    await importAttributes(
      istatClientMock as any,
      readModelQueriesMock as any,
      tenantProcessMock as any,
      attributeProcessMock as any,
      refreshableTokenMock,
      { defaultPollingMaxRetries: 1, defaultPollingRetryDelay: 1 },
      csvChunkSize,
      genericLogger,
      generateId()
    );

    expect(
      tenantProcessMock.internalAssignCertifiedDiscreteAttribute
    ).toHaveBeenCalledTimes(8);
  });
  it("should revoke a tenant if it possesses the attribute but lacks a valid ISTAT remoteId", async () => {
    readModelQueriesMock.getAttributeByExternalId.mockResolvedValue({
      data: { id: generateId() },
      metadata: { version: 1 },
    });
    tenantProcessMock.internalAssignCertifiedDiscreteAttribute.mockImplementation(
      internalAssignCertifiedDiscreteAttributeMock
    );

    readModelQueriesMock.getTenantsWithDiscreteAttribute.mockResolvedValueOnce([
      {
        data: {
          id: "tenant-malformed",
          remoteIds: [{ origin: "ISTAT", value: "12342" }],
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
      csvChunkSize,
      genericLogger,
      generateId()
    );

    expect(
      tenantProcessMock.internalRevokeCertifiedDiscreteAttribute
    ).toHaveBeenCalledWith(
      "ISTAT",
      "12342",
      ISTAT_ATTRIBUTE_SEED.origin,
      ISTAT_ATTRIBUTE_SEED.code,
      expect.anything(),
      expect.anything()
    );
  });
  it("should skip revocation and count an error when a tenant has no ISTAT remoteId", async () => {
    const warnSpy = vi.spyOn(genericLogger, "warn");
    readModelQueriesMock.getAttributeByExternalId.mockResolvedValue({
      data: { id: generateId() },
      metadata: { version: 1 },
    });
    tenantProcessMock.internalAssignCertifiedDiscreteAttribute.mockImplementation(
      internalAssignCertifiedDiscreteAttributeMock
    );

    readModelQueriesMock.getTenantsWithDiscreteAttribute.mockResolvedValueOnce([
      {
        data: {
          id: "tenant-without-istat-remoteid",
          externalId: { origin: "ISTAT", value: "999999" },
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
      csvChunkSize,
      genericLogger,
      generateId()
    );

    expect(
      tenantProcessMock.internalRevokeCertifiedDiscreteAttribute
    ).not.toHaveBeenCalled();

    expect(warnSpy).toHaveBeenCalledWith(
      "istatRemoteId not found for tenant: tenant-without-istat-remoteid"
    );
  });
  it("should continue revoking other tenants if one revocation fails", async () => {
    readModelQueriesMock.getAttributeByExternalId.mockResolvedValue({
      data: { id: generateId() },
      metadata: { version: 1 },
    });
    tenantProcessMock.internalAssignCertifiedDiscreteAttribute.mockImplementation(
      internalAssignCertifiedDiscreteAttributeMock
    );

    readModelQueriesMock.getTenantsWithDiscreteAttribute.mockResolvedValueOnce([
      {
        data: {
          id: "t1",
          externalId: { origin: "ISTAT", value: "999991" },
          remoteIds: [{ origin: ISTAT_ATTRIBUTE_SEED.origin, value: "999991" }],
        },
        metadata: { version: 1 },
      },
      {
        data: {
          id: "t2",
          externalId: { origin: "ISTAT", value: "999992" },
          remoteIds: [{ origin: ISTAT_ATTRIBUTE_SEED.origin, value: "999992" }],
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
      csvChunkSize,
      genericLogger,
      generateId()
    );

    expect(
      tenantProcessMock.internalRevokeCertifiedDiscreteAttribute
    ).toHaveBeenCalledTimes(2);
  });
});
