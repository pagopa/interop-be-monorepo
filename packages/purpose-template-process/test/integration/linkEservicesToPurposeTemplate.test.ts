/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { fail } from "assert";
import {
  Descriptor,
  DescriptorId,
  EService,
  PurposeTemplate,
  PurposeTemplateEServiceLinkedV2,
  Tenant,
  descriptorState,
  generateId,
  purposeTemplateState,
  tenantKind,
  toEServiceV2,
  toPurposeTemplateV2,
  EServiceId,
  PurposeTemplateId,
} from "pagopa-interop-models";
import { describe, expect, it, vi } from "vitest";
import {
  decodeProtobufPayload,
  getMockEService,
  getMockTenant,
  getMockPurposeTemplate,
  getMockDescriptor,
  getMockAuthData,
  getMockContext,
} from "pagopa-interop-commons-test";
import {
  associationEServicesForPurposeTemplateFailed,
  purposeTemplateNotFound,
  tooManyEServicesForPurposeTemplate,
} from "../../src/model/domain/errors.js";
import {
  addOneEService,
  addOnePurposeTemplate,
  addOneTenant,
  purposeTemplateService,
  readLastPurposeTemplateEvent,
} from "../integrationUtils.js";
import { config } from "../../src/config/config.js";
import {
  eserviceNotFound,
  invalidDescriptorStateError,
  missingDescriptorError,
} from "../../src/errors/purposeTemplateValidationErrors.js";

describe("linkEservicesToPurposeTemplate", () => {
  const tenant: Tenant = {
    ...getMockTenant(),
    kind: tenantKind.PA,
  };

  const descriptor1: Descriptor = {
    ...getMockDescriptor(descriptorState.published),
    version: "1",
  };

  const descriptor2: Descriptor = {
    ...getMockDescriptor(descriptorState.published),
    id: generateId<DescriptorId>(),
    version: "2",
  };

  const eService1: EService = {
    ...getMockEService(),
    producerId: tenant.id,
    descriptors: [descriptor1],
  };

  const eService2: EService = {
    ...getMockEService(),
    id: generateId<EServiceId>(),
    producerId: tenant.id,
    descriptors: [descriptor2],
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
      purposeTemplateId: purposeTemplate.id,
      eserviceId: eService1.id,
      descriptorId: descriptor1.id,
      createdAt: new Date(),
    });
    expect(linkResponse[1]).toMatchObject({
      purposeTemplateId: purposeTemplate.id,
      eserviceId: eService2.id,
      descriptorId: descriptor2.id,
      createdAt: new Date(),
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
      purposeTemplateId: purposeTemplate.id,
      eserviceId: eService1.id,
      descriptorId: descriptor1.id,
      createdAt: new Date(),
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
      { length: config.maxEServicesPerLinkRequest + 1 },
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
      id: generateId<EServiceId>(),
      producerId: tenant.id,
      descriptors: [],
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

  it("should throw associationEServicesForPurposeTemplateFailed if eservice has no valid descriptors", async () => {
    const eserviceWithDraftDescriptor: EService = {
      ...getMockEService(),
      id: generateId<EServiceId>(),
      producerId: tenant.id,
      descriptors: [getMockDescriptor(descriptorState.deprecated)],
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
        [
          invalidDescriptorStateError(eserviceWithDraftDescriptor.id, [
            descriptorState.published,
            descriptorState.draft,
          ]),
        ],
        [eserviceWithDraftDescriptor.id],
        purposeTemplate.id
      )
    );
  });

  it("should handle empty eserviceIds array", async () => {
    await addOneTenant(tenant);
    await addOnePurposeTemplate(purposeTemplate);

    const linkResponse =
      await purposeTemplateService.linkEservicesToPurposeTemplate(
        purposeTemplate.id,
        [],
        getMockContext({
          authData: getMockAuthData(tenant.id),
        })
      );

    expect(linkResponse).toEqual([]);
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
});
