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
      },
      {
        id: mockCertifiedAttribute2.id,
      },
    ],
  ];

  const validMockDescriptorVerifiedAttributes = [
    [
      {
        id: mockVerifiedAttribute1.id,
      },
    ],
    [
      {
        id: mockVerifiedAttribute2.id,
      },
    ],
  ];

  const validMockDescriptorAttributeSeed: catalogApi.AttributesSeed = {
    certified: [
      [
        ...validMockDescriptorCertifiedAttributes[0],
        {
          id: mockCertifiedAttribute3.id,
        },
      ],
    ],
    verified: [
      [
        ...validMockDescriptorVerifiedAttributes[0],
        {
          id: mockVerifiedAttribute3.id,
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
      expect(writtenPayload.eservice).toEqual(toEServiceV2(updatedEService));
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
              },
            ],
            [
              {
                id: mockVerifiedAttribute3.id,
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
});
