/* eslint-disable @typescript-eslint/no-floating-promises */
import {
  EServiceTemplateVersion,
  eserviceTemplateVersionState,
  EServiceTemplate,
  generateId,
  EServiceTemplateId,
} from "pagopa-interop-models";
import { expect, describe, it } from "vitest";
import {
  getMockAuthData,
  getMockContext,
  getMockDocument,
  getMockEServiceTemplate,
  getMockEServiceTemplateVersion,
} from "pagopa-interop-commons-test";
import { userRole } from "pagopa-interop-commons";
import { eserviceTemplateNotFound } from "../../src/model/domain/errors.js";
import {
  addOneEServiceTemplate,
  eserviceTemplateService,
} from "../integrationUtils.js";
import { getContextsAllowedToSeeDraftVersions } from "../mockUtils.js";

describe("getEServiceTemplateById", () => {
  const mockEServiceTemplateVersion = getMockEServiceTemplateVersion();
  const mockEServiceTemplate = getMockEServiceTemplate();
  const mockDocument = getMockDocument();

  it.each(getContextsAllowedToSeeDraftVersions(mockEServiceTemplate.creatorId))(
    "should get the eservice template including draft versions (requester is the creator, user roles: $authData.userRoles, system role: $authData.systemRole)",
    async (context) => {
      const eserviceTemplateVersion: EServiceTemplateVersion = {
        ...mockEServiceTemplateVersion,
        interface: mockDocument,
        state: eserviceTemplateVersionState.published,
        version: 1,
      };

      const eserviceTemplateDraftVersion: EServiceTemplateVersion = {
        ...getMockEServiceTemplateVersion(),
        interface: getMockDocument(),
        state: eserviceTemplateVersionState.draft,
        version: 2,
      };

      const eserviceTemplate: EServiceTemplate = {
        ...mockEServiceTemplate,
        id: generateId(),
        name: "eservice 001",
        versions: [eserviceTemplateVersion, eserviceTemplateDraftVersion],
      };

      await addOneEServiceTemplate(eserviceTemplate);

      const eserviceTemplateVersion2: EServiceTemplateVersion = {
        ...getMockEServiceTemplateVersion(),
        interface: getMockDocument(),
        state: eserviceTemplateVersionState.published,
      };
      const eserviceTemplate2: EServiceTemplate = {
        ...mockEServiceTemplate,
        id: generateId(),
        name: "eservice 002",
        versions: [eserviceTemplateVersion2],
      };
      await addOneEServiceTemplate(eserviceTemplate2);

      const eserviceTemplateVersion3: EServiceTemplateVersion = {
        ...getMockEServiceTemplateVersion(),
        interface: getMockDocument(),
        state: eserviceTemplateVersionState.published,
      };
      const eserviceTemplate3: EServiceTemplate = {
        ...mockEServiceTemplate,
        id: generateId(),
        name: "eservice 003",
        versions: [eserviceTemplateVersion3],
      };
      await addOneEServiceTemplate(eserviceTemplate3);

      const result = await eserviceTemplateService.getEServiceTemplateById(
        eserviceTemplate.id,
        context
      );

      expect(result).toStrictEqual({
        data: {
          ...eserviceTemplate,
          versions: expect.arrayContaining(eserviceTemplate.versions),
        },
        metadata: { version: 0 },
      });
    }
  );

  it("should throw eserviceTemplateNotFound if the eservice template doesn't exist", async () => {
    await addOneEServiceTemplate(mockEServiceTemplate);
    const notExistingId: EServiceTemplateId = generateId();
    expect(
      eserviceTemplateService.getEServiceTemplateById(
        notExistingId,
        getMockContext({})
      )
    ).rejects.toThrowError(eserviceTemplateNotFound(notExistingId));
  });

  it("should throw eserviceTemplateNotFound if there is only a draft version (requester is not the creator)", async () => {
    const eserviceTemplateVersion = {
      ...mockEServiceTemplateVersion,
      state: eserviceTemplateVersionState.draft,
    };
    const eserviceTemplate: EServiceTemplate = {
      ...mockEServiceTemplate,
      versions: [eserviceTemplateVersion],
    };
    await addOneEServiceTemplate(mockEServiceTemplate);
    expect(
      eserviceTemplateService.getEServiceTemplateById(
        eserviceTemplate.id,
        getMockContext({})
      )
    ).rejects.toThrowError(eserviceTemplateNotFound(eserviceTemplate.id));
  });

  it("should throw eserviceTemplateNotFound if there is only a draft version (requester is the creator, but user role is 'security')", async () => {
    const eserviceTemplateVersion = {
      ...mockEServiceTemplateVersion,
      state: eserviceTemplateVersionState.draft,
    };
    const eserviceTemplate: EServiceTemplate = {
      ...mockEServiceTemplate,
      versions: [eserviceTemplateVersion],
    };
    await addOneEServiceTemplate(mockEServiceTemplate);
    expect(
      eserviceTemplateService.getEServiceTemplateById(
        eserviceTemplate.id,
        getMockContext({
          authData: {
            ...getMockAuthData(eserviceTemplate.creatorId),
            userRoles: [userRole.SECURITY_ROLE],
          },
        })
      )
    ).rejects.toThrowError(eserviceTemplateNotFound(eserviceTemplate.id));
  });

  it("should throw eserviceTemplateNotFound if there are no versions (requester is not the creator)", async () => {
    const eserviceTemplate: EServiceTemplate = {
      ...mockEServiceTemplate,
      versions: [],
    };
    await addOneEServiceTemplate(mockEServiceTemplate);
    expect(
      eserviceTemplateService.getEServiceTemplateById(
        eserviceTemplate.id,
        getMockContext({})
      )
    ).rejects.toThrowError(eserviceTemplateNotFound(eserviceTemplate.id));
  });

  it("should throw eserviceTemplateNotFound if there are no versions (requester is the creator, but user role is 'security')", async () => {
    const eserviceTemplate: EServiceTemplate = {
      ...mockEServiceTemplate,
      versions: [],
    };
    await addOneEServiceTemplate(mockEServiceTemplate);
    expect(
      eserviceTemplateService.getEServiceTemplateById(
        eserviceTemplate.id,
        getMockContext({
          authData: {
            ...getMockAuthData(eserviceTemplate.creatorId),
            userRoles: [userRole.SECURITY_ROLE],
          },
        })
      )
    ).rejects.toThrowError(eserviceTemplateNotFound(eserviceTemplate.id));
  });

  it("should filter out the draft versions if the eservice template has both of that state and not (requester is the creator, but user role is 'security')", async () => {
    const eserviceTemplateVersionDraft: EServiceTemplateVersion = {
      ...mockEServiceTemplateVersion,
      state: eserviceTemplateVersionState.draft,
      version: 2,
    };
    const eserviceTemplateVersion: EServiceTemplateVersion = {
      ...getMockEServiceTemplateVersion(),
      state: eserviceTemplateVersionState.published,
      interface: mockDocument,
      publishedAt: new Date(),
      version: 1,
    };
    const eserviceTemplate: EServiceTemplate = {
      ...mockEServiceTemplate,
      versions: [eserviceTemplateVersionDraft, eserviceTemplateVersion],
    };
    await addOneEServiceTemplate(eserviceTemplate);
    const result = await eserviceTemplateService.getEServiceTemplateById(
      eserviceTemplate.id,
      getMockContext({
        authData: {
          ...getMockAuthData(eserviceTemplate.creatorId),
          userRoles: [userRole.SECURITY_ROLE],
        },
      })
    );
    expect(result.data.versions).toEqual([eserviceTemplateVersion]);
  });

  it.each(getContextsAllowedToSeeDraftVersions(generateId()))(
    "should filter out the draft versions if the eservice template has both of that state and not (requester is not the creator, user roles: $authData.userRoles, system role: $authData.systemRole)",
    async (context) => {
      const eserviceTemplateVersionDraft: EServiceTemplateVersion = {
        ...mockEServiceTemplateVersion,
        state: eserviceTemplateVersionState.draft,
        version: 2,
      };
      const eserviceTemplateVersion: EServiceTemplateVersion = {
        ...getMockEServiceTemplateVersion(),
        state: eserviceTemplateVersionState.published,
        interface: mockDocument,
        publishedAt: new Date(),
        version: 1,
      };
      const eserviceTemplate: EServiceTemplate = {
        ...mockEServiceTemplate,
        versions: [eserviceTemplateVersionDraft, eserviceTemplateVersion],
      };
      await addOneEServiceTemplate(eserviceTemplate);
      const result = await eserviceTemplateService.getEServiceTemplateById(
        eserviceTemplate.id,
        context
      );
      expect(result.data.versions).toEqual([eserviceTemplateVersion]);
    }
  );
});
