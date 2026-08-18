/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/no-floating-promises */
import { genericLogger } from "pagopa-interop-commons";
import {
  decodeProtobufPayload,
  getMockAuthData,
  getMockContext,
  getMockDocument,
  getMockEServiceTemplate,
  getMockEServiceTemplateVersion,
  readEventByStreamIdAndVersion,
  StoredEvent,
  writeInEventstore,
} from "pagopa-interop-commons-test";
import {
  Document,
  EServiceDocumentId,
  EServiceTemplate,
  EServiceTemplateEvent,
  EServiceTemplateVersion,
  EServiceTemplateVersionAddedV2,
  EServiceTemplateVersionDocumentAddedV2,
  eserviceTemplateVersionState,
  generateId,
  operationForbidden,
  TenantId,
  toEServiceTemplateV2,
} from "pagopa-interop-models";
import { upsertEServiceTemplate } from "pagopa-interop-readmodel/testUtils";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { config } from "../../src/config/config.js";
import {
  draftEServiceTemplateVersionAlreadyExists,
  eserviceTemplateNotFound,
  eserviceTemplateWithoutPublishedVersion,
} from "../../src/model/domain/errors.js";
import {
  addOneEServiceTemplate,
  eserviceTemplateService,
  fileManager,
  postgresDB,
  readModelDB,
  readLastEserviceTemplateEvent,
} from "../integrationUtils.js";

const buildDocument = (suffix: string): Document => {
  const id = generateId<EServiceDocumentId>();
  return {
    ...getMockDocument(),
    id,
    name: `fileName_${suffix}`,
    prettyName: `prettyName_${suffix}`,
    path: `${config.eserviceTemplateDocumentsPath}/${id}/fileName_${suffix}`,
    checksum: `checksum_${suffix}`,
  };
};

const storeDocument = async (doc: Document): Promise<void> => {
  await fileManager.storeBytes(
    {
      bucket: config.s3Bucket,
      path: config.eserviceTemplateDocumentsPath,
      resourceId: doc.id,
      name: doc.name,
      content: Buffer.from("testtest"),
    },
    genericLogger
  );
};

/**
 * Advances the e-service template event stream (and its readmodel metadata
 * version) to `targetVersion`, so that the operation under test does not start
 * from 0.
 */
const advanceTemplateStreamVersion = async (
  eserviceTemplate: EServiceTemplate,
  targetVersion: number
): Promise<void> => {
  for (let version = 1; version <= targetVersion; version++) {
    const event: StoredEvent<EServiceTemplateEvent> = {
      stream_id: eserviceTemplate.id,
      version,
      event: {
        type: "EServiceTemplateNameUpdated",
        event_version: 2,
        data: { eserviceTemplate: toEServiceTemplateV2(eserviceTemplate) },
      },
    };
    await writeInEventstore(event, "eservice_template", postgresDB);
  }
  await upsertEServiceTemplate(readModelDB, eserviceTemplate, targetVersion);
};

