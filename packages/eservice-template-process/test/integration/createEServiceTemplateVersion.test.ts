/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/no-floating-promises */
import {
  decodeProtobufPayload,
  getMockContext,
  getMockDocument,
  getMockEServiceTemplate,
  getMockEServiceTemplateVersion,
  getMockAuthData,
  readEventByStreamIdAndVersion,
} from "pagopa-interop-commons-test";
import {
  EServiceTemplateVersionAddedV2,
  toEServiceTemplateV2,
  EServiceTemplateVersion,
  operationForbidden,
  eserviceTemplateVersionState,
  EServiceTemplate,
  Attribute,
  generateId,
  EServiceTemplateVersionDocumentAddedV2,
  AttributeId,
} from "pagopa-interop-models";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { eserviceTemplateApi } from "pagopa-interop-api-clients";
import {
  attributeNotFound,
  draftEServiceTemplateVersionAlreadyExists,
  eserviceTemplateNotFound,
  eserviceTemplateWithoutPublishedVersion,
  inconsistentDailyCalls,
} from "../../src/model/domain/errors.js";
import {
  eserviceTemplateService,
  readLastEserviceTemplateEvent,
  addOneEServiceTemplate,
  addOneAttribute,
  postgresDB,
} from "../integrationUtils.js";
import { buildCreateVersionSeed } from "../mockUtils.js";

