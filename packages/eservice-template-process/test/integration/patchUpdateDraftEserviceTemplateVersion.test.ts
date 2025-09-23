/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/no-floating-promises */
import {
  decodeProtobufPayload,
  getMockContextM2MAdmin,
  getMockDocument,
  getMockEServiceTemplate,
  getMockEServiceTemplateVersion,
} from "pagopa-interop-commons-test";
import {
  EServiceTemplate,
  EServiceTemplateVersion,
  EServiceTemplateVersionId,
  EServiceTemplateDraftVersionUpdatedV2,
  toEServiceTemplateV2,
  operationForbidden,
  generateId,
  eserviceTemplateVersionState,
  TenantId,
  agreementApprovalPolicy,
} from "pagopa-interop-models";
import { expect, describe, it } from "vitest";
import { eserviceTemplateApi } from "pagopa-interop-api-clients";
import {
  eserviceTemplateNotFound,
  eserviceTemplateVersionNotFound,
  inconsistentDailyCalls,
  notValidEServiceTemplateVersionState,
} from "../../src/model/domain/errors.js";
import {
  eserviceTemplateService,
  addOneEServiceTemplate,
  readLastEserviceTemplateEvent,
} from "../integrationUtils.js";
import { apiAgreementApprovalPolicyToAgreementApprovalPolicy } from "../../src/model/domain/apiConverter.js";

