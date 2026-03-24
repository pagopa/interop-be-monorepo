/* eslint-disable @typescript-eslint/no-floating-promises */
import {
  decodeProtobufPayload,
  getMockAttribute,
  getMockContext,
  getMockDelegation,
  getMockAuthData,
  getMockDescriptor,
  getMockEService,
} from "pagopa-interop-commons-test";
import {
  Descriptor,
  descriptorState,
  EService,
  toEServiceV2,
  generateId,
  attributeKind,
  EServiceDescriptorAttributesUpdatedV2,
  operationForbidden,
  AttributeId,
  delegationKind,
  delegationState,
  EServiceTemplateId,
  unsafeBrandId,
} from "pagopa-interop-models";
import { catalogApi } from "pagopa-interop-api-clients";
import { expect, describe, it, beforeEach } from "vitest";
import {
  attributeNotFound,
  eServiceDescriptorNotFound,
  eServiceNotFound,
  inconsistentAttributesSeedGroupsCount,
  descriptorAttributeGroupSupersetMissingInAttributesSeed,
  notValidDescriptorState,
  unchangedAttributes,
  templateInstanceNotAllowed,
  attributeDailyCallsNotAllowed,
} from "../../src/model/domain/errors.js";
import {
  addOneAttribute,
  addOneDelegation,
  addOneEService,
  catalogService,
  readLastEserviceEvent,
} from "../integrationUtils.js";

