import fs from "fs/promises";
import { fileURLToPath } from "url";
import path from "path";
import { describe, it, expect, vi } from "vitest";
import {
  Document,
  EServiceDocumentId,
  EServiceId,
  EServiceTemplateId,
  EServiceTemplateVersion,
  EServiceTemplateVersionId,
  eserviceTemplateVersionState,
  generateId,
} from "pagopa-interop-models";
import { genericLogger, WithLogger } from "pagopa-interop-commons";
import {
  getMockDescriptor,
  getMockEService,
  getMockEServiceTemplate,
  getMockEServiceTemplateVersion,
  getRandomAuthData,
} from "pagopa-interop-commons-test/index.js";
import { catalogApi, eserviceTemplateApi } from "pagopa-interop-api-clients";
import {
  AttributeProcessClient,
  CatalogProcessClient,
  EServiceTemplateProcessClient,
  TenantProcessClient,
} from "../src/clients/clientsProvider.js";
import { config } from "../src/config/config.js";
import { BffAppContext } from "../src/utilities/context.js";
import { EServiceTemplateService } from "../src/services/eserviceTemplateService.js";
import {
  createEServiceTeamplateService as createEServiceTemplateService,
  fileManager,
  toEserviceTemplateProcessMock,
  toEserviceCatalogProcessMock,
} from "./utils.js";

async function readBufferFromFile(
  interfaceFileExtension: string,
  fileName: string
): Promise<Buffer> {
  const filename = fileURLToPath(import.meta.url);
  const dirname = path.dirname(filename);
  const templatePath = `./resources/${fileName}.${interfaceFileExtension}`;
  return await fs.readFile(`${dirname}/${templatePath}`);
}

function getEserviceTemplateServiceMock(
  mockEservice: catalogApi.EService,
  mockEserviceTemplate: eserviceTemplateApi.EServiceTemplate
): EServiceTemplateService {
  const tenantProcessClient = {} as unknown as TenantProcessClient;
  const attributeProcessClient = {} as unknown as AttributeProcessClient;

  const eserviceProcessTemplateClient = {
    getEServiceTemplateById: vi.fn().mockResolvedValue(mockEserviceTemplate),
  } as unknown as EServiceTemplateProcessClient;

  const catalogProcessClient = {
    getEServiceById: vi.fn().mockResolvedValue(mockEservice),
    createEServiceDocument: vi.fn().mockResolvedValue({
      id: generateId<EServiceDocumentId>(),
    }),
    addEServiceTemplateInstanceInterfaceRest: vi.fn().mockResolvedValue({
      id: generateId<EServiceDocumentId>(),
    }),
  } as unknown as CatalogProcessClient;

  return createEServiceTemplateService(
    eserviceProcessTemplateClient,
    tenantProcessClient,
    attributeProcessClient,
    catalogProcessClient,
    fileManager
  );
}
