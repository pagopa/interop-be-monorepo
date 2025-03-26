import { fileURLToPath } from "url";
import fs from "fs/promises";
import path from "path";
import {
  getMockAuthData,
  getMockContext,
  getMockDelegation,
  getMockDescriptor,
  getMockDocument,
  getMockEService,
  getMockEServiceTemplate,
  getMockEServiceTemplateVersion,
} from "pagopa-interop-commons-test";
import { expect, describe, it, vi, afterAll, beforeAll } from "vitest";
import {
  delegationKind,
  delegationState,
  Descriptor,
  DescriptorId,
  descriptorState,
  DescriptorState,
  Document,
  EService,
  EServiceId,
  EServiceTemplate,
  EServiceTemplateId,
  EServiceTemplateVersion,
  EServiceTemplateVersionId,
  eserviceTemplateVersionState,
  generateId,
  operationForbidden,
  Technology,
  TenantId,
} from "pagopa-interop-models";
import { catalogApi } from "pagopa-interop-api-clients";
import { genericLogger } from "pagopa-interop-commons";
import { config } from "../src/config/config.js";
import {
  eServiceDescriptorNotFound,
  eServiceNotFound,
} from "../src/model/domain/errors.js";
import {
  catalogService,
  addOneEService,
  addOneEServiceTemplate,
  fileManager,
  addOneDelegation,
} from "./utils.js";

const readFileContent = async (fileName: string): Promise<string> => {
  const filename = fileURLToPath(import.meta.url);
  const dirname = path.dirname(filename);
  const filePath = `./resources/${fileName}`;

  const fileContent = await fs.readFile(`${dirname}/${filePath}`);
  return fileContent.toString();
};

const initEserviceTemplateInstance = async (
  eserviceDescriptorState: DescriptorState,
  documents: Document[] = [],
  technology?: Technology,
  interfaceDoc?: {
    doc: Document;
    content: string;
  }
): Promise<{
  eservice: EService;
  descriptor: Descriptor;
  template: EServiceTemplate;
}> => {
  await Promise.all([
    ...documents.map((doc) =>
      fileManager.storeBytes(
        {
          bucket: config.s3Bucket,
          path: config.eserviceDocumentsPath,
          resourceId: doc.id,
          name: doc.name,
          content: Buffer.from("testtest"),
        },
        genericLogger
      )
    ),
  ]);

  const interfacePath = interfaceDoc
    ? await fileManager.storeBytes(
        {
          bucket: config.s3Bucket,
          path: interfaceDoc.doc.path,
          resourceId: interfaceDoc.doc.id,
          name: interfaceDoc.doc.name,
          content: Buffer.from(interfaceDoc.content),
        },
        genericLogger
      )
    : undefined;

  const mockEserviceTemplateVersion: EServiceTemplateVersion = {
    ...getMockEServiceTemplateVersion(
      generateId<EServiceTemplateVersionId>(),
      eserviceTemplateVersionState.published
    ),
    interface:
      interfaceDoc?.doc && interfacePath
        ? { ...interfaceDoc.doc, path: interfacePath }
        : undefined,
  };

  const mockEServiceTemplate = {
    ...getMockEServiceTemplate(
      generateId<EServiceTemplateId>(),
      generateId<TenantId>(),
      [mockEserviceTemplateVersion]
    ),
    documents,
    interface: interfaceDoc,
    technology: technology || "Rest",
  };

  const mockDescriptor = {
    ...getMockDescriptor(eserviceDescriptorState),
    templateVersionRef: {
      id: mockEServiceTemplate.versions[0].id,
    },
  };

  const mockEService = {
    ...getMockEService(),
    descriptors: [mockDescriptor],
    technology: technology || "Rest",
    templateRef: {
      id: mockEServiceTemplate.id,
    },
  };

  await addOneEService(mockEService);
  await addOneEServiceTemplate(mockEServiceTemplate);

  return {
    eservice: mockEService,
    descriptor: mockDescriptor,
    template: mockEServiceTemplate,
  };
};