describe("patch update draft eservice template version", () => {
  const eServiceTemplateVersionSeed: eserviceTemplateApi.PatchUpdateEServiceTemplateVersionSeed =
    {
      description: "updated description",
      voucherLifespan: 120,
      dailyCallsPerConsumer: 200,
      dailyCallsTotal: 1000,
      agreementApprovalPolicy: "MANUAL",
    };
  it("should write on event-store for the update of a draft eservice template version", async () => {
    const eserviceTemplateVersion: EServiceTemplateVersion = {
      ...getMockEServiceTemplateVersion(),
      state: eserviceTemplateVersionState.draft,
    };

    const eserviceTemplate: EServiceTemplate = {
      ...getMockEServiceTemplate(),
      versions: [eserviceTemplateVersion],
    };

    await addOneEServiceTemplate(eserviceTemplate);

    const expectedEServiceTemplate: EServiceTemplate = {
      ...eserviceTemplate,
      versions: [
        {
          ...eserviceTemplateVersion,
          description: eServiceTemplateVersionSeed.description!,
          voucherLifespan: eServiceTemplateVersionSeed.voucherLifespan!,
          dailyCallsPerConsumer:
            eServiceTemplateVersionSeed.dailyCallsPerConsumer!,
          dailyCallsTotal: eServiceTemplateVersionSeed.dailyCallsTotal!,
          agreementApprovalPolicy:
            apiAgreementApprovalPolicyToAgreementApprovalPolicy(
              eServiceTemplateVersionSeed.agreementApprovalPolicy!
            ),
        },
      ],
    };

    const updateEServiceTemplateVersionResponse =
      await eserviceTemplateService.patchUpdateDraftTemplateVersion(
        eserviceTemplate.id,
        eserviceTemplateVersion.id,
        eServiceTemplateVersionSeed,
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

    expect(writtenPayload.eserviceTemplate).toEqual(
      toEServiceTemplateV2(expectedEServiceTemplate)
    );
    expect(updateEServiceTemplateVersionResponse).toEqual({
      data: expectedEServiceTemplate,
      metadata: { version: 1 },
    });
  });

  it.each([
    {}, // This should not throw an error and leave all fields unchanged
    {
      description: "Updated description",
    },
    {
      description: "Updated description",
      voucherLifespan: 200,
    },
    {
      description: "Updated description",
      voucherLifespan: 200,
      dailyCallsPerConsumer: 300,
    },
    {
      description: "Updated description",
      voucherLifespan: 200,
      dailyCallsPerConsumer: 300,
      dailyCallsTotal: 1500,
    },
    {
      description: "Updated description",
      voucherLifespan: 200,
      dailyCallsPerConsumer: 300,
      dailyCallsTotal: 1500,
      agreementApprovalPolicy: "AUTOMATIC" as const,
    },
    {
      description: "Updated description",
      voucherLifespan: 200,
      dailyCallsPerConsumer: 300,
      dailyCallsTotal: 1500,
      agreementApprovalPolicy: "MANUAL" as const,
    },
  ] as eserviceTemplateApi.PatchUpdateEServiceTemplateVersionSeed[])(
    "should write on event-store and update only the fields set in the seed, and leave undefined fields unchanged (seed #%#)",
    async (seed) => {
      const eserviceTemplateVersion: EServiceTemplateVersion = {
        ...getMockEServiceTemplateVersion(),
        version: 1,
        interface: getMockDocument(),
        state: eserviceTemplateVersionState.draft,
        description: "Original description",
        voucherLifespan: 100,
        dailyCallsPerConsumer: 200,
        dailyCallsTotal: 1000,
        agreementApprovalPolicy: agreementApprovalPolicy.manual,
      };

      const eserviceTemplate: EServiceTemplate = {
        ...getMockEServiceTemplate(),
        versions: [eserviceTemplateVersion],
      };

      await addOneEServiceTemplate(eserviceTemplate);

      const updateEServiceTemplateVersionReturn =
        await eserviceTemplateService.patchUpdateDraftTemplateVersion(
          eserviceTemplate.id,
          eserviceTemplateVersion.id,
          seed,
          getMockContextM2MAdmin({ organizationId: eserviceTemplate.creatorId })
        );

      const expectedEServiceTemplateVersion: EServiceTemplateVersion = {
        ...eserviceTemplateVersion,
        description: seed.description ?? eserviceTemplateVersion.description,
        voucherLifespan:
          seed.voucherLifespan ?? eserviceTemplateVersion.voucherLifespan,
        dailyCallsPerConsumer:
          seed.dailyCallsPerConsumer ??
          eserviceTemplateVersion.dailyCallsPerConsumer,
        dailyCallsTotal:
          seed.dailyCallsTotal ?? eserviceTemplateVersion.dailyCallsTotal,
        agreementApprovalPolicy:
          seed.agreementApprovalPolicy === "AUTOMATIC"
            ? agreementApprovalPolicy.automatic
            : seed.agreementApprovalPolicy === "MANUAL"
            ? agreementApprovalPolicy.manual
            : eserviceTemplateVersion.agreementApprovalPolicy,
      };

      const expectedEServiceTemplate: EServiceTemplate = {
        ...eserviceTemplate,
        versions: [expectedEServiceTemplateVersion],
      };

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

      expect(writtenPayload.eserviceTemplate).toEqual(
        toEServiceTemplateV2(expectedEServiceTemplate)
      );
      expect(updateEServiceTemplateVersionReturn).toEqual({
        data: expectedEServiceTemplate,
        metadata: { version: 1 },
      });
    }
  );

  it("should throw eserviceTemplateNotFound if the eservice template doesn't exist", async () => {
    const mockEServiceTemplate = getMockEServiceTemplate();
    const nonExistingId = generateId<EServiceTemplate["id"]>();

    expect(
      eserviceTemplateService.patchUpdateDraftTemplateVersion(
        nonExistingId,
        mockEServiceTemplate.versions[0].id,
        {
          description: "Updated description",
        },
        getMockContextM2MAdmin({
          organizationId: mockEServiceTemplate.creatorId,
        })
      )
    ).rejects.toThrowError(eserviceTemplateNotFound(nonExistingId));
  });

  it("should throw eserviceTemplateVersionNotFound if the eservice template version doesn't exist", async () => {
    const eserviceTemplate: EServiceTemplate = {
      ...getMockEServiceTemplate(),
      versions: [
        {
          ...getMockEServiceTemplateVersion(),
          state: eserviceTemplateVersionState.draft,
        },
      ],
    };

    await addOneEServiceTemplate(eserviceTemplate);

    const nonExistingVersionId = generateId<EServiceTemplateVersionId>();

    expect(
      eserviceTemplateService.patchUpdateDraftTemplateVersion(
        eserviceTemplate.id,
        nonExistingVersionId,
        {
          description: "Updated description",
        },
        getMockContextM2MAdmin({ organizationId: eserviceTemplate.creatorId })
      )
    ).rejects.toThrowError(
      eserviceTemplateVersionNotFound(eserviceTemplate.id, nonExistingVersionId)
    );
  });

  it("should throw operationForbidden if the requester is not the creator", async () => {
    const eserviceTemplateVersion: EServiceTemplateVersion = {
      ...getMockEServiceTemplateVersion(),
      state: eserviceTemplateVersionState.draft,
    };

    const eserviceTemplate: EServiceTemplate = {
      ...getMockEServiceTemplate(),
      versions: [eserviceTemplateVersion],
    };

    await addOneEServiceTemplate(eserviceTemplate);

    const differentTenantId = generateId<TenantId>();

    expect(
      eserviceTemplateService.patchUpdateDraftTemplateVersion(
        eserviceTemplate.id,
        eserviceTemplateVersion.id,
        {
          description: "Updated description",
        },
        getMockContextM2MAdmin({ organizationId: differentTenantId })
      )
    ).rejects.toThrowError(operationForbidden);
  });

  it.each(
    Object.values(eserviceTemplateVersionState).filter(
      (state) => state !== eserviceTemplateVersionState.draft
    )
  )(
    "should throw notValidEServiceTemplateVersionState if the eservice template version is in %s state",
    async (state) => {
      const eserviceTemplateVersion: EServiceTemplateVersion = {
        ...getMockEServiceTemplateVersion(),
        state,
      };

      const eserviceTemplate: EServiceTemplate = {
        ...getMockEServiceTemplate(),
        versions: [eserviceTemplateVersion],
      };

      await addOneEServiceTemplate(eserviceTemplate);

      expect(
        eserviceTemplateService.patchUpdateDraftTemplateVersion(
          eserviceTemplate.id,
          eserviceTemplateVersion.id,
          {
            description: "Updated description",
          },
          getMockContextM2MAdmin({ organizationId: eserviceTemplate.creatorId })
        )
      ).rejects.toThrowError(
        notValidEServiceTemplateVersionState(eserviceTemplateVersion.id, state)
      );
    }
  );

  it("should throw inconsistentDailyCalls if dailyCallsPerConsumer is greater than dailyCallsTotal", async () => {
    const eserviceTemplateVersion: EServiceTemplateVersion = {
      ...getMockEServiceTemplateVersion(),
      state: eserviceTemplateVersionState.draft,
    };

    const eserviceTemplate: EServiceTemplate = {
      ...getMockEServiceTemplate(),
      versions: [eserviceTemplateVersion],
    };

    await addOneEServiceTemplate(eserviceTemplate);

    expect(
      eserviceTemplateService.patchUpdateDraftTemplateVersion(
        eserviceTemplate.id,
        eserviceTemplateVersion.id,
        {
          dailyCallsPerConsumer: 1000,
          dailyCallsTotal: 500, // This is less than dailyCallsPerConsumer
        },
        getMockContextM2MAdmin({ organizationId: eserviceTemplate.creatorId })
      )
    ).rejects.toThrowError(inconsistentDailyCalls());
  });

  it.each([
    { dailyCallsPerConsumer: 300, dailyCallsTotal: 200 },
    { dailyCallsPerConsumer: 300 }, // when updating only dailyCallsPerConsumer and it exceeds the existing dailyCallsTotal
    { dailyCallsTotal: 50 }, // when updating only dailyCallsTotal and it's less than existing dailyCallsPerConsumer
  ])(
    "should throw inconsistentDailyCalls if dailyCallsPerConsumer is greater than dailyCallsTotal (test case %#)",
    async (seed) => {
      const eserviceTemplateVersion: EServiceTemplateVersion = {
        ...getMockEServiceTemplateVersion(),
        state: eserviceTemplateVersionState.draft,
        dailyCallsPerConsumer: 100,
        dailyCallsTotal: 200,
      };

      const eserviceTemplate: EServiceTemplate = {
        ...getMockEServiceTemplate(),
        versions: [eserviceTemplateVersion],
      };

      await addOneEServiceTemplate(eserviceTemplate);

      expect(
        eserviceTemplateService.patchUpdateDraftTemplateVersion(
          eserviceTemplate.id,
          eserviceTemplateVersion.id,
          seed,
          getMockContextM2MAdmin({ organizationId: eserviceTemplate.creatorId })
        )
      ).rejects.toThrowError(inconsistentDailyCalls());
    }
  );

  it("should allow partial updates when only one of the daily calls fields is provided", async () => {
    const eserviceTemplateVersion: EServiceTemplateVersion = {
      ...getMockEServiceTemplateVersion(),
      state: eserviceTemplateVersionState.draft,
      dailyCallsPerConsumer: 100,
      dailyCallsTotal: 1000,
    };

    const eserviceTemplate: EServiceTemplate = {
      ...getMockEServiceTemplate(),
      versions: [eserviceTemplateVersion],
    };

    await addOneEServiceTemplate(eserviceTemplate);

    // This should not throw an error even though the new dailyCallsPerConsumer (500)
    // could be inconsistent if we also considered the existing dailyCallsTotal
    // The validation only occurs when both fields are provided in the same update
    const result =
      await eserviceTemplateService.patchUpdateDraftTemplateVersion(
        eserviceTemplate.id,
        eserviceTemplateVersion.id,
        {
          dailyCallsPerConsumer: 500,
        },
        getMockContextM2MAdmin({ organizationId: eserviceTemplate.creatorId })
      );

    expect(result.data.versions[0].dailyCallsPerConsumer).toBe(500);
    expect(result.data.versions[0].dailyCallsTotal).toBe(1000); // unchanged
  });

  it("should correctly handle consistent daily calls update", async () => {
    const eserviceTemplateVersion: EServiceTemplateVersion = {
      ...getMockEServiceTemplateVersion(),
      state: eserviceTemplateVersionState.draft,
      dailyCallsPerConsumer: 100,
      dailyCallsTotal: 1000,
    };

    const eserviceTemplate: EServiceTemplate = {
      ...getMockEServiceTemplate(),
      versions: [eserviceTemplateVersion],
    };

    await addOneEServiceTemplate(eserviceTemplate);

    const result =
      await eserviceTemplateService.patchUpdateDraftTemplateVersion(
        eserviceTemplate.id,
        eserviceTemplateVersion.id,
        {
          dailyCallsPerConsumer: 500,
          dailyCallsTotal: 2000,
        },
        getMockContextM2MAdmin({ organizationId: eserviceTemplate.creatorId })
      );

    expect(result.data.versions[0].dailyCallsPerConsumer).toBe(500);
    expect(result.data.versions[0].dailyCallsTotal).toBe(2000);
  });

  it("should correctly update agreementApprovalPolicy from MANUAL to AUTOMATIC", async () => {
    const eserviceTemplateVersion: EServiceTemplateVersion = {
      ...getMockEServiceTemplateVersion(),
      state: eserviceTemplateVersionState.draft,
      agreementApprovalPolicy: agreementApprovalPolicy.manual,
    };

    const eserviceTemplate: EServiceTemplate = {
      ...getMockEServiceTemplate(),
      versions: [eserviceTemplateVersion],
    };

    await addOneEServiceTemplate(eserviceTemplate);

    const result =
      await eserviceTemplateService.patchUpdateDraftTemplateVersion(
        eserviceTemplate.id,
        eserviceTemplateVersion.id,
        {
          agreementApprovalPolicy: "AUTOMATIC",
        },
        getMockContextM2MAdmin({ organizationId: eserviceTemplate.creatorId })
      );

    expect(result.data.versions[0].agreementApprovalPolicy).toBe(
      agreementApprovalPolicy.automatic
    );
  });

  it("should correctly update agreementApprovalPolicy from AUTOMATIC to MANUAL", async () => {
    const eserviceTemplateVersion: EServiceTemplateVersion = {
      ...getMockEServiceTemplateVersion(),
      state: eserviceTemplateVersionState.draft,
      agreementApprovalPolicy: agreementApprovalPolicy.automatic,
    };

    const eserviceTemplate: EServiceTemplate = {
      ...getMockEServiceTemplate(),
      versions: [eserviceTemplateVersion],
    };

    await addOneEServiceTemplate(eserviceTemplate);

    const result =
      await eserviceTemplateService.patchUpdateDraftTemplateVersion(
        eserviceTemplate.id,
        eserviceTemplateVersion.id,
        {
          agreementApprovalPolicy: "MANUAL",
        },
        getMockContextM2MAdmin({ organizationId: eserviceTemplate.creatorId })
      );

    expect(result.data.versions[0].agreementApprovalPolicy).toBe(
      agreementApprovalPolicy.manual
    );
  });

  it("should handle multiple versions and update only the specified version", async () => {
    const draftVersion: EServiceTemplateVersion = {
      ...getMockEServiceTemplateVersion(),
      version: 1,
      state: eserviceTemplateVersionState.draft,
      description: "Draft version description",
    };

    const publishedVersion: EServiceTemplateVersion = {
      ...getMockEServiceTemplateVersion(),
      version: 2,
      state: eserviceTemplateVersionState.published,
      description: "Published version description",
    };

    const eserviceTemplate: EServiceTemplate = {
      ...getMockEServiceTemplate(),
      versions: [publishedVersion, draftVersion],
    };

    await addOneEServiceTemplate(eserviceTemplate);

    const result =
      await eserviceTemplateService.patchUpdateDraftTemplateVersion(
        eserviceTemplate.id,
        draftVersion.id,
        {
          description: "Updated draft description",
        },
        getMockContextM2MAdmin({ organizationId: eserviceTemplate.creatorId })
      );

    // Check that only the draft version was updated
    const updatedDraftVersion = result.data.versions.find(
      (v) => v.id === draftVersion.id
    );
    const unchangedPublishedVersion = result.data.versions.find(
      (v) => v.id === publishedVersion.id
    );

    expect(updatedDraftVersion?.description).toBe("Updated draft description");
    expect(unchangedPublishedVersion?.description).toBe(
      "Published version description"
    );
  });
});
