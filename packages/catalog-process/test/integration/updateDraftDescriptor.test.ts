/* eslint-disable @typescript-eslint/no-floating-promises */
import { catalogApi } from "pagopa-interop-api-clients";
import {
  decodeProtobufPayload,
  getMockContext,
  getMockDelegation,
  getMockEServiceTemplate,
  getMockAuthData,
  getMockDescriptor,
  getMockEService,
  getMockDocument,
  getMockAttribute,
} from "pagopa-interop-commons-test";
import {
  Descriptor,
  descriptorState,
  EService,
  Attribute,
  generateId,
  EServiceDraftDescriptorUpdatedV2,
  toEServiceV2,
  operationForbidden,
  delegationState,
  delegationKind,
} from "pagopa-interop-models";
import { expect, describe, it, beforeEach } from "vitest";
import {
  eServiceNotFound,
  eServiceDescriptorNotFound,
  notValidDescriptorState,
  inconsistentDailyCalls,
  attributeNotFound,
  templateInstanceNotAllowed,
} from "../../src/model/domain/errors.js";
import {
  addOneEService,
  addOneAttribute,
  catalogService,
  readLastEserviceEvent,
  addOneDelegation,
  addOneEServiceTemplate,
} from "../integrationUtils.js";
import { buildUpdateDescriptorSeed } from "../mockUtils.js";

