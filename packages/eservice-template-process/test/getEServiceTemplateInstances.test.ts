/* eslint-disable functional/no-let */
import { genericLogger } from "pagopa-interop-commons";
import {
  getMockAuthData,
  getMockDescriptor,
  getMockEService,
  getMockEServiceTemplate,
  getMockEServiceTemplateVersion,
  getMockTenant,
} from "pagopa-interop-commons-test";
import {
  EService,
  generateId,
  descriptorState,
  EServiceTemplateVersion,
  eserviceTemplateVersionState,
  EServiceTemplate,
  Tenant,
  Descriptor,
  operationForbidden,
  EServiceTemplateId,
} from "pagopa-interop-models";
import { beforeEach, expect, describe, it } from "vitest";
import { EServiceTemplateInstance } from "../src/model/domain/models.js";
import { eServiceTemplateNotFound } from "../src/model/domain/errors.js";
import {
  addOneEService,
  addOneEServiceTemplate,
  addOneTenant,
  eserviceTemplateService,
} from "./utils.js";

function toMockEServiceTemplateInstance(
  eservice: EService,
  descriptor: Descriptor,
  eserviceTemplateVersion: EServiceTemplateVersion,
  tenant: Tenant
): EServiceTemplateInstance {
  return {
    id: eservice.id,
    producerName: tenant.name,
    state: descriptor.state,
    version: eserviceTemplateVersion.version,
    instanceId: eservice.templateRef?.instanceId,
  };
}

