/* eslint-disable @typescript-eslint/no-floating-promises */
import {
  decodeProtobufPayload,
  getMockContext,
  getMockDelegation,
  getMockAuthData,
  getMockEServiceTemplate,
  getMockEService,
  getMockDescriptor,
  getMockDocument,
  getMockAttribute,
} from "pagopa-interop-commons-test";
import {
  Descriptor,
  descriptorState,
  EService,
  EServiceDescriptorQuotasUpdatedV2,
  toEServiceV2,
  operationForbidden,
  delegationState,
  delegationKind,
  attributeKind,
} from "pagopa-interop-models";
import { catalogApi } from "pagopa-interop-api-clients";
import { expect, describe, it } from "vitest";
import {
  eServiceNotFound,
  eServiceDescriptorNotFound,
  notValidDescriptorState,
  inconsistentDailyCalls,
  eServiceNotAnInstance,
  templateInstanceNotAllowed,
  attributeDailyCallsNotAllowed,
} from "../../src/model/domain/errors.js";
import {
  addOneEService,
  addOneEServiceTemplate,
  addOneAttribute,
  catalogService,
  readLastEserviceEvent,
  addOneDelegation,
} from "../integrationUtils.js";

describe("update descriptor", () => {
  const mockEService = getMockEService();
  const mockTemplate = getMockEServiceTemplate();
  const mockDescriptor = getMockDescriptor();
  const mockDocument = getMockDocument();
  it.each([
    descriptorState.published,
    descriptorState.suspended,
    descriptorState.deprecated,
  ])(
    "should write on event-store for the update of an instance descriptor with state %s",
    async (descriptorState) => {
      const descriptor: Descriptor = {
        ...mockDescriptor,
        state: descriptorState,
        interface: mockDocument,
        publishedAt: new Date(),
      };
      const eservice: EService = {
        ...mockEService,
        templateId: mockTemplate.id,
        descriptors: [descriptor],
      };
      await addOneEService(eservice);
      await addOneEServiceTemplate(mockTemplate);

      const descriptorQuotasSeed: catalogApi.UpdateEServiceTemplateInstanceDescriptorQuotasSeed =
        {
          dailyCallsPerConsumer: descriptor.dailyCallsPerConsumer + 10,
          dailyCallsTotal: descriptor.dailyCallsTotal + 10,
        };

      const updatedEService: EService = {
        ...eservice,
        descriptors: [
          {
            ...descriptor,
            dailyCallsPerConsumer: descriptor.dailyCallsPerConsumer + 10,
            dailyCallsTotal: descriptor.dailyCallsTotal + 10,
          },
        ],
      };
      const returnedEService =
        await catalogService.updateTemplateInstanceDescriptor(
          eservice.id,
          descriptor.id,
          descriptorQuotasSeed,
          getMockContext({ authData: getMockAuthData(eservice.producerId) })
        );
      const writtenEvent = await readLastEserviceEvent(eservice.id);
      expect(writtenEvent).toMatchObject({
        stream_id: eservice.id,
        version: "1",
        type: "EServiceDescriptorQuotasUpdated",
        event_version: 2,
      });
      const writtenPayload = decodeProtobufPayload({
        messageType: EServiceDescriptorQuotasUpdatedV2,
        payload: writtenEvent.data,
      });
      expect(writtenPayload.eservice).toEqual(toEServiceV2(updatedEService));
      expect(writtenPayload.eservice).toEqual(toEServiceV2(returnedEService));
    }
  );

  it.each([
    descriptorState.published,
    descriptorState.suspended,
    descriptorState.deprecated,
  ])(
    "should write on event-store for the update of an instance descriptor with state %s (delegate)",
    async (descriptorState) => {
      const descriptor: Descriptor = {
        ...mockDescriptor,
        state: descriptorState,
        interface: mockDocument,
        publishedAt: new Date(),
      };
      const eservice: EService = {
        ...mockEService,
        templateId: mockTemplate.id,
        descriptors: [descriptor],
      };
      const delegation = getMockDelegation({
        kind: delegationKind.delegatedProducer,
        eserviceId: eservice.id,
        state: delegationState.active,
      });

      await addOneEService(eservice);
      await addOneDelegation(delegation);

      const descriptorQuotasSeed: catalogApi.UpdateEServiceTemplateInstanceDescriptorQuotasSeed =
        {
          dailyCallsPerConsumer: descriptor.dailyCallsPerConsumer + 10,
          dailyCallsTotal: descriptor.dailyCallsTotal + 10,
        };

      const updatedEService: EService = {
        ...eservice,
        descriptors: [
          {
            ...descriptor,
            dailyCallsPerConsumer: descriptor.dailyCallsPerConsumer + 10,
            dailyCallsTotal: descriptor.dailyCallsTotal + 10,
          },
        ],
      };
      const returnedEService =
        await catalogService.updateTemplateInstanceDescriptor(
          eservice.id,
          descriptor.id,
          descriptorQuotasSeed,
          getMockContext({ authData: getMockAuthData(delegation.delegateId) })
        );
      const writtenEvent = await readLastEserviceEvent(eservice.id);
      expect(writtenEvent).toMatchObject({
        stream_id: eservice.id,
        version: "1",
        type: "EServiceDescriptorQuotasUpdated",
        event_version: 2,
      });
      const writtenPayload = decodeProtobufPayload({
        messageType: EServiceDescriptorQuotasUpdatedV2,
        payload: writtenEvent.data,
      });
      expect(writtenPayload.eservice).toEqual(toEServiceV2(updatedEService));
      expect(writtenPayload.eservice).toEqual(toEServiceV2(returnedEService));
    }
  );

  it("should throw eServiceNotFound if the eservice doesn't exist", () => {
    const descriptorQuotasSeed: catalogApi.UpdateEServiceTemplateInstanceDescriptorQuotasSeed =
      {
        dailyCallsPerConsumer: mockDescriptor.dailyCallsPerConsumer + 10,
        dailyCallsTotal: mockDescriptor.dailyCallsTotal + 10,
      };
    expect(
      catalogService.updateTemplateInstanceDescriptor(
        mockEService.id,
        mockDescriptor.id,
        descriptorQuotasSeed,
        getMockContext({ authData: getMockAuthData(mockEService.producerId) })
      )
    ).rejects.toThrowError(eServiceNotFound(mockEService.id));
  });

  it("should throw eServiceDescriptorNotFound if the instance descriptor doesn't exist", async () => {
    const eservice: EService = {
      ...mockEService,
      templateId: mockTemplate.id,
      descriptors: [],
    };
    await addOneEService(eservice);

    const descriptorQuotasSeed: catalogApi.UpdateEServiceTemplateInstanceDescriptorQuotasSeed =
      {
        dailyCallsPerConsumer: mockDescriptor.dailyCallsPerConsumer + 10,
        dailyCallsTotal: mockDescriptor.dailyCallsTotal + 10,
      };

    expect(
      catalogService.updateTemplateInstanceDescriptor(
        mockEService.id,
        mockDescriptor.id,
        descriptorQuotasSeed,
        getMockContext({ authData: getMockAuthData(mockEService.producerId) })
      )
    ).rejects.toThrowError(
      eServiceDescriptorNotFound(eservice.id, mockDescriptor.id)
    );
  });

  it.each([
    descriptorState.draft,
    descriptorState.waitingForApproval,
    descriptorState.archived,
  ])(
    "should throw notValidDescriptorState if the instance descriptor is in %s state",
    async (state) => {
      const descriptor: Descriptor = {
        ...mockDescriptor,
        interface: mockDocument,
        state,
      };
      const eservice: EService = {
        ...mockEService,
        templateId: mockTemplate.id,
        descriptors: [descriptor],
      };
      await addOneEService(eservice);
      const updatedDescriptorQuotasSeed: catalogApi.UpdateEServiceTemplateInstanceDescriptorQuotasSeed =
        {
          dailyCallsPerConsumer: descriptor.dailyCallsPerConsumer + 10,
          dailyCallsTotal: descriptor.dailyCallsTotal + 10,
        };

      expect(
        catalogService.updateTemplateInstanceDescriptor(
          eservice.id,
          descriptor.id,
          updatedDescriptorQuotasSeed,
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
      templateId: mockTemplate.id,
      descriptors: [descriptor],
    };
    await addOneEService(eservice);

    const descriptorQuotasSeed: catalogApi.UpdateEServiceTemplateInstanceDescriptorQuotasSeed =
      {
        dailyCallsPerConsumer: descriptor.dailyCallsPerConsumer + 10,
        dailyCallsTotal: descriptor.dailyCallsTotal + 10,
      };
    expect(
      catalogService.updateTemplateInstanceDescriptor(
        eservice.id,
        descriptor.id,
        descriptorQuotasSeed,
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
      templateId: mockTemplate.id,
      descriptors: [descriptor],
    };
    const delegation = getMockDelegation({
      kind: delegationKind.delegatedProducer,
      eserviceId: eservice.id,
      state: delegationState.active,
    });

    await addOneEService(eservice);
    await addOneDelegation(delegation);

    const descriptorQuotasSeed: catalogApi.UpdateEServiceTemplateInstanceDescriptorQuotasSeed =
      {
        dailyCallsPerConsumer: descriptor.dailyCallsPerConsumer + 10,
        dailyCallsTotal: descriptor.dailyCallsTotal + 10,
      };
    expect(
      catalogService.updateTemplateInstanceDescriptor(
        eservice.id,
        descriptor.id,
        descriptorQuotasSeed,
        getMockContext({ authData: getMockAuthData(eservice.producerId) })
      )
    ).rejects.toThrowError(operationForbidden);
  });

  it("should throw inconsistentDailyCalls if dailyCallsPerConsumer is greater than dailyCallsTotal", async () => {
    const descriptor: Descriptor = {
      ...mockDescriptor,
      state: descriptorState.published,
      interface: mockDocument,
      publishedAt: new Date(),
    };
    const eservice: EService = {
      ...mockEService,
      templateId: mockTemplate.id,
      descriptors: [descriptor],
    };
    await addOneEService(eservice);

    const descriptorQuotasSeed: catalogApi.UpdateEServiceTemplateInstanceDescriptorQuotasSeed =
      {
        dailyCallsPerConsumer: descriptor.dailyCallsTotal + 11,
        dailyCallsTotal: descriptor.dailyCallsTotal + 10,
      };
    expect(
      catalogService.updateTemplateInstanceDescriptor(
        eservice.id,
        descriptor.id,
        descriptorQuotasSeed,
        getMockContext({ authData: getMockAuthData(eservice.producerId) })
      )
    ).rejects.toThrowError(inconsistentDailyCalls());
  });
  it("should throw eServiceNotAnInstance if the templateId is not defined", async () => {
    const descriptor: Descriptor = {
      ...mockDescriptor,
      state: descriptorState.published,
      interface: mockDocument,
      publishedAt: new Date(),
    };
    const eservice: EService = {
      ...mockEService,
      descriptors: [descriptor],
    };
    await addOneEService(eservice);

    const descriptorQuotasSeed: catalogApi.UpdateEServiceTemplateInstanceDescriptorQuotasSeed =
      {
        dailyCallsPerConsumer: descriptor.dailyCallsTotal + 11,
        dailyCallsTotal: descriptor.dailyCallsTotal + 10,
      };
    expect(
      catalogService.updateTemplateInstanceDescriptor(
        eservice.id,
        descriptor.id,
        descriptorQuotasSeed,
        getMockContext({ authData: getMockAuthData(eservice.producerId) })
      )
    ).rejects.toThrowError(eServiceNotAnInstance(eservice.id));
  });

  it("should update dailyCallsPerConsumer on certified attributes of a published template instance descriptor", async () => {
    const mockCertifiedAttribute1 = getMockAttribute(attributeKind.certified);
    const mockCertifiedAttribute2 = getMockAttribute(attributeKind.certified);

    await addOneAttribute(mockCertifiedAttribute1);
    await addOneAttribute(mockCertifiedAttribute2);

    const descriptor: Descriptor = {
      ...mockDescriptor,
      state: descriptorState.published,
      interface: mockDocument,
      publishedAt: new Date(),
      dailyCallsPerConsumer: 1,
      dailyCallsTotal: 1000,
      attributes: {
        certified: [
          [
            {
              id: mockCertifiedAttribute1.id,
              explicitAttributeVerification: false,
            },
            {
              id: mockCertifiedAttribute2.id,
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
      templateId: mockTemplate.id,
      descriptors: [descriptor],
    };
    await addOneEService(eservice);
    await addOneEServiceTemplate(mockTemplate);

    const attributesSeed: catalogApi.AttributesSeed = {
      certified: [
        [
          {
            id: mockCertifiedAttribute1.id,
            explicitAttributeVerification: false,
            dailyCallsPerConsumer: 500,
          },
          {
            id: mockCertifiedAttribute2.id,
            explicitAttributeVerification: false,
            dailyCallsPerConsumer: 300,
          },
        ],
      ],
      declared: [],
      verified: [],
    };

    const descriptorQuotasSeed: catalogApi.UpdateEServiceTemplateInstanceDescriptorQuotasSeed =
      {
        dailyCallsPerConsumer: 1,
        dailyCallsTotal: 1000,
        attributes: attributesSeed,
      };

    const returnedEService =
      await catalogService.updateTemplateInstanceDescriptor(
        eservice.id,
        descriptor.id,
        descriptorQuotasSeed,
        getMockContext({ authData: getMockAuthData(eservice.producerId) })
      );

    const writtenEvent = await readLastEserviceEvent(eservice.id);
    expect(writtenEvent).toMatchObject({
      stream_id: eservice.id,
      version: "1",
      type: "EServiceDescriptorQuotasUpdated",
      event_version: 2,
    });
    const writtenPayload = decodeProtobufPayload({
      messageType: EServiceDescriptorQuotasUpdatedV2,
      payload: writtenEvent.data,
    });

    const updatedDescriptor = writtenPayload.eservice?.descriptors[0];
    const certifiedGroup = updatedDescriptor?.attributes?.certified[0]?.values;

    const attr1 = certifiedGroup?.find(
      (attr) => attr.id === mockCertifiedAttribute1.id
    );
    expect(attr1?.dailyCallsPerConsumer).toBe(500);

    const attr2 = certifiedGroup?.find(
      (attr) => attr.id === mockCertifiedAttribute2.id
    );
    expect(attr2?.dailyCallsPerConsumer).toBe(300);

    expect(returnedEService.descriptors[0].attributes.certified[0]).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: mockCertifiedAttribute1.id,
          dailyCallsPerConsumer: 500,
        }),
        expect.objectContaining({
          id: mockCertifiedAttribute2.id,
          dailyCallsPerConsumer: 300,
        }),
      ])
    );
  });

  it("should throw templateInstanceNotAllowed when seed.attributes changes attribute structure", async () => {
    const mockCertifiedAttribute1 = getMockAttribute(attributeKind.certified);
    const mockCertifiedAttribute2 = getMockAttribute(attributeKind.certified);

    await addOneAttribute(mockCertifiedAttribute1);
    await addOneAttribute(mockCertifiedAttribute2);

    const descriptor: Descriptor = {
      ...mockDescriptor,
      state: descriptorState.published,
      interface: mockDocument,
      publishedAt: new Date(),
      dailyCallsPerConsumer: 1,
      dailyCallsTotal: 1000,
      attributes: {
        certified: [
          [
            {
              id: mockCertifiedAttribute1.id,
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
      templateId: mockTemplate.id,
      descriptors: [descriptor],
    };
    await addOneEService(eservice);
    await addOneEServiceTemplate(mockTemplate);

    const seedWithExtraAttribute: catalogApi.AttributesSeed = {
      certified: [
        [
          {
            id: mockCertifiedAttribute1.id,
            explicitAttributeVerification: false,
          },
          {
            id: mockCertifiedAttribute2.id,
            explicitAttributeVerification: false,
          },
        ],
      ],
      declared: [],
      verified: [],
    };

    const descriptorQuotasSeed: catalogApi.UpdateEServiceTemplateInstanceDescriptorQuotasSeed =
      {
        dailyCallsPerConsumer: 1,
        dailyCallsTotal: 1000,
        attributes: seedWithExtraAttribute,
      };

    expect(
      catalogService.updateTemplateInstanceDescriptor(
        eservice.id,
        descriptor.id,
        descriptorQuotasSeed,
        getMockContext({ authData: getMockAuthData(eservice.producerId) })
      )
    ).rejects.toThrowError(
      templateInstanceNotAllowed(eservice.id, mockTemplate.id)
    );
  });

  it("should throw inconsistentDailyCalls when attribute dailyCallsPerConsumer exceeds dailyCallsTotal", async () => {
    const mockCertifiedAttribute1 = getMockAttribute(attributeKind.certified);

    await addOneAttribute(mockCertifiedAttribute1);

    const descriptor: Descriptor = {
      ...mockDescriptor,
      state: descriptorState.published,
      interface: mockDocument,
      publishedAt: new Date(),
      dailyCallsPerConsumer: 1,
      dailyCallsTotal: 1000,
      attributes: {
        certified: [
          [
            {
              id: mockCertifiedAttribute1.id,
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
      templateId: mockTemplate.id,
      descriptors: [descriptor],
    };
    await addOneEService(eservice);
    await addOneEServiceTemplate(mockTemplate);

    const seedWithExcessiveDailyCalls: catalogApi.AttributesSeed = {
      certified: [
        [
          {
            id: mockCertifiedAttribute1.id,
            explicitAttributeVerification: false,
            dailyCallsPerConsumer: 2000,
          },
        ],
      ],
      declared: [],
      verified: [],
    };

    const descriptorQuotasSeed: catalogApi.UpdateEServiceTemplateInstanceDescriptorQuotasSeed =
      {
        dailyCallsPerConsumer: 1,
        dailyCallsTotal: 1000,
        attributes: seedWithExcessiveDailyCalls,
      };

    expect(
      catalogService.updateTemplateInstanceDescriptor(
        eservice.id,
        descriptor.id,
        descriptorQuotasSeed,
        getMockContext({ authData: getMockAuthData(eservice.producerId) })
      )
    ).rejects.toThrowError(inconsistentDailyCalls());
  });

  it("should throw attributeDailyCallsNotAllowed when dailyCallsPerConsumer is set on a declared attribute", async () => {
    const mockDeclaredAttribute = getMockAttribute(attributeKind.declared);

    await addOneAttribute(mockDeclaredAttribute);

    const descriptor: Descriptor = {
      ...mockDescriptor,
      state: descriptorState.published,
      interface: mockDocument,
      publishedAt: new Date(),
      dailyCallsPerConsumer: 1,
      dailyCallsTotal: 1000,
      attributes: {
        certified: [],
        declared: [
          [
            {
              id: mockDeclaredAttribute.id,
              explicitAttributeVerification: false,
            },
          ],
        ],
        verified: [],
      },
    };
    const eservice: EService = {
      ...mockEService,
      templateId: mockTemplate.id,
      descriptors: [descriptor],
    };
    await addOneEService(eservice);
    await addOneEServiceTemplate(mockTemplate);

    const seedWithDailyCallsOnDeclared: catalogApi.AttributesSeed = {
      certified: [],
      declared: [
        [
          {
            id: mockDeclaredAttribute.id,
            explicitAttributeVerification: false,
            dailyCallsPerConsumer: 100,
          },
        ],
      ],
      verified: [],
    };

    const descriptorQuotasSeed: catalogApi.UpdateEServiceTemplateInstanceDescriptorQuotasSeed =
      {
        dailyCallsPerConsumer: 1,
        dailyCallsTotal: 1000,
        attributes: seedWithDailyCallsOnDeclared,
      };

    expect(
      catalogService.updateTemplateInstanceDescriptor(
        eservice.id,
        descriptor.id,
        descriptorQuotasSeed,
        getMockContext({ authData: getMockAuthData(eservice.producerId) })
      )
    ).rejects.toThrowError(
      attributeDailyCallsNotAllowed(mockDeclaredAttribute.id)
    );
  });

  it("should throw inconsistentDailyCalls when lowering dailyCallsTotal below existing attribute dailyCallsPerConsumer without providing attributes", async () => {
    const certifiedAttribute = getMockAttribute(attributeKind.certified);
    await addOneAttribute(certifiedAttribute);

    const descriptor: Descriptor = {
      ...mockDescriptor,
      state: descriptorState.published,
      interface: mockDocument,
      publishedAt: new Date(),
      dailyCallsPerConsumer: 500,
      dailyCallsTotal: 1000,
      attributes: {
        certified: [
          [
            {
              id: certifiedAttribute.id,
              explicitAttributeVerification: false,
              dailyCallsPerConsumer: 500,
            },
          ],
        ],
        verified: [],
        declared: [],
      },
    };
    const eservice: EService = {
      ...mockEService,
      templateId: mockTemplate.id,
      descriptors: [descriptor],
    };
    await addOneEService(eservice);
    await addOneEServiceTemplate(mockTemplate);

    const seed: catalogApi.UpdateEServiceTemplateInstanceDescriptorQuotasSeed =
      {
        dailyCallsPerConsumer: 200,
        dailyCallsTotal: 300,
        // No attributes field — existing attributes must still be validated
      };

    await expect(
      catalogService.updateTemplateInstanceDescriptor(
        eservice.id,
        descriptor.id,
        seed,
        getMockContext({ authData: getMockAuthData(eservice.producerId) })
      )
    ).rejects.toThrowError(inconsistentDailyCalls());
  });
});
