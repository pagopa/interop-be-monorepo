/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { fail } from "assert";
import {
  decodeProtobufPayload,
  getMockAuthData,
  getMockContext,
  getMockDescriptor,
  getMockEService,
  getMockPurposeTemplate,
  getMockTenant,
} from "pagopa-interop-commons-test";
import {
  Descriptor,
  EService,
  EServiceId,
  PurposeTemplate,
  PurposeTemplateEServiceLinkedV2,
  PurposeTemplateId,
  Tenant,
  descriptorState,
  generateId,
  purposeTemplateState,
  targetTenantKind,
  toEServiceV2,
  toPurposeTemplateV2,
} from "pagopa-interop-models";
import { describe, expect, it, vi } from "vitest";
import { config } from "../../src/config/config.js";
import {
  eserviceAlreadyAssociatedError,
  eserviceNotFound,
  invalidDescriptorStateError,
  missingDescriptorError,
  purposeTemplateEServicePersonalDataFlagMismatch,
} from "../../src/errors/purposeTemplateValidationErrors.js";
import {
  associationBetweenEServiceAndPurposeTemplateAlreadyExists,
  associationEServicesForPurposeTemplateFailed,
  purposeTemplateNotFound,
  purposeTemplateNotInExpectedStates,
  tooManyEServicesForPurposeTemplate,
} from "../../src/model/domain/errors.js";
import { ALLOWED_DESCRIPTOR_STATES_FOR_PURPOSE_TEMPLATE_ESERVICE_ASSOCIATION } from "../../src/services/validators.js";
import {
  addOneEService,
  addOnePurposeTemplate,
  addOnePurposeTemplateEServiceDescriptor,
  addOneTenant,
  purposeTemplateService,
  readLastPurposeTemplateEvent,
} from "../integrationUtils.js";

