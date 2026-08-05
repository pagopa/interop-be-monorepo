/* eslint-disable @typescript-eslint/no-floating-promises */
import { catalogApi } from "pagopa-interop-api-clients";
import {
  decodeProtobufPayload,
  getMockAuthData,
  getMockContext,
  getMockEService,
  getMockEServiceTemplate,
  getMockTenant,
  getMockValidRiskAnalysis,
  readEventByStreamIdAndVersion,
} from "pagopa-interop-commons-test";
import {
  EServiceDescriptorDocumentAddedV2,
  EServiceDescriptorInterfaceAddedV2,
  Tenant,
  descriptorState,
  generateId,
  tenantKind,
  toEServiceV2,
} from "pagopa-interop-models";
import { expect, describe, it, beforeAll, vi, afterAll } from "vitest";

import {
  eServiceNameDuplicateForProducer,
  originNotCompliant,
} from "../../src/model/domain/errors.js";
import {
  addOneEService,
  addOneEServiceTemplate,
  addOneTenant,
  catalogService,
  postgresDB,
  readLastEserviceEvent,
} from "../integrationUtils.js";
import { buildRiskAnalysisSeed } from "../mockUtils.js";

describe("import eservice", () => {
  const producer: Tenant = {
    ...getMockTenant(),
    kind: tenantKind.PA,
  };

  const validRiskAnalysis1 = {
    ...getMockValidRiskAnalysis(tenantKind.PA),
    name: "risk analysis 1",
  };
  const validRiskAnalysis2 = {
    ...getMockValidRiskAnalysis(tenantKind.PA),
    name: "risk analysis 2",
  };

  const interfaceSeed: catalogApi.EServiceImportDocumentSeed = {
    documentId: generateId(),
    prettyName: "Interface",
    filePath: "interface/file/path",
    fileName: "api.yaml",
    contentType: "application/yaml",
    checksum: "interfaceChecksum",
    serverUrls: ["http://server.com"],
  };
  const documentSeed1: catalogApi.EServiceImportDocumentSeed = {
    documentId: generateId(),
    prettyName: "Document 1",
    filePath: "document1/file/path",
    fileName: "doc1.pdf",
    contentType: "application/pdf",
    checksum: "document1Checksum",
    serverUrls: [],
  };
  const documentSeed2: catalogApi.EServiceImportDocumentSeed = {
    documentId: generateId(),
    prettyName: "Document 2",
    filePath: "document2/file/path",
    fileName: "doc2.pdf",
    contentType: "application/pdf",
    checksum: "document2Checksum",
    serverUrls: [],
  };

  const importSeed: catalogApi.EServiceImportSeed = {
    name: "imported eservice",
    description: "imported eservice description",
    technology: "REST",
    mode: "RECEIVE",
    descriptor: {
      description: "imported descriptor description",
      audience: ["audience"],
      voucherLifespan: 600,
      dailyCallsPerConsumer: 10,
      dailyCallsTotal: 100,
      agreementApprovalPolicy: "AUTOMATIC",
      interface: interfaceSeed,
      docs: [documentSeed1, documentSeed2],
    },
    riskAnalysis: [
      buildRiskAnalysisSeed(validRiskAnalysis1),
      buildRiskAnalysisSeed(validRiskAnalysis2),
    ],
  };

  beforeAll(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date());
  });
  afterAll(() => {
    vi.useRealTimers();
  });

  it("should write all the events on the event-store in a single import (RECEIVE mode)", async () => {
    await addOneTenant(producer);

    const response = await catalogService.importEService(
      importSeed,
      getMockContext({ authData: getMockAuthData(producer.id) })
    );

    const eserviceId = response.data.eservice.id;
    const descriptorId = response.data.createdDescriptorId;

    expect(response.data.eservice.descriptors[0].id).toBe(descriptorId);
    expect(response.metadata.version).toBe(6);

    const expectedEventSequence = [
      "EServiceAdded",
      "EServiceDescriptorAdded",
      "EServiceRiskAnalysisAdded",
      "EServiceRiskAnalysisAdded",
      "EServiceDescriptorInterfaceAdded",
      "EServiceDescriptorDocumentAdded",
      "EServiceDescriptorDocumentAdded",
    ];

    for (const [version, type] of expectedEventSequence.entries()) {
      const event = await readEventByStreamIdAndVersion(
        eserviceId,
        version,
        "catalog",
        postgresDB
      );
      expect(event).toMatchObject({
        stream_id: eserviceId,
        version: version.toString(),
        type,
        event_version: 2,
      });
    }

    const interfaceEvent = await readEventByStreamIdAndVersion(
      eserviceId,
      4,
      "catalog",
      postgresDB
    );
    const interfacePayload = decodeProtobufPayload({
      messageType: EServiceDescriptorInterfaceAddedV2,
      payload: interfaceEvent.data,
    });

    // Each event snapshot must already contain the entities its ids point to
    expect(interfacePayload.descriptorId).toBe(descriptorId);
    expect(interfacePayload.documentId).toBe(interfaceSeed.documentId);
    expect(interfacePayload.eservice?.riskAnalysis).toHaveLength(2);
    expect(interfacePayload.eservice?.descriptors[0].interface?.id).toBe(
      interfaceSeed.documentId
    );
    expect(interfacePayload.eservice?.descriptors[0].docs).toEqual([]);

    const lastEvent = await readLastEserviceEvent(eserviceId);
    const lastPayload = decodeProtobufPayload({
      messageType: EServiceDescriptorDocumentAddedV2,
      payload: lastEvent.data,
    });

    expect(lastPayload.descriptorId).toBe(descriptorId);
    expect(lastPayload.documentId).toBe(documentSeed2.documentId);
    expect(lastPayload.eservice).toEqual(toEServiceV2(response.data.eservice));

    const finalDescriptor = response.data.eservice.descriptors[0];
    expect(finalDescriptor.state).toBe(descriptorState.draft);
    expect(finalDescriptor.serverUrls).toEqual(interfaceSeed.serverUrls);
    expect(finalDescriptor.interface).toMatchObject({
      id: interfaceSeed.documentId,
      name: interfaceSeed.fileName,
      contentType: interfaceSeed.contentType,
      prettyName: interfaceSeed.prettyName,
      path: interfaceSeed.filePath,
      checksum: interfaceSeed.checksum,
    });
    expect(finalDescriptor.docs.map((d) => d.id)).toEqual([
      documentSeed1.documentId,
      documentSeed2.documentId,
    ]);
    expect(response.data.eservice.riskAnalysis.map((ra) => ra.name)).toEqual([
      validRiskAnalysis1.name,
      validRiskAnalysis2.name,
    ]);
  });

  it("should import an eservice without interface, documents and risk analyses (DELIVER mode)", async () => {
    await addOneTenant(producer);

    const response = await catalogService.importEService(
      {
        ...importSeed,
        mode: "DELIVER",
        descriptor: {
          ...importSeed.descriptor,
          interface: undefined,
          docs: [],
        },
        riskAnalysis: [],
      },
      getMockContext({ authData: getMockAuthData(producer.id) })
    );

    const eserviceId = response.data.eservice.id;

    expect(response.metadata.version).toBe(1);

    const lastEvent = await readLastEserviceEvent(eserviceId);
    expect(lastEvent).toMatchObject({
      stream_id: eserviceId,
      version: "1",
      type: "EServiceDescriptorAdded",
      event_version: 2,
    });

    const descriptor = response.data.eservice.descriptors[0];
    expect(descriptor.interface).toBeUndefined();
    expect(descriptor.docs).toEqual([]);
    expect(descriptor.serverUrls).toEqual([]);
    expect(descriptor.state).toBe(descriptorState.draft);
    expect(response.data.eservice.riskAnalysis).toEqual([]);
  });

  it("should throw eserviceNotInReceiveMode if the seed has risk analyses and mode is DELIVER", async () => {
    await expect(
      catalogService.importEService(
        {
          ...importSeed,
          mode: "DELIVER",
        },
        getMockContext({ authData: getMockAuthData(producer.id) })
      )
    ).rejects.toMatchObject({ code: "eserviceNotInReceiveMode" });

    // this case throws after the creation events are already accumulated
    const events = await postgresDB.any("SELECT * FROM catalog.events");
    expect(events).toEqual([]);
  });

  it("should throw riskAnalysisDuplicated if the seed contains two risk analyses with the same name", async () => {
    await addOneTenant(producer);

    await expect(
      catalogService.importEService(
        {
          ...importSeed,
          riskAnalysis: [
            buildRiskAnalysisSeed(validRiskAnalysis1),
            buildRiskAnalysisSeed({
              ...validRiskAnalysis2,
              name: validRiskAnalysis1.name,
            }),
          ],
        },
        getMockContext({ authData: getMockAuthData(producer.id) })
      )
    ).rejects.toMatchObject({ code: "riskAnalysisDuplicated" });

    const events = await postgresDB.any("SELECT * FROM catalog.events");
    expect(events).toEqual([]);
  });

  it("should throw riskAnalysisValidationFailed if a risk analysis is not valid", async () => {
    await addOneTenant(producer);

    await expect(
      catalogService.importEService(
        {
          ...importSeed,
          riskAnalysis: [
            {
              ...buildRiskAnalysisSeed(validRiskAnalysis1),
              riskAnalysisForm: {
                version: "not-a-valid-version",
                answers: {},
              },
            },
          ],
        },
        getMockContext({ authData: getMockAuthData(producer.id) })
      )
    ).rejects.toMatchObject({ code: "riskAnalysisValidationFailed" });

    const events = await postgresDB.any("SELECT * FROM catalog.events");
    expect(events).toEqual([]);
  });

  it("should throw eServiceNameDuplicateForProducer if an eservice with the same name already exists", async () => {
    await addOneTenant(producer);
    await addOneEService({
      ...getMockEService(),
      name: importSeed.name,
      producerId: producer.id,
    });

    await expect(
      catalogService.importEService(
        importSeed,
        getMockContext({ authData: getMockAuthData(producer.id) })
      )
    ).rejects.toThrowError(
      eServiceNameDuplicateForProducer(importSeed.name, producer.id)
    );
  });

  it("should throw eserviceTemplateNameConflict if a template with the same name already exists", async () => {
    await addOneTenant(producer);
    await addOneEServiceTemplate({
      ...getMockEServiceTemplate(),
      name: importSeed.name,
    });

    await expect(
      catalogService.importEService(
        importSeed,
        getMockContext({ authData: getMockAuthData(producer.id) })
      )
    ).rejects.toMatchObject({ code: "eserviceTemplateNameConflict" });
  });

  it("should throw documentPrettyNameDuplicate if two documents share the same prettyName", async () => {
    await addOneTenant(producer);

    await expect(
      catalogService.importEService(
        {
          ...importSeed,
          descriptor: {
            ...importSeed.descriptor,
            docs: [
              documentSeed1,
              { ...documentSeed2, prettyName: documentSeed1.prettyName },
            ],
          },
        },
        getMockContext({ authData: getMockAuthData(producer.id) })
      )
    ).rejects.toMatchObject({ code: "documentPrettyNameDuplicate" });

    const events = await postgresDB.any("SELECT * FROM catalog.events");
    expect(events).toEqual([]);
  });

  it("should throw checksumDuplicate and commit no events if two documents share the same checksum", async () => {
    await addOneTenant(producer);

    await expect(
      catalogService.importEService(
        {
          ...importSeed,
          descriptor: {
            ...importSeed.descriptor,
            docs: [
              documentSeed1,
              { ...documentSeed2, checksum: documentSeed1.checksum },
            ],
          },
        },
        getMockContext({ authData: getMockAuthData(producer.id) })
      )
    ).rejects.toMatchObject({ code: "checksumDuplicate" });

    const events = await postgresDB.any("SELECT * FROM catalog.events");
    expect(events).toEqual([]);
  });

  it("should throw originNotCompliant if the requester externalId origin is not allowed", async () => {
    await expect(
      catalogService.importEService(
        importSeed,
        getMockContext({
          authData: {
            ...getMockAuthData(producer.id),
            externalId: {
              value: "123456",
              origin: "not-allowed-origin",
            },
          },
        })
      )
    ).rejects.toThrowError(originNotCompliant("not-allowed-origin"));
  });
});
