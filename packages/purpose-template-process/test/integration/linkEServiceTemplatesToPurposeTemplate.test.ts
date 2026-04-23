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
  EServiceTemplateVersion,
  EServiceTemplateVersionPurposeTemplate,
  PurposeTemplate,
  PurposeTemplateEServiceTemplateLinkedV2,
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
  eserviceTemplateAlreadyAssociatedError,
  eserviceTemplateNotFound,
  invalidEServiceTemplateVersionStateError,
  missingEServiceTemplateVersionError,
  purposeTemplateEServiceTemplatePersonalDataFlagMismatch,
} from "../../src/errors/purposeTemplateValidationErrors.js";
import {
  associationBetweenEServiceTemplateAndPurposeTemplateAlreadyExists,
  associationEServiceTemplatesForPurposeTemplateFailed,
  purposeTemplateNotFound,
  purposeTemplateNotInExpectedStates,
  tooManyEServiceTemplatesForPurposeTemplate,
} from "../../src/model/domain/errors.js";
import { ALLOWED_ESERVICE_TEMPLATE_VERSION_STATES_FOR_PURPOSE_TEMPLATE_ASSOCIATION } from "../../src/services/validators.js";
import {
  addOneEServiceTemplate,
  addOneEServiceTemplateVersionPurposeTemplate,
  addOnePurposeTemplate,
  addOneTenant,
  purposeTemplateService,
  readLastPurposeTemplateEvent,
} from "../integrationUtils.js";

