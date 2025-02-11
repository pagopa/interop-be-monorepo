/* eslint-disable @typescript-eslint/no-floating-promises */
import { genericLogger } from "pagopa-interop-commons";
import { eserviceTemplateApi } from "pagopa-interop-api-clients";
import {
  decodeProtobufPayload,
  getMockEServiceTemplate,
  getMockEServiceTemplateVersion,
  getMockAuthData,
  getMockDocument,
} from "pagopa-interop-commons-test";
import {
  descriptorState,
  Attribute,
  generateId,
  EServiceTemplateVersion,
  EServiceTemplate,
  EServiceTemplateDraftVersionUpdatedV2,
  toEServiceTemplateV2,
  eserviceTemplateVersionState,
  operationForbidden,
  AttributeId,
} from "pagopa-interop-models";
import { expect, describe, it } from "vitest";
import {
  attributeNotFound,
  eServiceTemplateNotFound,
  eServiceTemplateVersionNotFound,
  inconsistentDailyCalls,
  notValidEServiceTemplateVersionState,
} from "../src/model/domain/errors.js";
import {
  addOneAttribute,
  addOneEServiceTemplate,
  buildUpdateVersionSeed,
  eserviceTemplateService,
  readLastEserviceTemplateEvent,
} from "./utils.js";

