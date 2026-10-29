/* eslint-disable @typescript-eslint/no-floating-promises */
import { catalogApi } from "pagopa-interop-api-clients";
import { genericLogger } from "pagopa-interop-commons";
import {
  decodeProtobufPayload,
  getMockDelegation,
  getMockValidRiskAnalysis,
  getMockDocument,
  getMockDescriptor,
  getMockEService,
  getMockEServiceTemplate,
  getMockContextM2MAdmin,
  ReadEvent,
} from "pagopa-interop-commons-test";
import {
  Descriptor,
  descriptorState,
  EService,
  DraftEServiceUpdatedV2,
  toEServiceV2,
  operationForbidden,
  generateId,
  delegationState,
  delegationKind,
  EServiceTemplateId,
  EServiceTemplate,
  EServiceNameUpdatedV2,
  EServiceDescriptionUpdatedV2,
  EServiceEvent,
  EServiceId,
  TenantId,
} from "pagopa-interop-models";
import { upsertEService } from "pagopa-interop-readmodel/testUtils";
import { match } from "ts-pattern";
import { vi, expect, describe, it } from "vitest";

import { config } from "../../src/config/config.js";
import {
  apiEServiceModeToEServiceMode,
  apiTechnologyToTechnology,
} from "../../src/model/domain/apiConverter.js";
import {
  eServiceNotFound,
  eServiceNameDuplicateForProducer,
  eserviceNotInDraftState,
  invalidDelegationFlags,
  asyncExchangeNotAllowedForReceiveMode,
  templateInstanceNotAllowed,
  eserviceTemplateNameConflict,
} from "../../src/model/domain/errors.js";
import {
  fileManager,
  addOneEService,
  catalogService,
  readLastEserviceEvent,
  addOneDelegation,
  addOneEServiceTemplate,
  postgresDB,
  readModelService,
  readModelDB,
} from "../integrationUtils.js";

function decodeEServicePatchEvent(event: ReadEvent<EServiceEvent>): unknown {
  return match(event.type)
    .with(
      "EServiceNameUpdated",
      () =>
        decodeProtobufPayload({
          messageType: EServiceNameUpdatedV2,
          payload: event.data,
        }).eservice
    )
    .with(
      "EServiceDescriptionUpdated",
      () =>
        decodeProtobufPayload({
          messageType: EServiceDescriptionUpdatedV2,
          payload: event.data,
        }).eservice
    )
    .with(
      "DraftEServiceUpdated",
      () =>
        decodeProtobufPayload({
          messageType: DraftEServiceUpdatedV2,
          payload: event.data,
        }).eservice
    )
    .otherwise(() => {
      throw new Error(`Unexpected PATCH event ${event.type}`);
    });
}

async function readPatchEvents(
  eserviceId: EServiceId
): Promise<Array<ReadEvent<EServiceEvent> & { correlation_id: string }>> {
  return postgresDB.manyOrNone(
    "SELECT * FROM catalog.events WHERE stream_id = $1 AND version > 0 ORDER BY version",
    [eserviceId]
  );
}

