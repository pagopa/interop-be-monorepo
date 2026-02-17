/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/no-floating-promises */
import { eserviceTemplateApi } from "pagopa-interop-api-clients";
import {
  decodeProtobufPayload,
  getMockEServiceTemplate,
  getMockEServiceTemplateVersion,
  getMockDocument,
  getMockAttribute,
  getMockContextM2MAdmin,
} from "pagopa-interop-commons-test";
import {
  EServiceTemplateVersion,
  eserviceTemplateVersionState,
  EServiceTemplate,
  Attribute,
  AttributeId,
  generateId,
  EServiceTemplateDraftVersionUpdatedV2,
  toEServiceTemplateV2,
  operationForbidden,
} from "pagopa-interop-models";
import { expect, describe, it, beforeEach } from "vitest";
import {
  inconsistentDailyCalls,
  attributeNotFound,
  eserviceTemplateNotFound,
  eserviceTemplateVersionNotFound,
  notValidEServiceTemplateVersionState,
} from "../../src/model/domain/errors.js";
import {
  addOneAttribute,
  addOneEServiceTemplate,
  eserviceTemplateService,
  readLastEserviceTemplateEvent,
} from "../integrationUtils.js";
import { apiAgreementApprovalPolicyToAgreementApprovalPolicy } from "../../src/model/domain/apiConverter.js";

