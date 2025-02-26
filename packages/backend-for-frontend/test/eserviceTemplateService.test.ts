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
import {
  catalogApi,
  delegationApi,
  eserviceTemplateApi,
} from "pagopa-interop-api-clients";
import {
  AttributeProcessClient,
  CatalogProcessClient,
  DelegationProcessClient,
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
  mockEserviceTemplate: eserviceTemplateApi.EServiceTemplate,
  mockDelegation?: delegationApi.Delegation
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
  } as unknown as CatalogProcessClient;

  const delegationProcessClient = {
    delegation: {
      getDelegations: vi.fn().mockResolvedValue(mockDelegation),
    },
  } as unknown as DelegationProcessClient;

  return createEServiceTemplateService(
    eserviceProcessTemplateClient,
    tenantProcessClient,
    attributeProcessClient,
    catalogProcessClient,
    delegationProcessClient,
    fileManager,
    config
  );
}

describe("E-service Template Service BFF ", () => {
  describe("Add Interface to E-service draft by template", () => {
    it.each([
      {
        fileName: "test.openapi.3.0.2",
        interfaceFileExtension: "json",
      },
      {
        fileName: "test.openapi.3.0.2",
        interfaceFileExtension: "yaml",
      },
    ])(
      "should add OpenAPI interface with OpenAPI 3.0 by template fileName %s",
      async ({ fileName, interfaceFileExtension }) => {
        const authData = getRandomAuthData();
        const context: WithLogger<BffAppContext> = {
          serviceName: "test",
          authData,
          correlationId: generateId(),
          logger: genericLogger,
          headers: {
            "X-Correlation-Id": generateId(),
            Authorization: "Bearer token",
          },
        };
        const eserviceTemplateId = generateId<EServiceTemplateId>();
        const eserviceTemplateVersionId =
          generateId<EServiceTemplateVersionId>();
        const draftDescriptor = {
          ...getMockDescriptor("Draft"),
          templateVersionRef: {
            id: eserviceTemplateVersionId,
          },
        };
        const eservice = {
          ...getMockEService(
            generateId<EServiceId>(),
            authData.organizationId,
            [draftDescriptor]
          ),
          templateRef: {
            id: eserviceTemplateId,
          },
        };

        const interfaceResourceId = generateId<EServiceDocumentId>();
        const apiFileBuffer = await readBufferFromFile(
          interfaceFileExtension,
          fileName
        );
        const path = await fileManager.storeBytes(
          {
            bucket: config.eserviceTemplateDocumentsContainer,
            path: config.eserviceTemplateDocumentsPath,
            resourceId: interfaceResourceId,
            name: `test.openapi.${interfaceFileExtension}`,
            content: apiFileBuffer,
          },
          genericLogger
        );
        const interfaceTemplate: Document = {
          id: interfaceResourceId,
          name: `TestOpenApi.${interfaceFileExtension}`,
          contentType: interfaceFileExtension,
          prettyName: "Prettified Name",
          path,
          checksum: "123456",
          uploadDate: new Date(),
        };

        const eserviceTemplateVersion: EServiceTemplateVersion = {
          ...getMockEServiceTemplateVersion(eserviceTemplateVersionId),
          state: eserviceTemplateVersionState.published,
          interface: interfaceTemplate,
        };
        const eserviceTemplate = getMockEServiceTemplate(
          eserviceTemplateId,
          authData.organizationId,
          [eserviceTemplateVersion]
        );

        const eserviceTemplateService = getEserviceTemplateServiceMock(
          toEserviceCatalogProcessMock(eservice, draftDescriptor),
          toEserviceTemplateProcessMock(
            eserviceTemplate,
            eserviceTemplateVersion
          ),
          {
            id: generateId(),
            delegatorId: eservice.producerId,
            delegateId: authData.organizationId,
            eserviceId: eservice.id,
            state: "ACTIVE",
            kind: "DELEGATED_PRODUCER",
            createdAt: new Date().toISOString(),
            stamps: {
              submission: {
                who: authData.organizationId,
                when: new Date().toISOString(),
              },
            },
          }
        );

        const requestPayload = {
          contactName: "John Doe",
          email: "test-jhon-doe@email.test.com",
          contactUrl: "http://example.com",
          termsAndConditionsUrl: "http://example.com/terms",
          serverUrls: [
            "http://example.com",
            "http://example.com",
            "http://example.com",
          ],
        };

        const resourceId =
          await eserviceTemplateService.addEserviceInterfaceByTemplate(
            eservice.id,
            draftDescriptor.id,
            requestPayload,
            context
          );

        expect(resourceId.id).not.toBeNull();
      }
    );
  });
});
