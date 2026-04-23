/* eslint-disable @typescript-eslint/no-non-null-assertion */
import {
  decodeProtobufPayload,
  getMockAuthData,
  getMockContext,
  getMockEServiceTemplate,
  getMockEServiceTemplateVersion,
  getMockPurposeTemplate,
  getMockTenant,
} from "pagopa-interop-commons-test";
import {
  EServiceTemplate,
  EServiceTemplateId,
  EServiceTemplateVersion,
  EServiceTemplateVersionId,
  PurposeTemplate,
  PurposeTemplateEServiceTemplateUnlinkedV2,
  PurposeTemplateId,
  Tenant,
  eserviceTemplateVersionState,
  generateId,
  purposeTemplateState,
  toEServiceTemplateV2,
  toPurposeTemplateV2,
} from "pagopa-interop-models";
import { describe, expect, it, vi } from "vitest";
import { config } from "../../src/config/config.js";
import {
  eserviceTemplateNotAssociatedError,
  eserviceTemplateNotFound,
  invalidEServiceTemplateVersionStateError,
  missingEServiceTemplateVersionError,
} from "../../src/errors/purposeTemplateValidationErrors.js";
import {
  associationBetweenEServiceTemplateAndPurposeTemplateDoesNotExist,
  disassociationEServiceTemplatesFromPurposeTemplateFailed,
  purposeTemplateNotFound,
  purposeTemplateNotInExpectedStates,
  tooManyEServiceTemplatesForPurposeTemplate,
} from "../../src/model/domain/errors.js";
import { ALLOWED_ESERVICE_TEMPLATE_VERSION_STATES_FOR_PURPOSE_TEMPLATE_DISASSOCIATION } from "../../src/services/validators.js";
import {
  addOneEServiceTemplate,
  addOneEServiceTemplateVersionPurposeTemplate,
  addOnePurposeTemplate,
  addOneTenant,
  purposeTemplateService,
  readLastPurposeTemplateEvent,
} from "../integrationUtils.js";