describe("linkEservicesToPurposeTemplate", () => {
  const tenant: Tenant = {
    ...getMockTenant(),
    kind: targetTenantKind.PA,
  };

  const descriptor1: Descriptor = {
    ...getMockDescriptor(descriptorState.published),
    version: "1",
  };

  const descriptor2: Descriptor = {
    ...getMockDescriptor(descriptorState.published),
    version: "2",
  };

  const eService1: EService = {
    ...getMockEService(),
    producerId: tenant.id,
    descriptors: [descriptor1],
    personalData: true,
  };

  const eService2: EService = {
    ...getMockEService(),
    producerId: tenant.id,
    descriptors: [descriptor2],
    personalData: true,
  };

  const purposeTemplate: PurposeTemplate = {
    ...getMockPurposeTemplate(),
    creatorId: tenant.id,
    state: purposeTemplateState.draft,
  };

  it("should write on event-store for linking eservices to purpose template", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date());

    await addOneTenant(tenant);
    await addOnePurposeTemplate(purposeTemplate);
    await addOneEService(eService1);
    await addOneEService(eService2);

    const eserviceIds = [eService1.id, eService2.id];
    const linkResponse =
      await purposeTemplateService.linkEservicesToPurposeTemplate(
        purposeTemplate.id,
        eserviceIds,
        getMockContext({
          authData: getMockAuthData(tenant.id),
        })
      );

    expect(linkResponse).toHaveLength(2);
    expect(linkResponse[0]).toMatchObject({
      data: {
        purposeTemplateId: purposeTemplate.id,
        eserviceId: eService1.id,
        descriptorId: descriptor1.id,
        createdAt: new Date(),
      },
      metadata: { version: 2 },
    });
    expect(linkResponse[1]).toMatchObject({
      data: {
        purposeTemplateId: purposeTemplate.id,
        eserviceId: eService2.id,
        descriptorId: descriptor2.id,
        createdAt: new Date(),
      },
      metadata: { version: 2 },
    });

    const lastWrittenEvent = await readLastPurposeTemplateEvent(
      purposeTemplate.id
    );

    if (!lastWrittenEvent) {
      fail("Event not found in event-store for eservice1");
    }

    expect(lastWrittenEvent).toMatchObject({
      stream_id: purposeTemplate.id,
      version: "2",
      type: "PurposeTemplateEServiceLinked",
      event_version: 2,
    });

    const lastWrittenPayload = decodeProtobufPayload({
      messageType: PurposeTemplateEServiceLinkedV2,
      payload: lastWrittenEvent.data,
    });

    expect(lastWrittenPayload.purposeTemplate).toEqual(
      toPurposeTemplateV2(purposeTemplate)
    );
    expect(lastWrittenPayload.eservice).toEqual(toEServiceV2(eService2));
    expect(lastWrittenPayload.descriptorId).toBe(descriptor2.id);

    vi.useRealTimers();
  });

  it("should succeed when linking single eservice to purpose template", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date());

    await addOneTenant(tenant);
    await addOneEService(eService1);
    await addOnePurposeTemplate(purposeTemplate);

    const eserviceIds = [eService1.id];
    const linkResponse =
      await purposeTemplateService.linkEservicesToPurposeTemplate(
        purposeTemplate.id,
        eserviceIds,
        getMockContext({
          authData: getMockAuthData(tenant.id),
        })
      );

    expect(linkResponse).toHaveLength(1);
    expect(linkResponse[0]).toMatchObject({
      data: {
        purposeTemplateId: purposeTemplate.id,
        eserviceId: eService1.id,
        descriptorId: descriptor1.id,
        createdAt: new Date(),
      },
      metadata: { version: 1 },
    });

    vi.useRealTimers();
  });

  it("should throw purposeTemplateNotFound if the purpose template doesn't exist", async () => {
    const nonExistentPurposeTemplateId = generateId<PurposeTemplateId>();
    await addOneEService(eService1);

    await expect(
      purposeTemplateService.linkEservicesToPurposeTemplate(
        nonExistentPurposeTemplateId,
        [eService1.id],
        getMockContext({
          authData: getMockAuthData(tenant.id),
        })
      )
    ).rejects.toThrowError(
      purposeTemplateNotFound(nonExistentPurposeTemplateId)
    );
  });

  it("should throw eserviceNotFound if the eservice doesn't exist", async () => {
    const nonExistentEServiceId = generateId<EServiceId>();

    await addOnePurposeTemplate(purposeTemplate);
    await addOneTenant(tenant);

    await expect(
      purposeTemplateService.linkEservicesToPurposeTemplate(
        purposeTemplate.id,
        [nonExistentEServiceId],
        getMockContext({
          authData: getMockAuthData(tenant.id),
        })
      )
    ).rejects.toThrowError(
      associationEServicesForPurposeTemplateFailed(
        [eserviceNotFound(nonExistentEServiceId)],
        [nonExistentEServiceId],
        purposeTemplate.id
      )
    );
  });

  it("should throw tooManyEServicesForPurposeTemplate if too many eservices are provided", async () => {
    // Create many eservices to exceed the limit
    const manyEServices: EServiceId[] = Array.from(
      { length: Number(config.maxEServicesPerLinkRequest) + 1 },
      () => generateId<EServiceId>()
    );

    await addOneTenant(tenant);
    await addOnePurposeTemplate(purposeTemplate);

    // Add all eservices to the database
    for (const eserviceId of manyEServices) {
      const eservice: EService = {
        ...getMockEService(),
        id: eserviceId,
        producerId: tenant.id,
        descriptors: [getMockDescriptor()],
      };
      await addOneEService(eservice);
    }

    await expect(
      purposeTemplateService.linkEservicesToPurposeTemplate(
        purposeTemplate.id,
        manyEServices,
        getMockContext({
          authData: getMockAuthData(tenant.id),
        })
      )
    ).rejects.toThrowError(
      tooManyEServicesForPurposeTemplate(
        manyEServices.length,
        config.maxEServicesPerLinkRequest
      )
    );
  });

  it("should throw associationEServicesForPurposeTemplateFailed if eservice has no descriptors", async () => {
    const eserviceWithDraftDescriptor: EService = {
      ...getMockEService(),
      producerId: tenant.id,
      descriptors: [],
      personalData: true,
    };

    await addOneTenant(tenant);
    await addOneEService(eserviceWithDraftDescriptor);
    await addOnePurposeTemplate(purposeTemplate);

    await expect(
      purposeTemplateService.linkEservicesToPurposeTemplate(
        purposeTemplate.id,
        [eserviceWithDraftDescriptor.id],
        getMockContext({
          authData: getMockAuthData(tenant.id),
        })
      )
    ).rejects.toThrowError(
      associationEServicesForPurposeTemplateFailed(
        [missingDescriptorError(eserviceWithDraftDescriptor.id)],
        [eserviceWithDraftDescriptor.id],
        purposeTemplate.id
      )
    );
  });

  it("should throw invalidDescriptorStateError when trying to link eservice that has no valid descriptors (descriptors with state different from published)", async () => {
    const descriptor: Descriptor = {
      ...getMockDescriptor(descriptorState.suspended),
      version: "1",
    };

    const eService: EService = {
      ...getMockEService(),
      producerId: tenant.id,
      descriptors: [descriptor],
      personalData: true,
    };

    await addOneTenant(tenant);
    await addOnePurposeTemplate(purposeTemplate);
    await addOneEService(eService);

    await expect(
      purposeTemplateService.linkEservicesToPurposeTemplate(
        purposeTemplate.id,
        [eService.id],
        getMockContext({
          authData: getMockAuthData(tenant.id),
        })
      )
    ).rejects.toThrowError(
      associationEServicesForPurposeTemplateFailed(
        [
          invalidDescriptorStateError(
            eService.id,
            ALLOWED_DESCRIPTOR_STATES_FOR_PURPOSE_TEMPLATE_ESERVICE_ASSOCIATION
          ),
        ],
        [eService.id],
        purposeTemplate.id
      )
    );
  });

  it("should throw associationEServicesForPurposeTemplateFailed if the e-service has a different personal data flag than the purpose template", async () => {
    const eserviceWithDifferentPersonalDataFlag: EService = {
      ...eService1,
      personalData: false,
    };

    await addOneTenant(tenant);
    await addOneEService(eserviceWithDifferentPersonalDataFlag);
    await addOnePurposeTemplate(purposeTemplate);

    await expect(
      purposeTemplateService.linkEservicesToPurposeTemplate(
        purposeTemplate.id,
        [eserviceWithDifferentPersonalDataFlag.id],
        getMockContext({
          authData: getMockAuthData(tenant.id),
        })
      )
    ).rejects.toThrowError(
      associationEServicesForPurposeTemplateFailed(
        [
          purposeTemplateEServicePersonalDataFlagMismatch(
            eserviceWithDifferentPersonalDataFlag,
            purposeTemplate
          ),
        ],
        [eserviceWithDifferentPersonalDataFlag.id],
        purposeTemplate.id
      )
    );
  });

  it("should handle mixed valid and invalid eserviceIds", async () => {
    const nonExistentEServiceId = generateId<EServiceId>();

    await addOneTenant(tenant);
    await addOneEService(eService1);
    await addOnePurposeTemplate(purposeTemplate);

    await expect(
      purposeTemplateService.linkEservicesToPurposeTemplate(
        purposeTemplate.id,
        [eService1.id, nonExistentEServiceId],
        getMockContext({
          authData: getMockAuthData(tenant.id),
        })
      )
    ).rejects.toThrowError(
      associationEServicesForPurposeTemplateFailed(
        [eserviceNotFound(nonExistentEServiceId)],
        [eService1.id, nonExistentEServiceId],
        purposeTemplate.id
      )
    );
  });

  it("should throw purposeTemplateNotInExpectedStates when purpose template is suspended", async () => {
    const suspendedPurposeTemplate: PurposeTemplate = {
      ...getMockPurposeTemplate(),
      creatorId: tenant.id,
      state: purposeTemplateState.suspended,
    };

    await addOneTenant(tenant);
    await addOneEService(eService1);
    await addOnePurposeTemplate(suspendedPurposeTemplate);

    await expect(
      purposeTemplateService.linkEservicesToPurposeTemplate(
        suspendedPurposeTemplate.id,
        [eService1.id],
        getMockContext({
          authData: getMockAuthData(tenant.id),
        })
      )
    ).rejects.toThrowError(
      purposeTemplateNotInExpectedStates(
        suspendedPurposeTemplate.id,
        suspendedPurposeTemplate.state,
        [purposeTemplateState.draft, purposeTemplateState.published]
      )
    );
  });

  it("should throw purposeTemplateNotInExpectedStates when purpose template is archived", async () => {
    const archivedPurposeTemplate: PurposeTemplate = {
      ...getMockPurposeTemplate(),
      creatorId: tenant.id,
      state: purposeTemplateState.archived,
    };

    await addOneTenant(tenant);
    await addOneEService(eService1);
    await addOnePurposeTemplate(archivedPurposeTemplate);

    await expect(
      purposeTemplateService.linkEservicesToPurposeTemplate(
        archivedPurposeTemplate.id,
        [eService1.id],
        getMockContext({
          authData: getMockAuthData(tenant.id),
        })
      )
    ).rejects.toThrowError(
      purposeTemplateNotInExpectedStates(
        archivedPurposeTemplate.id,
        archivedPurposeTemplate.state,
        [purposeTemplateState.draft, purposeTemplateState.published]
      )
    );
  });

  it("should throw purposeTemplateNotFound when user is not the creator of the purpose template", async () => {
    const differentTenant: Tenant = {
      ...getMockTenant(),
      kind: targetTenantKind.PA,
    };

    await addOneTenant(tenant);
    await addOneTenant(differentTenant);
    await addOneEService(eService1);
    await addOnePurposeTemplate(purposeTemplate);

    await expect(
      purposeTemplateService.linkEservicesToPurposeTemplate(
        purposeTemplate.id,
        [eService1.id],
        getMockContext({
          authData: getMockAuthData(differentTenant.id),
        })
      )
    ).rejects.toThrowError(purposeTemplateNotFound(purposeTemplate.id));
  });

  it("should throw eserviceAlreadyAssociatedError when linking the same eservice twice", async () => {
    await addOneEService(eService1);
    await addOnePurposeTemplate(purposeTemplate);

    const firstLinkResponse =
      await purposeTemplateService.linkEservicesToPurposeTemplate(
        purposeTemplate.id,
        [eService1.id],
        getMockContext({
          authData: getMockAuthData(tenant.id),
        })
      );

    expect(firstLinkResponse).toHaveLength(1);
    expect(firstLinkResponse[0]).toMatchObject({
      data: {
        purposeTemplateId: purposeTemplate.id,
        eserviceId: eService1.id,
        descriptorId: descriptor1.id,
      },
      metadata: { version: 1 },
    });

    await addOnePurposeTemplateEServiceDescriptor({
      purposeTemplateId: purposeTemplate.id,
      eserviceId: eService1.id,
      descriptorId: descriptor1.id,
      createdAt: firstLinkResponse[0].data.createdAt,
    });

    await expect(
      purposeTemplateService.linkEservicesToPurposeTemplate(
        purposeTemplate.id,
        [eService1.id],
        getMockContext({
          authData: getMockAuthData(tenant.id),
        })
      )
    ).rejects.toThrowError(
      associationBetweenEServiceAndPurposeTemplateAlreadyExists(
        [eserviceAlreadyAssociatedError(eService1.id, purposeTemplate.id)],
        [eService1.id],
        purposeTemplate.id
      )
    );
  });
});
