/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { fail } from "assert";
import {
  Descriptor,
  DescriptorId,
  EService,
  PurposeTemplate,
  PurposeTemplateEServiceUnlinkedV2,
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
  disassociationEServicesFromPurposeTemplateFailed,
  purposeTemplateNotFound,
  tooManyEServicesForPurposeTemplate,
  associationBetweenEServiceAndPurposeTemplateDoesNotExist,
} from "../../src/model/domain/errors.js";
import {
  addOneEService,
  addOnePurposeTemplate,
  addOnePurposeTemplateEServiceDescriptor,
  addOneTenant,
  purposeTemplateService,
  readLastPurposeTemplateEvent,
} from "../integrationUtils.js";
import { config } from "../../src/config/config.js";
import {
  eserviceNotAssociatedError,
  eserviceNotFound,
} from "../../src/errors/purposeTemplateValidationErrors.js";

describe("unlinkEservicesFromPurposeTemplate", () => {
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

  it("should write on event-store for unlinking eservices from purpose template", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date());

    await addOneTenant(tenant);
    await addOnePurposeTemplate(purposeTemplate);
    await addOneEService(eService1);
    await addOneEService(eService2);
    await addOnePurposeTemplateEServiceDescriptor({
      purposeTemplateId: purposeTemplate.id,
      eserviceId: eService1.id,
      descriptorId: descriptor1.id,
      createdAt: new Date(),
    });
    await addOnePurposeTemplateEServiceDescriptor({
      purposeTemplateId: purposeTemplate.id,
      eserviceId: eService2.id,
      descriptorId: descriptor2.id,
      createdAt: new Date(),
    });

    const eserviceIds = [eService1.id, eService2.id];
    await purposeTemplateService.unlinkEservicesFromPurposeTemplate(
      purposeTemplate.id,
      eserviceIds,
      getMockContext({
        authData: getMockAuthData(tenant.id),
      })
    );

    const writtenEvent1 = await readLastPurposeTemplateEvent(
      purposeTemplate.id
    );

    if (!writtenEvent1) {
      fail("Event not found in event-store for eservice1");
    }

    expect(writtenEvent1).toMatchObject({
      stream_id: purposeTemplate.id,
      version: "2",
      type: "PurposeTemplateEServiceUnlinked",
      event_version: 2,
    });

    const writtenPayload1 = decodeProtobufPayload({
      messageType: PurposeTemplateEServiceUnlinkedV2,
      payload: writtenEvent1.data,
    });

    expect(writtenPayload1.purposeTemplate).toEqual(
      toPurposeTemplateV2(purposeTemplate)
    );
    expect(writtenPayload1.eservice).toEqual(toEServiceV2(eService2));
    expect(writtenPayload1.descriptorId).toBe(descriptor2.id);

    vi.useRealTimers();
  });

  it("should throw purposeTemplateNotFound if the purpose template doesn't exist", async () => {
    const nonExistentPurposeTemplateId = generateId<PurposeTemplateId>();
    await addOneEService(eService1);

    await expect(
      purposeTemplateService.unlinkEservicesFromPurposeTemplate(
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

    await addOneTenant(tenant);
    await addOnePurposeTemplate(purposeTemplate);

    await expect(
      purposeTemplateService.unlinkEservicesFromPurposeTemplate(
        purposeTemplate.id,
        [nonExistentEServiceId],
        getMockContext({
          authData: getMockAuthData(tenant.id),
        })
      )
    ).rejects.toThrowError(
      disassociationEServicesFromPurposeTemplateFailed(
        [eserviceNotFound(nonExistentEServiceId)],
        [nonExistentEServiceId],
        purposeTemplate.id
      )
    );
  });

  it("should throw tooManyEServicesForPurposeTemplate if too many eservices are provided", async () => {
    const manyEServices: EServiceId[] = Array.from(
      { length: config.maxEServicesPerLinkRequest + 1 },
      () => generateId<EServiceId>()
    );

    await addOneTenant(tenant);
    await addOnePurposeTemplate(purposeTemplate);

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
      purposeTemplateService.unlinkEservicesFromPurposeTemplate(
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

  it("should throw associationBetweenEServiceAndPurposeTemplateDoesNotExist if eservice is not associated", async () => {
    await addOneTenant(tenant);
    await addOneEService(eService1);
    await addOnePurposeTemplate(purposeTemplate);

    await expect(
      purposeTemplateService.unlinkEservicesFromPurposeTemplate(
        purposeTemplate.id,
        [eService1.id],
        getMockContext({
          authData: getMockAuthData(tenant.id),
        })
      )
    ).rejects.toThrowError(
      associationBetweenEServiceAndPurposeTemplateDoesNotExist(
        [eserviceNotAssociatedError(eService1.id, purposeTemplate.id)],
        [eService1.id],
        purposeTemplate.id
      )
    );
  });

  it("should handle mixed valid and invalid eserviceIds", async () => {
    const nonExistentEServiceId = generateId<EServiceId>();

    await addOneTenant(tenant);
    await addOneEService(eService1);
    await addOnePurposeTemplate(purposeTemplate);

    await addOnePurposeTemplateEServiceDescriptor({
      purposeTemplateId: purposeTemplate.id,
      eserviceId: eService1.id,
      descriptorId: descriptor1.id,
      createdAt: new Date(),
    });

    await expect(
      purposeTemplateService.unlinkEservicesFromPurposeTemplate(
        purposeTemplate.id,
        [eService1.id, nonExistentEServiceId],
        getMockContext({
          authData: getMockAuthData(tenant.id),
        })
      )
    ).rejects.toThrowError(
      disassociationEServicesFromPurposeTemplateFailed(
        [eserviceNotFound(nonExistentEServiceId)],
        [eService1.id, nonExistentEServiceId],
        purposeTemplate.id
      )
    );
  });

  it("should handle mixed associated and non-associated eserviceIds", async () => {
    const nonAssociatedEServiceId = generateId<EServiceId>();

    await addOneTenant(tenant);
    await addOneEService(eService1);
    await addOneEService({
      ...getMockEService(),
      id: nonAssociatedEServiceId,
      producerId: tenant.id,
      descriptors: [getMockDescriptor()],
    });
    await addOnePurposeTemplate(purposeTemplate);

    await addOnePurposeTemplateEServiceDescriptor({
      purposeTemplateId: purposeTemplate.id,
      eserviceId: eService1.id,
      descriptorId: descriptor1.id,
      createdAt: new Date(),
    });

    await expect(
      purposeTemplateService.unlinkEservicesFromPurposeTemplate(
        purposeTemplate.id,
        [eService1.id, nonAssociatedEServiceId],
        getMockContext({
          authData: getMockAuthData(tenant.id),
        })
      )
    ).rejects.toThrowError(
      associationBetweenEServiceAndPurposeTemplateDoesNotExist(
        [
          eserviceNotAssociatedError(
            nonAssociatedEServiceId,
            purposeTemplate.id
          ),
        ],
        [eService1.id, nonAssociatedEServiceId],
        purposeTemplate.id
      )
    );
  });
});
