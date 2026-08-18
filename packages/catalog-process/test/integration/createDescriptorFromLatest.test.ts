/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/no-floating-promises */
import { genericLogger } from "pagopa-interop-commons";
import {
  decodeProtobufPayload,
  getMockContext,
  getMockAuthData,
  getMockDelegation,
  getMockDescriptor,
  getMockDocument,
  getMockEService,
  readEventByStreamIdAndVersion,
  StoredEvent,
  writeInEventstore,
} from "pagopa-interop-commons-test";
import {
  delegationKind,
  delegationState,
  Descriptor,
  descriptorState,
  Document,
  EService,
  EServiceDescriptorAddedV2,
  EServiceDescriptorDocumentAddedV2,
  EServiceDocumentId,
  EServiceEvent,
  EServiceTemplateId,
  generateId,
  operationForbidden,
  TenantId,
  toEServiceV2,
  unsafeBrandId,
} from "pagopa-interop-models";
import { upsertEService } from "pagopa-interop-readmodel/testUtils";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { config } from "../../src/config/config.js";
import {
  draftDescriptorAlreadyExists,
  eserviceInArchivingOrArchivedState,
  eServiceNotFound,
  eserviceWithoutValidDescriptors,
  templateInstanceNotAllowed,
} from "../../src/model/domain/errors.js";
import {
  addOneDelegation,
  addOneEService,
  catalogService,
  fileManager,
  postgresDB,
  readModelDB,
  readLastEserviceEvent,
} from "../integrationUtils.js";

const buildDocument = (suffix: string): Document => {
  const id = generateId<EServiceDocumentId>();
  return {
    ...getMockDocument(),
    id,
    name: `fileName_${suffix}`,
    prettyName: `prettyName_${suffix}`,
    path: `${config.eserviceDocumentsPath}/${id}/fileName_${suffix}`,
    checksum: `checksum_${suffix}`,
  };
};

const storeDocument = async (doc: Document): Promise<void> => {
  await fileManager.storeBytes(
    {
      bucket: config.s3Bucket,
      path: config.eserviceDocumentsPath,
      resourceId: doc.id,
      name: doc.name,
      content: Buffer.from("testtest"),
    },
    genericLogger
  );
};

/**
 * Advances the e-service event stream (and its readmodel metadata version) to
 * `targetVersion`, so that the operation under test does not start from 0.
 */
const advanceEServiceStreamVersion = async (
  eservice: EService,
  targetVersion: number
): Promise<void> => {
  for (let version = 1; version <= targetVersion; version++) {
    const event: StoredEvent<EServiceEvent> = {
      stream_id: eservice.id,
      version,
      event: {
        type: "EServiceCloned",
        event_version: 2,
        data: {
          sourceEservice: toEServiceV2(eservice),
          sourceDescriptorId: eservice.descriptors[0].id,
          eservice: toEServiceV2(eservice),
        },
      },
    };
    await writeInEventstore(event, "catalog", postgresDB);
  }
  await upsertEService(readModelDB, eservice, targetVersion);
};

