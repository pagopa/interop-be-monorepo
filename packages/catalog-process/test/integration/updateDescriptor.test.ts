/* eslint-disable @typescript-eslint/no-floating-promises */
import {
  decodeProtobufPayload,
  getMockAttribute,
  getMockContext,
  getMockDelegation,
  getMockAuthData,
  getMockDescriptor,
  getMockDocument,
  getMockEService,
} from "pagopa-interop-commons-test";
import {
  attributeKind,
  Descriptor,
  descriptorState,
  EService,
  EServiceDescriptorQuotasUpdatedV2,
  toEServiceV2,
  operationForbidden,
  delegationState,
  generateId,
  delegationKind,
  EServiceTemplateId,
  unsafeBrandId,
} from "pagopa-interop-models";
import { catalogApi } from "pagopa-interop-api-clients";
import { expect, describe, it } from "vitest";
import {
  attributeDailyCallsNotAllowed,
  eServiceNotFound,
  eServiceDescriptorNotFound,
  notValidDescriptorState,
  inconsistentDailyCalls,
  templateInstanceNotAllowed,
} from "../../src/model/domain/errors.js";
import {
  addOneAttribute,
  addOneDelegation,
  addOneEService,
  catalogService,
  readLastEserviceEvent,
} from "../integrationUtils.js";