describe("createEServiceTemplateVersion", async () => {
  beforeAll(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date());
  });
  afterAll(() => {
    vi.useRealTimers();
  });
  it("should write on event-store for the creation of a version (eservice already had one version)", async () => {
    const mockDocument = getMockDocument();
    const existingVersion: EServiceTemplateVersion = {
      ...getMockEServiceTemplateVersion(),
      interface: getMockDocument(),
      state: eserviceTemplateVersionState.published,
    };
    const mockVersion: EServiceTemplateVersion = {
      ...getMockEServiceTemplateVersion(),
      docs: [mockDocument],
    };
    const eserviceTemplate: EServiceTemplate = {
      ...getMockEServiceTemplate(),
      versions: [existingVersion],
    };
    await addOneEServiceTemplate(eserviceTemplate);
    const attribute: Attribute = {
      name: "Attribute name",
      id: generateId(),
      kind: "Declared",
      description: "Attribute Description",
      creationTime: new Date(),
    };
    await addOneAttribute(attribute);
    const versionSeed: eserviceTemplateApi.EServiceTemplateVersionSeed = {
      ...buildCreateVersionSeed(mockVersion),
      attributes: {
        certified: [],
        declared: [
          [{ id: attribute.id, explicitAttributeVerification: false }],
        ],
        verified: [],
      },
    };

    const createVersionResponse =
      await eserviceTemplateService.createEServiceTemplateVersion(
        eserviceTemplate.id,
        versionSeed,
        getMockContext({
          authData: getMockAuthData(eserviceTemplate.creatorId),
        })
      );

    const newVersionId =
      createVersionResponse.data.createdEServiceTemplateVersionId;
    const versionCreationEvent = await readEventByStreamIdAndVersion(
      eserviceTemplate.id,
      1,
      "eservice_template",
      postgresDB
    );
    const documentAdditionEvent = await readLastEserviceTemplateEvent(
      eserviceTemplate.id
    );

    expect(versionCreationEvent).toMatchObject({
      stream_id: eserviceTemplate.id,
      version: "1",
      type: "EServiceTemplateVersionAdded",
      event_version: 2,
    });
    expect(documentAdditionEvent).toMatchObject({
      stream_id: eserviceTemplate.id,
      version: "2",
      type: "EServiceTemplateVersionDocumentAdded",
      event_version: 2,
    });

    const versionCreationPayload = decodeProtobufPayload({
      messageType: EServiceTemplateVersionAddedV2,
      payload: versionCreationEvent.data,
    });
    const documentAdditionPayload = decodeProtobufPayload({
      messageType: EServiceTemplateVersionDocumentAddedV2,
      payload: documentAdditionEvent.data,
    });

    const newVersion: EServiceTemplateVersion = {
      ...mockVersion,
      version: 2,
      createdAt: new Date(),
      id: newVersionId,
      attributes: {
        certified: [],
        declared: [
          [{ id: attribute.id, explicitAttributeVerification: false }],
        ],
        verified: [],
      },
      docs: [],
    };

    const expectedEServiceTemplateAfterVersionCreation: EServiceTemplate = {
      ...eserviceTemplate,
      versions: [...eserviceTemplate.versions, newVersion],
    };
    const expectedEServiceTemplateAfterDocumentAddition: EServiceTemplate = {
      ...expectedEServiceTemplateAfterVersionCreation,
      versions: expectedEServiceTemplateAfterVersionCreation.versions.map((d) =>
        d.id === newVersion.id ? { ...newVersion, docs: [mockDocument] } : d
      ),
    };

    expect(createVersionResponse).toEqual({
      data: {
        createdEServiceTemplateVersionId: newVersionId,
        eserviceTemplate: expectedEServiceTemplateAfterDocumentAddition,
      },
      metadata: { version: 2 },
    });
    expect(versionCreationPayload).toEqual({
      eserviceTemplateVersionId: newVersionId,
      eserviceTemplate: toEServiceTemplateV2(
        expectedEServiceTemplateAfterVersionCreation
      ),
    });
    expect(documentAdditionPayload).toEqual({
      documentId: mockDocument.id,
      eserviceTemplateVersionId: newVersionId,
      eserviceTemplate: toEServiceTemplateV2(
        expectedEServiceTemplateAfterDocumentAddition
      ),
    });
  });
  it("should throw draftVersionAlreadyExists if a version with state draft already exists", async () => {
    const version: EServiceTemplateVersion = {
      ...getMockEServiceTemplateVersion(),
      state: eserviceTemplateVersionState.draft,
    };
    const eserviceTemplate: EServiceTemplate = {
      ...getMockEServiceTemplate(),
      versions: [
        {
          ...getMockEServiceTemplateVersion(),
          state: eserviceTemplateVersionState.published,
        },
        version,
      ],
    };

    await addOneEServiceTemplate(eserviceTemplate);
    expect(
      eserviceTemplateService.createEServiceTemplateVersion(
        eserviceTemplate.id,
        buildCreateVersionSeed(version),
        getMockContext({
          authData: getMockAuthData(eserviceTemplate.creatorId),
        })
      )
    ).rejects.toThrowError(
      draftEServiceTemplateVersionAlreadyExists(eserviceTemplate.id)
    );
  });
  it("should throw eServiceTemplateNotFound if the eservice doesn't exist", async () => {
    const mockEServiceTemplate = getMockEServiceTemplate();
    expect(
      eserviceTemplateService.createEServiceTemplateVersion(
        mockEServiceTemplate.id,
        buildCreateVersionSeed(getMockEServiceTemplateVersion()),
        getMockContext({
          authData: getMockAuthData(mockEServiceTemplate.creatorId),
        })
      )
    ).rejects.toThrowError(eserviceTemplateNotFound(mockEServiceTemplate.id));
  });
  it("should throw attributeNotFound if at least one of the attributes doesn't exist", async () => {
    const eserviceTemplate: EServiceTemplate = {
      ...getMockEServiceTemplate(),
      versions: [
        {
          ...getMockEServiceTemplateVersion(),
          state: eserviceTemplateVersionState.published,
        },
      ],
    };
    await addOneEServiceTemplate(eserviceTemplate);

    const attribute: Attribute = {
      name: "Attribute name",
      id: generateId(),
      kind: "Declared",
      description: "Attribute Description",
      creationTime: new Date(),
    };
    await addOneAttribute(attribute);
    const notExistingId1 = generateId<AttributeId>();
    const notExistingId2 = generateId<AttributeId>();
    const versionSeed = {
      ...buildCreateVersionSeed(getMockEServiceTemplateVersion()),
      attributes: {
        certified: [],
        declared: [
          [
            { id: attribute.id, explicitAttributeVerification: false },
            {
              id: notExistingId1,
              explicitAttributeVerification: false,
            },
            {
              id: notExistingId2,
              explicitAttributeVerification: false,
            },
          ],
        ],
        verified: [],
      },
    };

    expect(
      eserviceTemplateService.createEServiceTemplateVersion(
        eserviceTemplate.id,
        versionSeed,
        getMockContext({
          authData: getMockAuthData(eserviceTemplate.creatorId),
        })
      )
    ).rejects.toThrowError(attributeNotFound(notExistingId1));
  });
  it("should throw eserviceTemplateWithoutPublishedVersion if the e-service template has no published versions", async () => {
    const eserviceTemplateDraftVersion: EServiceTemplateVersion = {
      ...getMockEServiceTemplateVersion(),
      state: eserviceTemplateVersionState.draft,
    };

    const eserviceTemplate: EServiceTemplate = {
      ...getMockEServiceTemplate(),
      versions: [eserviceTemplateDraftVersion],
    };

    await addOneEServiceTemplate(eserviceTemplate);
    const eserviceTemplateVersionSeed: eserviceTemplateApi.EServiceTemplateVersionSeed =
      buildCreateVersionSeed(eserviceTemplate.versions[0]!);

    expect(
      eserviceTemplateService.createEServiceTemplateVersion(
        eserviceTemplate.id,
        eserviceTemplateVersionSeed,
        getMockContext({
          authData: getMockAuthData(eserviceTemplate.creatorId),
        })
      )
    ).rejects.toThrowError(
      eserviceTemplateWithoutPublishedVersion(eserviceTemplate.id)
    );
  });
  it("should throw inconsistentDailyCalls if dailyCallsPerConsumer is greater than dailyCallsTotal", async () => {
    const versionSeed: eserviceTemplateApi.EServiceTemplateVersionSeed = {
      ...buildCreateVersionSeed(getMockEServiceTemplateVersion()),
      dailyCallsPerConsumer: 100,
      dailyCallsTotal: 50,
    };

    const eserviceTemplate: EServiceTemplate = {
      ...getMockEServiceTemplate(),
      versions: [
        {
          ...getMockEServiceTemplateVersion(),
          state: eserviceTemplateVersionState.published,
        },
      ],
    };

    await addOneEServiceTemplate(eserviceTemplate);
    expect(
      eserviceTemplateService.createEServiceTemplateVersion(
        eserviceTemplate.id,
        versionSeed,
        getMockContext({
          authData: getMockAuthData(eserviceTemplate.creatorId),
        })
      )
    ).rejects.toThrowError(inconsistentDailyCalls());
  });
  it("should throw operationForbidden if the requester is not the template creator", async () => {
    const existingVersion: EServiceTemplateVersion = {
      ...getMockEServiceTemplateVersion(),
      interface: getMockDocument(),
      state: eserviceTemplateVersionState.published,
    };
    const eserviceTemplate: EServiceTemplate = {
      ...getMockEServiceTemplate(),
      versions: [existingVersion],
    };
    await addOneEServiceTemplate(eserviceTemplate);
    const eserviceTemplateVersionSeed = buildCreateVersionSeed(existingVersion);
    expect(
      eserviceTemplateService.createEServiceTemplateVersion(
        eserviceTemplate.id,
        eserviceTemplateVersionSeed,
        getMockContext({})
      )
    ).rejects.toThrowError(operationForbidden);
  });
});