describe("create descriptor from latest", async () => {
  beforeAll(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date());
  });
  afterAll(() => {
    vi.useRealTimers();
  });

  it("should write on event-store for the creation of a descriptor cloning the latest one, with its documents", async () => {
    vi.spyOn(fileManager, "copy").mockClear();

    const document1 = buildDocument("1");
    const document2 = buildDocument("2");

    const previousDescriptor: Descriptor = {
      ...getMockDescriptor(descriptorState.published),
      version: "1",
      description: "previous descriptor description",
      voucherLifespan: 120,
      dailyCallsPerConsumer: 33,
      dailyCallsTotal: 333,
      agreementApprovalPolicy: "Manual",
      audience: ["previous.audience.it"],
      interface: getMockDocument(),
      docs: [document1, document2],
    };
    const eservice: EService = {
      ...getMockEService(),
      descriptors: [previousDescriptor],
    };
    await addOneEService(eservice);
    await storeDocument(document1);
    await storeDocument(document2);

    const response = await catalogService.createDescriptorFromLatest(
      eservice.id,
      getMockContext({ authData: getMockAuthData(eservice.producerId) })
    );

    const newDescriptorId = response.data.createdDescriptorId;
    const newDescriptor = response.data.eservice.descriptors.find(
      (d) => d.id === newDescriptorId
    )!;

    expect(newDescriptor).toMatchObject({
      version: "2",
      state: descriptorState.draft,
      description: previousDescriptor.description,
      voucherLifespan: previousDescriptor.voucherLifespan,
      dailyCallsPerConsumer: previousDescriptor.dailyCallsPerConsumer,
      dailyCallsTotal: previousDescriptor.dailyCallsTotal,
      agreementApprovalPolicy: previousDescriptor.agreementApprovalPolicy,
      attributes: previousDescriptor.attributes,
      audience: [],
      interface: undefined,
      serverUrls: [],
    });

    expect(newDescriptor.docs).toHaveLength(2);
    const [clonedDocument1, clonedDocument2] = newDescriptor.docs;

    expect(clonedDocument1.id).not.toEqual(document1.id);
    expect(clonedDocument2.id).not.toEqual(document2.id);
    expect(clonedDocument1).toEqual({
      id: clonedDocument1.id,
      name: document1.name,
      prettyName: document1.prettyName,
      contentType: document1.contentType,
      checksum: document1.checksum,
      path: `${config.eserviceDocumentsPath}/${clonedDocument1.id}/${document1.name}`,
      uploadDate: new Date(),
    });
    expect(clonedDocument2).toEqual({
      id: clonedDocument2.id,
      name: document2.name,
      prettyName: document2.prettyName,
      contentType: document2.contentType,
      checksum: document2.checksum,
      path: `${config.eserviceDocumentsPath}/${clonedDocument2.id}/${document2.name}`,
      uploadDate: new Date(),
    });

    expect(fileManager.copy).toHaveBeenCalledWith(
      config.s3Bucket,
      document1.path,
      config.eserviceDocumentsPath,
      clonedDocument1.id,
      document1.name,
      genericLogger
    );
    expect(fileManager.copy).toHaveBeenCalledWith(
      config.s3Bucket,
      document2.path,
      config.eserviceDocumentsPath,
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

    const descriptorCreationEvent = await readEventByStreamIdAndVersion(
      eservice.id,
      1,
      "catalog",
      postgresDB
    );
    const document1AdditionEvent = await readEventByStreamIdAndVersion(
      eservice.id,
      2,
      "catalog",
      postgresDB
    );
    const document2AdditionEvent = await readEventByStreamIdAndVersion(
      eservice.id,
      3,
      "catalog",
      postgresDB
    );

    expect(descriptorCreationEvent).toMatchObject({
      stream_id: eservice.id,
      version: "1",
      type: "EServiceDescriptorAdded",
      event_version: 2,
    });
    expect(document1AdditionEvent).toMatchObject({
      stream_id: eservice.id,
      version: "2",
      type: "EServiceDescriptorDocumentAdded",
      event_version: 2,
    });
    expect(document2AdditionEvent).toMatchObject({
      stream_id: eservice.id,
      version: "3",
      type: "EServiceDescriptorDocumentAdded",
      event_version: 2,
    });
    expect(await readLastEserviceEvent(eservice.id)).toMatchObject({
      version: "3",
    });

    const descriptorCreationPayload = decodeProtobufPayload({
      messageType: EServiceDescriptorAddedV2,
      payload: descriptorCreationEvent.data,
    });
    expect(descriptorCreationPayload.descriptorId).toEqual(newDescriptorId);
    expect(
      descriptorCreationPayload.eservice!.descriptors.find(
        (d) => d.id === newDescriptorId
      )!.docs
    ).toEqual([]);

    const document2AdditionPayload = decodeProtobufPayload({
      messageType: EServiceDescriptorDocumentAddedV2,
      payload: document2AdditionEvent.data,
    });
    expect(document2AdditionPayload).toEqual({
      documentId: clonedDocument2.id,
      descriptorId: newDescriptorId,
      eservice: toEServiceV2(response.data.eservice),
    });

    expect(response.metadata).toEqual({ version: 3 });
  });

  it("should emit events with versions relative to the current e-service stream version", async () => {
    const document1 = buildDocument("1");
    const document2 = buildDocument("2");

    const previousDescriptor: Descriptor = {
      ...getMockDescriptor(descriptorState.published),
      version: "1",
      docs: [document1, document2],
    };
    const eservice: EService = {
      ...getMockEService(),
      descriptors: [previousDescriptor],
    };
    await addOneEService(eservice);
    await advanceEServiceStreamVersion(eservice, 4);
    await storeDocument(document1);
    await storeDocument(document2);

    const response = await catalogService.createDescriptorFromLatest(
      eservice.id,
      getMockContext({ authData: getMockAuthData(eservice.producerId) })
    );

    expect(
      await readEventByStreamIdAndVersion(eservice.id, 5, "catalog", postgresDB)
    ).toMatchObject({
      version: "5",
      type: "EServiceDescriptorAdded",
    });
    expect(
      await readEventByStreamIdAndVersion(eservice.id, 6, "catalog", postgresDB)
    ).toMatchObject({
      version: "6",
      type: "EServiceDescriptorDocumentAdded",
    });
    expect(
      await readEventByStreamIdAndVersion(eservice.id, 7, "catalog", postgresDB)
    ).toMatchObject({
      version: "7",
      type: "EServiceDescriptorDocumentAdded",
    });
    expect(await readLastEserviceEvent(eservice.id)).toMatchObject({
      version: "7",
    });
    expect(response.metadata).toEqual({ version: 7 });
  });

  it("should throw eServiceNotFound if the eservice doesn't exist", async () => {
    const eservice = getMockEService();
    expect(
      catalogService.createDescriptorFromLatest(
        eservice.id,
        getMockContext({ authData: getMockAuthData(eservice.producerId) })
      )
    ).rejects.toThrowError(eServiceNotFound(eservice.id));
  });

  it("should throw eserviceWithoutValidDescriptors if the eservice has no descriptors", async () => {
    const eservice: EService = {
      ...getMockEService(),
      descriptors: [],
    };
    await addOneEService(eservice);

    expect(
      catalogService.createDescriptorFromLatest(
        eservice.id,
        getMockContext({ authData: getMockAuthData(eservice.producerId) })
      )
    ).rejects.toThrowError(eserviceWithoutValidDescriptors(eservice.id));
  });

  it("should throw templateInstanceNotAllowed if the eservice is a template instance", async () => {
    const templateId = generateId<EServiceTemplateId>();
    const eservice: EService = {
      ...getMockEService(),
      templateId,
      descriptors: [getMockDescriptor(descriptorState.published)],
    };
    await addOneEService(eservice);

    expect(
      catalogService.createDescriptorFromLatest(
        eservice.id,
        getMockContext({ authData: getMockAuthData(eservice.producerId) })
      )
    ).rejects.toThrowError(templateInstanceNotAllowed(eservice.id, templateId));
  });

  it.each([descriptorState.draft, descriptorState.waitingForApproval])(
    "should throw draftDescriptorAlreadyExists if a descriptor with state %s already exists",
    async (state) => {
      const eservice: EService = {
        ...getMockEService(),
        descriptors: [getMockDescriptor(state)],
      };
      await addOneEService(eservice);

      expect(
        catalogService.createDescriptorFromLatest(
          eservice.id,
          getMockContext({ authData: getMockAuthData(eservice.producerId) })
        )
      ).rejects.toThrowError(draftDescriptorAlreadyExists(eservice.id));
    }
  );

  it.each([
    descriptorState.archived,
    descriptorState.archivingSuspended,
    descriptorState.archiving,
  ])(
    "should throw eserviceInArchivingOrArchivedState if the latest active descriptor is in %s state",
    async (state) => {
      const eservice: EService = {
        ...getMockEService(),
        descriptors: [
          {
            ...getMockDescriptor(state),
            interface: getMockDocument(),
          },
        ],
      };
      await addOneEService(eservice);

      expect(
        catalogService.createDescriptorFromLatest(
          eservice.id,
          getMockContext({ authData: getMockAuthData(eservice.producerId) })
        )
      ).rejects.toThrowError(eserviceInArchivingOrArchivedState(eservice.id));
    }
  );

  it("should throw operationForbidden if the requester is not the producer", async () => {
    const eservice: EService = {
      ...getMockEService(),
      descriptors: [getMockDescriptor(descriptorState.published)],
    };
    await addOneEService(eservice);

    expect(
      catalogService.createDescriptorFromLatest(
        eservice.id,
        getMockContext({ authData: getMockAuthData(generateId<TenantId>()) })
      )
    ).rejects.toThrowError(operationForbidden);
  });

  it("should write on event-store for the creation of a descriptor from the latest one (delegate)", async () => {
    const document1 = buildDocument("1");

    const previousDescriptor: Descriptor = {
      ...getMockDescriptor(descriptorState.published),
      version: "1",
      docs: [document1],
    };
    const eservice: EService = {
      ...getMockEService(),
      descriptors: [previousDescriptor],
    };
    const delegation = getMockDelegation({
      kind: delegationKind.delegatedProducer,
      eserviceId: eservice.id,
      state: delegationState.active,
    });

    await addOneEService(eservice);
    await addOneDelegation(delegation);
    await storeDocument(document1);

    const response = await catalogService.createDescriptorFromLatest(
      eservice.id,
      getMockContext({ authData: getMockAuthData(delegation.delegateId) })
    );

    const newDescriptorId = response.data.createdDescriptorId;
    const newDescriptor = response.data.eservice.descriptors.find(
      (d) => d.id === newDescriptorId
    )!;

    expect(newDescriptor).toMatchObject({
      version: "2",
      state: descriptorState.draft,
    });
    expect(newDescriptor.docs).toHaveLength(1);
    expect(newDescriptor.docs[0].id).not.toEqual(document1.id);

    const descriptorCreationEvent = await readEventByStreamIdAndVersion(
      eservice.id,
      1,
      "catalog",
      postgresDB
    );
    expect(descriptorCreationEvent).toMatchObject({
      stream_id: eservice.id,
      version: "1",
      type: "EServiceDescriptorAdded",
      event_version: 2,
    });
    expect(
      decodeProtobufPayload({
        messageType: EServiceDescriptorAddedV2,
        payload: descriptorCreationEvent.data,
      }).descriptorId
    ).toEqual(newDescriptorId);
    expect(await readLastEserviceEvent(eservice.id)).toMatchObject({
      version: "2",
      type: "EServiceDescriptorDocumentAdded",
    });
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

    const eservice: EService = {
      ...getMockEService(),
      descriptors: [
        {
          ...getMockDescriptor(descriptorState.published),
          version: "1",
          docs: [document1, document2],
        },
      ],
    };
    await addOneEService(eservice);
    await storeDocument(document1);
    await storeDocument(document2);

    const response = await catalogService.createDescriptorFromLatest(
      eservice.id,
      getMockContext({ authData: getMockAuthData(eservice.producerId) })
    );

    const newDescriptor = response.data.eservice.descriptors.find(
      (d) => d.id === response.data.createdDescriptorId
    )!;

    expect(newDescriptor.docs).toHaveLength(2);
    expect(newDescriptor.docs.map((d) => d.checksum)).toEqual([
      "sharedChecksum",
      "sharedChecksum",
    ]);
    expect(newDescriptor.docs.map((d) => d.prettyName)).toEqual([
      "prettyName",
      "PRETTYNAME",
    ]);
    expect(newDescriptor.docs[0].id).not.toEqual(document1.id);
    expect(newDescriptor.docs[1].id).not.toEqual(document2.id);
    expect(await readLastEserviceEvent(eservice.id)).toMatchObject({
      version: "3",
      type: "EServiceDescriptorDocumentAdded",
    });
  });

  it("should clone from the descriptor with the highest numeric version when multiple non-draft descriptors exist", async () => {
    const oldDocument = buildDocument("old");
    const latestDocument = buildDocument("latest");

    const oldDescriptor: Descriptor = {
      ...getMockDescriptor(descriptorState.deprecated),
      version: "2",
      description: "old descriptor description",
      docs: [oldDocument],
    };
    const latestDescriptor: Descriptor = {
      ...getMockDescriptor(descriptorState.published),
      version: "10",
      description: "latest descriptor description",
      voucherLifespan: 99,
      dailyCallsPerConsumer: 11,
      dailyCallsTotal: 111,
      docs: [latestDocument],
    };
    const eservice: EService = {
      ...getMockEService(),
      descriptors: [latestDescriptor, oldDescriptor],
    };
    await addOneEService(eservice);
    await storeDocument(latestDocument);

    const response = await catalogService.createDescriptorFromLatest(
      eservice.id,
      getMockContext({ authData: getMockAuthData(eservice.producerId) })
    );

    const newDescriptor = response.data.eservice.descriptors.find(
      (d) => d.id === response.data.createdDescriptorId
    )!;

    expect(newDescriptor).toMatchObject({
      version: "11",
      state: descriptorState.draft,
      description: latestDescriptor.description,
      voucherLifespan: latestDescriptor.voucherLifespan,
      dailyCallsPerConsumer: latestDescriptor.dailyCallsPerConsumer,
      dailyCallsTotal: latestDescriptor.dailyCallsTotal,
    });
    expect(newDescriptor.docs).toHaveLength(1);
    expect(newDescriptor.docs[0]).toMatchObject({
      name: latestDocument.name,
      prettyName: latestDocument.prettyName,
      checksum: latestDocument.checksum,
    });
  });

  it("should not copy any file when the latest descriptor has no documents", async () => {
    vi.spyOn(fileManager, "copy").mockClear();

    const eservice: EService = {
      ...getMockEService(),
      descriptors: [
        {
          ...getMockDescriptor(descriptorState.published),
          docs: [],
        },
      ],
    };
    await addOneEService(eservice);

    const response = await catalogService.createDescriptorFromLatest(
      eservice.id,
      getMockContext({ authData: getMockAuthData(eservice.producerId) })
    );

    expect(fileManager.copy).not.toHaveBeenCalled();
    expect(await readLastEserviceEvent(eservice.id)).toMatchObject({
      version: "1",
      type: "EServiceDescriptorAdded",
    });
    expect(
      response.data.eservice.descriptors.find(
        (d) => d.id === unsafeBrandId(response.data.createdDescriptorId)
      )!.docs
    ).toEqual([]);
  });

  it("should copy asyncExchangeProperties from the latest descriptor when flag ON and asyncExchange true", async () => {
    config.featureFlagAsyncExchange = true;

    const asyncExchangeProperties = {
      responseTime: 3600,
      resourceAvailableTime: 7200,
      confirmation: true,
      bulk: true,
      maxResultSet: 1000,
    };
    const eservice: EService = {
      ...getMockEService(),
      asyncExchange: true,
      descriptors: [
        {
          ...getMockDescriptor(descriptorState.published),
          version: "1",
          docs: [],
          asyncExchangeProperties,
        },
      ],
    };
    await addOneEService(eservice);

    const response = await catalogService.createDescriptorFromLatest(
      eservice.id,
      getMockContext({ authData: getMockAuthData(eservice.producerId) })
    );

    const newDescriptor = response.data.eservice.descriptors.find(
      (d) => d.id === response.data.createdDescriptorId
    )!;
    expect(newDescriptor.asyncExchangeProperties).toEqual(
      asyncExchangeProperties
    );

    const writtenPayload = decodeProtobufPayload({
      messageType: EServiceDescriptorAddedV2,
      payload: (await readLastEserviceEvent(eservice.id)).data,
    });
    expect(
      writtenPayload.eservice!.descriptors.find(
        (d) => d.id === response.data.createdDescriptorId
      )!.asyncExchangeProperties
    ).toMatchObject(asyncExchangeProperties);
  });

  it("should not copy asyncExchangeProperties from the latest descriptor when flag OFF", async () => {
    config.featureFlagAsyncExchange = false;

    const eservice: EService = {
      ...getMockEService(),
      asyncExchange: true,
      descriptors: [
        {
          ...getMockDescriptor(descriptorState.published),
          version: "1",
          docs: [],
          asyncExchangeProperties: {
            responseTime: 3600,
            resourceAvailableTime: 7200,
            confirmation: true,
            bulk: true,
            maxResultSet: 1000,
          },
        },
      ],
    };
    await addOneEService(eservice);

    const response = await catalogService.createDescriptorFromLatest(
      eservice.id,
      getMockContext({ authData: getMockAuthData(eservice.producerId) })
    );

    expect(
      response.data.eservice.descriptors.find(
        (d) => d.id === response.data.createdDescriptorId
      )!.asyncExchangeProperties
    ).toBeUndefined();

    config.featureFlagAsyncExchange = true;
  });
});
