/* eslint-disable @typescript-eslint/no-floating-promises */
import {
  decodeProtobufPayload,
  getMockAttribute,
  getMockContext,
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
  EServiceDescriptorAttributesUpdatedByTemplateUpdateV2,
  AttributeId,
} from "pagopa-interop-models";
import { catalogApi } from "pagopa-interop-api-clients";
import { expect, describe, it, beforeEach } from "vitest";
import {
  attributeNotFound,
  eServiceDescriptorNotFound,
  eServiceNotFound,
  inconsistentAttributesSeedGroupsCount,
  descriptorAttributeGroupSupersetMissingInAttributesSeed,
} from "../../src/model/domain/errors.js";
import {
  addOneAttribute,
  addOneEService,
  catalogService,
  readLastEserviceEvent,
} from "../integrationUtils.js";

describe("updateTemplateInstanceDescriptorAttributes", () => {
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
    "should write on event-store for the internal attributes update of a descriptor with state %s",
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

      await catalogService.internalUpdateTemplateInstanceDescriptorAttributes(
        mockEService.id,
        mockDescriptor.id,
        validMockDescriptorAttributeSeed,
        getMockContext({ authData: getMockAuthData(mockEService.producerId) })
      );

      const writtenEvent = await readLastEserviceEvent(mockEService.id);
      expect(writtenEvent).toMatchObject({
        stream_id: mockEService.id,
        version: "1",
        type: "EServiceDescriptorAttributesUpdatedByTemplateUpdate",
        event_version: 2,
      });
      const writtenPayload = decodeProtobufPayload({
        messageType: EServiceDescriptorAttributesUpdatedByTemplateUpdateV2,
        payload: writtenEvent.data,
      });
      expect(writtenPayload).toEqual({
        descriptorId: mockDescriptor.id,
        attributeIds: [mockCertifiedAttribute3.id, mockVerifiedAttribute3.id],
        eservice: toEServiceV2(updatedEService),
      });
    }
  );

  it.each([
    descriptorState.draft,
    descriptorState.waitingForApproval,
    descriptorState.archived,
    descriptorState.deprecated,
  ])(
    "should not write on event-store for the internal attributes update of a descriptor if the descriptor state is state %s",
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

      await catalogService.internalUpdateTemplateInstanceDescriptorAttributes(
        mockEService.id,
        mockDescriptor.id,
        validMockDescriptorAttributeSeed,
        getMockContext({ authData: getMockAuthData(mockEService.producerId) })
      );

      const writtenEvent = await readLastEserviceEvent(mockEService.id);
      expect(writtenEvent).not.toMatchObject({
        stream_id: mockEService.id,
        version: "1",
        type: "EServiceDescriptorAttributesUpdatedByTemplateUpdate",
        event_version: 2,
      });
    }
  );

  it("should not write on event-store for the internal attributes update of a descriptor if the descriptor has no new attributes", async () => {
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

    await catalogService.internalUpdateTemplateInstanceDescriptorAttributes(
      mockEService.id,
      mockDescriptor.id,
      {
        certified: validMockDescriptorCertifiedAttributes,
        verified: validMockDescriptorVerifiedAttributes,
        declared: [],
      },
      getMockContext({ authData: getMockAuthData(mockEService.producerId) })
    );

    const writtenEvent = await readLastEserviceEvent(mockEService.id);
    expect(writtenEvent).not.toMatchObject({
      stream_id: mockEService.id,
      version: "1",
      type: "EServiceDescriptorAttributesUpdatedByTemplateUpdate",
      event_version: 2,
    });
  });

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
      catalogService.internalUpdateTemplateInstanceDescriptorAttributes(
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
      catalogService.internalUpdateTemplateInstanceDescriptorAttributes(
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
      catalogService.internalUpdateTemplateInstanceDescriptorAttributes(
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
      catalogService.internalUpdateTemplateInstanceDescriptorAttributes(
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
      catalogService.internalUpdateTemplateInstanceDescriptorAttributes(
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

  it.each([descriptorState.published, descriptorState.suspended])(
    "should preserve dailyCallsPerConsumer on existing attributes when template is edited",
    async (descriptorState) => {
      const dailyCallsAttr1 = 500;
      const dailyCallsAttr2 = 300;

      const mockDescriptor: Descriptor = {
        ...getMockDescriptor(),
        state: descriptorState,
        dailyCallsTotal: 1000,
        attributes: {
          certified: [
            [
              {
                id: mockCertifiedAttribute1.id,
                explicitAttributeVerification: false,
                dailyCallsPerConsumer: dailyCallsAttr1,
              },
              {
                id: mockCertifiedAttribute2.id,
                explicitAttributeVerification: false,
                dailyCallsPerConsumer: dailyCallsAttr2,
              },
            ],
          ],
          verified: validMockDescriptorVerifiedAttributes,
          declared: [],
        },
      };

      const mockEService: EService = {
        ...getMockEService(),
        descriptors: [mockDescriptor],
      };

      await addOneEService(mockEService);

      const seedWithNewAttribute: catalogApi.AttributesSeed = {
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

      await catalogService.internalUpdateTemplateInstanceDescriptorAttributes(
        mockEService.id,
        mockDescriptor.id,
        seedWithNewAttribute,
        getMockContext({ authData: getMockAuthData(mockEService.producerId) })
      );

      const writtenEvent = await readLastEserviceEvent(mockEService.id);
      expect(writtenEvent).toMatchObject({
        stream_id: mockEService.id,
        version: "1",
        type: "EServiceDescriptorAttributesUpdatedByTemplateUpdate",
        event_version: 2,
      });

      const writtenPayload = decodeProtobufPayload({
        messageType: EServiceDescriptorAttributesUpdatedByTemplateUpdateV2,
        payload: writtenEvent.data,
      });

      const updatedDescriptor = writtenPayload.eservice?.descriptors[0];

      const certifiedGroup =
        updatedDescriptor?.attributes?.certified[0]?.values;

      const preservedAttr1 = certifiedGroup?.find(
        (attr) => attr.id === mockCertifiedAttribute1.id
      );
      expect(preservedAttr1?.dailyCallsPerConsumer).toBe(dailyCallsAttr1);

      const preservedAttr2 = certifiedGroup?.find(
        (attr) => attr.id === mockCertifiedAttribute2.id
      );
      expect(preservedAttr2?.dailyCallsPerConsumer).toBe(dailyCallsAttr2);

      const newAttribute = certifiedGroup?.find(
        (attr) => attr.id === mockCertifiedAttribute3.id
      );
      expect(newAttribute?.dailyCallsPerConsumer).toBeUndefined();
    }
  );

  it.each([descriptorState.published, descriptorState.suspended])(
    "should preserve distinct dailyCallsPerConsumer values when the same certified attribute id appears in multiple groups",
    async (descriptorState) => {
      const firstGroupAttr1DailyCalls = 100;
      const firstGroupAttr2DailyCalls = 200;
      const secondGroupAttr1DailyCalls = 900;
      const secondGroupAttr2DailyCalls = 300;

      const mockDescriptor: Descriptor = {
        ...getMockDescriptor(),
        state: descriptorState,
        dailyCallsTotal: 1000,
        attributes: {
          certified: [
            [
              {
                id: mockCertifiedAttribute1.id,
                explicitAttributeVerification: false,
                dailyCallsPerConsumer: firstGroupAttr1DailyCalls,
              },
              {
                id: mockCertifiedAttribute2.id,
                explicitAttributeVerification: false,
                dailyCallsPerConsumer: firstGroupAttr2DailyCalls,
              },
            ],
            [
              {
                id: mockCertifiedAttribute1.id,
                explicitAttributeVerification: false,
                dailyCallsPerConsumer: secondGroupAttr1DailyCalls,
              },
              {
                id: mockCertifiedAttribute2.id,
                explicitAttributeVerification: false,
                dailyCallsPerConsumer: secondGroupAttr2DailyCalls,
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

      const seedWithNewAttribute: catalogApi.AttributesSeed = {
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
            {
              id: mockCertifiedAttribute3.id,
              explicitAttributeVerification: false,
            },
          ],
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
        verified: [],
        declared: [],
      };

      await catalogService.internalUpdateTemplateInstanceDescriptorAttributes(
        mockEService.id,
        mockDescriptor.id,
        seedWithNewAttribute,
        getMockContext({ authData: getMockAuthData(mockEService.producerId) })
      );

      const writtenEvent = await readLastEserviceEvent(mockEService.id);
      expect(writtenEvent).toMatchObject({
        stream_id: mockEService.id,
        version: "1",
        type: "EServiceDescriptorAttributesUpdatedByTemplateUpdate",
        event_version: 2,
      });

      const writtenPayload = decodeProtobufPayload({
        messageType: EServiceDescriptorAttributesUpdatedByTemplateUpdateV2,
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
                    dailyCallsPerConsumer: firstGroupAttr1DailyCalls,
                  },
                  {
                    id: mockCertifiedAttribute2.id,
                    explicitAttributeVerification: false,
                    dailyCallsPerConsumer: firstGroupAttr2DailyCalls,
                  },
                  {
                    id: mockCertifiedAttribute3.id,
                    explicitAttributeVerification: false,
                  },
                ],
                [
                  {
                    id: mockCertifiedAttribute1.id,
                    explicitAttributeVerification: false,
                    dailyCallsPerConsumer: secondGroupAttr1DailyCalls,
                  },
                  {
                    id: mockCertifiedAttribute2.id,
                    explicitAttributeVerification: false,
                    dailyCallsPerConsumer: secondGroupAttr2DailyCalls,
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
    }
  );
});
