import {
  EServiceTemplateId,
  EServiceTemplateVersion,
  EServiceTemplateVersionId,
  eserviceTemplateVersionState,
  generateId,
  unsafeBrandId,
} from "pagopa-interop-models";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
  getMockContext,
  getMockDocument,
  getMockEServiceTemplate,
  getMockEServiceTemplateVersion,
} from "pagopa-interop-commons-test";
import {
  eserviceTemplateDocumentNotFound,
  eserviceTemplateNotFound,
  eserviceTemplateVersionNotFound,
} from "../../src/model/domain/errors.js";
import {
  addOneEServiceTemplate,
  eserviceTemplateService,
} from "../integrationUtils.js";

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
        documentId: unsafeBrandId(documentId),
      },
      getMockContext({})
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
          documentId: unsafeBrandId(generateId()),
        },
        getMockContext({})
      )
    ).rejects.toThrowError(eserviceTemplateNotFound(invalidEServiceTemplateId));
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
          documentId: unsafeBrandId(generateId()),
        },
        getMockContext({})
      )
    ).rejects.toThrowError(
      eserviceTemplateVersionNotFound(
        eServiceTemplate.id,
        invalidEServiceTemplateVersionId
      )
    );
  });
  it("Should throw eserviceTemplateDocumentNotFound", async () => {
    const documentId = generateId();
    const versionDraft: EServiceTemplateVersion = {
      ...mockEServiceTemplateVersion,
      state: eserviceTemplateVersionState.draft,
      interface: {
        ...mockDocument,
        id: unsafeBrandId(documentId),
      },
    };

    const versionPublished: EServiceTemplateVersion = {
      ...mockEServiceTemplateVersion,
      id: generateId(),
      state: "Published",
    };

    const eServiceTemplate = {
      ...mockEServiceTemplate,
      versions: [versionDraft, versionPublished],
    };

    await addOneEServiceTemplate(eServiceTemplate);

    await expect(
      eserviceTemplateService.getEServiceTemplateDocument(
        {
          eServiceTemplateId: mockEServiceTemplate.id,
          eServiceTemplateVersionId: versionDraft.id,
          documentId: unsafeBrandId(documentId),
        },
        getMockContext({})
      )
    ).rejects.toThrowError(
      eserviceTemplateDocumentNotFound(
        mockEServiceTemplate.id,
        versionDraft.id,
        documentId
      )
    );
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
          documentId: unsafeBrandId(documentId),
        },
        getMockContext({})
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