describe("updateDraftDescriptor", () => {
  const mockDescriptor = getMockDescriptor();
  const mockEService = getMockEService();
  const mockDocument = getMockDocument();

  const certifiedAttribute: Attribute = getMockAttribute("Certified");

  const verifiedAttribute: Attribute = getMockAttribute("Verified");

  const declaredAttribute: Attribute = getMockAttribute("Declared");

  beforeEach(async () => {
    await addOneAttribute(certifiedAttribute);
    await addOneAttribute(verifiedAttribute);
    await addOneAttribute(declaredAttribute);
  });

  it("should write on event-store for the update of a draft descriptor", async () => {
    const descriptor: Descriptor = {
      ...mockDescriptor,
      state: descriptorState.draft,
    };
    const eservice: EService = {
      ...mockEService,
      descriptors: [descriptor],
    };
    await addOneEService(eservice);

    const descriptorSeed: catalogApi.UpdateEServiceDescriptorSeed = {
      ...buildUpdateDescriptorSeed(descriptor),
      dailyCallsTotal: 200,
      attributes: {
        certified: [
          [{ id: certifiedAttribute.id, explicitAttributeVerification: false }],
        ],
        declared: [
          [{ id: declaredAttribute.id, explicitAttributeVerification: false }],
        ],
        verified: [
          [{ id: verifiedAttribute.id, explicitAttributeVerification: false }],
        ],
      },
    };

    const expectedEService: EService = {
      ...eservice,
      descriptors: [
        {
          ...descriptor,
          dailyCallsTotal: 200,
          attributes: {
            certified: [
              [
                {
                  id: certifiedAttribute.id,
                  explicitAttributeVerification: false,
                },
              ],
            ],
            declared: [
              [
                {
                  id: declaredAttribute.id,
                  explicitAttributeVerification: false,
                },
              ],
            ],
            verified: [
              [
                {
                  id: verifiedAttribute.id,
                  explicitAttributeVerification: false,
                },
              ],
            ],
          },
        },
      ],
    };
    const updateDescriptorResponse = await catalogService.updateDraftDescriptor(
      eservice.id,
      descriptor.id,
      descriptorSeed,
      getMockContext({ authData: getMockAuthData(eservice.producerId) })
    );
    const writtenEvent = await readLastEserviceEvent(eservice.id);
    expect(writtenEvent).toMatchObject({
      stream_id: eservice.id,
      version: "1",
      type: "EServiceDraftDescriptorUpdated",
      event_version: 2,
    });
    const writtenPayload = decodeProtobufPayload({
      messageType: EServiceDraftDescriptorUpdatedV2,
      payload: writtenEvent.data,
    });
    expect(writtenPayload).toEqual({
      eservice: toEServiceV2(expectedEService),
      descriptorId: descriptor.id,
    });
    expect(updateDescriptorResponse).toEqual({
      data: expectedEService,
      metadata: { version: 1 },
    });
  });

  it("should write on event-store for the update of a draft descriptor (delegate)", async () => {
    const descriptor: Descriptor = {
      ...mockDescriptor,
      state: descriptorState.draft,
    };
    const eservice: EService = {
      ...mockEService,
      descriptors: [descriptor],
    };
    const delegation = getMockDelegation({
      kind: delegationKind.delegatedProducer,
      eserviceId: eservice.id,
      state: delegationState.active,
    });

    await addOneEService(eservice);
    await addOneDelegation(delegation);

    const descriptorSeed: catalogApi.UpdateEServiceDescriptorSeed = {
      ...buildUpdateDescriptorSeed(descriptor),
      dailyCallsTotal: 200,
      attributes: {
        certified: [],
        declared: [
          [{ id: declaredAttribute.id, explicitAttributeVerification: false }],
        ],
        verified: [],
      },
    };

    const expectedEService: EService = {
      ...eservice,
      descriptors: [
        {
          ...descriptor,
          dailyCallsTotal: 200,
          attributes: {
            certified: [],
            declared: [
              [
                {
                  id: declaredAttribute.id,
                  explicitAttributeVerification: false,
                },
              ],
            ],
            verified: [],
          },
        },
      ],
    };
    const updateDescriptorResponse = await catalogService.updateDraftDescriptor(
      eservice.id,
      descriptor.id,
      descriptorSeed,
      getMockContext({ authData: getMockAuthData(delegation.delegateId) })
    );
    const writtenEvent = await readLastEserviceEvent(eservice.id);
    expect(writtenEvent).toMatchObject({
      stream_id: eservice.id,
      version: "1",
      type: "EServiceDraftDescriptorUpdated",
      event_version: 2,
    });
    const writtenPayload = decodeProtobufPayload({
      messageType: EServiceDraftDescriptorUpdatedV2,
      payload: writtenEvent.data,
    });
    expect(writtenPayload).toEqual({
      eservice: toEServiceV2(expectedEService),
      descriptorId: descriptor.id,
    });
    expect(updateDescriptorResponse).toEqual({
      data: expectedEService,
      metadata: { version: 1 },
    });
  });

  it("should throw eServiceNotFound if the eservice doesn't exist", () => {
    const descriptor: Descriptor = {
      ...mockDescriptor,
      interface: mockDocument,
      state: descriptorState.published,
    };
    expect(
      catalogService.updateDraftDescriptor(
        mockEService.id,
        descriptor.id,
        buildUpdateDescriptorSeed(descriptor),
        getMockContext({ authData: getMockAuthData(mockEService.producerId) })
      )
    ).rejects.toThrowError(eServiceNotFound(mockEService.id));
  });

  it("should throw eServiceDescriptorNotFound if the descriptor doesn't exist", async () => {
    const eservice: EService = {
      ...mockEService,
      descriptors: [],
    };
    await addOneEService(eservice);

    expect(
      catalogService.updateDraftDescriptor(
        mockEService.id,
        mockDescriptor.id,
        buildUpdateDescriptorSeed(mockDescriptor),
        getMockContext({ authData: getMockAuthData(mockEService.producerId) })
      )
    ).rejects.toThrowError(
      eServiceDescriptorNotFound(eservice.id, mockDescriptor.id)
    );
  });

  it.each(
    Object.values(descriptorState).filter(
      (state) => state !== descriptorState.draft
    )
  )(
    "should throw notValidDescriptorState if the descriptor is in $s state",
    async (state) => {
      const descriptor: Descriptor = {
        ...mockDescriptor,
        interface: mockDocument,
        state,
      };
      const eservice: EService = {
        ...mockEService,
        descriptors: [descriptor],
      };
      await addOneEService(eservice);

      expect(
        catalogService.updateDraftDescriptor(
          eservice.id,
          descriptor.id,
          buildUpdateDescriptorSeed(descriptor),
          getMockContext({ authData: getMockAuthData(eservice.producerId) })
        )
      ).rejects.toThrowError(notValidDescriptorState(mockDescriptor.id, state));
    }
  );

  it("should throw operationForbidden if the requester is not the producer", async () => {
    const descriptor: Descriptor = {
      ...mockDescriptor,
      state: descriptorState.draft,
    };
    const eservice: EService = {
      ...mockEService,
      descriptors: [descriptor],
    };
    await addOneEService(eservice);

    expect(
      catalogService.updateDraftDescriptor(
        eservice.id,
        descriptor.id,
        buildUpdateDescriptorSeed(descriptor),
        getMockContext({})
      )
    ).rejects.toThrowError(operationForbidden);
  });

  it("should throw operationForbidden if the requester if the given e-service has been delegated and caller is not the delegate", async () => {
    const descriptor: Descriptor = {
      ...mockDescriptor,
      state: descriptorState.draft,
    };
    const eservice: EService = {
      ...mockEService,
      descriptors: [descriptor],
    };

    const delegation = getMockDelegation({
      kind: delegationKind.delegatedProducer,
      eserviceId: eservice.id,
      state: delegationState.active,
    });

    await addOneEService(eservice);
    await addOneDelegation(delegation);

    expect(
      catalogService.updateDraftDescriptor(
        eservice.id,
        descriptor.id,
        buildUpdateDescriptorSeed(descriptor),
        getMockContext({ authData: getMockAuthData(eservice.producerId) })
      )
    ).rejects.toThrowError(operationForbidden);
  });

  it("should throw inconsistentDailyCalls if dailyCallsPerConsumer is greater than dailyCallsTotal", async () => {
    const descriptor: Descriptor = {
      ...mockDescriptor,
      state: descriptorState.draft,
    };
    const eservice: EService = {
      ...mockEService,
      descriptors: [descriptor],
    };
    await addOneEService(eservice);

    expect(
      catalogService.updateDraftDescriptor(
        eservice.id,
        descriptor.id,
        buildUpdateDescriptorSeed({
          ...descriptor,
          dailyCallsPerConsumer: 100,
          dailyCallsTotal: 50,
        }),
        getMockContext({ authData: getMockAuthData(eservice.producerId) })
      )
    ).rejects.toThrowError(inconsistentDailyCalls());
  });

  it("should throw attributeNotFound if at least one of the attributes doesn't exist", async () => {
    const descriptor: Descriptor = {
      ...mockDescriptor,
      state: descriptorState.draft,
      attributes: {
        certified: [],
        declared: [],
        verified: [],
      },
    };
    const eservice: EService = {
      ...mockEService,
      descriptors: [descriptor],
    };
    await addOneEService(eservice);

    const notExistingId1 = generateId();
    const notExistingId2 = generateId();

    const descriptorSeed = {
      ...buildUpdateDescriptorSeed(mockDescriptor),
      attributes: {
        certified: [],
        declared: [
          [
            { id: declaredAttribute.id, explicitAttributeVerification: false },
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
      catalogService.updateDraftDescriptor(
        eservice.id,
        descriptor.id,
        descriptorSeed,
        getMockContext({ authData: getMockAuthData(eservice.producerId) })
      )
    ).rejects.toThrowError(attributeNotFound(notExistingId1));
  });

  it("should throw templateInstanceNotAllowed if the eservice is a template instance", async () => {
    const template = getMockEServiceTemplate();

    const descriptor: Descriptor = {
      ...mockDescriptor,
      state: descriptorState.draft,
      attributes: {
        certified: [],
        declared: [],
        verified: [],
      },
    };
    const eservice: EService = {
      ...mockEService,
      descriptors: [descriptor],
      name: template.name,
      templateId: template.id,
    };
    await addOneEServiceTemplate(template);
    await addOneEService(eservice);

    expect(
      catalogService.updateDraftDescriptor(
        eservice.id,
        descriptor.id,
        buildUpdateDescriptorSeed(descriptor),
        getMockContext({ authData: getMockAuthData(eservice.producerId) })
      )
    ).rejects.toThrowError(
      templateInstanceNotAllowed(eservice.id, template.id)
    );
  });
});
