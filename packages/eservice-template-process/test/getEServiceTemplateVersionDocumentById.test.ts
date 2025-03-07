import { genericLogger } from "pagopa-interop-commons";
import {
  EServiceTemplateId,
  EServiceTemplateVersion,
  EServiceTemplateVersionId,
  generateId,
  operationForbidden,
  unsafeBrandId,
} from "pagopa-interop-models";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
  getMockAuthData,
  getMockDocument,
  getMockEServiceTemplate,
  getMockEServiceTemplateVersion,
} from "pagopa-interop-commons-test";
import {
  eserviceTemplateDocumentNotFound,
  eServiceTemplateNotFound,
  eServiceTemplateVersionNotFound,
} from "../src/model/domain/errors.js";
import { addOneEServiceTemplate, eserviceTemplateService } from "./utils.js";

describe("getEServiceTemplateVersionDocumentById", () => {
  const mockDocument = getMockDocument();
  const mockEServiceTemplate = getMockEServiceTemplate();
  const mockEServiceTemplateVersion = getMockEServiceTemplateVersion();

  beforeAll(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date());
  });
  afterAll(() => {
    vi.useRealTimers();
  });

  it("should return the eservice template version document by id", async () => {
    const documentId = generateId();
    const version: EServiceTemplateVersion = {
      ...mockEServiceTemplateVersion,
      state: "Published",
      interface: {
        ...mockDocument,
        id: unsafeBrandId(documentId),
      },
    };

    const eServiceTemplate = {
      ...mockEServiceTemplate,
      versions: [version],
    };

    await addOneEServiceTemplate(eServiceTemplate);

    const document = await eserviceTemplateService.getEServiceTemplateDocument(
      {
        eServiceTemplateId: mockEServiceTemplate.id,
        eServiceTemplateVersionId: mockEServiceTemplateVersion.id,
        eServiceDocumentId: unsafeBrandId(documentId),
      },
      {
        authData: getMockAuthData(),
        correlationId: generateId(),
        serviceName: "",
        logger: genericLogger,
      }
    );

    expect(document).toBeDefined();
  });
  it("should throw eServiceTemplate not found", async () => {
    const eServiceTemplate = {
      ...mockEServiceTemplate,
      versions: [mockEServiceTemplateVersion],
    };

    await addOneEServiceTemplate(eServiceTemplate);

    const invalidEServiceTemplateId: EServiceTemplateId = generateId();

    await expect(
      eserviceTemplateService.getEServiceTemplateDocument(
        {
          eServiceTemplateId: invalidEServiceTemplateId,
          eServiceTemplateVersionId: mockEServiceTemplateVersion.id,
          eServiceDocumentId: unsafeBrandId(generateId()),
        },
        {
          authData: getMockAuthData(),
          correlationId: generateId(),
          serviceName: "",
          logger: genericLogger,
        }
      )
    ).rejects.toThrowError(eServiceTemplateNotFound(invalidEServiceTemplateId));
  });
  it("should throw eServiceTemplateVersion not found", async () => {
    const eServiceTemplate = {
      ...mockEServiceTemplate,
      versions: [mockEServiceTemplateVersion],
    };

    await addOneEServiceTemplate(eServiceTemplate);

    const invalidEServiceTemplateVersionId: EServiceTemplateVersionId =
      generateId();

    await expect(
      eserviceTemplateService.getEServiceTemplateDocument(
        {
          eServiceTemplateId: mockEServiceTemplate.id,
          eServiceTemplateVersionId: invalidEServiceTemplateVersionId,
          eServiceDocumentId: unsafeBrandId(generateId()),
        },
        {
          authData: getMockAuthData(),
          correlationId: generateId(),
          serviceName: "",
          logger: genericLogger,
        }
      )
    ).rejects.toThrowError(
      eServiceTemplateVersionNotFound(
        eServiceTemplate.id,
        invalidEServiceTemplateVersionId
      )
    );
  });
  it("Should throw operation forbidden", async () => {
    const documentId = generateId();
    const version: EServiceTemplateVersion = {
      ...mockEServiceTemplateVersion,
      interface: {
        ...mockDocument,
        id: unsafeBrandId(documentId),
      },
    };

    const eServiceTemplate = {
      ...mockEServiceTemplate,
      versions: [version],
    };

    await addOneEServiceTemplate(eServiceTemplate);

    await expect(
      eserviceTemplateService.getEServiceTemplateDocument(
        {
          eServiceTemplateId: mockEServiceTemplate.id,
          eServiceTemplateVersionId: mockEServiceTemplateVersion.id,
          eServiceDocumentId: unsafeBrandId(documentId),
        },
        {
          authData: getMockAuthData(),
          correlationId: generateId(),
          serviceName: "",
          logger: genericLogger,
        }
      )
    ).rejects.toThrowError(operationForbidden);
  });
  it("Should throw eServiceTemplateDocument not found", async () => {
    const documentId = generateId();

    const version: EServiceTemplateVersion = {
      ...mockEServiceTemplateVersion,
      state: "Published",
    };

    const eServiceTemplate = {
      ...mockEServiceTemplate,
      versions: [version],
    };

    await addOneEServiceTemplate(eServiceTemplate);

    await expect(
      eserviceTemplateService.getEServiceTemplateDocument(
        {
          eServiceTemplateId: mockEServiceTemplate.id,
          eServiceTemplateVersionId: mockEServiceTemplateVersion.id,
          eServiceDocumentId: unsafeBrandId(documentId),
        },
        {
          authData: getMockAuthData(),
          correlationId: generateId(),
          serviceName: "",
          logger: genericLogger,
        }
      )
    ).rejects.toThrowError(
      eserviceTemplateDocumentNotFound(
        eServiceTemplate.id,
        version.id,
        unsafeBrandId(documentId)
      )
    );
  });
});