describe("unlinkEServiceTemplatesFromPurposeTemplate", () => {
  const tenant: Tenant = getMockTenant();

  const makeTemplate = (
    versionState: EServiceTemplateVersion["state"] = eserviceTemplateVersionState.published
  ): EServiceTemplate => {
    const version: EServiceTemplateVersion = {
      ...getMockEServiceTemplateVersion(),
      state: versionState,
    };
    return {
      ...getMockEServiceTemplate(),
      creatorId: tenant.id,
      personalData: false,
      versions: [version],
    };
  };

  const purposeTemplate: PurposeTemplate = {
    ...getMockPurposeTemplate(),
    creatorId: tenant.id,
    state: purposeTemplateState.draft,
    handlesPersonalData: false,
  };

  it("should write on event-store for unlinking e-service templates from purpose template", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date());

    const template1 = makeTemplate();
    const template2 = makeTemplate();

    await addOneTenant(tenant);
    await addOnePurposeTemplate(purposeTemplate);
    await addOneEServiceTemplate(template1);
    await addOneEServiceTemplate(template2);
    await addOneEServiceTemplateVersionPurposeTemplate({
      purposeTemplateId: purposeTemplate.id,
      eserviceTemplateId: template1.id,
      eserviceTemplateVersionId: template1.versions[0].id,
      createdAt: new Date(),
    });
    await addOneEServiceTemplateVersionPurposeTemplate({
      purposeTemplateId: purposeTemplate.id,
      eserviceTemplateId: template2.id,
      eserviceTemplateVersionId: template2.versions[0].id,
      createdAt: new Date(),
    });

    const unlinkResponse =
      await purposeTemplateService.unlinkEServiceTemplatesFromPurposeTemplate(
        purposeTemplate.id,
        [template1.id, template2.id],
        getMockContext({ authData: getMockAuthData(tenant.id) })
      );

    expect(unlinkResponse).toHaveLength(2);
    expect(unlinkResponse[0]).toMatchObject({
      data: {
        purposeTemplateId: purposeTemplate.id,
        eserviceTemplateId: template1.id,
        eserviceTemplateVersionId: template1.versions[0].id,
        createdAt: new Date(),
      },
      metadata: { version: 2 },
    });
    expect(unlinkResponse[1]).toMatchObject({
      data: {
        purposeTemplateId: purposeTemplate.id,
        eserviceTemplateId: template2.id,
        eserviceTemplateVersionId: template2.versions[0].id,
        createdAt: new Date(),
      },
      metadata: { version: 2 },
    });

    const lastEvent = await readLastPurposeTemplateEvent(purposeTemplate.id);
    expect(lastEvent.type).toBe("PurposeTemplateEServiceTemplateUnlinked");
    expect(lastEvent).toMatchObject({
      stream_id: purposeTemplate.id,
      version: "2",
      event_version: 2,
    });

    const eventPayload = decodeProtobufPayload({
      messageType: PurposeTemplateEServiceTemplateUnlinkedV2,
      payload: lastEvent.data,
    });
    expect(eventPayload.purposeTemplate).toEqual(
      toPurposeTemplateV2(purposeTemplate)
    );
    expect(eventPayload.eserviceTemplate).toEqual(
      toEServiceTemplateV2(template2)
    );
    expect(eventPayload.eserviceTemplateVersionId).toBe(
      template2.versions[0].id
    );

    vi.useRealTimers();
  });

  it("should throw purposeTemplateNotFound if the purpose template does not exist", async () => {
    const notExistingId = generateId<PurposeTemplateId>();
    const template = makeTemplate();
    await addOneEServiceTemplate(template);

    await expect(
      purposeTemplateService.unlinkEServiceTemplatesFromPurposeTemplate(
        notExistingId,
        [template.id],
        getMockContext({ authData: getMockAuthData(tenant.id) })
      )
    ).rejects.toThrowError(purposeTemplateNotFound(notExistingId));
  });

  it("should throw purposeTemplateNotInExpectedStates for a Suspended purpose template", async () => {
    const suspended: PurposeTemplate = {
      ...purposeTemplate,
      id: generateId<PurposeTemplateId>(),
      state: purposeTemplateState.suspended,
    };
    const template = makeTemplate();
    await addOnePurposeTemplate(suspended);
    await addOneEServiceTemplate(template);

    await expect(
      purposeTemplateService.unlinkEServiceTemplatesFromPurposeTemplate(
        suspended.id,
        [template.id],
        getMockContext({ authData: getMockAuthData(tenant.id) })
      )
    ).rejects.toThrowError(
      purposeTemplateNotInExpectedStates(
        suspended.id,
        purposeTemplateState.suspended,
        [purposeTemplateState.draft, purposeTemplateState.published]
      )
    );
  });

  it("should throw purposeTemplateNotFound when requester is not the creator", async () => {
    const otherPurposeTemplate: PurposeTemplate = {
      ...purposeTemplate,
      id: generateId<PurposeTemplateId>(),
    };
    const template = makeTemplate();
    await addOnePurposeTemplate(otherPurposeTemplate);
    await addOneEServiceTemplate(template);

    const nonCreator = generateId<Tenant["id"]>();

    await expect(
      purposeTemplateService.unlinkEServiceTemplatesFromPurposeTemplate(
        otherPurposeTemplate.id,
        [template.id],
        getMockContext({ authData: getMockAuthData(nonCreator) })
      )
    ).rejects.toThrowError(purposeTemplateNotFound(otherPurposeTemplate.id));
  });

  it("should throw disassociationEServiceTemplatesFromPurposeTemplateFailed when template does not exist", async () => {
    const pt: PurposeTemplate = {
      ...purposeTemplate,
      id: generateId<PurposeTemplateId>(),
    };
    await addOnePurposeTemplate(pt);

    const missingId = generateId<EServiceTemplateId>();

    await expect(
      purposeTemplateService.unlinkEServiceTemplatesFromPurposeTemplate(
        pt.id,
        [missingId],
        getMockContext({ authData: getMockAuthData(tenant.id) })
      )
    ).rejects.toThrowError(
      disassociationEServiceTemplatesFromPurposeTemplateFailed(
        [eserviceTemplateNotFound(missingId)],
        [missingId],
        pt.id
      )
    );
  });

  it("should throw associationBetweenEServiceTemplateAndPurposeTemplateDoesNotExist when template is not linked", async () => {
    const pt: PurposeTemplate = {
      ...purposeTemplate,
      id: generateId<PurposeTemplateId>(),
    };
    const template = makeTemplate();
    await addOnePurposeTemplate(pt);
    await addOneEServiceTemplate(template);

    await expect(
      purposeTemplateService.unlinkEServiceTemplatesFromPurposeTemplate(
        pt.id,
        [template.id],
        getMockContext({ authData: getMockAuthData(tenant.id) })
      )
    ).rejects.toThrowError(
      associationBetweenEServiceTemplateAndPurposeTemplateDoesNotExist(
        [eserviceTemplateNotAssociatedError(template.id, pt.id)],
        [template.id],
        pt.id
      )
    );
  });

  it("should throw tooManyEServiceTemplatesForPurposeTemplate if too many templates are provided", async () => {
    const manyIds: EServiceTemplateId[] = Array.from(
      { length: config.maxEServiceTemplatesPerLinkRequest + 1 },
      () => generateId<EServiceTemplateId>()
    );

    await addOneTenant(tenant);
    await addOnePurposeTemplate(purposeTemplate);

    await expect(
      purposeTemplateService.unlinkEServiceTemplatesFromPurposeTemplate(
        purposeTemplate.id,
        manyIds,
        getMockContext({ authData: getMockAuthData(tenant.id) })
      )
    ).rejects.toThrowError(
      tooManyEServiceTemplatesForPurposeTemplate(
        manyIds.length,
        config.maxEServiceTemplatesPerLinkRequest
      )
    );
  });

  it("should throw disassociationEServiceTemplatesFromPurposeTemplateFailed when the template has no versions (defensive)", async () => {
    const pt: PurposeTemplate = {
      ...purposeTemplate,
      id: generateId<PurposeTemplateId>(),
    };
    const template: EServiceTemplate = {
      ...makeTemplate(),
      versions: [],
    };
    await addOnePurposeTemplate(pt);
    await addOneEServiceTemplate(template);
    await addOneEServiceTemplateVersionPurposeTemplate({
      purposeTemplateId: pt.id,
      eserviceTemplateId: template.id,
      eserviceTemplateVersionId: generateId<EServiceTemplateVersionId>(),
      createdAt: new Date(),
    });

    await expect(
      purposeTemplateService.unlinkEServiceTemplatesFromPurposeTemplate(
        pt.id,
        [template.id],
        getMockContext({ authData: getMockAuthData(tenant.id) })
      )
    ).rejects.toThrowError(
      disassociationEServiceTemplatesFromPurposeTemplateFailed(
        [missingEServiceTemplateVersionError(template.id)],
        [template.id],
        pt.id
      )
    );
  });

  it("should throw disassociationEServiceTemplatesFromPurposeTemplateFailed when the crystallised version id is not present in the template versions (defensive)", async () => {
    const pt: PurposeTemplate = {
      ...purposeTemplate,
      id: generateId<PurposeTemplateId>(),
    };
    const template = makeTemplate();
    await addOnePurposeTemplate(pt);
    await addOneEServiceTemplate(template);
    await addOneEServiceTemplateVersionPurposeTemplate({
      purposeTemplateId: pt.id,
      eserviceTemplateId: template.id,
      eserviceTemplateVersionId: generateId<EServiceTemplateVersionId>(),
      createdAt: new Date(),
    });

    await expect(
      purposeTemplateService.unlinkEServiceTemplatesFromPurposeTemplate(
        pt.id,
        [template.id],
        getMockContext({ authData: getMockAuthData(tenant.id) })
      )
    ).rejects.toThrowError(
      disassociationEServiceTemplatesFromPurposeTemplateFailed(
        [eserviceTemplateNotAssociatedError(template.id, pt.id)],
        [template.id],
        pt.id
      )
    );
  });

  it("should throw disassociationEServiceTemplatesFromPurposeTemplateFailed when the crystallised version is in Draft state", async () => {
    const pt: PurposeTemplate = {
      ...purposeTemplate,
      id: generateId<PurposeTemplateId>(),
    };
    const template = makeTemplate(eserviceTemplateVersionState.draft);
    await addOnePurposeTemplate(pt);
    await addOneEServiceTemplate(template);
    await addOneEServiceTemplateVersionPurposeTemplate({
      purposeTemplateId: pt.id,
      eserviceTemplateId: template.id,
      eserviceTemplateVersionId: template.versions[0].id,
      createdAt: new Date(),
    });

    await expect(
      purposeTemplateService.unlinkEServiceTemplatesFromPurposeTemplate(
        pt.id,
        [template.id],
        getMockContext({ authData: getMockAuthData(tenant.id) })
      )
    ).rejects.toThrowError(
      disassociationEServiceTemplatesFromPurposeTemplateFailed(
        [
          invalidEServiceTemplateVersionStateError(
            template.id,
            ALLOWED_ESERVICE_TEMPLATE_VERSION_STATES_FOR_PURPOSE_TEMPLATE_DISASSOCIATION
          ),
        ],
        [template.id],
        pt.id
      )
    );
  });
});
