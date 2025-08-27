/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/no-floating-promises */
import { catalogApi } from "pagopa-interop-api-clients";
import {
  decodeProtobufPayload,
  getMockDelegation,
  getMockEServiceTemplate,
  getMockDescriptor,
  getMockEService,
  getMockDocument,
  getMockAttribute,
  getMockContextM2MAdmin,
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
import { apiAgreementApprovalPolicyToAgreementApprovalPolicy } from "../../src/model/domain/apiConverter.js";

describe("patchUpdateDraftDescriptor", () => {
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

    const descriptorSeed: catalogApi.PatchUpdateEServiceDescriptorSeed = {
      description: "new description",
      audience: ["new audience"],
      voucherLifespan: 1000,
      dailyCallsPerConsumer: 100,
      dailyCallsTotal: 200,
      agreementApprovalPolicy: "AUTOMATIC",
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
          description: descriptorSeed.description!,
          audience: descriptorSeed.audience!,
          voucherLifespan: descriptorSeed.voucherLifespan!,
          dailyCallsPerConsumer: descriptorSeed.dailyCallsPerConsumer!,
          dailyCallsTotal: descriptorSeed.dailyCallsTotal!,
          agreementApprovalPolicy:
            apiAgreementApprovalPolicyToAgreementApprovalPolicy(
              descriptorSeed.agreementApprovalPolicy!
            ),
          attributes: descriptorSeed.attributes! as Descriptor["attributes"],
        },
      ],
    };
    const updateDescriptorResponse =
      await catalogService.patchUpdateDraftDescriptor(
        eservice.id,
        descriptor.id,
        descriptorSeed,
        getMockContextM2MAdmin({ organizationId: eservice.producerId })
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

  it.each([
    {}, // This should not throw an error and leave all fields unchanged
    {
      description: "new description",
    },
    { description: "new description", audience: ["new audience"] },
    {
      description: "new description",
      audience: ["new audience"],
      voucherLifespan: 1000,
    },
    {
      description: "new description",
      audience: ["new audience"],
      voucherLifespan: 1000,
      dailyCallsPerConsumer: 100,
      dailyCallsTotal: 200,
      agreementApprovalPolicy: "AUTOMATIC",
    },
    {
      description: "new description",
      audience: ["new audience"],
      voucherLifespan: 1000,
      dailyCallsPerConsumer: 100,
      dailyCallsTotal: 200,
      agreementApprovalPolicy: "MANUAL",
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
    },
    {
      attributes: {
        certified: [],
        declared: [
          [{ id: declaredAttribute.id, explicitAttributeVerification: false }],
        ],
      },
    },
    {
      attributes: {
        verified: [
          [{ id: verifiedAttribute.id, explicitAttributeVerification: false }],
        ],
      },
    },
  ] as catalogApi.PatchUpdateEServiceDescriptorSeed[])(
    `should write on event-store and update only the fields set in the seed (seed #%#)`,
    async (seed) => {
      const descriptor: Descriptor = {
        ...mockDescriptor,
        state: descriptorState.draft,
        description: "Some description",
      };
      const eservice: EService = {
        ...mockEService,
        descriptors: [descriptor],
      };
      await addOneEService(eservice);
      const attribute: Attribute = {
        name: "Attribute name",
        id: generateId(),
        kind: "Declared",
        description: "Attribute Description",
        creationTime: new Date(),
      };
      await addOneAttribute(attribute);

      const expectedEService: EService = {
        ...eservice,
        descriptors: [
          {
            ...descriptor,
            description: seed.description ?? descriptor.description,
            audience: seed.audience ?? descriptor.audience,
            voucherLifespan: seed.voucherLifespan ?? descriptor.voucherLifespan,
            dailyCallsPerConsumer:
              seed.dailyCallsPerConsumer ?? descriptor.dailyCallsPerConsumer,
            dailyCallsTotal: seed.dailyCallsTotal ?? descriptor.dailyCallsTotal,
            agreementApprovalPolicy: seed.agreementApprovalPolicy
              ? apiAgreementApprovalPolicyToAgreementApprovalPolicy(
                  seed.agreementApprovalPolicy
                )
              : descriptor.agreementApprovalPolicy,
            attributes: (seed.attributes
              ? {
                  certified:
                    seed.attributes.certified ??
                    descriptor.attributes.certified,
                  declared:
                    seed.attributes.declared ?? descriptor.attributes.declared,
                  verified:
                    seed.attributes.verified ?? descriptor.attributes.verified,
                }
              : descriptor.attributes) as Descriptor["attributes"],
          },
        ],
      };
      const updateDescriptorResponse =
        await catalogService.patchUpdateDraftDescriptor(
          eservice.id,
          descriptor.id,
          seed,
          getMockContextM2MAdmin({ organizationId: eservice.producerId })
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
    }
  );

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

    const descriptorSeed: catalogApi.PatchUpdateEServiceDescriptorSeed = {
      description: "new description",
      audience: ["new audience"],
    };

    const expectedEService: EService = {
      ...eservice,
      descriptors: [
        {
          ...descriptor,
          description: descriptorSeed.description!,
          audience: descriptorSeed.audience!,
        },
      ],
    };
    const updateDescriptorResponse =
      await catalogService.patchUpdateDraftDescriptor(
        eservice.id,
        descriptor.id,
        descriptorSeed,
        getMockContextM2MAdmin({ organizationId: delegation.delegateId })
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
      catalogService.patchUpdateDraftDescriptor(
        mockEService.id,
        descriptor.id,
        {},
        getMockContextM2MAdmin({ organizationId: mockEService.producerId })
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
      catalogService.patchUpdateDraftDescriptor(
        mockEService.id,
        mockDescriptor.id,
        {},
        getMockContextM2MAdmin({ organizationId: mockEService.producerId })
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

      expect(
        catalogService.patchUpdateDraftDescriptor(
          eservice.id,
          descriptor.id,
          {},
          getMockContextM2MAdmin({ organizationId: eservice.producerId })
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
      catalogService.patchUpdateDraftDescriptor(
        eservice.id,
        descriptor.id,
        {},
        getMockContextM2MAdmin({})
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
      catalogService.patchUpdateDraftDescriptor(
        eservice.id,
        descriptor.id,
        {},
        getMockContextM2MAdmin({ organizationId: eservice.producerId })
      )
    ).rejects.toThrowError(operationForbidden);
  });

  it.each([
    { dailyCallsPerConsumer: 300, dailyCallsTotal: 200 },
    { dailyCallsPerConsumer: 300 },
    { dailyCallsTotal: 50 },
  ])(
    "should throw inconsistentDailyCalls if dailyCallsPerConsumer is greater than dailyCallsTotal",
    async (seed) => {
      const descriptor: Descriptor = {
        ...mockDescriptor,
        state: descriptorState.draft,
        dailyCallsPerConsumer: 100,
        dailyCallsTotal: 200,
      };
      const eservice: EService = {
        ...mockEService,
        descriptors: [descriptor],
      };
      await addOneEService(eservice);

      expect(
        catalogService.patchUpdateDraftDescriptor(
          eservice.id,
          descriptor.id,
          seed,
          getMockContextM2MAdmin({ organizationId: eservice.producerId })
        )
      ).rejects.toThrowError(inconsistentDailyCalls());
    }
  );

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

    expect(
      catalogService.patchUpdateDraftDescriptor(
        eservice.id,
        descriptor.id,
        {
          attributes: {
            certified: [],
            declared: [
              [
                {
                  id: declaredAttribute.id,
                  explicitAttributeVerification: false,
                },
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
        },
        getMockContextM2MAdmin({ organizationId: eservice.producerId })
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
      catalogService.patchUpdateDraftDescriptor(
        eservice.id,
        descriptor.id,
        {},
        getMockContextM2MAdmin({ organizationId: eservice.producerId })
      )
    ).rejects.toThrowError(
      templateInstanceNotAllowed(eservice.id, template.id)
    );
  });
});