describe("patch update eService", () => {
  const mockEService: EService = {
    ...getMockEService(),
    isSignalHubEnabled: false,
  };
  const mockDocument = getMockDocument();

  it.each(["unauthorized", "template"] as const)(
    "should enforce ownership and template exclusion before a metadata no-op (%s)",
    async (scenario) => {
      const eservice: EService = {
        ...mockEService,
        templateId:
          scenario === "template"
            ? generateId<EServiceTemplateId>()
            : undefined,
      };
      await addOneEService(eservice);
      await expect(
        catalogService.patchUpdateEService(
          eservice.id,
          { name: eservice.name, description: eservice.description },
          getMockContextM2MAdmin({
            organizationId:
              scenario === "unauthorized"
                ? generateId<TenantId>()
                : eservice.producerId,
          })
        )
      ).rejects.toMatchObject({
        code:
          scenario === "unauthorized"
            ? "operationForbidden"
            : "templateInstanceNotAllowed",
      });
      expect(await readPatchEvents(eservice.id)).toEqual([]);
    }
  );

  it.each([
    { name: "Updated https://example.com" },
    { description: "Updated description https://example.com" },
  ])(
    "should reject hyperlinks before persisting any metadata (case #%#)",
    async (invalidSeed) => {
      await addOneEService(mockEService);
      await expect(
        catalogService.patchUpdateEService(
          mockEService.id,
          {
            name: "Updated name",
            description: "Updated description",
            ...invalidSeed,
          },
          getMockContextM2MAdmin({
            organizationId: mockEService.producerId,
          })
        )
      ).rejects.toMatchObject({ code: "hyperlinkDetectionError" });
      expect(await readPatchEvents(mockEService.id)).toEqual([]);
    }
  );

  it.each([
    { technology: "REST" },
    { mode: "DELIVER" },
    { isSignalHubEnabled: false },
    { isConsumerDelegable: false },
    { isClientAccessDelegable: false },
    { personalData: null },
    { asyncExchange: null },
  ] satisfies catalogApi.PatchUpdateEServiceSeed[])(
    "should reject each operational field outside Draft even when false, null or unchanged (case #%#)",
    async (seed) => {
      const eservice: EService = {
        ...mockEService,
        technology: "Rest",
        descriptors: [
          { ...getMockDescriptor(), state: descriptorState.published },
        ],
      };
      await addOneEService(eservice);
      await expect(
        catalogService.patchUpdateEService(
          eservice.id,
          { name: "Updated name", ...seed },
          getMockContextM2MAdmin({ organizationId: eservice.producerId })
        )
      ).rejects.toThrow(eserviceNotInDraftState(eservice.id));
      expect(await readPatchEvents(eservice.id)).toEqual([]);
    }
  );

  it("should update operational fields without descriptors", async () => {
    const eservice: EService = {
      ...mockEService,
      descriptors: [],
      technology: "Rest",
      mode: "Receive",
    };
    await addOneEService(eservice);

    const result = await catalogService.patchUpdateEService(
      eservice.id,
      { technology: "SOAP", isSignalHubEnabled: true },
      getMockContextM2MAdmin({ organizationId: eservice.producerId })
    );

    const expectedEService: EService = {
      ...eservice,
      technology: "Soap",
      isSignalHubEnabled: true,
    };
    expect(result).toEqual({
      data: expectedEService,
      metadata: { version: 1 },
    });
    const events = await readPatchEvents(eservice.id);
    expect(events).toMatchObject([
      { type: "DraftEServiceUpdated", version: "1", event_version: 2 },
    ]);
    expect(decodeEServicePatchEvent(events[0]!)).toEqual(
      toEServiceV2(expectedEService)
    );
  });

  it.each([
    [],
    ...Object.values(descriptorState).map((state) => [
      { ...getMockDescriptor(), state },
    ]),
    [
      { ...getMockDescriptor(), state: descriptorState.published },
      { ...getMockDescriptor(), state: descriptorState.draft },
    ],
  ])(
    "should update metadata without changing descriptors or operational data (case #%#)",
    async (...descriptors) => {
      const eservice: EService = {
        ...mockEService,
        descriptors,
        mode: "Deliver",
        riskAnalysis: [getMockValidRiskAnalysis("PA")],
      };
      await addOneEService(eservice);
      const before = await readModelService.getEServiceById(eservice.id);
      expect(before).toBeDefined();
      const ctx = getMockContextM2MAdmin({
        organizationId: eservice.producerId,
      });

      const result = await catalogService.patchUpdateEService(
        eservice.id,
        { name: "Updated name", description: "Updated description" },
        ctx
      );
      const expectedEService = {
        ...before!.data,
        name: "Updated name",
        description: "Updated description",
      };
      expect(result).toEqual({
        data: expectedEService,
        metadata: { version: 2 },
      });
      const events = await readPatchEvents(eservice.id);
      expect(events).toMatchObject([
        {
          version: "1",
          type: "EServiceNameUpdated",
          event_version: 2,
          correlation_id: ctx.correlationId,
        },
        {
          version: "2",
          type: "EServiceDescriptionUpdated",
          event_version: 2,
          correlation_id: ctx.correlationId,
        },
      ]);
      expect(decodeEServicePatchEvent(events[0]!)).toEqual(
        toEServiceV2({ ...before!.data, name: expectedEService.name })
      );
      expect(
        decodeProtobufPayload({
          messageType: EServiceNameUpdatedV2,
          payload: events[0]!.data,
        }).oldName
      ).toBe(eservice.name);
      expect(decodeEServicePatchEvent(events[1]!)).toEqual(
        toEServiceV2(expectedEService)
      );
    }
  );

  it.each(["name", "description", "both"] as const)(
    "should not create events or advance the version for unchanged metadata (%s)",
    async (field) => {
      const eservice: EService = {
        ...mockEService,
        descriptors: [
          { ...getMockDescriptor(), state: descriptorState.archived },
        ],
      };
      await addOneEService(eservice);
      const seed = match(field)
        .with("name", () => ({ name: eservice.name }))
        .with("description", () => ({ description: eservice.description }))
        .with("both", () => ({
          name: eservice.name,
          description: eservice.description,
        }))
        .exhaustive();
      expect(
        await catalogService.patchUpdateEService(
          eservice.id,
          seed,
          getMockContextM2MAdmin({ organizationId: eservice.producerId })
        )
      ).toEqual({ data: eservice, metadata: { version: 0 } });
      expect(await readPatchEvents(eservice.id)).toEqual([]);
    }
  );

  it.each([{ name: "Updated name" }, { description: "Updated description" }])(
    "should create an event only for the changed metadata field (case #%#)",
    async (changedSeed) => {
      await addOneEService(mockEService);
      const result = await catalogService.patchUpdateEService(
        mockEService.id,
        {
          name: mockEService.name,
          description: mockEService.description,
          ...changedSeed,
        },
        getMockContextM2MAdmin({ organizationId: mockEService.producerId })
      );
      expect(result.metadata.version).toBe(1);
      const events = await readPatchEvents(mockEService.id);
      expect(events).toHaveLength(1);
      expect(events[0]!.type).toBe(
        changedSeed.name ? "EServiceNameUpdated" : "EServiceDescriptionUpdated"
      );
      expect(decodeEServicePatchEvent(events[0]!)).toEqual(
        toEServiceV2(result.data)
      );
    }
  );

  it.each([
    { isSignalHubEnabled: false },
    { isConsumerDelegable: true, isClientAccessDelegable: true },
    { technology: "REST" },
    { mode: "RECEIVE" },
    { personalData: null },
    { asyncExchange: null },
  ] satisfies catalogApi.PatchUpdateEServiceSeed[])(
    "should not create events for unchanged operational fields (case #%#)",
    async (seed) => {
      const eservice: EService = {
        ...mockEService,
        descriptors: [{ ...getMockDescriptor(), state: descriptorState.draft }],
        technology: "Rest",
        mode: "Receive",
        isConsumerDelegable: true,
        isClientAccessDelegable: true,
        personalData: undefined,
        asyncExchange: undefined,
      };
      await addOneEService(eservice);
      expect(
        await catalogService.patchUpdateEService(
          eservice.id,
          seed,
          getMockContextM2MAdmin({ organizationId: eservice.producerId })
        )
      ).toEqual({ data: eservice, metadata: { version: 0 } });
      expect(await readPatchEvents(eservice.id)).toEqual([]);
    }
  );

  it("should preserve a nonzero metadata version when repeating a successful update", async () => {
    await addOneEService(mockEService);
    const seed = {
      name: "Updated name",
      description: "Updated description",
    };
    const ctx = getMockContextM2MAdmin({
      organizationId: mockEService.producerId,
    });
    const firstResult = await catalogService.patchUpdateEService(
      mockEService.id,
      seed,
      ctx
    );
    await upsertEService(
      readModelDB,
      firstResult.data,
      firstResult.metadata.version
    );
    expect(
      await catalogService.patchUpdateEService(mockEService.id, seed, ctx)
    ).toEqual(firstResult);
    expect(await readPatchEvents(mockEService.id)).toHaveLength(2);
  });

  it("should not emit an operational event for unchanged operational fields in a mixed patch", async () => {
    const eservice: EService = {
      ...mockEService,
      descriptors: [{ ...getMockDescriptor(), state: descriptorState.draft }],
      mode: "Deliver",
      riskAnalysis: [getMockValidRiskAnalysis("PA")],
    };
    await addOneEService(eservice);

    const result = await catalogService.patchUpdateEService(
      eservice.id,
      { name: "Updated name", mode: "DELIVER" },
      getMockContextM2MAdmin({ organizationId: eservice.producerId })
    );

    expect(result).toEqual({
      data: { ...eservice, name: "Updated name" },
      metadata: { version: 1 },
    });
    expect(await readPatchEvents(eservice.id)).toMatchObject([
      { type: "EServiceNameUpdated", version: "1" },
    ]);
  });

  it("should preserve operational data for an unchanged Deliver mode", async () => {
    const eservice: EService = {
      ...mockEService,
      descriptors: [],
      mode: "Deliver",
      riskAnalysis: [getMockValidRiskAnalysis("PA")],
    };
    await addOneEService(eservice);

    expect(
      await catalogService.patchUpdateEService(
        eservice.id,
        { mode: "DELIVER" },
        getMockContextM2MAdmin({ organizationId: eservice.producerId })
      )
    ).toEqual({ data: eservice, metadata: { version: 0 } });
    expect(await readPatchEvents(eservice.id)).toEqual([]);
  });

  it("should reject concurrent metadata updates without partial batches or retry", async () => {
    await addOneEService(mockEService);
    const ctx = getMockContextM2MAdmin({
      organizationId: mockEService.producerId,
    });
    const results = await Promise.allSettled(
      ["First", "Second"].map((prefix) =>
        catalogService.patchUpdateEService(
          mockEService.id,
          {
            name: `${prefix} updated name`,
            description: `${prefix} updated description`,
          },
          ctx
        )
      )
    );
    expect(
      results.filter((result) => result.status === "fulfilled")
    ).toHaveLength(1);
    expect(
      results.filter((result) => result.status === "rejected")
    ).toMatchObject([{ reason: { code: "eventConflictError" } }]);
    const events = await readPatchEvents(mockEService.id);
    expect(events).toHaveLength(2);
    expect(events.map((event) => event.version)).toEqual(["1", "2"]);
  });

  it.each([
    ...Object.values(descriptorState)
      .filter((state) => state !== descriptorState.draft)
      .map((state) => [{ ...getMockDescriptor(), state }]),
    [
      { ...getMockDescriptor(), state: descriptorState.draft },
      { ...getMockDescriptor(), state: descriptorState.draft },
    ],
    [
      { ...getMockDescriptor(), state: descriptorState.draft },
      { ...getMockDescriptor(), state: descriptorState.draft },
      { ...getMockDescriptor(), state: descriptorState.draft },
    ],
  ])(
    "should reject mixed operational updates atomically with non-Draft or multiple descriptors (case #%#)",
    async (...descriptors) => {
      const eservice = { ...mockEService, descriptors };
      await addOneEService(eservice);
      const deleteSpy = vi.spyOn(fileManager, "delete");
      await expect(
        catalogService.patchUpdateEService(
          eservice.id,
          {
            name: "Updated name",
            description: "Updated description",
            technology: "SOAP",
          },
          getMockContextM2MAdmin({ organizationId: eservice.producerId })
        )
      ).rejects.toThrow(eserviceNotInDraftState(eservice.id));
      expect(await readPatchEvents(eservice.id)).toEqual([]);
      expect(deleteSpy).not.toHaveBeenCalled();
    }
  );

  it.each([
    {
      seed: { isConsumerDelegable: false, isClientAccessDelegable: true },
      error: invalidDelegationFlags(false, true),
    },
    {
      seed: { mode: "RECEIVE", asyncExchange: true },
      error: asyncExchangeNotAllowedForReceiveMode(mockEService.id),
    },
  ] satisfies Array<{
    seed: catalogApi.PatchUpdateEServiceSeed;
    error: Error;
  }>)(
    "should validate all fields before file deletion or persistence (case #%#)",
    async ({ seed, error }) => {
      const eservice: EService = {
        ...mockEService,
        technology: "Rest",
        descriptors: [
          {
            ...getMockDescriptor(),
            state: descriptorState.draft,
            interface: mockDocument,
          },
        ],
      };
      await addOneEService(eservice);
      const deleteSpy = vi.spyOn(fileManager, "delete");
      await expect(
        catalogService.patchUpdateEService(
          eservice.id,
          { name: "Updated name", technology: "SOAP", ...seed },
          getMockContextM2MAdmin({ organizationId: eservice.producerId })
        )
      ).rejects.toThrow(error);
      expect(await readPatchEvents(eservice.id)).toEqual([]);
      expect(deleteSpy).not.toHaveBeenCalled();
    }
  );

  it("should persist metadata and operational events in order with the same correlation", async () => {
    const eservice: EService = {
      ...mockEService,
      technology: "Rest",
      descriptors: [{ ...getMockDescriptor(), state: descriptorState.draft }],
    };
    await addOneEService(eservice);
    const ctx = getMockContextM2MAdmin({
      organizationId: eservice.producerId,
    });
    const result = await catalogService.patchUpdateEService(
      eservice.id,
      {
        name: "Updated name",
        description: "Updated description",
        technology: "SOAP",
      },
      ctx
    );
    const events = await readPatchEvents(eservice.id);
    expect(events).toMatchObject([
      { type: "EServiceNameUpdated", version: "1" },
      { type: "EServiceDescriptionUpdated", version: "2" },
      { type: "DraftEServiceUpdated", version: "3" },
    ]);
    expect(events.every((e) => e.correlation_id === ctx.correlationId)).toBe(
      true
    );
    expect(decodeEServicePatchEvent(events[2]!)).toEqual(
      toEServiceV2(result.data)
    );
    expect(result.metadata.version).toBe(3);
  });

  it("should roll back the whole event batch if a later event conflicts", async () => {
    await addOneEService(mockEService);
    await postgresDB.none(
      "INSERT INTO catalog.events (stream_id, version, type, event_version, data) SELECT stream_id, 2, type, event_version, data FROM catalog.events WHERE stream_id = $1 AND version = 0",
      [mockEService.id]
    );
    await expect(
      catalogService.patchUpdateEService(
        mockEService.id,
        { name: "Updated name", description: "Updated description" },
        getMockContextM2MAdmin({ organizationId: mockEService.producerId })
      )
    ).rejects.toMatchObject({ code: "eventConflictError" });
    const events = await readPatchEvents(mockEService.id);
    expect(events).toMatchObject([{ version: "2", type: "EServiceAdded" }]);
  });

  it.each([
    {
      name: "New name",
    },
    {
      name: "New name",
      description: "New description",
    },
    {
      name: "New name",
      description: "New description",
      technology: "SOAP",
    },
    {
      name: "New name",
      description: "New description",
      technology: "SOAP",
      mode: "DELIVER",
    },
    {
      name: "New name",
      description: "New description",
      technology: "SOAP",
      mode: "DELIVER",
      isSignalHubEnabled: true,
    },
    {
      name: "New name",
      description: "New description",
      technology: "SOAP",
      mode: "DELIVER",
      isSignalHubEnabled: true,
      isConsumerDelegable: true,
    },
    {
      name: "New name",
      description: "New description",
      technology: "SOAP",
      mode: "DELIVER",
      isSignalHubEnabled: true,
      isConsumerDelegable: true,
      isClientAccessDelegable: true,
    },
    {
      name: "New name",
      description: "New description",
      technology: "SOAP",
      mode: "DELIVER",
      isSignalHubEnabled: true,
      isConsumerDelegable: true,
      isClientAccessDelegable: true,
      personalData: true,
      asyncExchange: true,
    },
  ] as catalogApi.PatchUpdateEServiceSeed[])(
    "should write on event-store and update only the fields set in the seed, and leave undefined fields unchanged (seed #%#)",
    async (seed) => {
      const descriptor: Descriptor = {
        ...getMockDescriptor(),
        state: descriptorState.draft,
        interface: mockDocument,
        serverUrls: ["test"],
      };
      const eservice: EService = {
        ...mockEService,
        descriptors: [descriptor],
        technology: "Rest",
        mode: "Receive",
        isSignalHubEnabled: false,
        isConsumerDelegable: false,
        isClientAccessDelegable: false,
        riskAnalysis: [getMockValidRiskAnalysis("PA")],
      };

      await addOneEService(eservice);

      const updateEServiceReturn = await catalogService.patchUpdateEService(
        mockEService.id,
        seed,
        getMockContextM2MAdmin({ organizationId: mockEService.producerId })
      );

      const wasTechnologyUpdated =
        seed.technology &&
        apiTechnologyToTechnology(seed.technology) !== eservice.technology;

      const expectedEService: EService = {
        ...eservice,
        name: seed.name ?? eservice.name,
        description: seed.description ?? eservice.description,
        technology: seed.technology
          ? apiTechnologyToTechnology(seed.technology)
          : eservice.technology,
        mode: seed.mode
          ? apiEServiceModeToEServiceMode(seed.mode)
          : eservice.mode,
        isSignalHubEnabled:
          seed.isSignalHubEnabled ?? eservice.isSignalHubEnabled,
        isConsumerDelegable:
          seed.isConsumerDelegable ?? eservice.isConsumerDelegable,
        isClientAccessDelegable:
          seed.isClientAccessDelegable ?? eservice.isClientAccessDelegable,
        personalData: seed.personalData ?? eservice.personalData,
        asyncExchange: seed.asyncExchange ?? eservice.asyncExchange,
        descriptors: eservice.descriptors.map((d) => ({
          ...d,
          interface: wasTechnologyUpdated ? undefined : d.interface,
          serverUrls: wasTechnologyUpdated ? [] : d.serverUrls,
        })),
        riskAnalysis: seed.mode === "DELIVER" ? [] : eservice.riskAnalysis,
      };

      const writtenEvent = await readLastEserviceEvent(mockEService.id);
      const expectedVersion =
        (seed.name ? 1 : 0) +
        (seed.description ? 1 : 0) +
        (seed.technology ? 1 : 0);

      expect(writtenEvent).toMatchObject({
        stream_id: mockEService.id,
        version: expectedVersion.toString(),
        type: seed.technology
          ? "DraftEServiceUpdated"
          : seed.description
            ? "EServiceDescriptionUpdated"
            : "EServiceNameUpdated",
        event_version: 2,
      });

      expect(decodeEServicePatchEvent(writtenEvent)).toEqual(
        toEServiceV2(expectedEService)
      );
      expect(updateEServiceReturn).toEqual({
        data: expectedEService,
        metadata: { version: expectedVersion },
      });
    }
  );

  it("should update an eservice correctly handling isClientAccessDelegable when isConsumerDelegable is not true", async () => {
    const descriptor: Descriptor = {
      ...getMockDescriptor(),
      state: descriptorState.draft,
    };
    const eservice: EService = {
      ...mockEService,
      descriptors: [descriptor],
      isConsumerDelegable: true,
      isClientAccessDelegable: true,
    };

    await addOneEService(eservice);
    const updateEServiceReturn = await catalogService.patchUpdateEService(
      mockEService.id,
      {
        isConsumerDelegable: false,
        isClientAccessDelegable: false,
      },
      getMockContextM2MAdmin({ organizationId: mockEService.producerId })
    );

    const expectedEService: EService = {
      ...eservice,
      isConsumerDelegable: false,
      isClientAccessDelegable: false,
    };

    const writtenEvent = await readLastEserviceEvent(mockEService.id);

    expect(writtenEvent).toMatchObject({
      stream_id: mockEService.id,
      version: "1",
      type: "DraftEServiceUpdated",
      event_version: 2,
    });

    const writtenPayload = decodeProtobufPayload({
      messageType: DraftEServiceUpdatedV2,
      payload: writtenEvent.data,
    });

    expect(writtenPayload).toEqual({
      eservice: toEServiceV2(expectedEService),
    });
    expect(updateEServiceReturn).toEqual({
      data: expectedEService,
      metadata: { version: 1 },
    });
  });

  it("should throw invalidDelegationFlags when isConsumerDelegable is false and isClientAccessDelegable is true", async () => {
    const descriptor: Descriptor = {
      ...getMockDescriptor(),
      state: descriptorState.draft,
      interface: mockDocument,
    };
    const eservice: EService = {
      ...mockEService,
      descriptors: [descriptor],
      isConsumerDelegable: true,
      isClientAccessDelegable: false,
    };

    await addOneEService(eservice);

    await expect(
      catalogService.patchUpdateEService(
        mockEService.id,
        {
          isConsumerDelegable: false,
          isClientAccessDelegable: true,
        },
        getMockContextM2MAdmin({ organizationId: mockEService.producerId })
      )
    ).rejects.toThrowError(invalidDelegationFlags(false, true));
  });

  it("should delete interface on technology change)", async () => {
    vi.spyOn(fileManager, "delete");

    const interfaceDocument = {
      ...mockDocument,
      name: `${mockDocument.name}`,
      path: `${config.eserviceDocumentsPath}/${mockDocument.id}/${mockDocument.name}`,
    };
    const mockAsyncExchangeCallbackInterfaceDocument = getMockDocument();
    const asyncExchangeCallbackInterfaceDocument = {
      ...mockAsyncExchangeCallbackInterfaceDocument,
      name: `${mockDocument.name}_callback`,
      path: `${config.eserviceDocumentsPath}/${mockAsyncExchangeCallbackInterfaceDocument.id}/${mockDocument.name}_callback`,
    };

    const descriptor: Descriptor = {
      ...getMockDescriptor(),
      state: descriptorState.draft,
      interface: interfaceDocument,
      asyncExchangeCallbackInterface: asyncExchangeCallbackInterfaceDocument,
    };
    const eservice: EService = {
      ...mockEService,
      descriptors: [descriptor],
      technology: "Rest",
    };
    await addOneEService(eservice);

    await fileManager.storeBytes(
      {
        bucket: config.s3Bucket,
        path: config.eserviceDocumentsPath,
        resourceId: interfaceDocument.id,
        name: interfaceDocument.name,
        content: Buffer.from("testtest"),
      },
      genericLogger
    );
    await fileManager.storeBytes(
      {
        bucket: config.s3Bucket,
        path: config.eserviceDocumentsPath,
        resourceId: asyncExchangeCallbackInterfaceDocument.id,
        name: asyncExchangeCallbackInterfaceDocument.name,
        content: Buffer.from("testtest"),
      },
      genericLogger
    );

    expect(
      await fileManager.listFiles(config.s3Bucket, genericLogger)
    ).toContain(interfaceDocument.path);
    expect(
      await fileManager.listFiles(config.s3Bucket, genericLogger)
    ).toContain(asyncExchangeCallbackInterfaceDocument.path);

    const updateEServiceReturn = await catalogService.patchUpdateEService(
      eservice.id,
      {
        technology: "SOAP",
      },
      getMockContextM2MAdmin({ organizationId: eservice.producerId })
    );

    const expectedEService: EService = {
      ...eservice,
      technology: "Soap",
      descriptors: eservice.descriptors.map((d) => ({
        ...d,
        interface: undefined,
        asyncExchangeCallbackInterface: undefined,
        serverUrls: [],
      })),
    };

    const writtenEvent = await readLastEserviceEvent(eservice.id);
    expect(writtenEvent).toMatchObject({
      stream_id: eservice.id,
      version: "1",
      type: "DraftEServiceUpdated",
      event_version: 2,
    });

    const writtenPayload = decodeProtobufPayload({
      messageType: DraftEServiceUpdatedV2,
      payload: writtenEvent.data,
    });

    expect(writtenPayload).toEqual({
      eservice: toEServiceV2(expectedEService),
    });
    expect(fileManager.delete).toHaveBeenCalledWith(
      config.s3Bucket,
      interfaceDocument.path,
      genericLogger
    );
    expect(
      await fileManager.listFiles(config.s3Bucket, genericLogger)
    ).not.toContain(interfaceDocument.path);
    expect(updateEServiceReturn).toEqual({
      data: expectedEService,
      metadata: { version: 1 },
    });
  });

  it("should write on event-store for the update of an e-service (delegate)", async () => {
    const delegation = getMockDelegation({
      kind: delegationKind.delegatedProducer,
      eserviceId: mockEService.id,
      state: delegationState.active,
    });

    await addOneEService(mockEService);
    await addOneDelegation(delegation);
    const updateEServiceReturn = await catalogService.patchUpdateEService(
      mockEService.id,
      {
        name: "eservice new name",
        description: "eservice new description",
      },
      getMockContextM2MAdmin({ organizationId: delegation.delegateId })
    );

    const expectedEService: EService = {
      ...mockEService,
      name: "eservice new name",
      description: "eservice new description",
    };

    const writtenEvent = await readLastEserviceEvent(mockEService.id);
    expect(writtenEvent).toMatchObject({
      stream_id: mockEService.id,
      version: "2",
      type: "EServiceDescriptionUpdated",
      event_version: 2,
    });

    const writtenPayload = decodeProtobufPayload({
      messageType: EServiceDescriptionUpdatedV2,
      payload: writtenEvent.data,
    });

    expect(writtenPayload).toEqual({
      eservice: toEServiceV2(expectedEService),
    });
    expect(updateEServiceReturn).toEqual({
      data: expectedEService,
      metadata: { version: 2 },
    });
  });

  it("should throw eServiceNotFound if the eservice doesn't exist", async () => {
    expect(
      catalogService.patchUpdateEService(
        mockEService.id,
        {
          name: "eservice new name",
          description: "eservice description",
          technology: "REST",
          mode: "DELIVER",
        },
        getMockContextM2MAdmin({ organizationId: mockEService.producerId })
      )
    ).rejects.toThrowError(eServiceNotFound(mockEService.id));
  });

  it("should throw operationForbidden if the requester is not the producer", async () => {
    await addOneEService(mockEService);

    expect(
      catalogService.patchUpdateEService(
        mockEService.id,
        {
          name: "eservice new name",
          description: "eservice description",
          technology: "REST",
          mode: "DELIVER",
        },
        getMockContextM2MAdmin({})
      )
    ).rejects.toThrowError(operationForbidden);
  });

  it("should throw operationForbidden if the requester if the given e-service has been delegated and caller is not the delegate", async () => {
    const delegation = getMockDelegation({
      kind: delegationKind.delegatedProducer,
      eserviceId: mockEService.id,
      state: delegationState.active,
    });

    await addOneEService(mockEService);
    await addOneDelegation(delegation);

    expect(
      catalogService.patchUpdateEService(
        mockEService.id,
        {
          name: "eservice new name",
          description: "eservice description",
          technology: "REST",
          mode: "DELIVER",
        },
        getMockContextM2MAdmin({ organizationId: mockEService.producerId })
      )
    ).rejects.toThrowError(operationForbidden);
  });

  it("should throw eServiceNameDuplicateForProducer if the updated name is already in use", async () => {
    const eservice1: EService = {
      ...mockEService,
      id: generateId(),
      descriptors: [],
    };

    const name = "eservice name already in use";

    const eservice2: EService = {
      ...mockEService,
      id: generateId(),
      name,
      descriptors: [],
    };
    await addOneEService(eservice1);
    await addOneEService(eservice2);

    expect(
      catalogService.patchUpdateEService(
        eservice1.id,
        {
          name,
          description: "eservice description",
        },
        getMockContextM2MAdmin({ organizationId: eservice1.producerId })
      )
    ).rejects.toThrowError(
      eServiceNameDuplicateForProducer(name, eservice1.producerId)
    );
  });

  it("should throw eServiceNameDuplicateForProducer if the updated name is already in use, case insensitive", async () => {
    const eservice1: EService = {
      ...mockEService,
      id: generateId(),
      descriptors: [],
    };

    const name = "eservice name already in use";

    const eservice2: EService = {
      ...mockEService,
      id: generateId(),
      name,
      descriptors: [],
    };
    await addOneEService(eservice1);
    await addOneEService(eservice2);

    expect(
      catalogService.patchUpdateEService(
        eservice1.id,
        {
          name: name.toUpperCase(),
          description: "eservice description",
        },
        getMockContextM2MAdmin({ organizationId: eservice1.producerId })
      )
    ).rejects.toThrowError(
      eServiceNameDuplicateForProducer(name.toUpperCase(), eservice1.producerId)
    );
  });

  it("should throw eserviceTemplateNameConflict if the updated name is already in use", async () => {
    const eservice1: EService = {
      ...mockEService,
      id: generateId(),
      descriptors: [],
    };

    const name = "eservice name already in use";

    const eserviceTemplate: EServiceTemplate = {
      ...getMockEServiceTemplate(),
      name,
    };

    await addOneEService(eservice1);
    await addOneEServiceTemplate(eserviceTemplate);

    expect(
      catalogService.patchUpdateEService(
        eservice1.id,
        {
          name,
          description: "eservice description",
        },
        getMockContextM2MAdmin({ organizationId: eservice1.producerId })
      )
    ).rejects.toThrowError(eserviceTemplateNameConflict(name));
  });

  it("should throw eserviceTemplateNameConflict if the updated name is already in use, case insensitive", async () => {
    const eservice1: EService = {
      ...mockEService,
      id: generateId(),
      descriptors: [],
    };

    const name = "eservice name already in use";

    const eserviceTemplate: EServiceTemplate = {
      ...getMockEServiceTemplate(),
      name,
    };

    await addOneEService(eservice1);
    await addOneEServiceTemplate(eserviceTemplate);

    expect(
      catalogService.patchUpdateEService(
        eservice1.id,
        {
          name: name.toUpperCase(),
          description: "eservice description",
        },
        getMockContextM2MAdmin({ organizationId: eservice1.producerId })
      )
    ).rejects.toThrowError(eserviceTemplateNameConflict(name.toUpperCase()));
  });

  it.each(
    Object.values(descriptorState).filter(
      (state) => state !== descriptorState.draft
    )
  )(
    "should throw eserviceNotInDraftState if the eservice descriptor is in %s state",
    async (state) => {
      const descriptor: Descriptor = {
        ...getMockDescriptor(),
        interface: mockDocument,
        state,
      };
      const eservice: EService = {
        ...mockEService,
        descriptors: [descriptor],
      };
      await addOneEService(eservice);
      expect(
        catalogService.patchUpdateEService(
          eservice.id,
          {
            name: "eservice new name",
            description: "eservice description",
            technology: "REST",
            mode: "DELIVER",
          },
          getMockContextM2MAdmin({ organizationId: eservice.producerId })
        )
      ).rejects.toThrowError(eserviceNotInDraftState(eservice.id));
    }
  );

  it("should throw templateInstanceNotAllowed if the eservice is an instance of a template", async () => {
    const templateId: EServiceTemplateId = generateId();
    const descriptor: Descriptor = {
      ...getMockDescriptor(),
      interface: mockDocument,
      state: descriptorState.draft,
    };
    const eservice: EService = {
      ...mockEService,
      descriptors: [descriptor],
      templateId,
    };
    await addOneEService(eservice);

    expect(
      catalogService.patchUpdateEService(
        mockEService.id,
        {
          name: "eservice new name",
          description: "eservice description",
          technology: "REST",
          mode: "DELIVER",
        },
        getMockContextM2MAdmin({ organizationId: eservice.producerId })
      )
    ).rejects.toThrowError(templateInstanceNotAllowed(eservice.id, templateId));
  });
});
