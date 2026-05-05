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
  AttributeId,
  unsafeBrandId,
} from "pagopa-interop-models";
import { expect, describe, it } from "vitest";
import {
  eServiceNotFound,
  eServiceDescriptorNotFound,
  notValidDescriptorState,
  inconsistentDailyCalls,
  eServiceNotAnInstance,
  attributeDailyCallsNotAllowed,
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

describe("update draft descriptor instance", () => {
  const mockDescriptor = getMockDescriptor();
  const mockEService = getMockEService();
  const mockDocument = getMockDocument();
  it("should write on event-store for the update of a draft descriptor instance", async () => {
    const template = getMockEServiceTemplate();

    const descriptor: Descriptor = {
      ...mockDescriptor,
      state: descriptorState.draft,
    };
    const eservice: EService = {
      ...mockEService,
      descriptors: [descriptor],
      name: `${template.name} test`,
      templateId: template.id,
    };
    await addOneEServiceTemplate(template);
    await addOneEService(eservice);
    const attribute: Attribute = {
      name: "Attribute name",
      id: generateId(),
      kind: "Declared",
      description: "Attribute Description",
      creationTime: new Date(),
    };
    await addOneAttribute(attribute);

    const expectedDescriptorSeed: catalogApi.UpdateEServiceDescriptorTemplateInstanceSeed =
      {
        ...buildUpdateDescriptorSeed(descriptor),
        dailyCallsTotal: 200,
      };

    const updatedEService: EService = {
      ...eservice,
      descriptors: [
        {
          ...descriptor,
          dailyCallsTotal: 200,
        },
      ],
    };
    await catalogService.updateDraftDescriptorTemplateInstance(
      eservice.id,
      descriptor.id,
      expectedDescriptorSeed,
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
    expect(writtenPayload.eservice).toEqual(toEServiceV2(updatedEService));
  });
  it("should write on event-store for the update of a draft descriptor instance (delegate)", async () => {
    const template = getMockEServiceTemplate();

    const descriptor: Descriptor = {
      ...mockDescriptor,
      state: descriptorState.draft,
    };
    const eservice: EService = {
      ...mockEService,
      descriptors: [descriptor],
      name: `${template.name} test`,
      templateId: template.id,
    };
    await addOneEServiceTemplate(template);
    await addOneEService(eservice);

    const delegation = getMockDelegation({
      kind: delegationKind.delegatedProducer,
      eserviceId: eservice.id,
      state: delegationState.active,
    });

    await addOneDelegation(delegation);

    const attribute: Attribute = {
      name: "Attribute name",
      id: generateId(),
      kind: "Declared",
      description: "Attribute Description",
      creationTime: new Date(),
    };
    await addOneAttribute(attribute);

    const expectedDescriptorSeed: catalogApi.UpdateEServiceDescriptorTemplateInstanceSeed =
      {
        ...buildUpdateDescriptorSeed(descriptor),
        dailyCallsTotal: 200,
      };

    const updatedEService: EService = {
      ...eservice,
      descriptors: [
        {
          ...descriptor,
          dailyCallsTotal: 200,
        },
      ],
    };
    await catalogService.updateDraftDescriptorTemplateInstance(
      eservice.id,
      descriptor.id,
      expectedDescriptorSeed,
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
    expect(writtenPayload.eservice).toEqual(toEServiceV2(updatedEService));
  });

  it("should throw eServiceNotFound if the eservice doesn't exist", () => {
    const descriptor: Descriptor = {
      ...mockDescriptor,
      interface: mockDocument,
      state: descriptorState.published,
    };
    expect(
      catalogService.updateDraftDescriptorTemplateInstance(
        mockEService.id,
        descriptor.id,
        buildUpdateDescriptorSeed(descriptor),
        getMockContext({ authData: getMockAuthData(mockEService.producerId) })
      )
    ).rejects.toThrowError(eServiceNotFound(mockEService.id));
  });

  it("should throw eServiceDescriptorNotFound if the descriptor doesn't exist", async () => {
    const template = getMockEServiceTemplate();

    const eservice: EService = {
      ...mockEService,
      descriptors: [],
      name: `${template.name} test`,
      templateId: template.id,
    };

    await addOneEServiceTemplate(template);
    await addOneEService(eservice);

    expect(
      catalogService.updateDraftDescriptorTemplateInstance(
        mockEService.id,
        mockDescriptor.id,
        buildUpdateDescriptorSeed(mockDescriptor),
        getMockContext({ authData: getMockAuthData(mockEService.producerId) })
      )
    ).rejects.toThrowError(
      eServiceDescriptorNotFound(eservice.id, mockDescriptor.id)
    );
  });

  it.each([
    descriptorState.published,
    descriptorState.deprecated,
    descriptorState.suspended,
    descriptorState.archived,
  ] as const)(
    "should throw notValidDescriptorState if the descriptor is in %s state",
    async (descriptorState) => {
      const template = getMockEServiceTemplate();

      const descriptor: Descriptor = {
        ...mockDescriptor,
        interface: mockDocument,
        state: descriptorState,
      };
      const eservice: EService = {
        ...mockEService,
        descriptors: [descriptor],
        name: `${template.name} test`,
        templateId: template.id,
      };
      await addOneEServiceTemplate(template);
      await addOneEService(eservice);

      expect(
        catalogService.updateDraftDescriptorTemplateInstance(
          eservice.id,
          descriptor.id,
          buildUpdateDescriptorSeed(descriptor),
          getMockContext({ authData: getMockAuthData(eservice.producerId) })
        )
      ).rejects.toThrowError(
        notValidDescriptorState(mockDescriptor.id, descriptorState)
      );
    }
  );

  it("should throw operationForbidden if the requester is not the producer", async () => {
    const template = getMockEServiceTemplate();

    const descriptor: Descriptor = {
      ...mockDescriptor,
      interface: mockDocument,
      state: descriptorState.draft,
    };
    const eservice: EService = {
      ...mockEService,
      descriptors: [descriptor],
      name: `${template.name} test`,
      templateId: template.id,
    };
    await addOneEServiceTemplate(template);
    await addOneEService(eservice);

    const expectedDescriptor = {
      ...descriptor,
      dailyCallsTotal: 200,
    };
    expect(
      catalogService.updateDraftDescriptorTemplateInstance(
        eservice.id,
        descriptor.id,
        buildUpdateDescriptorSeed(expectedDescriptor),
        getMockContext({})
      )
    ).rejects.toThrowError(operationForbidden);
  });

  it("should throw operationForbidden if the requester if the given e-service has been delegated and caller is not the delegate", async () => {
    const template = getMockEServiceTemplate();

    const descriptor: Descriptor = {
      ...mockDescriptor,
      interface: mockDocument,
      state: descriptorState.draft,
    };
    const eservice: EService = {
      ...mockEService,
      descriptors: [descriptor],
      name: `${template.name} test`,
      templateId: template.id,
    };
    await addOneEServiceTemplate(template);
    await addOneEService(eservice);

    const delegation = getMockDelegation({
      kind: delegationKind.delegatedProducer,
      eserviceId: eservice.id,
      state: delegationState.active,
    });

    await addOneDelegation(delegation);

    const expectedDescriptor = {
      ...descriptor,
      dailyCallsTotal: 200,
    };
    expect(
      catalogService.updateDraftDescriptorTemplateInstance(
        eservice.id,
        descriptor.id,
        buildUpdateDescriptorSeed(expectedDescriptor),
        getMockContext({ authData: getMockAuthData(eservice.producerId) })
      )
    ).rejects.toThrowError(operationForbidden);
  });

  it("should throw inconsistentDailyCalls if dailyCallsPerConsumer is greater than dailyCallsTotal", async () => {
    const template = getMockEServiceTemplate();

    const descriptor: Descriptor = {
      ...mockDescriptor,
      interface: mockDocument,
      state: descriptorState.draft,
    };
    const eservice: EService = {
      ...mockEService,
      descriptors: [descriptor],
      name: `${template.name} test`,
      templateId: template.id,
    };
    await addOneEServiceTemplate(template);
    await addOneEService(eservice);

    const expectedDescriptor: Descriptor = {
      ...descriptor,
      dailyCallsPerConsumer: 100,
      dailyCallsTotal: 50,
    };
    expect(
      catalogService.updateDraftDescriptorTemplateInstance(
        eservice.id,
        descriptor.id,
        buildUpdateDescriptorSeed(expectedDescriptor),
        getMockContext({ authData: getMockAuthData(eservice.producerId) })
      )
    ).rejects.toThrowError(inconsistentDailyCalls());
  });

  it("should throw eServiceNotAnInstance if the eservice is not a template instance", async () => {
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

    const descriptorSeed = {
      ...buildUpdateDescriptorSeed(mockDescriptor),
    };

    expect(
      catalogService.updateDraftDescriptorTemplateInstance(
        eservice.id,
        descriptor.id,
        descriptorSeed,
        getMockContext({ authData: getMockAuthData(eservice.producerId) })
      )
    ).rejects.toThrowError(eServiceNotAnInstance(eservice.id));
  });

  it("should update draft descriptor with attribute-level dailyCallsPerConsumer on certified attributes", async () => {
    const template = getMockEServiceTemplate();

    const certifiedAttributeId = unsafeBrandId<AttributeId>(generateId());
    const certifiedAttribute: Attribute = {
      name: "Certified attribute",
      id: certifiedAttributeId,
      kind: "Certified",
      description: "A certified attribute",
      creationTime: new Date(),
    };

    const descriptor: Descriptor = {
      ...mockDescriptor,
      state: descriptorState.draft,
      dailyCallsPerConsumer: 1,
      dailyCallsTotal: 1000,
      attributes: {
        certified: [
          [
            {
              id: certifiedAttributeId,
              explicitAttributeVerification: false,
            },
          ],
        ],
        declared: [],
        verified: [],
      },
    };

    const eservice: EService = {
      ...mockEService,
      descriptors: [descriptor],
      name: `${template.name} test`,
      templateId: template.id,
    };

    await addOneEServiceTemplate(template);
    await addOneAttribute(certifiedAttribute);
    await addOneEService(eservice);

    const attributesWithDailyCalls: catalogApi.AttributesSeed = {
      certified: [
        [
          {
            id: certifiedAttributeId,
            explicitAttributeVerification: false,
            dailyCallsPerConsumer: 500,
          },
        ],
      ],
      declared: [],
      verified: [],
    };

    const expectedDescriptorSeed: catalogApi.UpdateEServiceDescriptorTemplateInstanceSeed =
      {
        ...buildUpdateDescriptorSeed(descriptor),
        dailyCallsTotal: 1000,
        attributes: attributesWithDailyCalls,
      };

    const updatedEService: EService = {
      ...eservice,
      descriptors: [
        {
          ...descriptor,
          dailyCallsTotal: 1000,
          attributes: {
            certified: [
              [
                {
                  id: certifiedAttributeId,
                  explicitAttributeVerification: false,
                  dailyCallsPerConsumer: 500,
                },
              ],
            ],
            declared: [],
            verified: [],
          },
        },
      ],
    };

    await catalogService.updateDraftDescriptorTemplateInstance(
      eservice.id,
      descriptor.id,
      expectedDescriptorSeed,
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
    expect(writtenPayload.eservice).toEqual(toEServiceV2(updatedEService));
  });

  it("should preserve existing attributes when seed.attributes is not provided", async () => {
    const template = getMockEServiceTemplate();

    const certifiedAttributeId = unsafeBrandId<AttributeId>(generateId());
    const certifiedAttribute: Attribute = {
      name: "Certified attribute",
      id: certifiedAttributeId,
      kind: "Certified",
      description: "A certified attribute",
      creationTime: new Date(),
    };

    const descriptor: Descriptor = {
      ...mockDescriptor,
      state: descriptorState.draft,
      dailyCallsPerConsumer: 1,
      dailyCallsTotal: 1000,
      attributes: {
        certified: [
          [
            {
              id: certifiedAttributeId,
              explicitAttributeVerification: false,
              dailyCallsPerConsumer: 500,
            },
          ],
        ],
        declared: [],
        verified: [],
      },
    };

    const eservice: EService = {
      ...mockEService,
      descriptors: [descriptor],
      name: `${template.name} test`,
      templateId: template.id,
    };

    await addOneEServiceTemplate(template);
    await addOneAttribute(certifiedAttribute);
    await addOneEService(eservice);

    const seedWithoutAttributes: catalogApi.UpdateEServiceDescriptorTemplateInstanceSeed =
      {
        audience: descriptor.audience,
        dailyCallsPerConsumer: descriptor.dailyCallsPerConsumer,
        dailyCallsTotal: 2000,
        agreementApprovalPolicy: "AUTOMATIC",
      };

    const updatedEService: EService = {
      ...eservice,
      descriptors: [
        {
          ...descriptor,
          dailyCallsTotal: 2000,
          attributes: {
            certified: [
              [
                {
                  id: certifiedAttributeId,
                  explicitAttributeVerification: false,
                  dailyCallsPerConsumer: 500,
                },
              ],
            ],
            declared: [],
            verified: [],
          },
        },
      ],
    };

    await catalogService.updateDraftDescriptorTemplateInstance(
      eservice.id,
      descriptor.id,
      seedWithoutAttributes,
      getMockContext({ authData: getMockAuthData(eservice.producerId) })
    );

    const writtenEvent = await readLastEserviceEvent(eservice.id);
    const writtenPayload = decodeProtobufPayload({
      messageType: EServiceDraftDescriptorUpdatedV2,
      payload: writtenEvent.data,
    });
    expect(writtenPayload.eservice).toEqual(toEServiceV2(updatedEService));
  });

  it("should clear existing certified attribute dailyCallsPerConsumer when seed.attributes omits them", async () => {
    const template = getMockEServiceTemplate();

    const certifiedAttributeId = unsafeBrandId<AttributeId>(generateId());
    const certifiedAttribute: Attribute = {
      name: "Certified attribute",
      id: certifiedAttributeId,
      kind: "Certified",
      description: "A certified attribute",
      creationTime: new Date(),
    };

    const descriptor: Descriptor = {
      ...mockDescriptor,
      state: descriptorState.draft,
      dailyCallsPerConsumer: 1,
      dailyCallsTotal: 1000,
      attributes: {
        certified: [
          [
            {
              id: certifiedAttributeId,
              explicitAttributeVerification: false,
              dailyCallsPerConsumer: 500,
            },
          ],
        ],
        declared: [],
        verified: [],
      },
    };

    const eservice: EService = {
      ...mockEService,
      descriptors: [descriptor],
      name: `${template.name} test`,
      templateId: template.id,
    };

    await addOneEServiceTemplate(template);
    await addOneAttribute(certifiedAttribute);
    await addOneEService(eservice);

    const seedWithAttributesWithoutDailyCalls: catalogApi.UpdateEServiceDescriptorTemplateInstanceSeed =
      {
        ...buildUpdateDescriptorSeed(descriptor),
        attributes: {
          certified: [
            [
              {
                id: certifiedAttributeId,
                explicitAttributeVerification: false,
              },
            ],
          ],
          declared: [],
          verified: [],
        },
      };

    await catalogService.updateDraftDescriptorTemplateInstance(
      eservice.id,
      descriptor.id,
      seedWithAttributesWithoutDailyCalls,
      getMockContext({ authData: getMockAuthData(eservice.producerId) })
    );

    const writtenEvent = await readLastEserviceEvent(eservice.id);
    const writtenPayload = decodeProtobufPayload({
      messageType: EServiceDraftDescriptorUpdatedV2,
      payload: writtenEvent.data,
    });

    const expectedEService: EService = {
      ...eservice,
      descriptors: [
        {
          ...descriptor,
          attributes: {
            certified: [
              [
                {
                  id: certifiedAttributeId,
                  explicitAttributeVerification: false,
                },
              ],
            ],
            declared: [],
            verified: [],
          },
        },
      ],
    };

    expect(writtenPayload.eservice).toEqual(toEServiceV2(expectedEService));
  });

  it("should throw attributeDailyCallsNotAllowed when dailyCallsPerConsumer is set on declared attribute", async () => {
    const template = getMockEServiceTemplate();

    const declaredAttributeId = unsafeBrandId<AttributeId>(generateId());
    const declaredAttribute: Attribute = {
      name: "Declared attribute",
      id: declaredAttributeId,
      kind: "Declared",
      description: "A declared attribute",
      creationTime: new Date(),
    };

    const descriptor: Descriptor = {
      ...mockDescriptor,
      state: descriptorState.draft,
      dailyCallsPerConsumer: 1,
      dailyCallsTotal: 1000,
      attributes: {
        certified: [],
        declared: [
          [
            {
              id: declaredAttributeId,
              explicitAttributeVerification: false,
            },
          ],
        ],
        verified: [],
      },
    };

    const eservice: EService = {
      ...mockEService,
      descriptors: [descriptor],
      name: `${template.name} test`,
      templateId: template.id,
    };

    await addOneEServiceTemplate(template);
    await addOneAttribute(declaredAttribute);
    await addOneEService(eservice);

    const attributesWithDailyCallsOnDeclared: catalogApi.AttributesSeed = {
      certified: [],
      declared: [
        [
          {
            id: declaredAttributeId,
            explicitAttributeVerification: false,
            dailyCallsPerConsumer: 100,
          },
        ],
      ],
      verified: [],
    };

    await expect(
      catalogService.updateDraftDescriptorTemplateInstance(
        eservice.id,
        descriptor.id,
        {
          ...buildUpdateDescriptorSeed(descriptor),
          attributes: attributesWithDailyCallsOnDeclared,
        },
        getMockContext({ authData: getMockAuthData(eservice.producerId) })
      )
    ).rejects.toThrowError(attributeDailyCallsNotAllowed(declaredAttributeId));
  });

  it("should throw inconsistentDailyCalls when attribute dailyCallsPerConsumer exceeds dailyCallsTotal", async () => {
    const template = getMockEServiceTemplate();

    const certifiedAttributeId = unsafeBrandId<AttributeId>(generateId());
    const certifiedAttribute: Attribute = {
      name: "Certified attribute",
      id: certifiedAttributeId,
      kind: "Certified",
      description: "A certified attribute",
      creationTime: new Date(),
    };

    const descriptor: Descriptor = {
      ...mockDescriptor,
      state: descriptorState.draft,
      dailyCallsPerConsumer: 1,
      dailyCallsTotal: 100,
      attributes: {
        certified: [
          [
            {
              id: certifiedAttributeId,
              explicitAttributeVerification: false,
            },
          ],
        ],
        declared: [],
        verified: [],
      },
    };

    const eservice: EService = {
      ...mockEService,
      descriptors: [descriptor],
      name: `${template.name} test`,
      templateId: template.id,
    };

    await addOneEServiceTemplate(template);
    await addOneAttribute(certifiedAttribute);
    await addOneEService(eservice);

    const attributesWithExceedingDailyCalls: catalogApi.AttributesSeed = {
      certified: [
        [
          {
            id: certifiedAttributeId,
            explicitAttributeVerification: false,
            dailyCallsPerConsumer: 500,
          },
        ],
      ],
      declared: [],
      verified: [],
    };

    await expect(
      catalogService.updateDraftDescriptorTemplateInstance(
        eservice.id,
        descriptor.id,
        {
          ...buildUpdateDescriptorSeed(descriptor),
          dailyCallsTotal: 100,
          attributes: attributesWithExceedingDailyCalls,
        },
        getMockContext({ authData: getMockAuthData(eservice.producerId) })
      )
    ).rejects.toThrowError(inconsistentDailyCalls());
  });
});