describe("createEServiceTemplateVersionFromLatest", async () => {
  beforeAll(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date());
  });
  afterAll(() => {
    vi.useRealTimers();
  });

  it("should write on event-store for the creation of a version cloning the latest one, with its documents", async () => {
    vi.spyOn(fileManager, "copy").mockClear();

    const document1 = buildDocument("1");
    const document2 = buildDocument("2");

    const previousVersion: EServiceTemplateVersion = {
      ...getMockEServiceTemplateVersion(),
      version: 1,
      state: eserviceTemplateVersionState.published,
      description: "previous version description",
      voucherLifespan: 120,
      dailyCallsPerConsumer: 33,
      dailyCallsTotal: 333,
      agreementApprovalPolicy: "Manual",
      interface: getMockDocument(),
      docs: [document1, document2],
    };
    const eserviceTemplate: EServiceTemplate = {
      ...getMockEServiceTemplate(),
      versions: [previousVersion],
    };
    await addOneEServiceTemplate(eserviceTemplate);
    await storeDocument(document1);
    await storeDocument(document2);

    const response =
      await eserviceTemplateService.createEServiceTemplateVersionFromLatest(
        eserviceTemplate.id,
        getMockContext({
          authData: getMockAuthData(eserviceTemplate.creatorId),
        })
      );

    const newVersionId = response.data.createdEServiceTemplateVersionId;
    const newVersion = response.data.eserviceTemplate.versions.find(
      (v) => v.id === newVersionId
    )!;

    expect(newVersion).toMatchObject({
      version: 2,
      state: eserviceTemplateVersionState.draft,
      description: previousVersion.description,
      voucherLifespan: previousVersion.voucherLifespan,
      dailyCallsPerConsumer: previousVersion.dailyCallsPerConsumer,
      dailyCallsTotal: previousVersion.dailyCallsTotal,
      agreementApprovalPolicy: previousVersion.agreementApprovalPolicy,
      attributes: previousVersion.attributes,
      interface: undefined,
    });

    expect(newVersion.docs).toHaveLength(2);
    const [clonedDocument1, clonedDocument2] = newVersion.docs;

    expect(clonedDocument1.id).not.toEqual(document1.id);
    expect(clonedDocument2.id).not.toEqual(document2.id);
    expect(clonedDocument1).toEqual({
      id: clonedDocument1.id,
      name: document1.name,
      prettyName: document1.prettyName,
      contentType: document1.contentType,
      checksum: document1.checksum,
      path: `${config.eserviceTemplateDocumentsPath}/${clonedDocument1.id}/${document1.name}`,
      uploadDate: new Date(),
    });
    expect(clonedDocument2).toEqual({
      id: clonedDocument2.id,
      name: document2.name,
      prettyName: document2.prettyName,
      contentType: document2.contentType,
      checksum: document2.checksum,
      path: `${config.eserviceTemplateDocumentsPath}/${clonedDocument2.id}/${document2.name}`,
      uploadDate: new Date(),
    });

    expect(fileManager.copy).toHaveBeenCalledWith(
      config.s3Bucket,
      document1.path,
      config.eserviceTemplateDocumentsPath,
      clonedDocument1.id,
      document1.name,
      genericLogger
    );
    expect(fileManager.copy).toHaveBeenCalledWith(
      config.s3Bucket,
      document2.path,
      config.eserviceTemplateDocumentsPath,
      clonedDocument2.id,
      document2.name,
      genericLogger
    );
    const storedFiles = await fileManager.listFiles(
      config.s3Bucket,
      genericLogger
    );
    expect(storedFiles).toContain(clonedDocument1.path);
    expect(storedFiles).toContain(clonedDocument2.path);

    const versionCreationEvent = await readEventByStreamIdAndVersion(
      eserviceTemplate.id,
      1,
      "eservice_template",
      postgresDB
    );
    const document1AdditionEvent = await readEventByStreamIdAndVersion(
      eserviceTemplate.id,
      2,
      "eservice_template",
      postgresDB
    );
    const document2AdditionEvent = await readEventByStreamIdAndVersion(
      eserviceTemplate.id,
      3,
      "eservice_template",
      postgresDB
    );

    expect(versionCreationEvent).toMatchObject({
      stream_id: eserviceTemplate.id,
      version: "1",
      type: "EServiceTemplateVersionAdded",
      event_version: 2,
    });
    expect(document1AdditionEvent).toMatchObject({
      stream_id: eserviceTemplate.id,
      version: "2",
      type: "EServiceTemplateVersionDocumentAdded",
      event_version: 2,
    });
    expect(document2AdditionEvent).toMatchObject({
      stream_id: eserviceTemplate.id,
      version: "3",
      type: "EServiceTemplateVersionDocumentAdded",
      event_version: 2,
    });
    expect(
      await readLastEserviceTemplateEvent(eserviceTemplate.id)
    ).toMatchObject({
      version: "3",
    });

    const versionCreationPayload = decodeProtobufPayload({
      messageType: EServiceTemplateVersionAddedV2,
      payload: versionCreationEvent.data,
    });
    expect(versionCreationPayload.eserviceTemplateVersionId).toEqual(
      newVersionId
    );
    expect(
      versionCreationPayload.eserviceTemplate!.versions.find(
        (v) => v.id === newVersionId
      )!.docs
    ).toEqual([]);

    const document2AdditionPayload = decodeProtobufPayload({
      messageType: EServiceTemplateVersionDocumentAddedV2,
      payload: document2AdditionEvent.data,
    });
    expect(document2AdditionPayload).toEqual({
      documentId: clonedDocument2.id,
      eserviceTemplateVersionId: newVersionId,
      eserviceTemplate: toEServiceTemplateV2(response.data.eserviceTemplate),
    });

    expect(response.metadata).toEqual({ version: 3 });
  });

  it("should emit events with versions relative to the current e-service template stream version", async () => {
    const document1 = buildDocument("1");
    const document2 = buildDocument("2");

    const previousVersion: EServiceTemplateVersion = {
      ...getMockEServiceTemplateVersion(),
      version: 1,
      state: eserviceTemplateVersionState.published,
      docs: [document1, document2],
    };
    const eserviceTemplate: EServiceTemplate = {
      ...getMockEServiceTemplate(),
      versions: [previousVersion],
    };
    await addOneEServiceTemplate(eserviceTemplate);
    await advanceTemplateStreamVersion(eserviceTemplate, 4);
    await storeDocument(document1);
    await storeDocument(document2);

    const response =
      await eserviceTemplateService.createEServiceTemplateVersionFromLatest(
        eserviceTemplate.id,
        getMockContext({
          authData: getMockAuthData(eserviceTemplate.creatorId),
        })
      );

    expect(
      await readEventByStreamIdAndVersion(
        eserviceTemplate.id,
        5,
        "eservice_template",
        postgresDB
      )
    ).toMatchObject({
      version: "5",
      type: "EServiceTemplateVersionAdded",
    });
    expect(
      await readEventByStreamIdAndVersion(
        eserviceTemplate.id,
        6,
        "eservice_template",
        postgresDB
      )
    ).toMatchObject({
      version: "6",
      type: "EServiceTemplateVersionDocumentAdded",
    });
    expect(
      await readEventByStreamIdAndVersion(
        eserviceTemplate.id,
        7,
        "eservice_template",
        postgresDB
      )
    ).toMatchObject({
      version: "7",
      type: "EServiceTemplateVersionDocumentAdded",
    });
    expect(
      await readLastEserviceTemplateEvent(eserviceTemplate.id)
    ).toMatchObject({
      version: "7",
    });
    expect(response.metadata).toEqual({ version: 7 });
  });

  it("should throw eserviceTemplateNotFound if the template doesn't exist", async () => {
    const eserviceTemplate = getMockEServiceTemplate();
    expect(
      eserviceTemplateService.createEServiceTemplateVersionFromLatest(
        eserviceTemplate.id,
        getMockContext({
          authData: getMockAuthData(eserviceTemplate.creatorId),
        })
      )
    ).rejects.toThrowError(eserviceTemplateNotFound(eserviceTemplate.id));
  });

  it("should throw eserviceTemplateWithoutPublishedVersion if the template has no published version", async () => {
    const eserviceTemplate: EServiceTemplate = {
      ...getMockEServiceTemplate(),
      versions: [
        {
          ...getMockEServiceTemplateVersion(),
          state: eserviceTemplateVersionState.draft,
        },
      ],
    };
    await addOneEServiceTemplate(eserviceTemplate);

    expect(
      eserviceTemplateService.createEServiceTemplateVersionFromLatest(
        eserviceTemplate.id,
        getMockContext({
          authData: getMockAuthData(eserviceTemplate.creatorId),
        })
      )
    ).rejects.toThrowError(
      eserviceTemplateWithoutPublishedVersion(eserviceTemplate.id)
    );
  });

  it("should throw draftEServiceTemplateVersionAlreadyExists if a draft version already exists", async () => {
    const eserviceTemplate: EServiceTemplate = {
      ...getMockEServiceTemplate(),
      versions: [
        {
          ...getMockEServiceTemplateVersion(),
          version: 1,
          state: eserviceTemplateVersionState.published,
        },
        {
          ...getMockEServiceTemplateVersion(),
          version: 2,
          state: eserviceTemplateVersionState.draft,
        },
      ],
    };
    await addOneEServiceTemplate(eserviceTemplate);

    expect(
      eserviceTemplateService.createEServiceTemplateVersionFromLatest(
        eserviceTemplate.id,
        getMockContext({
          authData: getMockAuthData(eserviceTemplate.creatorId),
        })
      )
    ).rejects.toThrowError(
      draftEServiceTemplateVersionAlreadyExists(eserviceTemplate.id)
    );
  });

  it("should throw operationForbidden if the requester is not the template creator", async () => {
    const eserviceTemplate: EServiceTemplate = {
      ...getMockEServiceTemplate(),
      versions: [
        {
          ...getMockEServiceTemplateVersion(),
          version: 1,
          state: eserviceTemplateVersionState.published,
        },
      ],
    };
    await addOneEServiceTemplate(eserviceTemplate);

    expect(
      eserviceTemplateService.createEServiceTemplateVersionFromLatest(
        eserviceTemplate.id,
        getMockContext({ authData: getMockAuthData(generateId<TenantId>()) })
      )
    ).rejects.toThrowError(operationForbidden);
  });

  it("should clone documents sharing checksum and case-variant prettyNames", async () => {
    const document1: Document = {
      ...buildDocument("1"),
      prettyName: "prettyName",
      checksum: "sharedChecksum",
    };
    const document2: Document = {
      ...buildDocument("2"),
      prettyName: "PRETTYNAME",
      checksum: "sharedChecksum",
    };

    const eserviceTemplate: EServiceTemplate = {
      ...getMockEServiceTemplate(),
      versions: [
        {
          ...getMockEServiceTemplateVersion(),
          version: 1,
          state: eserviceTemplateVersionState.published,
          docs: [document1, document2],
        },
      ],
    };
    await addOneEServiceTemplate(eserviceTemplate);
    await storeDocument(document1);
    await storeDocument(document2);

    const response =
      await eserviceTemplateService.createEServiceTemplateVersionFromLatest(
        eserviceTemplate.id,
        getMockContext({
          authData: getMockAuthData(eserviceTemplate.creatorId),
        })
      );

    const newVersion = response.data.eserviceTemplate.versions.find(
      (v) => v.id === response.data.createdEServiceTemplateVersionId
    )!;

    expect(newVersion.docs).toHaveLength(2);
    expect(newVersion.docs.map((d) => d.checksum)).toEqual([
      "sharedChecksum",
      "sharedChecksum",
    ]);
    expect(newVersion.docs.map((d) => d.prettyName)).toEqual([
      "prettyName",
      "PRETTYNAME",
    ]);
    expect(newVersion.docs[0].id).not.toEqual(document1.id);
    expect(newVersion.docs[1].id).not.toEqual(document2.id);
    expect(
      await readLastEserviceTemplateEvent(eserviceTemplate.id)
    ).toMatchObject({
      version: "3",
      type: "EServiceTemplateVersionDocumentAdded",
    });
  });

  it("should clone from the version with the highest version number when multiple non-draft versions exist", async () => {
    const oldDocument = buildDocument("old");
    const latestDocument = buildDocument("latest");

    const oldVersion: EServiceTemplateVersion = {
      ...getMockEServiceTemplateVersion(),
      version: 1,
      state: eserviceTemplateVersionState.deprecated,
      description: "old version description",
      docs: [oldDocument],
    };
    const latestVersion: EServiceTemplateVersion = {
      ...getMockEServiceTemplateVersion(),
      version: 2,
      state: eserviceTemplateVersionState.published,
      description: "latest version description",
      voucherLifespan: 99,
      dailyCallsPerConsumer: 11,
      dailyCallsTotal: 111,
      docs: [latestDocument],
    };
    const eserviceTemplate: EServiceTemplate = {
      ...getMockEServiceTemplate(),
      versions: [latestVersion, oldVersion],
    };
    await addOneEServiceTemplate(eserviceTemplate);
    await storeDocument(latestDocument);

    const response =
      await eserviceTemplateService.createEServiceTemplateVersionFromLatest(
        eserviceTemplate.id,
        getMockContext({
          authData: getMockAuthData(eserviceTemplate.creatorId),
        })
      );

    const newVersion = response.data.eserviceTemplate.versions.find(
      (v) => v.id === response.data.createdEServiceTemplateVersionId
    )!;

    expect(newVersion).toMatchObject({
      version: 3,
      state: eserviceTemplateVersionState.draft,
      description: latestVersion.description,
      voucherLifespan: latestVersion.voucherLifespan,
      dailyCallsPerConsumer: latestVersion.dailyCallsPerConsumer,
      dailyCallsTotal: latestVersion.dailyCallsTotal,
    });
    expect(newVersion.docs).toHaveLength(1);
    expect(newVersion.docs[0]).toMatchObject({
      name: latestDocument.name,
      prettyName: latestDocument.prettyName,
      checksum: latestDocument.checksum,
    });
  });

  it("should not copy any file when the latest version has no documents", async () => {
    vi.spyOn(fileManager, "copy").mockClear();

    const eserviceTemplate: EServiceTemplate = {
      ...getMockEServiceTemplate(),
      versions: [
        {
          ...getMockEServiceTemplateVersion(),
          version: 1,
          state: eserviceTemplateVersionState.published,
          docs: [],
        },
      ],
    };
    await addOneEServiceTemplate(eserviceTemplate);

    const response =
      await eserviceTemplateService.createEServiceTemplateVersionFromLatest(
        eserviceTemplate.id,
        getMockContext({
          authData: getMockAuthData(eserviceTemplate.creatorId),
        })
      );

    expect(fileManager.copy).not.toHaveBeenCalled();
    expect(
      await readLastEserviceTemplateEvent(eserviceTemplate.id)
    ).toMatchObject({
      version: "1",
      type: "EServiceTemplateVersionAdded",
    });
    expect(
      response.data.eserviceTemplate.versions.find(
        (v) => v.id === response.data.createdEServiceTemplateVersionId
      )!.docs
    ).toEqual([]);
  });
});