describe("patchUpdateDraftTemplateVersion", () => {
  const mockTemplateVersion = getMockEServiceTemplateVersion();
  const mockEServiceTemplate = getMockEServiceTemplate();
  const mockDocument = getMockDocument();

  const certifiedAttribute: Attribute = getMockAttribute("Certified");

  const verifiedAttribute: Attribute = getMockAttribute("Verified");

  const declaredAttribute: Attribute = getMockAttribute("Declared");

  beforeEach(async () => {
    await addOneAttribute(certifiedAttribute);
    await addOneAttribute(verifiedAttribute);
    await addOneAttribute(declaredAttribute);
  });

  it("should write on event-store for the update of a draft template version", async () => {
    const templateVersion: EServiceTemplateVersion = {
      ...mockTemplateVersion,
      state: eserviceTemplateVersionState.draft,
    };
    const eserviceTemplate: EServiceTemplate = {
      ...mockEServiceTemplate,
      versions: [templateVersion],
    };
    await addOneEServiceTemplate(eserviceTemplate);

    const versionSeed: eserviceTemplateApi.PatchUpdateEServiceTemplateVersionSeed =
      {
        description: "new description",
        voucherLifespan: 1000,
        dailyCallsPerConsumer: 100,
        dailyCallsTotal: 200,
        agreementApprovalPolicy: "AUTOMATIC",
        attributes: {
          certified: [
            [
              {
                id: certifiedAttribute.id,
                explicitAttributeVerification: false,
              },
            ],
          ],
          declared: [
            [
              {
                id: declaredAttribute.id,
                explicitAttributeVerification: false,
              },
            ],
          ],
          verified: [
            [
              {
                id: verifiedAttribute.id,
                explicitAttributeVerification: false,
              },
            ],
          ],
        },
      };

    const expectedEServiceTemplate: EServiceTemplate = {
      ...eserviceTemplate,
      versions: [
        {
          ...templateVersion,
          description: versionSeed.description!,
          voucherLifespan: versionSeed.voucherLifespan!,
          dailyCallsPerConsumer: versionSeed.dailyCallsPerConsumer!,
          dailyCallsTotal: versionSeed.dailyCallsTotal!,
          agreementApprovalPolicy:
            apiAgreementApprovalPolicyToAgreementApprovalPolicy(
              versionSeed.agreementApprovalPolicy!
            ),
          attributes:
            versionSeed.attributes! as EServiceTemplateVersion["attributes"],
        },
      ],
    };
    const updateVersionResponse =
      await eserviceTemplateService.patchUpdateDraftTemplateVersion(
        eserviceTemplate.id,
        templateVersion.id,
        versionSeed,
        getMockContextM2MAdmin({ organizationId: eserviceTemplate.creatorId })
      );
    const writtenEvent = await readLastEserviceTemplateEvent(
      eserviceTemplate.id
    );
    expect(writtenEvent).toMatchObject({
      stream_id: eserviceTemplate.id,
      version: "1",
      type: "EServiceTemplateDraftVersionUpdated",
      event_version: 2,
    });
    const writtenPayload = decodeProtobufPayload({
      messageType: EServiceTemplateDraftVersionUpdatedV2,
      payload: writtenEvent.data,
    });
    expect(writtenPayload).toEqual({
      eserviceTemplate: toEServiceTemplateV2(expectedEServiceTemplate),
      eserviceTemplateVersionId: templateVersion.id,
    });
    expect(updateVersionResponse).toEqual({
      data: expectedEServiceTemplate,
      metadata: { version: 1 },
    });
  });

  it.each([
    {}, // This should not throw an error and leave all fields unchanged
    {
      description: "new description",
    },
    {
      description: "new description",
      voucherLifespan: 1000,
    },
    {
      description: "new description",
      voucherLifespan: 1000,
      dailyCallsPerConsumer: 100,
      dailyCallsTotal: 200,
      agreementApprovalPolicy: "AUTOMATIC",
    },
    {
      description: "new description",
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
    {
      dailyCallsPerConsumer: null,
    },
    {
      dailyCallsTotal: null,
    },
    {
      agreementApprovalPolicy: null,
    },
  ] as eserviceTemplateApi.PatchUpdateEServiceTemplateVersionSeed[])(
    `should write on event-store, update only the fields set in the seed and delete fields set to null (seed #%#)`,
    async (seed) => {
      const templateVersion: EServiceTemplateVersion = {
        ...mockTemplateVersion,
        state: eserviceTemplateVersionState.draft,
        description: "Some description",
      };
      const eserviceTemplate: EServiceTemplate = {
        ...mockEServiceTemplate,
        versions: [templateVersion],
      };
      await addOneEServiceTemplate(eserviceTemplate);
      const attribute: Attribute = {
        name: "Attribute name",
        id: generateId(),
        kind: "Declared",
        description: "Attribute Description",
        creationTime: new Date(),
      };
      await addOneAttribute(attribute);

      const expectedEServiceTemplate: EServiceTemplate = {
        ...eserviceTemplate,
        versions: [
          {
            ...templateVersion,
            description: seed.description ?? templateVersion.description,
            voucherLifespan:
              seed.voucherLifespan ?? templateVersion.voucherLifespan,
            dailyCallsPerConsumer:
              seed.dailyCallsPerConsumer === null
                ? undefined
                : (seed.dailyCallsPerConsumer ??
                  templateVersion.dailyCallsPerConsumer),
            dailyCallsTotal:
              seed.dailyCallsTotal === null
                ? undefined
                : (seed.dailyCallsTotal ?? templateVersion.dailyCallsTotal),
            agreementApprovalPolicy: seed.agreementApprovalPolicy
              ? apiAgreementApprovalPolicyToAgreementApprovalPolicy(
                  seed.agreementApprovalPolicy
                )
              : seed.agreementApprovalPolicy === null
                ? undefined
                : templateVersion.agreementApprovalPolicy,
            attributes: (seed.attributes
              ? {
                  certified:
                    seed.attributes.certified ??
                    templateVersion.attributes.certified,
                  declared:
                    seed.attributes.declared ??
                    templateVersion.attributes.declared,
                  verified:
                    seed.attributes.verified ??
                    templateVersion.attributes.verified,
                }
              : templateVersion.attributes) as EServiceTemplateVersion["attributes"],
          },
        ],
      };
      const updateVersionResponse =
        await eserviceTemplateService.patchUpdateDraftTemplateVersion(
          eserviceTemplate.id,
          templateVersion.id,
          seed,
          getMockContextM2MAdmin({ organizationId: eserviceTemplate.creatorId })
        );
      const writtenEvent = await readLastEserviceTemplateEvent(
        eserviceTemplate.id
      );
      expect(writtenEvent).toMatchObject({
        stream_id: eserviceTemplate.id,
        version: "1",
        type: "EServiceTemplateDraftVersionUpdated",
        event_version: 2,
      });
      const writtenPayload = decodeProtobufPayload({
        messageType: EServiceTemplateDraftVersionUpdatedV2,
        payload: writtenEvent.data,
      });
      expect(writtenPayload).toEqual({
        eserviceTemplate: toEServiceTemplateV2(expectedEServiceTemplate),
        eserviceTemplateVersionId: templateVersion.id,
      });
      expect(updateVersionResponse).toEqual({
        data: expectedEServiceTemplate,
        metadata: { version: 1 },
      });
    }
  );

  it("should throw eserviceTemplateNotFound if the eservice template doesn't exist", async () => {
    const templateVersion: EServiceTemplateVersion = {
      ...mockTemplateVersion,
      interface: mockDocument,
      state: eserviceTemplateVersionState.published,
    };
    await expect(
      eserviceTemplateService.patchUpdateDraftTemplateVersion(
        mockEServiceTemplate.id,
        templateVersion.id,
        {},
        getMockContextM2MAdmin({
          organizationId: mockEServiceTemplate.creatorId,
        })
      )
    ).rejects.toThrowError(eserviceTemplateNotFound(mockEServiceTemplate.id));
  });

  it("should throw eserviceTemplateVersionNotFound if the version doesn't exist", async () => {
    const eserviceTemplate: EServiceTemplate = {
      ...mockEServiceTemplate,
      versions: [],
    };
    await addOneEServiceTemplate(eserviceTemplate);

    await expect(
      eserviceTemplateService.patchUpdateDraftTemplateVersion(
        mockEServiceTemplate.id,
        mockTemplateVersion.id,
        {},
        getMockContextM2MAdmin({
          organizationId: mockEServiceTemplate.creatorId,
        })
      )
    ).rejects.toThrowError(
      eserviceTemplateVersionNotFound(
        eserviceTemplate.id,
        mockTemplateVersion.id
      )
    );
  });

  it.each(
    Object.values(eserviceTemplateVersionState).filter(
      (state) => state !== eserviceTemplateVersionState.draft
    )
  )(
    "should throw notValidEServiceTemplateVersionState if the version is in %s state",
    async (state) => {
      const templateVersion: EServiceTemplateVersion = {
        ...mockTemplateVersion,
        interface: mockDocument,
        state,
      };
      const eserviceTemplate: EServiceTemplate = {
        ...mockEServiceTemplate,
        versions: [templateVersion],
      };
      await addOneEServiceTemplate(eserviceTemplate);

      await expect(
        eserviceTemplateService.patchUpdateDraftTemplateVersion(
          eserviceTemplate.id,
          templateVersion.id,
          {},
          getMockContextM2MAdmin({ organizationId: eserviceTemplate.creatorId })
        )
      ).rejects.toThrowError(
        notValidEServiceTemplateVersionState(mockTemplateVersion.id, state)
      );
    }
  );

  it("should throw operationForbidden if the requester is not the creator", async () => {
    const templateVersion: EServiceTemplateVersion = {
      ...mockTemplateVersion,
      state: eserviceTemplateVersionState.draft,
    };
    const eserviceTemplate: EServiceTemplate = {
      ...mockEServiceTemplate,
      versions: [templateVersion],
    };
    await addOneEServiceTemplate(eserviceTemplate);

    await expect(
      eserviceTemplateService.patchUpdateDraftTemplateVersion(
        eserviceTemplate.id,
        templateVersion.id,
        {},
        getMockContextM2MAdmin({})
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
      const templateVersion: EServiceTemplateVersion = {
        ...mockTemplateVersion,
        state: eserviceTemplateVersionState.draft,
        dailyCallsPerConsumer: 100,
        dailyCallsTotal: 200,
      };
      const eserviceTemplate: EServiceTemplate = {
        ...mockEServiceTemplate,
        versions: [templateVersion],
      };
      await addOneEServiceTemplate(eserviceTemplate);

      await expect(
        eserviceTemplateService.patchUpdateDraftTemplateVersion(
          eserviceTemplate.id,
          templateVersion.id,
          seed,
          getMockContextM2MAdmin({ organizationId: eserviceTemplate.creatorId })
        )
      ).rejects.toThrowError(inconsistentDailyCalls());
    }
  );

  it("should throw attributeNotFound if at least one of the attributes doesn't exist", async () => {
    const templateVersion: EServiceTemplateVersion = {
      ...mockTemplateVersion,
      state: eserviceTemplateVersionState.draft,
      attributes: {
        certified: [],
        declared: [],
        verified: [],
      },
    };
    const eserviceTemplate: EServiceTemplate = {
      ...mockEServiceTemplate,
      versions: [templateVersion],
    };
    await addOneEServiceTemplate(eserviceTemplate);

    const notExistingId1 = generateId<AttributeId>();
    const notExistingId2 = generateId<AttributeId>();

    await expect(
      eserviceTemplateService.patchUpdateDraftTemplateVersion(
        eserviceTemplate.id,
        templateVersion.id,
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
        getMockContextM2MAdmin({ organizationId: eserviceTemplate.creatorId })
      )
    ).rejects.toThrowError(attributeNotFound(notExistingId1));
  });
});
