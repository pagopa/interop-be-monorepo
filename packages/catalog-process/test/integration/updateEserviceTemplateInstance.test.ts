/* eslint-disable @typescript-eslint/no-floating-promises */
import {
  decodeProtobufPayload,
  getMockContext,
  getMockDelegation,
  getMockEServiceTemplate,
  getMockAuthData,
  randomArrayItem,
  getMockDocument,
  getMockDescriptor,
  getMockEService,
} from "pagopa-interop-commons-test";
import {
  Descriptor,
  descriptorState,
  EService,
  DraftEServiceUpdatedV2,
  toEServiceV2,
  operationForbidden,
  delegationState,
  delegationKind,
  EServiceTemplate,
} from "pagopa-interop-models";
import { expect, describe, it } from "vitest";
import { match } from "ts-pattern";
import {
  eServiceNotFound,
  eserviceNotInDraftState,
  eServiceNotAnInstance,
} from "../../src/model/domain/errors.js";
import {
  addOneEService,
  catalogService,
  readLastEserviceEvent,
  addOneDelegation,
  addOneEServiceTemplate,
} from "../integrationUtils.js";

describe("update eService Instance", () => {
  const mockEService = getMockEService();
  const mockDocument = getMockDocument();

  it("should write on event-store for the update of an eService", async () => {
    const isSignalHubEnabled = randomArrayItem([false, true, undefined]);
    const isConsumerDelegable = randomArrayItem([false, true, undefined]);
    const isClientAccessDelegable = match(isConsumerDelegable)
      .with(undefined, () => undefined)
      .with(true, () => randomArrayItem([false, true, undefined]))
      .with(false, () => false)
      .exhaustive();

    const template: EServiceTemplate = getMockEServiceTemplate();

    const descriptor: Descriptor = {
      ...getMockDescriptor(),
      state: descriptorState.draft,
      interface: mockDocument,
    };
    const eservice: EService = {
      ...mockEService,
      name: `${template.name}`,
      descriptors: [descriptor],
      isSignalHubEnabled,
      templateId: template.id,
    };
    await addOneEServiceTemplate(template);
    await addOneEService(eservice);
    const returnedEService =
      await catalogService.updateEServiceTemplateInstance(
        mockEService.id,
        {
          isSignalHubEnabled,
          isConsumerDelegable,
          isClientAccessDelegable,
        },
        getMockContext({ authData: getMockAuthData(mockEService.producerId) })
      );

    const updatedEService: EService = {
      ...eservice,
      isSignalHubEnabled,
      isConsumerDelegable,
      isClientAccessDelegable,
    };

    const writtenEvent = await readLastEserviceEvent(mockEService.id);
    expect(writtenEvent.stream_id).toBe(mockEService.id);
    expect(writtenEvent.version).toBe("1");
    expect(writtenEvent.type).toBe("DraftEServiceUpdated");
    expect(writtenEvent.event_version).toBe(2);
    const writtenPayload = decodeProtobufPayload({
      messageType: DraftEServiceUpdatedV2,
      payload: writtenEvent.data,
    });

    expect(writtenPayload.eservice).toEqual(toEServiceV2(updatedEService));
    expect(writtenPayload.eservice).toEqual(toEServiceV2(returnedEService));
  });

  it("should update an eservice correctly handling isClientAccessDelegable when isConsumerDelegable is not true", async () => {
    const isSignalHubEnabled = randomArrayItem([false, true, undefined]);
    const isConsumerDelegable: false | undefined = randomArrayItem([
      false,
      undefined,
    ]);
    const isClientAccessDelegable = randomArrayItem([false, true, undefined]);
    const expectedIsClientAccessDelegable = match(isConsumerDelegable)
      .with(false, () => false)
      .with(undefined, () => undefined)
      .exhaustive();

    const template: EServiceTemplate = getMockEServiceTemplate();

    const descriptor: Descriptor = {
      ...getMockDescriptor(),
      state: descriptorState.draft,
      interface: mockDocument,
    };
    const eservice: EService = {
      ...mockEService,
      name: `${template.name}`,
      descriptors: [descriptor],
      isSignalHubEnabled,
      templateId: template.id,
    };
    await addOneEServiceTemplate(template);
    await addOneEService(eservice);

    const returnedEService =
      await catalogService.updateEServiceTemplateInstance(
        mockEService.id,
        {
          isSignalHubEnabled,
          isConsumerDelegable,
          isClientAccessDelegable,
        },
        getMockContext({ authData: getMockAuthData(mockEService.producerId) })
      );

    const updatedEService: EService = {
      ...eservice,
      isSignalHubEnabled,
      isConsumerDelegable,
      isClientAccessDelegable: expectedIsClientAccessDelegable,
    };

    const writtenEvent = await readLastEserviceEvent(mockEService.id);
    expect(writtenEvent.stream_id).toBe(mockEService.id);
    expect(writtenEvent.version).toBe("1");
    expect(writtenEvent.type).toBe("DraftEServiceUpdated");
    expect(writtenEvent.event_version).toBe(2);
    const writtenPayload = decodeProtobufPayload({
      messageType: DraftEServiceUpdatedV2,
      payload: writtenEvent.data,
    });

    expect(writtenPayload.eservice).toEqual(toEServiceV2(updatedEService));
    expect(writtenPayload.eservice).toEqual(toEServiceV2(returnedEService));
  });

  it("should write on event-store for the update of an eService (delegate)", async () => {
    const delegation = getMockDelegation({
      kind: delegationKind.delegatedProducer,
      eserviceId: mockEService.id,
      state: delegationState.active,
    });

    const template: EServiceTemplate = getMockEServiceTemplate();

    const eservice: EService = {
      ...mockEService,
      name: template.name,
      templateId: template.id,
      isConsumerDelegable: true,
    };

    await addOneEServiceTemplate(template);
    await addOneEService(eservice);
    await addOneDelegation(delegation);

    const returnedEService =
      await catalogService.updateEServiceTemplateInstance(
        mockEService.id,
        {
          isConsumerDelegable: false,
          isClientAccessDelegable: false,
          isSignalHubEnabled: false,
        },
        getMockContext({ authData: getMockAuthData(delegation.delegateId) })
      );

    const updatedEService: EService = {
      ...eservice,
      name: template.name,
      isConsumerDelegable: false,
      isClientAccessDelegable: false,
      isSignalHubEnabled: false,
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

    expect(writtenPayload.eservice).toEqual(toEServiceV2(updatedEService));
    expect(writtenPayload.eservice).toEqual(toEServiceV2(returnedEService));
  });

  it("should throw eServiceNotFound if the eservice doesn't exist", async () => {
    expect(
      catalogService.updateEServiceTemplateInstance(
        mockEService.id,
        {},
        getMockContext({ authData: getMockAuthData(mockEService.producerId) })
      )
    ).rejects.toThrowError(eServiceNotFound(mockEService.id));
  });

  it("should throw operationForbidden if the requester is not the producer", async () => {
    const template = getMockEServiceTemplate();
    await addOneEServiceTemplate(template);
    await addOneEService({
      ...mockEService,
      name: template.name,
      templateId: template.id,
    });

    expect(
      catalogService.updateEServiceTemplateInstance(
        mockEService.id,
        {},
        getMockContext({})
      )
    ).rejects.toThrowError(operationForbidden);
  });

  it("should throw operationForbidden if the requester if the given e-service has been delegated and caller is not the delegate", async () => {
    const delegation = getMockDelegation({
      kind: delegationKind.delegatedProducer,
      eserviceId: mockEService.id,
      state: delegationState.active,
    });

    const template = getMockEServiceTemplate();
    await addOneEServiceTemplate(template);
    await addOneEService({
      ...mockEService,
      name: template.name,
      templateId: template.id,
    });
    await addOneDelegation(delegation);

    expect(
      catalogService.updateEServiceTemplateInstance(
        mockEService.id,
        {},
        getMockContext({ authData: getMockAuthData(mockEService.producerId) })
      )
    ).rejects.toThrowError(operationForbidden);
  });

  it.each([
    descriptorState.published,
    descriptorState.archived,
    descriptorState.suspended,
    descriptorState.deprecated,
  ] as const)(
    "should throw eserviceNotInDraftState if the eservice descriptor is in %s state",
    async (descriptorState) => {
      const template = getMockEServiceTemplate();
      await addOneEServiceTemplate(template);
      const descriptor: Descriptor = {
        ...getMockDescriptor(),
        interface: mockDocument,
        state: descriptorState,
      };
      const eservice: EService = {
        ...mockEService,
        descriptors: [descriptor],
        name: `${template.name}`,
        templateId: template.id,
      };

      await addOneEService(eservice);
      expect(
        catalogService.updateEServiceTemplateInstance(
          eservice.id,
          {},
          getMockContext({ authData: getMockAuthData(eservice.producerId) })
        )
      ).rejects.toThrowError(eserviceNotInDraftState(eservice.id));
    }
  );

  it("should throw eServiceNotAnInstance if the eservice is not an instance of a template", async () => {
    const descriptor: Descriptor = {
      ...getMockDescriptor(),
      interface: mockDocument,
      state: descriptorState.draft,
    };
    const eservice: EService = {
      ...mockEService,
      descriptors: [descriptor],
      templateId: undefined,
    };
    await addOneEService(eservice);

    expect(
      catalogService.updateEServiceTemplateInstance(
        mockEService.id,
        {},
        getMockContext({ authData: getMockAuthData(mockEService.producerId) })
      )
    ).rejects.toThrowError(eServiceNotAnInstance(eservice.id));
  });
});
