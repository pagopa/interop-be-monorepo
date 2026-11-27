import { AxiosError, InternalAxiosRequestConfig } from "axios";
import {
  agreementApi,
  attributeRegistryApi,
  catalogApi,
  eserviceTemplateApi,
  inAppNotificationApi,
} from "pagopa-interop-api-clients";
import { FileManager, genericLogger, WithLogger } from "pagopa-interop-commons";
import {
  createDummyStub,
  getMockAuthData,
  getMockContext,
} from "pagopa-interop-commons-test";
import {
  commonErrorCodes,
  generateId,
  Problem,
  serviceErrorCode,
  serviceName,
  TenantId,
} from "pagopa-interop-models";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type {
  AuthorizationProcessClient,
  DelegationProcessClient,
  TenantProcessClient,
} from "../src/clients/clientsProvider.js";

import { config } from "../src/config/config.js";
import { catalogServiceBuilder } from "../src/services/catalogService.js";
import { BffAppContext } from "../src/utilities/context.js";
import {
  getMockCatalogApiEService,
  getMockCatalogApiEServiceDescriptor,
} from "./mockUtils.js";

describe("createEServiceDocument", () => {
  const tenantId = generateId<TenantId>();
  const descriptor = getMockCatalogApiEServiceDescriptor();
  const eservice = {
    ...getMockCatalogApiEService(),
    producerId: tenantId,
    technology: "REST" as const,
    descriptors: [descriptor],
  };
  const document = {
    kind: "DOCUMENT" as const,
    prettyName: "Document",
    doc: new File([JSON.stringify({ test: true })], "document.json", {
      type: "application/json",
    }),
  };
  const appContext = getMockContext({
    authData: getMockAuthData(tenantId),
  });
  const context: WithLogger<BffAppContext> = {
    ...appContext,
    headers: {
      "X-Correlation-Id": appContext.correlationId,
      Authorization: "authorization",
      "X-Forwarded-For": "x-forwarded-for",
    },
    logger: genericLogger,
  };

  const createEServiceDocument = vi.fn();
  const catalogProcessClient = Object.assign(
    createDummyStub<catalogApi.CatalogProcessClient>(),
    {
      getEServiceById: vi.fn().mockResolvedValue(eservice),
      createEServiceDocument,
    }
  );
  const fileManager = Object.assign(createDummyStub<FileManager>(), {
    storeBytes: vi.fn().mockResolvedValue("documents/path/document.json"),
    delete: vi.fn().mockResolvedValue(undefined),
  });

  const catalogService = catalogServiceBuilder(
    catalogProcessClient,
    createDummyStub<TenantProcessClient>(),
    createDummyStub<agreementApi.AgreementProcessClient>(),
    createDummyStub<attributeRegistryApi.AttributeProcessClient>(),
    createDummyStub<AuthorizationProcessClient>(),
    createDummyStub<DelegationProcessClient>(),
    createDummyStub<eserviceTemplateApi.EServiceTemplateProcessClient>(),
    createDummyStub<inAppNotificationApi.InAppNotificationManagerClient>(),
    fileManager,
    config
  );

  const axiosError = (problem: Problem): AxiosError<Problem> =>
    new AxiosError(
      "Downstream error",
      String(problem.status),
      undefined,
      undefined,
      {
        status: problem.status,
        data: problem,
        statusText: problem.title,
        config: {} as InternalAxiosRequestConfig,
        headers: {},
      }
    );

  const eventConflictProblem: Problem = {
    type: "about:blank",
    title: "Conflict",
    status: 409,
    detail: "Request conflicts with an ongoing operation. Please retry.",
    correlationId: context.correlationId,
    errors: [
      {
        code: `${serviceErrorCode[serviceName.CATALOG_PROCESS]}-${commonErrorCodes.eventConflictError}`,
        detail: "Request conflicts with an ongoing operation. Please retry.",
      },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    createEServiceDocument.mockReset();
  });

  it("should retry catalog event conflicts and complete the upload", async () => {
    createEServiceDocument
      .mockRejectedValueOnce(axiosError(eventConflictProblem))
      .mockResolvedValueOnce(undefined);

    await expect(
      catalogService.createEServiceDocument(
        eservice.id,
        descriptor.id,
        document,
        context
      )
    ).resolves.toEqual({ id: expect.any(String) });

    expect(createEServiceDocument).toHaveBeenCalledTimes(2);
    expect(fileManager.delete).not.toHaveBeenCalled();
  });

  it("should not retry other conflicts", async () => {
    const otherConflict: Problem = {
      ...eventConflictProblem,
      errors: [{ code: "001-0001", detail: "Another conflict" }],
    };
    createEServiceDocument.mockRejectedValue(axiosError(otherConflict));

    await expect(
      catalogService.createEServiceDocument(
        eservice.id,
        descriptor.id,
        document,
        context
      )
    ).rejects.toBeInstanceOf(AxiosError);

    expect(createEServiceDocument).toHaveBeenCalledTimes(1);
    expect(fileManager.delete).toHaveBeenCalledTimes(1);
  });
});