describe("update descriptor", () => {
  const mockEService = getMockEService();
  const mockDescriptor = getMockDescriptor();
  const mockDocument = getMockDocument();
  it.each([
    descriptorState.published,
    descriptorState.suspended,
    descriptorState.deprecated,
  ])(
    "should write on event-store for the update of a descriptor with state %s",
    async (descriptorState) => {
      const descriptor: Descriptor = {
        ...mockDescriptor,
        state: descriptorState,
        interface: mockDocument,
        publishedAt: new Date(),
      };
      const eservice: EService = {
        ...mockEService,
        descriptors: [descriptor],
      };
      await addOneEService(eservice);

      const expectedDescriptorQuotasSeed: catalogApi.UpdateEServiceDescriptorQuotasSeed =
        {
          voucherLifespan: 1000,
          dailyCallsPerConsumer: descriptor.dailyCallsPerConsumer + 10,
          dailyCallsTotal: descriptor.dailyCallsTotal + 10,
        };

      const expectedEService: EService = {
        ...eservice,
        descriptors: [
          {
            ...descriptor,
            voucherLifespan: 1000,
            dailyCallsPerConsumer: descriptor.dailyCallsPerConsumer + 10,
            dailyCallsTotal: descriptor.dailyCallsTotal + 10,
          },
        ],
      };
      const updateDescriptorReturn = await catalogService.updateDescriptor(
        eservice.id,
        descriptor.id,
        expectedDescriptorQuotasSeed,
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
      expect(writtenPayload).toEqual({
        eservice: toEServiceV2(expectedEService),
        descriptorId: descriptor.id,
      });
      expect(updateDescriptorReturn).toEqual({
        data: expectedEService,
        metadata: { version: 1 },
      });
    }
  );

  it.each([
    descriptorState.published,
    descriptorState.suspended,
    descriptorState.deprecated,
  ])(
    "should write on event-store for the update of a descriptor with state %s (delegate)",
    async (descriptorState) => {
      const descriptor: Descriptor = {
        ...mockDescriptor,
        state: descriptorState,
        interface: mockDocument,
        publishedAt: new Date(),
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

      const expectedDescriptorQuotasSeed: catalogApi.UpdateEServiceDescriptorQuotasSeed =
        {
          voucherLifespan: 1000,
          dailyCallsPerConsumer: descriptor.dailyCallsPerConsumer + 10,
          dailyCallsTotal: descriptor.dailyCallsTotal + 10,
        };

      const expectedEService: EService = {
        ...eservice,
        descriptors: [
          {
            ...descriptor,
            voucherLifespan: 1000,
            dailyCallsPerConsumer: descriptor.dailyCallsPerConsumer + 10,
            dailyCallsTotal: descriptor.dailyCallsTotal + 10,
          },
        ],
      };
      const updateDescriptorReturn = await catalogService.updateDescriptor(
        eservice.id,
        descriptor.id,
        expectedDescriptorQuotasSeed,
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
      expect(writtenPayload).toEqual({
        eservice: toEServiceV2(expectedEService),
        descriptorId: descriptor.id,
      });
      expect(updateDescriptorReturn).toEqual({
        data: expectedEService,
        metadata: { version: 1 },
      });
    }
  );

  it("should throw eServiceNotFound if the eservice doesn't exist", () => {
    const expectedDescriptorQuotasSeed: catalogApi.UpdateEServiceDescriptorQuotasSeed =
      {
        voucherLifespan: 1000,
        dailyCallsPerConsumer: mockDescriptor.dailyCallsPerConsumer + 10,
        dailyCallsTotal: mockDescriptor.dailyCallsTotal + 10,
      };
    expect(
      catalogService.updateDescriptor(
        mockEService.id,
        mockDescriptor.id,
        expectedDescriptorQuotasSeed,
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

    const expectedDescriptorQuotasSeed: catalogApi.UpdateEServiceDescriptorQuotasSeed =
      {
        voucherLifespan: 1000,
        dailyCallsPerConsumer: mockDescriptor.dailyCallsPerConsumer + 10,
        dailyCallsTotal: mockDescriptor.dailyCallsTotal + 10,
      };

    expect(
      catalogService.updateDescriptor(
        mockEService.id,
        mockDescriptor.id,
        expectedDescriptorQuotasSeed,
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
    "should throw notValidDescriptorState if the descriptor is in %s state",
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
      const updatedDescriptorQuotasSeed: catalogApi.UpdateEServiceDescriptorQuotasSeed =
        {
          voucherLifespan: 1000,
          dailyCallsPerConsumer: descriptor.dailyCallsPerConsumer + 10,
          dailyCallsTotal: descriptor.dailyCallsTotal + 10,
        };

      expect(
        catalogService.updateDescriptor(
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
      descriptors: [descriptor],
    };
    await addOneEService(eservice);

    const expectedDescriptorQuotasSeed: catalogApi.UpdateEServiceDescriptorQuotasSeed =
      {
        voucherLifespan: 1000,
        dailyCallsPerConsumer: descriptor.dailyCallsPerConsumer + 10,
        dailyCallsTotal: descriptor.dailyCallsTotal + 10,
      };
    expect(
      catalogService.updateDescriptor(
        eservice.id,
        descriptor.id,
        expectedDescriptorQuotasSeed,
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

    const expectedDescriptorQuotasSeed: catalogApi.UpdateEServiceDescriptorQuotasSeed =
      {
        voucherLifespan: 1000,
        dailyCallsPerConsumer: descriptor.dailyCallsPerConsumer + 10,
        dailyCallsTotal: descriptor.dailyCallsTotal + 10,
      };
    expect(
      catalogService.updateDescriptor(
        eservice.id,
        descriptor.id,
        expectedDescriptorQuotasSeed,
        getMockContext({ authData: getMockAuthData(eservice.producerId) })
      )
    ).rejects.toThrowError(operationForbidden);
  });

  it("should throw inconsistentDailyCalls if dailyCallsPerConsumer is greater than or equal to dailyCallsTotal", async () => {
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

    const expectedDescriptorQuotasSeed: catalogApi.UpdateEServiceDescriptorQuotasSeed =
      {
        voucherLifespan: 1000,
        dailyCallsPerConsumer: descriptor.dailyCallsTotal + 11,
        dailyCallsTotal: descriptor.dailyCallsTotal + 10,
      };
    expect(
      catalogService.updateDescriptor(
        eservice.id,
        descriptor.id,
        expectedDescriptorQuotasSeed,
        getMockContext({ authData: getMockAuthData(eservice.producerId) })
      )
    ).rejects.toThrowError(inconsistentDailyCalls());
  });
  it("should throw templateInstanceNotAllowed if the templateId is defined", async () => {
    const templateId = unsafeBrandId<EServiceTemplateId>(generateId());
    const descriptor: Descriptor = {
      ...mockDescriptor,
      state: descriptorState.published,
      interface: mockDocument,
      publishedAt: new Date(),
    };
    const eservice: EService = {
      ...mockEService,
      templateId,
      descriptors: [descriptor],
    };
    await addOneEService(eservice);

    const expectedDescriptorQuotasSeed: catalogApi.UpdateEServiceDescriptorQuotasSeed =
      {
        voucherLifespan: 1000,
        dailyCallsPerConsumer: descriptor.dailyCallsTotal + 11,
        dailyCallsTotal: descriptor.dailyCallsTotal + 10,
      };
    expect(
      catalogService.updateDescriptor(
        eservice.id,
        descriptor.id,
        expectedDescriptorQuotasSeed,
        getMockContext({ authData: getMockAuthData(eservice.producerId) })
      )
    ).rejects.toThrowError(templateInstanceNotAllowed(eservice.id, templateId));
  });

  it("should update certified attribute dailyCallsPerConsumer on a published descriptor", async () => {
    const certifiedAttribute = getMockAttribute(attributeKind.certified);
    await addOneAttribute(certifiedAttribute);

    const descriptor: Descriptor = {
      ...mockDescriptor,
      state: descriptorState.published,
      interface: mockDocument,
      publishedAt: new Date(),
      attributes: {
        certified: [
          [{ id: certifiedAttribute.id }],
        ],
        verified: [],
        declared: [],
      },
    };
    const eservice: EService = {
      ...mockEService,
      descriptors: [descriptor],
    };
    await addOneEService(eservice);

    const seed: catalogApi.UpdateEServiceDescriptorQuotasSeed = {
      voucherLifespan: 1000,
      dailyCallsPerConsumer: descriptor.dailyCallsPerConsumer + 10,
      dailyCallsTotal: descriptor.dailyCallsTotal + 10,
      attributes: {
        certified: [
          [
            {
              id: certifiedAttribute.id,
              dailyCallsPerConsumer: 100,
            },
          ],
        ],
        verified: [],
        declared: [],
      },
    };

    const expectedEService: EService = {
      ...eservice,
      descriptors: [
        {
          ...descriptor,
          voucherLifespan: 1000,
          dailyCallsPerConsumer: descriptor.dailyCallsPerConsumer + 10,
          dailyCallsTotal: descriptor.dailyCallsTotal + 10,
          attributes: {
            certified: [
              [
                {
                  id: certifiedAttribute.id,
                  dailyCallsPerConsumer: 100,
                },
              ],
            ],
            verified: [],
            declared: [],
          },
        },
      ],
    };

    await catalogService.updateDescriptor(
      eservice.id,
      descriptor.id,
      seed,
      getMockContext({ authData: getMockAuthData(eservice.producerId) })
    );

    const lastEvent = await readLastEserviceEvent(eservice.id);
    expect(lastEvent).toMatchObject({
      stream_id: eservice.id,
      version: "1",
      type: "EServiceDescriptorQuotasUpdated",
      event_version: 2,
    });
    const writtenPayload = decodeProtobufPayload({
      messageType: EServiceDescriptorQuotasUpdatedV2,
      payload: lastEvent.data,
    });
    expect(writtenPayload).toEqual({
      eservice: toEServiceV2(expectedEService),
      descriptorId: descriptor.id,
    });
  });

  it("should throw inconsistentDailyCalls when a new certified attribute has dailyCallsPerConsumer greater than or equal to the descriptor dailyCallsTotal", async () => {
    const certifiedAttribute = getMockAttribute(attributeKind.certified);
    await addOneAttribute(certifiedAttribute);

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
              id: certifiedAttribute.id,
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
    };
    await addOneEService(eservice);

    const seed: catalogApi.UpdateEServiceDescriptorQuotasSeed = {
      voucherLifespan: 1000,
      dailyCallsPerConsumer: 1,
      dailyCallsTotal: 1000,
      attributes: {
        certified: [
          [
            {
              id: certifiedAttribute.id,
            },
          ],
        ],
        declared: [],
        verified: [],
      },
    };

    const expectedEService: EService = {
      ...eservice,
      descriptors: [
        {
          ...descriptor,
          voucherLifespan: 1000,
          dailyCallsPerConsumer: 1,
          dailyCallsTotal: 1000,
          attributes: {
            certified: [
              [
                {
                  id: certifiedAttribute.id,
                },
              ],
            ],
            declared: [],
            verified: [],
          },
        },
      ],
    };

    const returnedEService = await catalogService.updateDescriptor(
      eservice.id,
      descriptor.id,
      seed,
      getMockContext({ authData: getMockAuthData(eservice.producerId) })
    );

    const lastEvent = await readLastEserviceEvent(eservice.id);
    const writtenPayload = decodeProtobufPayload({
      messageType: EServiceDescriptorQuotasUpdatedV2,
      payload: lastEvent.data,
    });

    expect(writtenPayload).toEqual({
      eservice: toEServiceV2(expectedEService),
      descriptorId: descriptor.id,
    });
    expect(returnedEService).toEqual({
      data: expectedEService,
      metadata: { version: 1 },
    });
  });

  it("should clear existing certified attribute dailyCallsPerConsumer when seed.attributes omits them", async () => {
    const certifiedAttribute = getMockAttribute(attributeKind.certified);
    await addOneAttribute(certifiedAttribute);

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
              id: certifiedAttribute.id,
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
    };
    await addOneEService(eservice);

    const seed: catalogApi.UpdateEServiceDescriptorQuotasSeed = {
      voucherLifespan: 1000,
      dailyCallsPerConsumer: 1,
      dailyCallsTotal: 1000,
      attributes: {
        certified: [
          [
            {
              id: certifiedAttribute.id,
            },
          ],
        ],
        declared: [],
        verified: [],
      },
    };

    const expectedEService: EService = {
      ...eservice,
      descriptors: [
        {
          ...descriptor,
          voucherLifespan: 1000,
          dailyCallsPerConsumer: 1,
          dailyCallsTotal: 1000,
          attributes: {
            certified: [
              [
                {
                  id: certifiedAttribute.id,
                },
              ],
            ],
            declared: [],
            verified: [],
          },
        },
      ],
    };

    const returnedEService = await catalogService.updateDescriptor(
      eservice.id,
      descriptor.id,
      seed,
      getMockContext({ authData: getMockAuthData(eservice.producerId) })
    );

    const lastEvent = await readLastEserviceEvent(eservice.id);
    const writtenPayload = decodeProtobufPayload({
      messageType: EServiceDescriptorQuotasUpdatedV2,
      payload: lastEvent.data,
    });

    expect(writtenPayload).toEqual({
      eservice: toEServiceV2(expectedEService),
      descriptorId: descriptor.id,
    });
    expect(returnedEService).toEqual({
      data: expectedEService,
      metadata: { version: 1 },
    });
  });

  it("should throw inconsistentDailyCalls when a new certified attribute has dailyCallsPerConsumer greater than or equal to the descriptor dailyCallsTotal", async () => {
    const certifiedAttribute = getMockAttribute(attributeKind.certified);
    await addOneAttribute(certifiedAttribute);

    const descriptor: Descriptor = {
      ...mockDescriptor,
      state: descriptorState.published,
      interface: mockDocument,
      publishedAt: new Date(),
      dailyCallsTotal: 100,
      attributes: {
        certified: [],
        verified: [],
        declared: [],
      },
    };
    const eservice: EService = {
      ...mockEService,
      descriptors: [descriptor],
    };
    await addOneEService(eservice);

    const seed: catalogApi.UpdateEServiceDescriptorQuotasSeed = {
      voucherLifespan: 1000,
      dailyCallsPerConsumer: 50,
      dailyCallsTotal: 100,
      attributes: {
        certified: [
          [
            {
              id: certifiedAttribute.id,
              dailyCallsPerConsumer: 200,
            },
          ],
        ],
        verified: [],
        declared: [],
      },
    };

    expect(
      catalogService.updateDescriptor(
        eservice.id,
        descriptor.id,
        seed,
        getMockContext({ authData: getMockAuthData(eservice.producerId) })
      )
    ).rejects.toThrowError(inconsistentDailyCalls());
  });

  it.each([attributeKind.declared, attributeKind.verified])(
    "should throw attributeDailyCallsNotAllowed when setting dailyCallsPerConsumer on a non-certifiedattribute",
    async (kind) => {
      const nonCertifiedAttribute = getMockAttribute(kind);
      await addOneAttribute(nonCertifiedAttribute);

      const descriptor: Descriptor = {
        ...mockDescriptor,
        state: descriptorState.published,
        interface: mockDocument,
        publishedAt: new Date(),
        attributes: {
          certified: [],
          verified:
            kind === attributeKind.verified
              ? [
                  [
                    {
                      id: nonCertifiedAttribute.id,
                    },
                  ],
                ]
              : [],
          declared:
            kind === attributeKind.declared
              ? [
                  [
                    {
                      id: nonCertifiedAttribute.id,
                    },
                  ],
                ]
              : [],
        },
      };
      const eservice: EService = {
        ...mockEService,
        descriptors: [descriptor],
      };
      await addOneEService(eservice);

      const attributeWithDailyCalls = {
        id: nonCertifiedAttribute.id,
        dailyCallsPerConsumer: 100,
      };
      const seed: catalogApi.UpdateEServiceDescriptorQuotasSeed = {
        voucherLifespan: 1000,
        dailyCallsPerConsumer: descriptor.dailyCallsPerConsumer,
        dailyCallsTotal: descriptor.dailyCallsTotal,
        attributes: {
          certified: [],
          verified:
            kind === attributeKind.verified ? [[attributeWithDailyCalls]] : [],
          declared:
            kind === attributeKind.declared ? [[attributeWithDailyCalls]] : [],
        },
      };

      expect(
        catalogService.updateDescriptor(
          eservice.id,
          descriptor.id,
          seed,
          getMockContext({ authData: getMockAuthData(eservice.producerId) })
        )
      ).rejects.toThrowError(
        attributeDailyCallsNotAllowed(nonCertifiedAttribute.id)
      );
    }
  );

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
      descriptors: [descriptor],
    };
    await addOneEService(eservice);

    const seed: catalogApi.UpdateEServiceDescriptorQuotasSeed = {
      voucherLifespan: 1000,
      dailyCallsPerConsumer: 200,
      dailyCallsTotal: 300,
      // No attributes field — existing attributes must still be validated
    };

    await expect(
      catalogService.updateDescriptor(
        eservice.id,
        descriptor.id,
        seed,
        getMockContext({ authData: getMockAuthData(eservice.producerId) })
      )
    ).rejects.toThrowError(inconsistentDailyCalls());
  });
});