describe("update draft version", () => {
  const mockVersion = getMockEServiceTemplateVersion();
  const mockEServiceTemplate = getMockEServiceTemplate();
  const mockDocument = getMockDocument();
  it("should write on event-store for the update of a draft version", async () => {
    const version: EServiceTemplateVersion = {
      ...mockVersion,
      state: descriptorState.draft,
    };
    const eserviceTemplate: EServiceTemplate = {
      ...mockEServiceTemplate,
      versions: [version],
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

    const expectedVersionSeed: eserviceTemplateApi.UpdateEServiceTemplateVersionSeed =
      {
        ...buildUpdateVersionSeed(version),
        dailyCallsTotal: 200,
        attributes: {
          certified: [],
          declared: [
            [{ id: attribute.id, explicitAttributeVerification: false }],
          ],
          verified: [],
        },
      };

    const updatedEServiceTemplate: EServiceTemplate = {
      ...eserviceTemplate,
      versions: [
        {
          ...version,
          dailyCallsTotal: 200,
          attributes: {
            certified: [],
            declared: [
              [{ id: attribute.id, explicitAttributeVerification: false }],
            ],
            verified: [],
          },
        },
      ],
    };
    await eserviceTemplateService.updateDraftTemplateVersion(
      eserviceTemplate.id,
      version.id,
      expectedVersionSeed,
      {
        authData: getMockAuthData(eserviceTemplate.creatorId),
        correlationId: generateId(),
        serviceName: "",
        logger: genericLogger,
      }
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
      toEServiceTemplateV2(updatedEServiceTemplate)
    );
  });

  it("should throw eServiceTemplateNotFound if the eservice template doesn't exist", () => {
    const version: EServiceTemplateVersion = {
      ...mockVersion,
      interface: mockDocument,
      state: descriptorState.published,
    };
    expect(
      eserviceTemplateService.updateDraftTemplateVersion(
        mockEServiceTemplate.id,
        version.id,
        buildUpdateVersionSeed(version),
        {
          authData: getMockAuthData(mockEServiceTemplate.creatorId),
          correlationId: generateId(),
          serviceName: "",
          logger: genericLogger,
        }
      )
    ).rejects.toThrowError(eServiceTemplateNotFound(mockEServiceTemplate.id));
  });

  it("should throw eServiceVersionNotFound if the version doesn't exist", async () => {
    const eserviceTemplate: EServiceTemplate = {
      ...mockEServiceTemplate,
      versions: [],
    };
    await addOneEServiceTemplate(eserviceTemplate);

    await expect(
      eserviceTemplateService.updateDraftTemplateVersion(
        mockEServiceTemplate.id,
        mockVersion.id,
        buildUpdateVersionSeed(mockVersion),
        {
          authData: getMockAuthData(mockEServiceTemplate.creatorId),
          correlationId: generateId(),
          serviceName: "",
          logger: genericLogger,
        }
      )
    ).rejects.toThrowError(
      eServiceTemplateVersionNotFound(eserviceTemplate.id, mockVersion.id)
    );
  });

  it.each([
    eserviceTemplateVersionState.published,
    eserviceTemplateVersionState.deprecated,
    eserviceTemplateVersionState.suspended,
  ])(
    "should throw notValidVersionState if the version is in %s state",
    async (state) => {
      const version: EServiceTemplateVersion = {
        ...mockVersion,
        interface: mockDocument,
        state,
      };
      const eserviceTemplate: EServiceTemplate = {
        ...mockEServiceTemplate,
        versions: [version],
      };
      await addOneEServiceTemplate(eserviceTemplate);

      await expect(
        eserviceTemplateService.updateDraftTemplateVersion(
          eserviceTemplate.id,
          version.id,
          buildUpdateVersionSeed(version),
          {
            authData: getMockAuthData(eserviceTemplate.creatorId),
            correlationId: generateId(),
            serviceName: "",
            logger: genericLogger,
          }
        )
      ).rejects.toThrowError(
        notValidEServiceTemplateVersionState(mockVersion.id, state)
      );
    }
  );

  it("should throw operationForbidden if the requester is not the creator", async () => {
    const version: EServiceTemplateVersion = {
      ...mockVersion,
      state: descriptorState.draft,
    };
    const eserviceTemplate: EServiceTemplate = {
      ...mockEServiceTemplate,
      versions: [version],
    };
    await addOneEServiceTemplate(eserviceTemplate);

    const expectedVersion = {
      ...version,
      dailyCallsTotal: 200,
    };
    await expect(
      eserviceTemplateService.updateDraftTemplateVersion(
        eserviceTemplate.id,
        version.id,
        buildUpdateVersionSeed(expectedVersion),
        {
          authData: getMockAuthData(),
          correlationId: generateId(),
          serviceName: "",
          logger: genericLogger,
        }
      )
    ).rejects.toThrowError(operationForbidden);
  });

  it("should throw inconsistentDailyCalls if dailyCallsPerConsumer is greater than dailyCallsTotal", async () => {
    const version: EServiceTemplateVersion = {
      ...mockVersion,
      state: descriptorState.draft,
    };
    const eservice: EServiceTemplate = {
      ...mockEServiceTemplate,
      versions: [version],
    };
    await addOneEServiceTemplate(eservice);

    const expectedVersion: EServiceTemplateVersion = {
      ...version,
      dailyCallsPerConsumer: 100,
      dailyCallsTotal: 50,
    };
    expect(
      eserviceTemplateService.updateDraftTemplateVersion(
        eservice.id,
        version.id,
        buildUpdateVersionSeed(expectedVersion),
        {
          authData: getMockAuthData(eservice.creatorId),
          correlationId: generateId(),
          serviceName: "",
          logger: genericLogger,
        }
      )
    ).rejects.toThrowError(inconsistentDailyCalls());
  });

  it("should throw attributeNotFound if at least one of the attributes doesn't exist", async () => {
    const version: EServiceTemplateVersion = {
      ...mockVersion,
      state: descriptorState.draft,
      attributes: {
        certified: [],
        declared: [],
        verified: [],
      },
    };
    const eserviceTemplate: EServiceTemplate = {
      ...mockEServiceTemplate,
      versions: [version],
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
    const notExistingId1 = generateId<AttributeId>();
    const notExistingId2 = generateId<AttributeId>();

    const descriptorSeed = {
      ...buildUpdateVersionSeed(mockVersion),
      attributes: {
        certified: [],
        declared: [
          [
            { id: attribute.id, explicitAttributeVerification: false },
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
    };

    expect(
      eserviceTemplateService.updateDraftTemplateVersion(
        eserviceTemplate.id,
        version.id,
        descriptorSeed,
        {
          authData: getMockAuthData(eserviceTemplate.creatorId),
          correlationId: generateId(),
          serviceName: "",
          logger: genericLogger,
        }
      )
    ).rejects.toThrowError(attributeNotFound(notExistingId1));
  });
});