describe("getEServiceTemplateInstances", () => {
  let publishedEServiceTemplateVersion: EServiceTemplateVersion;
  let deprecatedEServiceTemplateVersion: EServiceTemplateVersion;
  let eserviceTemplateMock: EServiceTemplate;
  let tenant: Tenant;
  let tenant2: Tenant;

  beforeEach(async () => {
    publishedEServiceTemplateVersion = {
      ...getMockEServiceTemplateVersion(),
      state: eserviceTemplateVersionState.published,
      version: 2,
    };
    deprecatedEServiceTemplateVersion = {
      ...getMockEServiceTemplateVersion(),
      state: eserviceTemplateVersionState.deprecated,
      version: 1,
    };
    eserviceTemplateMock = {
      ...getMockEServiceTemplate(),
      versions: [
        deprecatedEServiceTemplateVersion,
        publishedEServiceTemplateVersion,
      ],
    };
    await addOneEServiceTemplate(eserviceTemplateMock);

    tenant = { ...getMockTenant(), name: "Tenant 1" };
    await addOneTenant(tenant);
    tenant2 = { ...getMockTenant(), name: "Tenant 2" };
    await addOneTenant(tenant2);
  });

  it("should get the template instances if they exist", async () => {
    const publishedDescriptor: Descriptor = {
      ...getMockDescriptor(),
      state: descriptorState.published,
      templateVersionRef: { id: deprecatedEServiceTemplateVersion.id },
      version: "1",
    };

    const draftDescriptor: Descriptor = {
      ...getMockDescriptor(),
      state: descriptorState.draft,
      templateVersionRef: { id: publishedEServiceTemplateVersion.id },
      version: "2",
    };

    const eservice1: EService = {
      ...getMockEService(),
      producerId: tenant.id,
      descriptors: [publishedDescriptor, draftDescriptor],
      templateRef: { id: eserviceTemplateMock.id },
    };

    await addOneEService(eservice1);

    const suspendedDescriptor1: Descriptor = {
      ...getMockDescriptor(),
      state: descriptorState.suspended,
      templateVersionRef: { id: publishedEServiceTemplateVersion.id },
      version: "1",
    };

    const eservice2: EService = {
      ...getMockEService(),
      producerId: tenant2.id,
      descriptors: [suspendedDescriptor1],
      templateRef: { id: eserviceTemplateMock.id },
    };

    await addOneEService(eservice2);

    const archivedDescriptor1: Descriptor = {
      ...getMockDescriptor(),
      state: descriptorState.archived,
      templateVersionRef: { id: publishedEServiceTemplateVersion.id },
      version: "1",
    };

    const eservice3: EService = {
      ...getMockEService(),
      producerId: tenant2.id,
      descriptors: [archivedDescriptor1],
      templateRef: { id: eserviceTemplateMock.id },
    };

    await addOneEService(eservice3);

    const result = await eserviceTemplateService.getEServiceTemplateIstances(
      eserviceTemplateMock.id,
      {
        states: [],
      },
      0,
      50,
      {
        logger: genericLogger,
        authData: getMockAuthData(eserviceTemplateMock.creatorId),
        correlationId: generateId(),
        serviceName: "",
      }
    );
    expect(result.totalCount).toBe(3);
    expect(result.results).toEqual([
      toMockEServiceTemplateInstance(
        eservice1,
        publishedDescriptor,
        deprecatedEServiceTemplateVersion,
        tenant
      ),
      toMockEServiceTemplateInstance(
        eservice3,
        archivedDescriptor1,
        publishedEServiceTemplateVersion,
        tenant2
      ),
      toMockEServiceTemplateInstance(
        eservice2,
        suspendedDescriptor1,
        publishedEServiceTemplateVersion,
        tenant2
      ),
    ]);
  });

  it("should get the template instances if they exist (filtered by state)", async () => {
    const publishedDescriptor: Descriptor = {
      ...getMockDescriptor(),
      state: descriptorState.published,
      templateVersionRef: { id: deprecatedEServiceTemplateVersion.id },
      version: "1",
    };

    const draftDescriptor: Descriptor = {
      ...getMockDescriptor(),
      state: descriptorState.draft,
      templateVersionRef: { id: publishedEServiceTemplateVersion.id },
      version: "2",
    };

    const eservice1: EService = {
      ...getMockEService(),
      producerId: tenant.id,
      descriptors: [publishedDescriptor, draftDescriptor],
      templateRef: { id: eserviceTemplateMock.id },
    };

    await addOneEService(eservice1);

    const suspendedDescriptor1: Descriptor = {
      ...getMockDescriptor(),
      state: descriptorState.suspended,
      templateVersionRef: { id: publishedEServiceTemplateVersion.id },
      version: "1",
    };

    const eservice2: EService = {
      ...getMockEService(),
      producerId: tenant2.id,
      descriptors: [suspendedDescriptor1],
      templateRef: { id: eserviceTemplateMock.id },
    };

    await addOneEService(eservice2);

    const result = await eserviceTemplateService.getEServiceTemplateIstances(
      eserviceTemplateMock.id,
      {
        states: [descriptorState.suspended],
      },
      0,
      50,
      {
        logger: genericLogger,
        authData: getMockAuthData(eserviceTemplateMock.creatorId),
        correlationId: generateId(),
        serviceName: "",
      }
    );
    expect(result.totalCount).toBe(1);
    expect(result.results).toEqual([
      toMockEServiceTemplateInstance(
        eservice2,
        suspendedDescriptor1,
        publishedEServiceTemplateVersion,
        tenant2
      ),
    ]);
  });

  it("should get the template instances if they exist (filtered by producerName)", async () => {
    const publishedDescriptor: Descriptor = {
      ...getMockDescriptor(),
      state: descriptorState.published,
      templateVersionRef: { id: deprecatedEServiceTemplateVersion.id },
      version: "1",
    };

    const draftDescriptor: Descriptor = {
      ...getMockDescriptor(),
      state: descriptorState.draft,
      templateVersionRef: { id: publishedEServiceTemplateVersion.id },
      version: "2",
    };

    const eservice1: EService = {
      ...getMockEService(),
      producerId: tenant.id,
      descriptors: [publishedDescriptor, draftDescriptor],
      templateRef: { id: eserviceTemplateMock.id },
    };

    await addOneEService(eservice1);

    const suspendedDescriptor1: Descriptor = {
      ...getMockDescriptor(),
      state: descriptorState.suspended,
      templateVersionRef: { id: publishedEServiceTemplateVersion.id },
      version: "1",
    };

    const eservice2: EService = {
      ...getMockEService(),
      producerId: tenant2.id,
      descriptors: [suspendedDescriptor1],
      templateRef: { id: eserviceTemplateMock.id },
    };

    await addOneEService(eservice2);

    const archivedDescriptor1: Descriptor = {
      ...getMockDescriptor(),
      state: descriptorState.archived,
      templateVersionRef: { id: publishedEServiceTemplateVersion.id },
      version: "1",
    };

    const eservice3: EService = {
      ...getMockEService(),
      producerId: tenant2.id,
      descriptors: [archivedDescriptor1],
      templateRef: { id: eserviceTemplateMock.id },
    };

    await addOneEService(eservice3);

    const result = await eserviceTemplateService.getEServiceTemplateIstances(
      eserviceTemplateMock.id,
      {
        states: [],
        producerName: "Tenant 2",
      },
      0,
      50,
      {
        logger: genericLogger,
        authData: getMockAuthData(eserviceTemplateMock.creatorId),
        correlationId: generateId(),
        serviceName: "",
      }
    );
    expect(result.totalCount).toBe(2);
    expect(result.results).toEqual([
      toMockEServiceTemplateInstance(
        eservice3,
        archivedDescriptor1,
        publishedEServiceTemplateVersion,
        tenant2
      ),
      toMockEServiceTemplateInstance(
        eservice2,
        suspendedDescriptor1,
        publishedEServiceTemplateVersion,
        tenant2
      ),
    ]);
  });

  it("should get the template instances if they exist (filtered by producerName, state)", async () => {
    const publishedDescriptor: Descriptor = {
      ...getMockDescriptor(),
      state: descriptorState.published,
      templateVersionRef: { id: deprecatedEServiceTemplateVersion.id },
      version: "1",
    };

    const draftDescriptor: Descriptor = {
      ...getMockDescriptor(),
      state: descriptorState.draft,
      templateVersionRef: { id: publishedEServiceTemplateVersion.id },
      version: "2",
    };

    const eservice1: EService = {
      ...getMockEService(),
      producerId: tenant.id,
      descriptors: [publishedDescriptor, draftDescriptor],
      templateRef: { id: eserviceTemplateMock.id },
    };

    await addOneEService(eservice1);

    const suspendedDescriptor1: Descriptor = {
      ...getMockDescriptor(),
      state: descriptorState.suspended,
      templateVersionRef: { id: publishedEServiceTemplateVersion.id },
      version: "1",
    };

    const eservice2: EService = {
      ...getMockEService(),
      producerId: tenant2.id,
      descriptors: [suspendedDescriptor1],
      templateRef: { id: eserviceTemplateMock.id },
    };

    await addOneEService(eservice2);

    const archivedDescriptor1: Descriptor = {
      ...getMockDescriptor(),
      state: descriptorState.archived,
      templateVersionRef: { id: publishedEServiceTemplateVersion.id },
      version: "1",
    };

    const eservice3: EService = {
      ...getMockEService(),
      producerId: tenant2.id,
      descriptors: [archivedDescriptor1],
      templateRef: { id: eserviceTemplateMock.id },
    };

    await addOneEService(eservice3);

    const result = await eserviceTemplateService.getEServiceTemplateIstances(
      eserviceTemplateMock.id,
      {
        states: [descriptorState.archived],
        producerName: "Tenant 2",
      },
      0,
      50,
      {
        logger: genericLogger,
        authData: getMockAuthData(eserviceTemplateMock.creatorId),
        correlationId: generateId(),
        serviceName: "",
      }
    );
    expect(result.totalCount).toBe(1);
    expect(result.results).toEqual([
      toMockEServiceTemplateInstance(
        eservice3,
        archivedDescriptor1,
        publishedEServiceTemplateVersion,
        tenant2
      ),
    ]);
  });

  it("should throw eserviceTemplateNotFound if the e-service template does not exist", async () => {
    const eserviceTemplateIdNotExist = generateId<EServiceTemplateId>();
    await expect(
      eserviceTemplateService.getEServiceTemplateIstances(
        eserviceTemplateIdNotExist,
        {
          states: [],
        },
        0,
        50,
        {
          logger: genericLogger,
          authData: getMockAuthData(),
          correlationId: generateId(),
          serviceName: "",
        }
      )
    ).rejects.toThrowError(
      eServiceTemplateNotFound(eserviceTemplateIdNotExist)
    );
  });

  it("should throw operationForbidden if the requester is not the e-service template creator", async () => {
    await expect(
      eserviceTemplateService.getEServiceTemplateIstances(
        eserviceTemplateMock.id,
        {
          states: [],
        },
        0,
        50,
        {
          logger: genericLogger,
          authData: getMockAuthData(),
          correlationId: generateId(),
          serviceName: "",
        }
      )
    ).rejects.toThrowError(operationForbidden);
  });
});
