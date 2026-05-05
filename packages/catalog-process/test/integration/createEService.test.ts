/* eslint-disable @typescript-eslint/no-floating-promises */
import {
  decodeProtobufPayload,
  getMockAuthData,
  getMockContext,
  getMockDescriptor,
  randomArrayItem,
  readEventByStreamIdAndVersion,
  getMockEService,
  getMockEServiceTemplate,
} from "pagopa-interop-commons-test";
import {
  EServiceAddedV2,
  EService,
  toEServiceV2,
  EServiceDescriptorAddedV2,
} from "pagopa-interop-models";
import { expect, describe, it, beforeAll, vi, afterAll } from "vitest";
import { match } from "ts-pattern";
import {
  eServiceNameDuplicateForProducer,
  eserviceTemplateNameConflict,
  inconsistentDailyCalls,
  invalidDelegationFlags,
  originNotCompliant,
} from "../../src/model/domain/errors.js";
import {
  addOneEService,
  addOneEServiceTemplate,
  catalogService,
  postgresDB,
  readLastEserviceEvent,
} from "../integrationUtils.js";
import { buildDescriptorSeedForEserviceCreation } from "../mockUtils.js";
describe("create eservice", () => {
  const mockEService = getMockEService();
  const mockDescriptor = getMockDescriptor();
  beforeAll(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date());
  });
  afterAll(() => {
    vi.useRealTimers();
  });
  it("should write on event-store for the creation of an eservice", async () => {
    const isSignalHubEnabled = randomArrayItem([false, true, undefined]);
    const isConsumerDelegable = randomArrayItem([false, true, undefined]);
    const isClientAccessDelegable = match(isConsumerDelegable)
      .with(undefined, () => undefined)
      .with(true, () => randomArrayItem([false, true, undefined]))
      .with(false, () => false)
      .exhaustive();
    const personalData = randomArrayItem([false, true]);

    const eservice = await catalogService.createEService(
      {
        name: mockEService.name,
        description: mockEService.description,
        technology: "REST",
        mode: "DELIVER",
        descriptor: buildDescriptorSeedForEserviceCreation(mockDescriptor),
        isSignalHubEnabled,
        isConsumerDelegable,
        isClientAccessDelegable,
        personalData,
      },
      getMockContext({ authData: getMockAuthData(mockEService.producerId) })
    );

    expect(eservice).toBeDefined();

    const eserviceCreationEvent = await readEventByStreamIdAndVersion(
      eservice.data.id,
      0,
      "catalog",
      postgresDB
    );
    const descriptorCreationEvent = await readLastEserviceEvent(
      eservice.data.id
    );

    expect(eserviceCreationEvent).toMatchObject({
      stream_id: eservice.data.id,
      version: "0",
      type: "EServiceAdded",
      event_version: 2,
    });
    expect(descriptorCreationEvent).toMatchObject({
      stream_id: eservice.data.id,
      version: "1",
      type: "EServiceDescriptorAdded",
      event_version: 2,
    });

    const eserviceCreationPayload = decodeProtobufPayload({
      messageType: EServiceAddedV2,
      payload: eserviceCreationEvent.data,
    });
    const descriptorCreationPayload = decodeProtobufPayload({
      messageType: EServiceDescriptorAddedV2,
      payload: descriptorCreationEvent.data,
    });

    const expectedEservice: EService = {
      ...mockEService,
      createdAt: new Date(),
      id: eservice.data.id,
      descriptors: [],
      isSignalHubEnabled,
      isConsumerDelegable,
      isClientAccessDelegable,
      personalData,
    };
    const expectedEserviceWithDescriptor: EService = {
      ...mockEService,
      createdAt: new Date(),
      id: eservice.data.id,
      isSignalHubEnabled,
      isConsumerDelegable,
      isClientAccessDelegable,
      personalData,
      descriptors: [
        {
          ...mockDescriptor,
          id: eservice.data.descriptors[0].id,
          createdAt: new Date(),
          serverUrls: [],
        },
      ],
    };

    expect(eserviceCreationPayload.eservice).toEqual(
      toEServiceV2(expectedEservice)
    );
    expect(descriptorCreationPayload.eservice).toEqual(
      toEServiceV2(expectedEserviceWithDescriptor)
    );
    expect(eservice).toEqual({
      data: expectedEserviceWithDescriptor,
      metadata: { version: 1 },
    });
  });

  it("should create an eservice correctly handling isClientAccessDelegable when isConsumerDelegable is not true", async () => {
    const isSignalHubEnabled = randomArrayItem([false, true, undefined]);
    const isConsumerDelegable: false | undefined = randomArrayItem([
      false,
      undefined,
    ]);
    const isClientAccessDelegable = match(isConsumerDelegable)
      .with(false, () => false)
      .with(undefined, () => undefined)
      .exhaustive();
    const expectedIsClientAccessDelegable = match(isConsumerDelegable)
      .with(false, () => false)
      .with(undefined, () => undefined)
      .exhaustive();

    const eservice = await catalogService.createEService(
      {
        name: mockEService.name,
        description: mockEService.description,
        technology: "REST",
        mode: "DELIVER",
        descriptor: buildDescriptorSeedForEserviceCreation(mockDescriptor),
        isSignalHubEnabled,
        isConsumerDelegable,
        isClientAccessDelegable,
      },
      getMockContext({ authData: getMockAuthData(mockEService.producerId) })
    );

    expect(eservice).toBeDefined();

    const eserviceCreationEvent = await readEventByStreamIdAndVersion(
      eservice.data.id,
      0,
      "catalog",
      postgresDB
    );
    const descriptorCreationEvent = await readLastEserviceEvent(
      eservice.data.id
    );

    expect(eserviceCreationEvent).toMatchObject({
      stream_id: eservice.data.id,
      version: "0",
      type: "EServiceAdded",
      event_version: 2,
    });
    expect(descriptorCreationEvent).toMatchObject({
      stream_id: eservice.data.id,
      version: "1",
      type: "EServiceDescriptorAdded",
      event_version: 2,
    });

    const eserviceCreationPayload = decodeProtobufPayload({
      messageType: EServiceAddedV2,
      payload: eserviceCreationEvent.data,
    });
    const descriptorCreationPayload = decodeProtobufPayload({
      messageType: EServiceDescriptorAddedV2,
      payload: descriptorCreationEvent.data,
    });

    const expectedEservice: EService = {
      ...mockEService,
      createdAt: new Date(),
      id: eservice.data.id,
      descriptors: [],
      isSignalHubEnabled,
      isConsumerDelegable,
      isClientAccessDelegable: expectedIsClientAccessDelegable,
    };
    const expectedEserviceWithDescriptor: EService = {
      ...mockEService,
      createdAt: new Date(),
      id: eservice.data.id,
      isSignalHubEnabled,
      isConsumerDelegable,
      isClientAccessDelegable: expectedIsClientAccessDelegable,
      descriptors: [
        {
          ...mockDescriptor,
          id: eservice.data.descriptors[0].id,
          createdAt: new Date(),
          serverUrls: [],
        },
      ],
    };

    expect(eserviceCreationPayload.eservice).toEqual(
      toEServiceV2(expectedEservice)
    );
    expect(descriptorCreationPayload.eservice).toEqual(
      toEServiceV2(expectedEserviceWithDescriptor)
    );
  });

  it("should throw invalidDelegationFlags when isConsumerDelegable is false and isClientAccessDelegable is true", async () => {
    const isSignalHubEnabled = randomArrayItem([false, true, undefined]);

    await expect(
      catalogService.createEService(
        {
          name: mockEService.name,
          description: mockEService.description,
          technology: "REST",
          mode: "DELIVER",
          descriptor: buildDescriptorSeedForEserviceCreation(mockDescriptor),
          isSignalHubEnabled,
          isConsumerDelegable: false,
          isClientAccessDelegable: true,
        },
        getMockContext({ authData: getMockAuthData(mockEService.producerId) })
      )
    ).rejects.toMatchObject({
      code: invalidDelegationFlags(false, true).code,
    });
  });

  it("should throw eServiceNameDuplicateForProducer if an eservice with the same name already exists", async () => {
    await addOneEService({
      ...mockEService,
      name: mockEService.name,
    });
    expect(
      catalogService.createEService(
        {
          name: mockEService.name,
          description: mockEService.description,
          technology: "REST",
          mode: "DELIVER",
          descriptor: buildDescriptorSeedForEserviceCreation(mockDescriptor),
        },
        getMockContext({ authData: getMockAuthData(mockEService.producerId) })
      )
    ).rejects.toThrowError(
      eServiceNameDuplicateForProducer(
        mockEService.name,
        mockEService.producerId
      )
    );
  });
  it("should throw eServiceNameDuplicateForProducer if an eservice with the same name already exists, case insensitive", async () => {
    await addOneEService({
      ...mockEService,
      name: mockEService.name.toUpperCase(),
    });
    expect(
      catalogService.createEService(
        {
          name: mockEService.name.toLowerCase(),
          description: mockEService.description,
          technology: "REST",
          mode: "DELIVER",
          descriptor: buildDescriptorSeedForEserviceCreation(mockDescriptor),
        },
        getMockContext({ authData: getMockAuthData(mockEService.producerId) })
      )
    ).rejects.toThrowError(
      eServiceNameDuplicateForProducer(
        mockEService.name.toLowerCase(),
        mockEService.producerId
      )
    );
  });
  it("should throw eserviceTemplateNameConflict if an eservice template with the same name already exists", async () => {
    await addOneEServiceTemplate({
      ...getMockEServiceTemplate(),
      name: mockEService.name,
    });
    expect(
      catalogService.createEService(
        {
          name: mockEService.name,
          description: mockEService.description,
          technology: "REST",
          mode: "DELIVER",
          descriptor: buildDescriptorSeedForEserviceCreation(mockDescriptor),
        },
        getMockContext({ authData: getMockAuthData(mockEService.producerId) })
      )
    ).rejects.toThrowError(eserviceTemplateNameConflict(mockEService.name));
  });
  it("should throw eserviceTemplateNameConflict if an eservice template with the same name already exists, case insensitive", async () => {
    await addOneEServiceTemplate({
      ...getMockEServiceTemplate(),
      name: mockEService.name.toUpperCase(),
    });
    expect(
      catalogService.createEService(
        {
          name: mockEService.name.toLowerCase(),
          description: mockEService.description,
          technology: "REST",
          mode: "DELIVER",
          descriptor: buildDescriptorSeedForEserviceCreation(mockDescriptor),
        },
        getMockContext({ authData: getMockAuthData(mockEService.producerId) })
      )
    ).rejects.toThrowError(
      eserviceTemplateNameConflict(mockEService.name.toLowerCase())
    );
  });

  it("should throw originNotCompliant if the requester externalId origin is not allowed", async () => {
    expect(
      catalogService.createEService(
        {
          name: mockEService.name,
          description: mockEService.description,
          technology: "REST",
          mode: "DELIVER",
          descriptor: buildDescriptorSeedForEserviceCreation(mockDescriptor),
        },
        getMockContext({
          authData: {
            ...getMockAuthData(mockEService.producerId),
            externalId: {
              value: "123456",
              origin: "not-allowed-origin",
            },
          },
        })
      )
    ).rejects.toThrowError(originNotCompliant("not-allowed-origin"));
  });

  it("should throw inconsistentDailyCalls if the descriptor seed has dailyCallsPerConsumer > dailyCallsTotal", async () => {
    expect(
      catalogService.createEService(
        {
          name: mockEService.name,
          description: mockEService.description,
          technology: "REST",
          mode: "DELIVER",
          descriptor: {
            ...buildDescriptorSeedForEserviceCreation(mockDescriptor),
            dailyCallsPerConsumer: 100,
            dailyCallsTotal: 99,
          },
        },
        getMockContext({ authData: getMockAuthData(mockEService.producerId) })
      )
    ).rejects.toThrowError(inconsistentDailyCalls());
  });
});