describe("addEServiceTemplateInstanceInterface", () => {
  beforeAll(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date());
  });

  afterAll(() => {
    vi.useRealTimers();
  });

  describe("Invalid data input (Rest/Soap)", () => {
    it("should throw an eserviceInterfaceDataNotValid if template doesn't contains serverUrls", async () => {
      const eserviceId = generateId<EServiceId>();
      await expect(
        catalogService.addEServiceTemplateInstanceInterface(
          eserviceId,
          generateId(),
          {
            contactName: "Jhon Doe",
            contactUrl: "https://fun.tester.johnny.info",
            contactEmail: "johnnyd@funnytester.com",
            termsAndConditionsUrl: "https://fun.tester.johnny.terms.com",
            serverUrls: ["https://fun.tester.server.com"],
          },
          getMockContext({ authData: getMockAuthData() })
        )
      ).rejects.toThrow(eServiceNotFound(eserviceId));
    });

    it("should throw an eServiceDescriptorNotFound if descriptor doesn't exist", async () => {
      const mockEserviceTemplateVersion = getMockEServiceTemplateVersion();
      const mockEServiceTemplate = getMockEServiceTemplate(
        generateId<EServiceTemplateId>(),
        generateId<TenantId>(),
        [mockEserviceTemplateVersion]
      );
      const mockEService = getMockEService();
      await addOneEService(mockEService);
      await addOneEServiceTemplate(mockEServiceTemplate);

      const invalidDescriptorId = generateId<DescriptorId>();
      await expect(
        catalogService.addEServiceTemplateInstanceInterface(
          mockEService.id,
          invalidDescriptorId,
          {
            contactName: "Jhon Doe",
            contactUrl: "https://fun.tester.johnny.info",
            contactEmail: "johnnyd@funnytester.com",
            termsAndConditionsUrl: "https://fun.tester.johnny.terms.com",
            serverUrls: ["https://fun.tester.server.com"],
          },
          getMockContext({ authData: getMockAuthData() })
        )
      ).rejects.toThrow(
        eServiceDescriptorNotFound(mockEService.id, invalidDescriptorId)
      );
    });

    it("should throw an operationForbidden if exists Producer delegation and requester is not a Delgate", async () => {
      const authData = getMockAuthData();
      const eserviceId = generateId<EServiceId>();

      const interfaceDoc = getMockDocument();
      const interfacePath = await fileManager.storeBytes(
        {
          bucket: config.s3Bucket,
          path: interfaceDoc.path,
          resourceId: interfaceDoc.id,
          name: interfaceDoc.name,
          content: Buffer.from("a fake file content"),
        },
        genericLogger
      );

      const mockEserviceTemplateVersion = {
        ...getMockEServiceTemplateVersion(
          generateId<EServiceTemplateVersionId>(),
          eserviceTemplateVersionState.published
        ),
        interface: { ...interfaceDoc, path: interfacePath },
      };

      const mockEServiceTemplate = {
        ...getMockEServiceTemplate(
          generateId<EServiceTemplateId>(),
          generateId<TenantId>(),
          [mockEserviceTemplateVersion]
        ),
      };
      const mockDescriptor = {
        ...getMockDescriptor(),
        templateVersionRef: {
          id: mockEServiceTemplate.versions[0].id,
        },
      };

      const mockEService = {
        ...getMockEService(eserviceId, authData.organizationId, [
          mockDescriptor,
        ]),
        templateRef: {
          id: mockEServiceTemplate.id,
        },
      };

      const mockDelegation = getMockDelegation({
        eserviceId,
        delegateId: generateId<TenantId>(),
        kind: delegationKind.delegatedProducer,
        state: delegationState.active,
      });

      await addOneEService(mockEService);
      await addOneEServiceTemplate(mockEServiceTemplate);
      await addOneDelegation(mockDelegation);

      await expect(
        catalogService.addEServiceTemplateInstanceInterface(
          eserviceId,
          mockDescriptor.id,
          {
            contactName: "Jhon Doe",
            contactUrl: "https://fun.tester.johnny.info",
            contactEmail: "johnnyd@funnytester.com",
            termsAndConditionsUrl: "https://fun.tester.johnny.terms.com",
            serverUrls: ["https://fun.tester.server.com"],
          },
          getMockContext({ authData })
        )
      ).rejects.toThrow(operationForbidden);
    });
  });
  describe("API REST", () => {
    it("should add interface REST interface to eservice template instance", async () => {
      const interfaceDocumentFile = {
        ...getMockDocument(),
        name: "test.openapi.3.0.2.yaml",
        contentType: "yaml",
        path: `${config.eserviceDocumentsPath}`,
      };

      const document1 = getMockDocument();
      const document2 = getMockDocument();
      const { eservice, descriptor, template } =
        await initEserviceTemplateInstance(
          descriptorState.draft,
          [
            {
              ...document1,
              path: `${config.eserviceDocumentsPath}`,
            },
            {
              ...document2,
              path: `${config.eserviceDocumentsPath}`,
            },
          ],
          "Rest",
          {
            doc: interfaceDocumentFile,
            content: await readFileContent("test.openapi.3.0.2.yaml"),
          }
        );

      const expectedServerUrls = [
        "https://fun.tester.server.com",
        "https://fun.tester.server.it",
        "https://fun.tester.server.io",
      ];
      const contactName = "Jhon Doe";
      const contactUrl = "https://fun.tester.johnny.info";
      const contactEmail = "johnnyd@funnytester.com";
      const termsAndConditionsUrl = "https://fun.tester.johnny.terms.com";
      const requestPayload: catalogApi.TemplateInstanceInterfaceRESTSeed = {
        contactName,
        contactUrl,
        contactEmail,
        termsAndConditionsUrl,
        serverUrls: expectedServerUrls,
      };

      const res = await catalogService.addEServiceTemplateInstanceInterface(
        eservice.id,
        descriptor.id,
        requestPayload,
        getMockContext({ authData: getMockAuthData(eservice.producerId) })
      );

      // Assert descriptor contains template interface metadata
      expect(res.descriptors[0]?.state).toBe(descriptorState.draft);
      expect(res.descriptors[0]?.serverUrls).toStrictEqual(expectedServerUrls);
      expect(res.descriptors[0]?.interface).toMatchObject({
        name: interfaceDocumentFile.name,
        prettyName: interfaceDocumentFile.prettyName,
        contentType: "yaml",
        uploadDate: new Date(),
      });
      expect(res.descriptors[0]).toMatchObject({
        templateVersionRef: {
          id: template.versions[0].id,
          interfaceMetadata: {
            contactEmail,
            contactName,
            contactUrl,
            termsAndConditionsUrl,
          },
        },
      });
    });
  });

  describe("API SOAP", () => {
    it("should add interface SOAP interface to eservice template instance", async () => {
      const interfaceDocumentFile = {
        ...getMockDocument(),
        name: "interface-test.wsdl",
        contentType: "wsdl",
        path: `${config.eserviceDocumentsPath}`,
      };

      const document1 = getMockDocument();
      const document2 = getMockDocument();
      const { eservice, descriptor, template } =
        await initEserviceTemplateInstance(
          descriptorState.draft,
          [
            {
              ...document1,
              path: `${config.eserviceDocumentsPath}`,
            },
            {
              ...document2,
              path: `${config.eserviceDocumentsPath}`,
            },
          ],
          "Soap",
          {
            doc: interfaceDocumentFile,
            content: await readFileContent("interface-test.wsdl"),
          }
        );

      const expectedServerUrls = ["https://host.com/TestWS/v1"];
      const requestPayload: catalogApi.TemplateInstanceInterfaceSOAPSeed = {
        serverUrls: expectedServerUrls,
      };

      const res = await catalogService.addEServiceTemplateInstanceInterface(
        eservice.id,
        descriptor.id,
        requestPayload,
        getMockContext({ authData: getMockAuthData(eservice.producerId) })
      );

      // Assert descriptor contains template interface metadata
      expect(res.descriptors[0]?.state).toBe(descriptorState.draft);
      expect(res.descriptors[0]?.serverUrls).toStrictEqual(expectedServerUrls);
      expect(res.descriptors[0]?.interface).toMatchObject({
        name: interfaceDocumentFile.name,
        prettyName: interfaceDocumentFile.prettyName,
        contentType: "wsdl",
        uploadDate: new Date(),
      });
      expect(
        res.descriptors[0].templateVersionRef?.interfaceMetadata
      ).toBeUndefined();
      expect(res.descriptors[0]).toMatchObject({
        templateVersionRef: {
          id: template.versions[0].id,
        },
      });
    });
  });
});
