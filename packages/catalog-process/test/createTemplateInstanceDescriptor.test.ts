/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/no-floating-promises */
import {
  decodeProtobufPayload,
  getMockContext,
  getMockDelegation,
  getMockEServiceTemplate,
  getMockEServiceTemplateVersion,
  getMockAuthData,
} from "pagopa-interop-commons-test";
import {
  EService,
  EServiceDescriptorAddedV2,
  toEServiceV2,
  Descriptor,
  descriptorState,
  operationForbidden,
  delegationState,
  delegationKind,
  EServiceTemplateVersion,
  EServiceTemplate,
  eserviceTemplateVersionState,
} from "pagopa-interop-models";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { catalogApi } from "pagopa-interop-api-clients";
import {
  draftDescriptorAlreadyExists,
  eServiceNotFound,
  inconsistentDailyCalls,
} from "../src/model/domain/errors.js";
import {
  addOneEService,
  catalogService,
  readLastEserviceEvent,
  getMockDescriptor,
  getMockDocument,
  getMockEService,
  addOneDelegation,
  addOneEServiceTemplate,
} from "./utils.js";

describe("create descriptor", async () => {
  beforeAll(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date());
  });
  afterAll(() => {
    vi.useRealTimers();
  });
  it("should write on event-store for the creation of a descriptor of a instance e-service", async () => {
    const templateVersion: EServiceTemplateVersion = {
      ...getMockEServiceTemplateVersion(),
      state: eserviceTemplateVersionState.published,
      interface: getMockDocument(),
    };
    const template: EServiceTemplate = {
      ...getMockEServiceTemplate(),
      versions: [templateVersion],
    };

    const prevDescriptor: Descriptor = {
      ...getMockDescriptor(),
      version: "1",
      state: descriptorState.published,
      interface: getMockDocument(),
      templateVersionRef: {
        id: templateVersion.id,
      },
    };
    const eservice: EService = {
      ...getMockEService(),
      descriptors: [prevDescriptor],
      templateRef: {
        id: template.id,
      },
    };

    await addOneEServiceTemplate(template);
    await addOneEService(eservice);

    const descriptorSeed: catalogApi.EServiceInstanceDescriptorSeed = {
      audience: [],
      dailyCallsPerConsumer: 60,
      dailyCallsTotal: 60,
    };

    const returnedDescriptor =
      await catalogService.createTemplateInstanceDescriptor(
        eservice.id,
        descriptorSeed,
        getMockContext({ authData: getMockAuthData(eservice.producerId) })
      );
    const newDescriptorId = returnedDescriptor.id;
    const writtenEvent = await readLastEserviceEvent(eservice.id);
    expect(writtenEvent).toMatchObject({
      stream_id: eservice.id,
      version: "1",
      type: "EServiceDescriptorAdded",
      event_version: 2,
    });
    const writtenPayload = decodeProtobufPayload({
      messageType: EServiceDescriptorAddedV2,
      payload: writtenEvent.data,
    });

    const expectedEservice = toEServiceV2({
      ...eservice,
      descriptors: [
        prevDescriptor,
        {
          ...getMockDescriptor(),
          id: newDescriptorId,
          description: templateVersion.description,
          attributes: templateVersion.attributes,
          docs: templateVersion.docs,
          state: descriptorState.draft,
          voucherLifespan: templateVersion.voucherLifespan,
          templateVersionRef: {
            id: templateVersion.id,
          },
          audience: descriptorSeed.audience,
          dailyCallsPerConsumer: descriptorSeed.dailyCallsPerConsumer,
          dailyCallsTotal: descriptorSeed.dailyCallsTotal,
          version: "2",
          serverUrls: [],
          interface: undefined,
        },
      ],
    });

    expect(writtenPayload).toEqual({
      descriptorId: newDescriptorId,
      eservice: expectedEservice,
    });
    expect(writtenPayload).toEqual({
      descriptorId: newDescriptorId,
      eservice: toEServiceV2({
        ...eservice,
        descriptors: [prevDescriptor, returnedDescriptor],
      }),
    });
  });

  it("should write on event-store for the creation of a descriptor of a instance e-service (delegate)", async () => {
    const templateVersion: EServiceTemplateVersion = {
      ...getMockEServiceTemplateVersion(),
      state: eserviceTemplateVersionState.published,
      interface: getMockDocument(),
    };
    const template: EServiceTemplate = {
      ...getMockEServiceTemplate(),
      versions: [templateVersion],
    };

    const prevDescriptor: Descriptor = {
      ...getMockDescriptor(),
      version: "1",
      state: descriptorState.published,
      interface: getMockDocument(),
      templateVersionRef: {
        id: templateVersion.id,
      },
    };
    const eservice: EService = {
      ...getMockEService(),
      descriptors: [prevDescriptor],
      templateRef: {
        id: template.id,
      },
    };

    const delegation = getMockDelegation({
      kind: delegationKind.delegatedProducer,
      eserviceId: eservice.id,
      state: delegationState.active,
    });

    await addOneEServiceTemplate(template);
    await addOneEService(eservice);
    await addOneDelegation(delegation);

    const descriptorSeed: catalogApi.EServiceInstanceDescriptorSeed = {
      audience: [],
      dailyCallsPerConsumer: 60,
      dailyCallsTotal: 60,
    };

    const returnedDescriptor =
      await catalogService.createTemplateInstanceDescriptor(
        eservice.id,
        descriptorSeed,
        getMockContext({ authData: getMockAuthData(delegation.delegateId) })
      );
    const newDescriptorId = returnedDescriptor.id;
    const writtenEvent = await readLastEserviceEvent(eservice.id);
    expect(writtenEvent).toMatchObject({
      stream_id: eservice.id,
      version: "1",
      type: "EServiceDescriptorAdded",
      event_version: 2,
    });
    const writtenPayload = decodeProtobufPayload({
      messageType: EServiceDescriptorAddedV2,
      payload: writtenEvent.data,
    });

    const expectedEservice = toEServiceV2({
      ...eservice,
      descriptors: [
        prevDescriptor,
        {
          ...getMockDescriptor(),
          id: newDescriptorId,
          description: templateVersion.description,
          attributes: templateVersion.attributes,
          docs: templateVersion.docs,
          state: descriptorState.draft,
          voucherLifespan: templateVersion.voucherLifespan,
          templateVersionRef: {
            id: templateVersion.id,
          },
          audience: descriptorSeed.audience,
          dailyCallsPerConsumer: descriptorSeed.dailyCallsPerConsumer,
          dailyCallsTotal: descriptorSeed.dailyCallsTotal,
          version: "2",
          serverUrls: [],
          interface: undefined,
        },
      ],
    });

    expect(writtenPayload).toEqual({
      descriptorId: newDescriptorId,
      eservice: expectedEservice,
    });
    expect(writtenPayload).toEqual({
      descriptorId: newDescriptorId,
      eservice: toEServiceV2({
        ...eservice,
        descriptors: [prevDescriptor, returnedDescriptor],
      }),
    });
  });

  it.each([descriptorState.draft, descriptorState.waitingForApproval])(
    "should throw draftDescriptorAlreadyExists if a descriptor with state %s already exists",
    async (state) => {
      const templateVersion: EServiceTemplateVersion = {
        ...getMockEServiceTemplateVersion(),
        state: eserviceTemplateVersionState.published,
        interface: getMockDocument(),
      };
      const template: EServiceTemplate = {
        ...getMockEServiceTemplate(),
        versions: [templateVersion],
      };

      const prevDescriptor: Descriptor = {
        ...getMockDescriptor(),
        version: "1",
        state,
        interface: getMockDocument(),
        templateVersionRef: {
          id: templateVersion.id,
        },
      };
      const eservice: EService = {
        ...getMockEService(),
        descriptors: [prevDescriptor],
        templateRef: {
          id: template.id,
        },
      };

      await addOneEServiceTemplate(template);
      await addOneEService(eservice);

      const descriptorSeed: catalogApi.EServiceInstanceDescriptorSeed = {
        audience: [],
        dailyCallsPerConsumer: 60,
        dailyCallsTotal: 60,
      };

      expect(
        catalogService.createTemplateInstanceDescriptor(
          eservice.id,
          descriptorSeed,
          getMockContext({ authData: getMockAuthData(eservice.producerId) })
        )
      ).rejects.toThrowError(draftDescriptorAlreadyExists(eservice.id));
    }
  );

  it("should throw eServiceNotFound if the eservice doesn't exist", async () => {
    const templateVersion: EServiceTemplateVersion = {
      ...getMockEServiceTemplateVersion(),
      state: eserviceTemplateVersionState.published,
      interface: getMockDocument(),
    };
    const template: EServiceTemplate = {
      ...getMockEServiceTemplate(),
      versions: [templateVersion],
    };

    const prevDescriptor: Descriptor = {
      ...getMockDescriptor(),
      version: "1",
      state: descriptorState.published,
      interface: getMockDocument(),
      templateVersionRef: {
        id: templateVersion.id,
      },
    };
    const eservice: EService = {
      ...getMockEService(),
      descriptors: [prevDescriptor],
      templateRef: {
        id: template.id,
      },
    };

    await addOneEServiceTemplate(template);

    const descriptorSeed: catalogApi.EServiceInstanceDescriptorSeed = {
      audience: [],
      dailyCallsPerConsumer: 60,
      dailyCallsTotal: 60,
    };

    expect(
      catalogService.createTemplateInstanceDescriptor(
        eservice.id,
        descriptorSeed,
        getMockContext({ authData: getMockAuthData(eservice.producerId) })
      )
    ).rejects.toThrowError(eServiceNotFound(eservice.id));
  });

  it("should throw operationForbidden if the requester is not the producer", async () => {
    const templateVersion: EServiceTemplateVersion = {
      ...getMockEServiceTemplateVersion(),
      state: eserviceTemplateVersionState.published,
      interface: getMockDocument(),
    };
    const template: EServiceTemplate = {
      ...getMockEServiceTemplate(),
      versions: [templateVersion],
    };

    const prevDescriptor: Descriptor = {
      ...getMockDescriptor(),
      version: "1",
      state: descriptorState.published,
      interface: getMockDocument(),
      templateVersionRef: {
        id: templateVersion.id,
      },
    };
    const eservice: EService = {
      ...getMockEService(),
      descriptors: [prevDescriptor],
      templateRef: {
        id: template.id,
      },
    };

    await addOneEService(eservice);
    await addOneEServiceTemplate(template);

    expect(
      catalogService.createTemplateInstanceDescriptor(
        eservice.id,
        { audience: [], dailyCallsPerConsumer: 60, dailyCallsTotal: 60 },
        getMockContext({})
      )
    ).rejects.toThrowError(operationForbidden);
  });
  it("should throw operationForbidden if the requester if the given e-service has been delegated and caller is not the delegate", async () => {
    const templateVersion: EServiceTemplateVersion = {
      ...getMockEServiceTemplateVersion(),
      state: eserviceTemplateVersionState.published,
      interface: getMockDocument(),
    };
    const template: EServiceTemplate = {
      ...getMockEServiceTemplate(),
      versions: [templateVersion],
    };

    const prevDescriptor: Descriptor = {
      ...getMockDescriptor(),
      version: "1",
      state: descriptorState.published,
      interface: getMockDocument(),
      templateVersionRef: {
        id: templateVersion.id,
      },
    };
    const eservice: EService = {
      ...getMockEService(),
      descriptors: [prevDescriptor],
      templateRef: {
        id: template.id,
      },
    };

    const delegation = getMockDelegation({
      kind: delegationKind.delegatedProducer,
      eserviceId: eservice.id,
      state: delegationState.active,
    });

    await addOneEService(eservice);
    await addOneEServiceTemplate(template);
    await addOneDelegation(delegation);

    expect(
      catalogService.createTemplateInstanceDescriptor(
        eservice.id,
        { audience: [], dailyCallsPerConsumer: 60, dailyCallsTotal: 60 },
        getMockContext({ authData: getMockAuthData(eservice.producerId) })
      )
    ).rejects.toThrowError(operationForbidden);
  });
  it("should throw inconsistentDailyCalls if dailyCallsPerConsumer is greater than dailyCallsTotal", async () => {
    const templateVersion: EServiceTemplateVersion = {
      ...getMockEServiceTemplateVersion(),
      state: eserviceTemplateVersionState.published,
      interface: getMockDocument(),
    };
    const template: EServiceTemplate = {
      ...getMockEServiceTemplate(),
      versions: [templateVersion],
    };

    const prevDescriptor: Descriptor = {
      ...getMockDescriptor(),
      version: "1",
      state: descriptorState.published,
      interface: getMockDocument(),
      templateVersionRef: {
        id: templateVersion.id,
      },
    };
    const eservice: EService = {
      ...getMockEService(),
      descriptors: [prevDescriptor],
      templateRef: {
        id: template.id,
      },
    };

    await addOneEService(eservice);
    await addOneEServiceTemplate(template);

    expect(
      catalogService.createTemplateInstanceDescriptor(
        eservice.id,
        { audience: [], dailyCallsPerConsumer: 60, dailyCallsTotal: 50 },
        getMockContext({ authData: getMockAuthData(eservice.producerId) })
      )
    ).rejects.toThrowError(inconsistentDailyCalls());
  });
});