describe("linkEServiceTemplatesToPurposeTemplate", () => {
  const tenant: Tenant = getMockTenant();

  const makeTemplate = (
    versionState: EServiceTemplateVersion["state"] = eserviceTemplateVersionState.published,
    personalData: boolean | undefined = false
  ): EServiceTemplate => {
    const version: EServiceTemplateVersion = {
      ...getMockEServiceTemplateVersion(),
      state: versionState,
    };
    return {
      ...getMockEServiceTemplate(),
      creatorId: tenant.id,
      personalData,
      versions: [version],
    };
  };

  const purposeTemplate: PurposeTemplate = {
    ...getMockPurposeTemplate(),
    creatorId: tenant.id,
    state: purposeTemplateState.draft,
    handlesPersonalData: false,
  };

  it("should write on event-store for linking e-service templates to purpose template", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date());

    const template1 = makeTemplate();
    const template2 = makeTemplate();

    await addOneTenant(tenant);
    await addOnePurposeTemplate(purposeTemplate);
    await addOneEServiceTemplate(template1);
    await addOneEServiceTemplate(template2);

    const linkResponse =
      await purposeTemplateService.linkEServiceTemplatesToPurposeTemplate(
        purposeTemplate.id,
        [template1.id, template2.id],
        getMockContext({ authData: getMockAuthData(tenant.id) })
      );

    expect(linkResponse).toHaveLength(2);
    expect(linkResponse[0]).toMatchObject({
      data: {
        purposeTemplateId: purposeTemplate.id,
        eserviceTemplateId: template1.id,
        eserviceTemplateVersionId: template1.versions[0].id,
        createdAt: new Date(),
      },
      metadata: { version: 2 },
    });
    expect(linkResponse[1]).toMatchObject({
      data: {
        purposeTemplateId: purposeTemplate.id,
        eserviceTemplateId: template2.id,
        eserviceTemplateVersionId: template2.versions[0].id,
        createdAt: new Date(),
      },
      metadata: { version: 2 },
    });

    const lastEvent = await readLastPurposeTemplateEvent(purposeTemplate.id);
    expect(lastEvent.type).toBe("PurposeTemplateEServiceTemplateLinked");
    expect(lastEvent).toMatchObject({
      stream_id: purposeTemplate.id,
      version: "2",
      event_version: 2,
    });

    const eventPayload = decodeProtobufPayload({
      messageType: PurposeTemplateEServiceTemplateLinkedV2,
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
      purposeTemplateService.linkEServiceTemplatesToPurposeTemplate(
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
      purposeTemplateService.linkEServiceTemplatesToPurposeTemplate(
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
      purposeTemplateService.linkEServiceTemplatesToPurposeTemplate(
        otherPurposeTemplate.id,
        [template.id],
        getMockContext({ authData: getMockAuthData(nonCreator) })
      )
    ).rejects.toThrowError(purposeTemplateNotFound(otherPurposeTemplate.id));
  });

  it("should throw associationEServiceTemplatesForPurposeTemplateFailed when template does not exist", async () => {
    const pt: PurposeTemplate = {
      ...purposeTemplate,
      id: generateId<PurposeTemplateId>(),
    };
    await addOnePurposeTemplate(pt);

    const missingId = generateId<EServiceTemplate["id"]>();

    await expect(
      purposeTemplateService.linkEServiceTemplatesToPurposeTemplate(
        pt.id,
        [missingId],
        getMockContext({ authData: getMockAuthData(tenant.id) })
      )
    ).rejects.toThrowError(
      associationEServiceTemplatesForPurposeTemplateFailed(
        [eserviceTemplateNotFound(missingId)],
        [missingId],
        pt.id
      )
    );
  });

  it("should throw associationEServiceTemplatesForPurposeTemplateFailed on personalData mismatch", async () => {
    const pt: PurposeTemplate = {
      ...purposeTemplate,
      id: generateId<PurposeTemplateId>(),
      handlesPersonalData: true,
    };
    const template = makeTemplate(
      eserviceTemplateVersionState.published,
      false
    );
    await addOnePurposeTemplate(pt);
    await addOneEServiceTemplate(template);

    await expect(
      purposeTemplateService.linkEServiceTemplatesToPurposeTemplate(
        pt.id,
        [template.id],
        getMockContext({ authData: getMockAuthData(tenant.id) })
      )
    ).rejects.toThrowError(
      associationEServiceTemplatesForPurposeTemplateFailed(
        [purposeTemplateEServiceTemplatePersonalDataFlagMismatch(template, pt)],
        [template.id],
        pt.id
      )
    );
  });

  it("should return invalid result when template has no versions", async () => {
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

    await expect(
      purposeTemplateService.linkEServiceTemplatesToPurposeTemplate(
        pt.id,
        [template.id],
        getMockContext({ authData: getMockAuthData(tenant.id) })
      )
    ).rejects.toThrowError(
      associationEServiceTemplatesForPurposeTemplateFailed(
        [missingEServiceTemplateVersionError(template.id)],
        [template.id],
        pt.id
      )
    );
  });

  it("should return invalid result when template has only Draft versions", async () => {
    const pt: PurposeTemplate = {
      ...purposeTemplate,
      id: generateId<PurposeTemplateId>(),
    };
    const template = makeTemplate(eserviceTemplateVersionState.draft);
    await addOnePurposeTemplate(pt);
    await addOneEServiceTemplate(template);

    await expect(
      purposeTemplateService.linkEServiceTemplatesToPurposeTemplate(
        pt.id,
        [template.id],
        getMockContext({ authData: getMockAuthData(tenant.id) })
      )
    ).rejects.toThrowError(
      associationEServiceTemplatesForPurposeTemplateFailed(
        [
          invalidEServiceTemplateVersionStateError(
            template.id,
            ALLOWED_ESERVICE_TEMPLATE_VERSION_STATES_FOR_PURPOSE_TEMPLATE_ASSOCIATION
          ),
        ],
        [template.id],
        pt.id
      )
    );
  });

  it("should throw associationBetweenEServiceTemplateAndPurposeTemplateAlreadyExists when already linked", async () => {
    const pt: PurposeTemplate = {
      ...purposeTemplate,
      id: generateId<PurposeTemplateId>(),
    };
    const template = makeTemplate();
    await addOnePurposeTemplate(pt);
    await addOneEServiceTemplate(template);

    const existingLink: EServiceTemplateVersionPurposeTemplate = {
      purposeTemplateId: pt.id,
      eserviceTemplateId: template.id,
      eserviceTemplateVersionId: template.versions[0].id,
      createdAt: new Date(),
    };
    await addOneEServiceTemplateVersionPurposeTemplate(existingLink);

    await expect(
      purposeTemplateService.linkEServiceTemplatesToPurposeTemplate(
        pt.id,
        [template.id],
        getMockContext({ authData: getMockAuthData(tenant.id) })
      )
    ).rejects.toThrowError(
      associationBetweenEServiceTemplateAndPurposeTemplateAlreadyExists(
        [eserviceTemplateAlreadyAssociatedError(template.id, pt.id)],
        [template.id],
        pt.id
      )
    );
  });

  it("should throw tooManyEServiceTemplatesForPurposeTemplate when exceeding limit", async () => {
    const pt: PurposeTemplate = {
      ...purposeTemplate,
      id: generateId<PurposeTemplateId>(),
    };
    await addOnePurposeTemplate(pt);

    const tooMany = Array.from(
      { length: config.maxEServiceTemplatesPerLinkRequest + 1 },
      () => generateId<EServiceTemplate["id"]>()
    );

    await expect(
      purposeTemplateService.linkEServiceTemplatesToPurposeTemplate(
        pt.id,
        tooMany,
        getMockContext({ authData: getMockAuthData(tenant.id) })
      )
    ).rejects.toThrowError(
      tooManyEServiceTemplatesForPurposeTemplate(
        tooMany.length,
        config.maxEServiceTemplatesPerLinkRequest
      )
    );
  });
});