describe("update descriptor", () => {
  const mockCertifiedAttribute1 = getMockAttribute(attributeKind.certified);
  const mockCertifiedAttribute2 = getMockAttribute(attributeKind.certified);
  const mockCertifiedAttribute3 = getMockAttribute(attributeKind.certified);
  const mockVerifiedAttribute1 = getMockAttribute(attributeKind.verified);
  const mockVerifiedAttribute2 = getMockAttribute(attributeKind.verified);
  const mockVerifiedAttribute3 = getMockAttribute(attributeKind.verified);
  const mockDeclaredAttribute1 = getMockAttribute(attributeKind.declared);
  const mockDeclaredAttribute2 = getMockAttribute(attributeKind.declared);
  const mockDeclaredAttribute3 = getMockAttribute(attributeKind.declared);

  const validMockDescriptorCertifiedAttributes = [
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
  ];

  const validMockDescriptorVerifiedAttributes = [
    [
      {
        id: mockVerifiedAttribute1.id,
        explicitAttributeVerification: false,
      },
    ],
    [
      {
        id: mockVerifiedAttribute2.id,
        explicitAttributeVerification: false,
      },
    ],
  ];

  const validMockDescriptorAttributeSeed: catalogApi.AttributesSeed = {
    certified: [
      [
        ...validMockDescriptorCertifiedAttributes[0],
        {
          id: mockCertifiedAttribute3.id,
          explicitAttributeVerification: false,
        },
      ],
    ],
    verified: [
      [
        ...validMockDescriptorVerifiedAttributes[0],
        {
          id: mockVerifiedAttribute3.id,
          explicitAttributeVerification: false,
        },
      ],
      validMockDescriptorVerifiedAttributes[1],
    ],
    declared: [],
  };

  beforeEach(async () => {
    await addOneAttribute(mockCertifiedAttribute1);
    await addOneAttribute(mockCertifiedAttribute2);
    await addOneAttribute(mockCertifiedAttribute3);
    await addOneAttribute(mockVerifiedAttribute1);
    await addOneAttribute(mockVerifiedAttribute2);
    await addOneAttribute(mockVerifiedAttribute3);
    await addOneAttribute(mockDeclaredAttribute1);
    await addOneAttribute(mockDeclaredAttribute2);
    await addOneAttribute(mockDeclaredAttribute3);
  });

  it.each([descriptorState.published, descriptorState.suspended])(
    "should write on event-store for the attributes update of a descriptor with state %s",
    async (descriptorState) => {
      const mockDescriptor: Descriptor = {
        ...getMockDescriptor(),
        state: descriptorState,
        attributes: {
          certified: validMockDescriptorCertifiedAttributes,
          verified: validMockDescriptorVerifiedAttributes,
          declared: [],
        },
      };

      const mockEService: EService = {
        ...getMockEService(),
        descriptors: [mockDescriptor],
      };

      await addOneEService(mockEService);

      const updatedEService: EService = {
        ...mockEService,
        descriptors: [
          {
            ...mockDescriptor,
            attributes:
              validMockDescriptorAttributeSeed as Descriptor["attributes"],
          },
        ],
      };

      const returnedEService = await catalogService.updateDescriptorAttributes(
        mockEService.id,
        mockDescriptor.id,
        validMockDescriptorAttributeSeed,
        getMockContext({ authData: getMockAuthData(mockEService.producerId) })
      );

      const writtenEvent = await readLastEserviceEvent(mockEService.id);
      expect(writtenEvent).toMatchObject({
        stream_id: mockEService.id,
        version: "1",
        type: "EServiceDescriptorAttributesUpdated",
        event_version: 2,
      });
      const writtenPayload = decodeProtobufPayload({
        messageType: EServiceDescriptorAttributesUpdatedV2,
        payload: writtenEvent.data,
      });
      expect(writtenPayload.eservice).toEqual(toEServiceV2(updatedEService));
      expect(writtenPayload.eservice).toEqual(
        toEServiceV2(returnedEService.data)
      );
    }
  );

  it.each([descriptorState.published, descriptorState.suspended])(
    "should write on event-store for the attributes update of a descriptor with state %s (producer delegate)",
    async (descriptorState) => {
      const mockDescriptor: Descriptor = {
        ...getMockDescriptor(),
        state: descriptorState,
        attributes: {
          certified: validMockDescriptorCertifiedAttributes,
          verified: validMockDescriptorVerifiedAttributes,
          declared: [],
        },
      };

      const mockEService: EService = {
        ...getMockEService(),
        descriptors: [mockDescriptor],
      };

      await addOneEService(mockEService);

      const delegation = getMockDelegation({
        kind: delegationKind.delegatedProducer,
        eserviceId: mockEService.id,
        state: delegationState.active,
      });

      await addOneDelegation(delegation);

      const updatedEService: EService = {
        ...mockEService,
        descriptors: [
          {
            ...mockDescriptor,
            attributes:
              validMockDescriptorAttributeSeed as Descriptor["attributes"],
          },
        ],
      };

      const returnedEService = await catalogService.updateDescriptorAttributes(
        mockEService.id,
        mockDescriptor.id,
        validMockDescriptorAttributeSeed,
        getMockContext({ authData: getMockAuthData(delegation.delegateId) })
      );

      const writtenEvent = await readLastEserviceEvent(mockEService.id);
      expect(writtenEvent).toMatchObject({
        stream_id: mockEService.id,
        version: "1",
        type: "EServiceDescriptorAttributesUpdated",
        event_version: 2,
      });
      const writtenPayload = decodeProtobufPayload({
        messageType: EServiceDescriptorAttributesUpdatedV2,
        payload: writtenEvent.data,
      });
      expect(writtenPayload.eservice).toEqual(toEServiceV2(updatedEService));
      expect(writtenPayload.eservice).toEqual(
        toEServiceV2(returnedEService.data)
      );
    }
  );

  it("should throw eServiceNotFound if the eservice doesn't exist", async () => {
    const mockDescriptor: Descriptor = {
      ...getMockDescriptor(),
      state: descriptorState.published,
      attributes: {
        certified: validMockDescriptorCertifiedAttributes,
        verified: validMockDescriptorVerifiedAttributes,
        declared: [],
      },
    };

    const mockEService: EService = {
      ...getMockEService(),
      descriptors: [mockDescriptor],
    };

    expect(
      catalogService.updateDescriptorAttributes(
        mockEService.id,
        mockDescriptor.id,
        validMockDescriptorAttributeSeed,
        getMockContext({ authData: getMockAuthData(mockEService.producerId) })
      )
    ).rejects.toThrowError(eServiceNotFound(mockEService.id));
  });

  it("should throw eServiceDescriptorNotFound if the descriptor doesn't exist", async () => {
    const mockDescriptor: Descriptor = {
      ...getMockDescriptor(),
      state: descriptorState.published,
      attributes: {
        certified: validMockDescriptorCertifiedAttributes,
        verified: validMockDescriptorVerifiedAttributes,
        declared: [],
      },
    };

    const mockEService: EService = {
      ...getMockEService(),
      descriptors: [],
    };

    await addOneEService(mockEService);

    expect(
      catalogService.updateDescriptorAttributes(
        mockEService.id,
        mockDescriptor.id,
        validMockDescriptorAttributeSeed,
        getMockContext({ authData: getMockAuthData(mockEService.producerId) })
      )
    ).rejects.toThrowError(
      eServiceDescriptorNotFound(mockEService.id, mockDescriptor.id)
    );
  });

  it("should throw attributeNotFound if the attribute doesn't exist", async () => {
    const notExistingAttributeId = generateId<AttributeId>();

    const mockDescriptor: Descriptor = {
      ...getMockDescriptor(),
      state: descriptorState.published,
      attributes: {
        certified: validMockDescriptorCertifiedAttributes,
        verified: validMockDescriptorVerifiedAttributes,
        declared: [
          [
            {
              id: notExistingAttributeId,
              explicitAttributeVerification: false,
            },
          ],
        ],
      },
    };

    const mockEService: EService = {
      ...getMockEService(),
      descriptors: [mockDescriptor],
    };

    await addOneEService(mockEService);

    expect(
      catalogService.updateDescriptorAttributes(
        mockEService.id,
        mockDescriptor.id,
        {
          ...validMockDescriptorAttributeSeed,
          declared: [
            [
              {
                id: notExistingAttributeId,
                explicitAttributeVerification: false,
              },
            ],
          ],
        },
        getMockContext({ authData: getMockAuthData(mockEService.producerId) })
      )
    ).rejects.toThrowError(attributeNotFound(notExistingAttributeId));
  });

  it("should throw operationForbidden if the requester is not the producer", async () => {
    const mockDescriptor: Descriptor = {
      ...getMockDescriptor(),
      state: descriptorState.published,
      attributes: {
        certified: validMockDescriptorCertifiedAttributes,
        verified: validMockDescriptorVerifiedAttributes,
        declared: [],
      },
    };

    const mockEService: EService = {
      ...getMockEService(),
      descriptors: [mockDescriptor],
    };

    await addOneEService(mockEService);

    expect(
      catalogService.updateDescriptorAttributes(
        mockEService.id,
        mockDescriptor.id,
        validMockDescriptorAttributeSeed,
        getMockContext({})
      )
    ).rejects.toThrowError(operationForbidden);
  });

  it("should throw operationForbidden if the requester if the given e-service has been delegated and caller is not the delegate", async () => {
    const mockDescriptor: Descriptor = {
      ...getMockDescriptor(),
      state: descriptorState.published,
      attributes: {
        certified: validMockDescriptorCertifiedAttributes,
        verified: validMockDescriptorVerifiedAttributes,
        declared: [],
      },
    };

    const mockEService: EService = {
      ...getMockEService(),
      descriptors: [mockDescriptor],
    };

    await addOneEService(mockEService);

    const delegation = getMockDelegation({
      kind: delegationKind.delegatedProducer,
      eserviceId: mockEService.id,
      state: delegationState.active,
    });

    await addOneDelegation(delegation);

    expect(
      catalogService.updateDescriptorAttributes(
        mockEService.id,
        mockDescriptor.id,
        validMockDescriptorAttributeSeed,
        getMockContext({ authData: getMockAuthData(mockEService.producerId) })
      )
    ).rejects.toThrowError(operationForbidden);
  });

  it.each([
    descriptorState.draft,
    descriptorState.waitingForApproval,
    descriptorState.archived,
  ])(
    "should throw notValidDescriptorState if the descriptor is in %s state",
    async (descriptorState) => {
      const mockDescriptor: Descriptor = {
        ...getMockDescriptor(),
        state: descriptorState,
        attributes: {
          certified: validMockDescriptorCertifiedAttributes,
          verified: validMockDescriptorVerifiedAttributes,
          declared: [],
        },
      };

      const mockEService: EService = {
        ...getMockEService(),
        descriptors: [mockDescriptor],
      };

      await addOneEService(mockEService);

      expect(
        catalogService.updateDescriptorAttributes(
          mockEService.id,
          mockDescriptor.id,
          validMockDescriptorAttributeSeed,
          getMockContext({
            authData: getMockAuthData(mockEService.producerId),
          })
        )
      ).rejects.toThrowError(
        notValidDescriptorState(mockDescriptor.id, descriptorState)
      );
    }
  );

  it("should throw unchangedAttributes if the passed seed does not differ from the actual descriptor attributes", async () => {
    const mockDescriptor: Descriptor = {
      ...getMockDescriptor(),
      state: descriptorState.published,
      attributes: {
        certified: validMockDescriptorCertifiedAttributes,
        verified: validMockDescriptorVerifiedAttributes,
        declared: [],
      },
    };

    const mockEService: EService = {
      ...getMockEService(),
      descriptors: [mockDescriptor],
    };

    await addOneEService(mockEService);

    expect(
      catalogService.updateDescriptorAttributes(
        mockEService.id,
        mockDescriptor.id,
        {
          certified: validMockDescriptorCertifiedAttributes,
          verified: validMockDescriptorVerifiedAttributes,
          declared: [],
        },
        getMockContext({ authData: getMockAuthData(mockEService.producerId) })
      )
    ).rejects.toThrowError(
      unchangedAttributes(mockEService.id, mockDescriptor.id)
    );
  });

  it("should throw inconsistentAttributesSeedGroupsCount if the passed seed contains an additional attribute group", async () => {
    const mockDescriptor: Descriptor = {
      ...getMockDescriptor(),
      state: descriptorState.published,
      attributes: {
        certified: validMockDescriptorCertifiedAttributes,
        verified: validMockDescriptorVerifiedAttributes,
        declared: [],
      },
    };

    const mockEService: EService = {
      ...getMockEService(),
      descriptors: [mockDescriptor],
    };

    await addOneEService(mockEService);

    expect(
      catalogService.updateDescriptorAttributes(
        mockEService.id,
        mockDescriptor.id,
        {
          certified: validMockDescriptorCertifiedAttributes,
          verified: [
            ...validMockDescriptorVerifiedAttributes,
            [
              {
                id: mockVerifiedAttribute3.id,
                explicitAttributeVerification: false,
              },
            ],
          ],
          declared: [],
        },
        getMockContext({ authData: getMockAuthData(mockEService.producerId) })
      )
    ).rejects.toThrowError(
      inconsistentAttributesSeedGroupsCount(mockEService.id, mockDescriptor.id)
    );
  });

  it("should throw descriptorAttributeGroupSupersetMissingInAttributesSeed if the passed seed does not contains all the actual descriptor attributes", async () => {
    const mockDescriptor: Descriptor = {
      ...getMockDescriptor(),
      state: descriptorState.published,
      attributes: {
        certified: validMockDescriptorCertifiedAttributes,
        verified: validMockDescriptorVerifiedAttributes,
        declared: [],
      },
    };

    const mockEService: EService = {
      ...getMockEService(),
      descriptors: [mockDescriptor],
    };

    await addOneEService(mockEService);

    expect(
      catalogService.updateDescriptorAttributes(
        mockEService.id,
        mockDescriptor.id,
        {
          certified: validMockDescriptorCertifiedAttributes,
          verified: [
            [
              {
                id: mockVerifiedAttribute1.id,
                explicitAttributeVerification: false,
              },
            ],
            [
              {
                id: mockVerifiedAttribute3.id,
                explicitAttributeVerification: false,
              },
            ],
          ],
          declared: [],
        },
        getMockContext({ authData: getMockAuthData(mockEService.producerId) })
      )
    ).rejects.toThrowError(
      descriptorAttributeGroupSupersetMissingInAttributesSeed(
        mockEService.id,
        mockDescriptor.id
      )
    );
  });
  it("should throw templateInstanceNotAllowed if the templateId is defined", async () => {
    const templateId = unsafeBrandId<EServiceTemplateId>(generateId());
    const mockDescriptor: Descriptor = {
      ...getMockDescriptor(),
      state: descriptorState.published,
      attributes: {
        certified: validMockDescriptorCertifiedAttributes,
        verified: validMockDescriptorVerifiedAttributes,
        declared: [],
      },
    };

    const mockEService: EService = {
      ...getMockEService(),
      templateId,
      descriptors: [mockDescriptor],
    };

    await addOneEService(mockEService);

    expect(
      catalogService.updateDescriptorAttributes(
        mockEService.id,
        mockDescriptor.id,
        validMockDescriptorAttributeSeed,
        getMockContext({ authData: getMockAuthData(mockEService.producerId) })
      )
    ).rejects.toThrowError(
      templateInstanceNotAllowed(mockEService.id, templateId)
    );
  });

  it("should write on event-store when adding new certified attribute with dailyCalls", async () => {
    const mockDescriptor: Descriptor = {
      ...getMockDescriptor(),
      state: descriptorState.published,
      attributes: {
        certified: validMockDescriptorCertifiedAttributes,
        verified: [],
        declared: [],
      },
    };

    const mockEService: EService = {
      ...getMockEService(),
      descriptors: [mockDescriptor],
    };

    await addOneEService(mockEService);

    const attributeSeedWithDailyCalls: catalogApi.AttributesSeed = {
      certified: [
        [
          ...validMockDescriptorCertifiedAttributes[0],
          {
            id: mockCertifiedAttribute3.id,
            explicitAttributeVerification: false,
            dailyCallsPerConsumer: 500,
          },
        ],
      ],
      verified: [],
      declared: [],
    };

    const updatedEService: EService = {
      ...mockEService,
      descriptors: [
        {
          ...mockDescriptor,
          attributes: {
            certified: [
              [
                ...validMockDescriptorCertifiedAttributes[0],
                {
                  id: mockCertifiedAttribute3.id,
                  explicitAttributeVerification: false,
                  dailyCallsPerConsumer: 500,
                },
              ],
            ],
            verified: [],
            declared: [],
          },
        },
      ],
    };

    const returnedEService = await catalogService.updateDescriptorAttributes(
      mockEService.id,
      mockDescriptor.id,
      attributeSeedWithDailyCalls,
      getMockContext({ authData: getMockAuthData(mockEService.producerId) })
    );

    const writtenEvent = await readLastEserviceEvent(mockEService.id);
    expect(writtenEvent).toMatchObject({
      stream_id: mockEService.id,
      version: "1",
      type: "EServiceDescriptorAttributesUpdated",
      event_version: 2,
    });

    const writtenPayload = decodeProtobufPayload({
      messageType: EServiceDescriptorAttributesUpdatedV2,
      payload: writtenEvent.data,
    });

    expect(writtenPayload.eservice).toEqual(toEServiceV2(updatedEService));
    expect(writtenPayload.eservice).toEqual(
      toEServiceV2(returnedEService.data)
    );
  });

  it("should write on event-store when updating only dailyCalls on existing certified attribute", async () => {
    const mockDescriptor: Descriptor = {
      ...getMockDescriptor(),
      state: descriptorState.published,
      attributes: {
        certified: [
          [
            {
              id: mockCertifiedAttribute1.id,
              explicitAttributeVerification: false,
              dailyCallsPerConsumer: 100,
            },
          ],
        ],
        verified: [],
        declared: [],
      },
    };

    const mockEService: EService = {
      ...getMockEService(),
      descriptors: [mockDescriptor],
    };

    await addOneEService(mockEService);

    const attributeSeedWithUpdatedDailyCalls: catalogApi.AttributesSeed = {
      certified: [
        [
          {
            id: mockCertifiedAttribute1.id,
            explicitAttributeVerification: false,
            dailyCallsPerConsumer: 200,
          },
        ],
      ],
      verified: [],
      declared: [],
    };

    const updatedEService: EService = {
      ...mockEService,
      descriptors: [
        {
          ...mockDescriptor,
          attributes: {
            certified: [
              [
                {
                  id: mockCertifiedAttribute1.id,
                  explicitAttributeVerification: false,
                  dailyCallsPerConsumer: 200,
                },
              ],
            ],
            verified: [],
            declared: [],
          },
        },
      ],
    };

    const returnedEService = await catalogService.updateDescriptorAttributes(
      mockEService.id,
      mockDescriptor.id,
      attributeSeedWithUpdatedDailyCalls,
      getMockContext({ authData: getMockAuthData(mockEService.producerId) })
    );

    const writtenEvent = await readLastEserviceEvent(mockEService.id);
    expect(writtenEvent).toMatchObject({
      stream_id: mockEService.id,
      version: "1",
      type: "EServiceDescriptorAttributesUpdated",
      event_version: 2,
    });

    const writtenPayload = decodeProtobufPayload({
      messageType: EServiceDescriptorAttributesUpdatedV2,
      payload: writtenEvent.data,
    });

    expect(writtenPayload.eservice).toEqual(toEServiceV2(updatedEService));
    expect(writtenPayload.eservice).toEqual(
      toEServiceV2(returnedEService.data)
    );
  });

  it("should write on event-store when removing dailyCalls from certified attribute", async () => {
    const mockDescriptor: Descriptor = {
      ...getMockDescriptor(),
      state: descriptorState.published,
      attributes: {
        certified: [
          [
            {
              id: mockCertifiedAttribute1.id,
              explicitAttributeVerification: false,
              dailyCallsPerConsumer: 500,
            },
          ],
        ],
        verified: [],
        declared: [],
      },
    };

    const mockEService: EService = {
      ...getMockEService(),
      descriptors: [mockDescriptor],
    };

    await addOneEService(mockEService);

    const attributeSeedWithoutDailyCalls: catalogApi.AttributesSeed = {
      certified: [
        [
          {
            id: mockCertifiedAttribute1.id,
            explicitAttributeVerification: false,
          },
        ],
      ],
      verified: [],
      declared: [],
    };

    const updatedEService: EService = {
      ...mockEService,
      descriptors: [
        {
          ...mockDescriptor,
          attributes: {
            certified: [
              [
                {
                  id: mockCertifiedAttribute1.id,
                  explicitAttributeVerification: false,
                },
              ],
            ],
            verified: [],
            declared: [],
          },
        },
      ],
    };

    const returnedEService = await catalogService.updateDescriptorAttributes(
      mockEService.id,
      mockDescriptor.id,
      attributeSeedWithoutDailyCalls,
      getMockContext({ authData: getMockAuthData(mockEService.producerId) })
    );

    const writtenEvent = await readLastEserviceEvent(mockEService.id);
    expect(writtenEvent).toMatchObject({
      stream_id: mockEService.id,
      version: "1",
      type: "EServiceDescriptorAttributesUpdated",
      event_version: 2,
    });

    const writtenPayload = decodeProtobufPayload({
      messageType: EServiceDescriptorAttributesUpdatedV2,
      payload: writtenEvent.data,
    });

    expect(writtenPayload.eservice).toEqual(toEServiceV2(updatedEService));
    expect(writtenPayload.eservice).toEqual(
      toEServiceV2(returnedEService.data)
    );
  });

  it("should throw attributeDailyCallsNotAllowed when dailyCalls is on declared attribute", async () => {
    const mockDescriptor: Descriptor = {
      ...getMockDescriptor(),
      state: descriptorState.published,
      attributes: {
        certified: [],
        verified: [],
        declared: [
          [
            {
              id: mockDeclaredAttribute1.id,
              explicitAttributeVerification: false,
            },
          ],
        ],
      },
    };

    const mockEService: EService = {
      ...getMockEService(),
      descriptors: [mockDescriptor],
    };

    await addOneEService(mockEService);

    const attributeSeedWithDailyCallsOnDeclared: catalogApi.AttributesSeed = {
      certified: [],
      verified: [],
      declared: [
        [
          {
            id: mockDeclaredAttribute1.id,
            explicitAttributeVerification: false,
            dailyCallsPerConsumer: 100,
          },
        ],
      ],
    };

    await expect(
      catalogService.updateDescriptorAttributes(
        mockEService.id,
        mockDescriptor.id,
        attributeSeedWithDailyCallsOnDeclared,
        getMockContext({ authData: getMockAuthData(mockEService.producerId) })
      )
    ).rejects.toThrowError(
      attributeDailyCallsNotAllowed(mockDeclaredAttribute1.id)
    );
  });

  it("should throw attributeDailyCallsNotAllowed when dailyCalls is on verified attribute", async () => {
    const mockDescriptor: Descriptor = {
      ...getMockDescriptor(),
      state: descriptorState.published,
      attributes: {
        certified: [],
        verified: [
          [
            {
              id: mockVerifiedAttribute1.id,
              explicitAttributeVerification: false,
            },
          ],
        ],
        declared: [],
      },
    };

    const mockEService: EService = {
      ...getMockEService(),
      descriptors: [mockDescriptor],
    };

    await addOneEService(mockEService);

    const attributeSeedWithDailyCallsOnVerified: catalogApi.AttributesSeed = {
      certified: [],
      verified: [
        [
          {
            id: mockVerifiedAttribute1.id,
            explicitAttributeVerification: false,
            dailyCallsPerConsumer: 100,
          },
        ],
      ],
      declared: [],
    };

    await expect(
      catalogService.updateDescriptorAttributes(
        mockEService.id,
        mockDescriptor.id,
        attributeSeedWithDailyCallsOnVerified,
        getMockContext({ authData: getMockAuthData(mockEService.producerId) })
      )
    ).rejects.toThrowError(
      attributeDailyCallsNotAllowed(mockVerifiedAttribute1.id)
    );
  });

  it("should preserve dailyCalls in protobuf round-trip", async () => {
    const mockDescriptor: Descriptor = {
      ...getMockDescriptor(),
      state: descriptorState.published,
      attributes: {
        certified: [
          [
            {
              id: mockCertifiedAttribute1.id,
              explicitAttributeVerification: false,
              dailyCallsPerConsumer: 1000,
            },
            {
              id: mockCertifiedAttribute2.id,
              explicitAttributeVerification: true,
              dailyCallsPerConsumer: 2000,
            },
          ],
        ],
        verified: [],
        declared: [],
      },
    };

    const mockEService: EService = {
      ...getMockEService(),
      descriptors: [mockDescriptor],
    };

    await addOneEService(mockEService);

    const attributeSeedWithNewAttribute: catalogApi.AttributesSeed = {
      certified: [
        [
          {
            id: mockCertifiedAttribute1.id,
            explicitAttributeVerification: false,
            dailyCallsPerConsumer: 1000,
          },
          {
            id: mockCertifiedAttribute2.id,
            explicitAttributeVerification: true,
            dailyCallsPerConsumer: 2000,
          },
          {
            id: mockCertifiedAttribute3.id,
            explicitAttributeVerification: false,
            dailyCallsPerConsumer: 3000,
          },
        ],
      ],
      verified: [],
      declared: [],
    };

    const updatedEService: EService = {
      ...mockEService,
      descriptors: [
        {
          ...mockDescriptor,
          attributes: {
            certified: [
              [
                {
                  id: mockCertifiedAttribute1.id,
                  explicitAttributeVerification: false,
                  dailyCallsPerConsumer: 1000,
                },
                {
                  id: mockCertifiedAttribute2.id,
                  explicitAttributeVerification: true,
                  dailyCallsPerConsumer: 2000,
                },
                {
                  id: mockCertifiedAttribute3.id,
                  explicitAttributeVerification: false,
                  dailyCallsPerConsumer: 3000,
                },
              ],
            ],
            verified: [],
            declared: [],
          },
        },
      ],
    };

    const returnedEService = await catalogService.updateDescriptorAttributes(
      mockEService.id,
      mockDescriptor.id,
      attributeSeedWithNewAttribute,
      getMockContext({ authData: getMockAuthData(mockEService.producerId) })
    );

    const writtenEvent = await readLastEserviceEvent(mockEService.id);
    expect(writtenEvent).toMatchObject({
      stream_id: mockEService.id,
      version: "1",
      type: "EServiceDescriptorAttributesUpdated",
      event_version: 2,
    });

    const writtenPayload = decodeProtobufPayload({
      messageType: EServiceDescriptorAttributesUpdatedV2,
      payload: writtenEvent.data,
    });

    expect(writtenPayload.eservice).toEqual(toEServiceV2(updatedEService));
    expect(writtenPayload.eservice).toEqual(
      toEServiceV2(returnedEService.data)
    );
  });

  it("should detect dailyCallsPerConsumer change for an attribute (same id) appearing in two different groups", async () => {
    const mockDescriptor: Descriptor = {
      ...getMockDescriptor(),
      state: descriptorState.published,
      attributes: {
        certified: [
          [
            {
              id: mockCertifiedAttribute1.id,
              explicitAttributeVerification: false,
              dailyCallsPerConsumer: 100,
            },
            {
              id: mockCertifiedAttribute2.id,
              explicitAttributeVerification: false,
              dailyCallsPerConsumer: 200,
            },
          ],
          [
            {
              id: mockCertifiedAttribute1.id,
              explicitAttributeVerification: false,
              dailyCallsPerConsumer: 200,
            },
            {
              id: mockCertifiedAttribute2.id,
              explicitAttributeVerification: false,
              dailyCallsPerConsumer: 300,
            },
          ],
        ],
        verified: [],
        declared: [],
      },
    };

    const mockEService: EService = {
      ...getMockEService(),
      descriptors: [mockDescriptor],
    };

    await addOneEService(mockEService);

    const seedWithChangedDailyCallsInSecondGroup: catalogApi.AttributesSeed = {
      certified: [
        [
          {
            id: mockCertifiedAttribute1.id,
            explicitAttributeVerification: false,
            dailyCallsPerConsumer: 100,
          },
          {
            id: mockCertifiedAttribute2.id,
            explicitAttributeVerification: false,
            dailyCallsPerConsumer: 200,
          },
        ],
        [
          {
            id: mockCertifiedAttribute1.id,
            explicitAttributeVerification: false,
            dailyCallsPerConsumer: 999,
          },
          {
            id: mockCertifiedAttribute2.id,
            explicitAttributeVerification: false,
            dailyCallsPerConsumer: 300,
          },
        ],
      ],
      verified: [],
      declared: [],
    };

    const returnedEService = await catalogService.updateDescriptorAttributes(
      mockEService.id,
      mockDescriptor.id,
      seedWithChangedDailyCallsInSecondGroup,
      getMockContext({ authData: getMockAuthData(mockEService.producerId) })
    );

    const writtenEvent = await readLastEserviceEvent(mockEService.id);
    expect(writtenEvent).toMatchObject({
      stream_id: mockEService.id,
      version: "1",
      type: "EServiceDescriptorAttributesUpdated",
      event_version: 2,
    });

    const writtenPayload = decodeProtobufPayload({
      messageType: EServiceDescriptorAttributesUpdatedV2,
      payload: writtenEvent.data,
    });

    const expectedEService: EService = {
      ...mockEService,
      descriptors: [
        {
          ...mockDescriptor,
          attributes: {
            certified: [
              [
                {
                  id: mockCertifiedAttribute1.id,
                  explicitAttributeVerification: false,
                  dailyCallsPerConsumer: 100,
                },
                {
                  id: mockCertifiedAttribute2.id,
                  explicitAttributeVerification: false,
                  dailyCallsPerConsumer: 200,
                },
              ],
              [
                {
                  id: mockCertifiedAttribute1.id,
                  explicitAttributeVerification: false,
                  dailyCallsPerConsumer: 999,
                },
                {
                  id: mockCertifiedAttribute2.id,
                  explicitAttributeVerification: false,
                  dailyCallsPerConsumer: 300,
                },
              ],
            ],
            verified: [],
            declared: [],
          },
        },
      ],
    };

    expect(writtenPayload.eservice).toEqual(toEServiceV2(expectedEService));
    expect(writtenPayload.eservice).toEqual(
      toEServiceV2(returnedEService.data)
    );
  });
});
