/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/no-floating-promises */
import {
  decodeProtobufPayload,
  getMockContext,
  getMockDocument,
  getMockEServiceTemplate,
  getMockEServiceTemplateVersion,
  getMockAuthData,
} from "pagopa-interop-commons-test";
import {
  descriptorState,
  toEServiceTemplateV2,
  operationForbidden,
  EServiceTemplate,
  EServiceTemplateVersion,
  eserviceTemplateVersionState,
  EServiceTemplateVersionQuotasUpdatedV2,
} from "pagopa-interop-models";
import { expect, describe, it } from "vitest";
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

describe("updateEServiceTemplateVersionQuotas", () => {
  const mockEServiceTemplate = getMockEServiceTemplate();
  const mockEServiceTemplateVersion = getMockEServiceTemplateVersion();
  const mockDocument = getMockDocument();

  it("should write on event-store for the update of the eservice template version quotas", async () => {
    const eserviceTemplateVersion: EServiceTemplateVersion = {
      ...mockEServiceTemplateVersion,
      interface: mockDocument,
      state: descriptorState.published,
    };
    const eserviceTemplate: EServiceTemplate = {
      ...mockEServiceTemplate,
      versions: [eserviceTemplateVersion],
    };
    await addOneEServiceTemplate(eserviceTemplate);

    const updatedEserviceTemplateVersionReturn =
      await eserviceTemplateService.updateEServiceTemplateVersionQuotas(
        eserviceTemplate.id,
        eserviceTemplateVersion.id,
        { voucherLifespan: 60 },
        getMockContext({
          authData: getMockAuthData(eserviceTemplate.creatorId),
        })
      );

    const writtenEvent = await readLastEserviceTemplateEvent(
      eserviceTemplate.id
    );
    expect(writtenEvent.stream_id).toBe(eserviceTemplate.id);
    expect(writtenEvent.version).toBe("1");
    expect(writtenEvent.type).toBe("EServiceTemplateVersionQuotasUpdated");
    expect(writtenEvent.event_version).toBe(2);
    const writtenPayload = decodeProtobufPayload({
      messageType: EServiceTemplateVersionQuotasUpdatedV2,
      payload: writtenEvent.data,
    });

    const expectedEServiceTemplate = {
      ...eserviceTemplate,
      versions: [
        {
          ...eserviceTemplateVersion,
          voucherLifespan: 60,
        },
      ],
    };

    expect(writtenPayload.eserviceTemplateVersionId).toEqual(
      eserviceTemplateVersion.id
    );
    expect(writtenPayload.eserviceTemplate).toEqual(
      toEServiceTemplateV2(expectedEServiceTemplate)
    );

    expect(updatedEserviceTemplateVersionReturn).toEqual({
      data: expectedEServiceTemplate,
      metadata: { version: 1 },
    });
  });

  it("should throw eserviceTemplateNotFound if the eservice template doesn't exist", () => {
    expect(
      eserviceTemplateService.updateEServiceTemplateVersionQuotas(
        mockEServiceTemplate.id,
        mockEServiceTemplateVersion.id,
        { voucherLifespan: 60 },
        getMockContext({
          authData: getMockAuthData(mockEServiceTemplate.creatorId),
        })
      )
    ).rejects.toThrowError(eserviceTemplateNotFound(mockEServiceTemplate.id));
  });

  it("should throw operationForbidden if the requester is not the eservice template creator", async () => {
    const eserviceTemplateVersion: EServiceTemplateVersion = {
      ...mockEServiceTemplateVersion,
      interface: mockDocument,
      state: descriptorState.published,
    };
    const eserviceTemplate: EServiceTemplate = {
      ...mockEServiceTemplate,
      versions: [eserviceTemplateVersion],
    };
    await addOneEServiceTemplate(eserviceTemplate);
    expect(
      eserviceTemplateService.updateEServiceTemplateVersionQuotas(
        eserviceTemplate.id,
        eserviceTemplateVersion.id,
        { voucherLifespan: 60 },
        getMockContext({})
      )
    ).rejects.toThrowError(operationForbidden);
  });

  it("should throw eserviceTemplateVersionNotFound if the eservice template version doesn't exist", async () => {
    const eserviceTemplate: EServiceTemplate = {
      ...mockEServiceTemplate,
      versions: [],
    };
    await addOneEServiceTemplate(eserviceTemplate);

    expect(
      eserviceTemplateService.updateEServiceTemplateVersionQuotas(
        eserviceTemplate.id,
        mockEServiceTemplateVersion.id,
        { voucherLifespan: 60 },
        getMockContext({
          authData: getMockAuthData(mockEServiceTemplate.creatorId),
        })
      )
    ).rejects.toThrowError(
      eserviceTemplateVersionNotFound(
        eserviceTemplate.id,
        mockEServiceTemplateVersion.id
      )
    );
  });

  it.each([
    eserviceTemplateVersionState.draft,
    eserviceTemplateVersionState.deprecated,
  ])(
    "should throw notValidEServiceTemplateVersionState if the descriptor is in %s state",
    async (state) => {
      const eserviceTemplateVersion: EServiceTemplateVersion = {
        ...mockEServiceTemplateVersion,
        state,
      };
      const eserviceTemplate: EServiceTemplate = {
        ...mockEServiceTemplate,
        versions: [eserviceTemplateVersion],
      };
      await addOneEServiceTemplate(eserviceTemplate);
      expect(
        eserviceTemplateService.updateEServiceTemplateVersionQuotas(
          eserviceTemplate.id,
          eserviceTemplateVersion.id,
          { voucherLifespan: 60 },
          getMockContext({
            authData: getMockAuthData(eserviceTemplate.creatorId),
          })
        )
      ).rejects.toThrowError(
        notValidEServiceTemplateVersionState(eserviceTemplateVersion.id, state)
      );
    }
  );

  it("should throw inconsistentDailyCalls if dailyCallsPerConsumer is greater than dailyCallsTotal", async () => {
    const eserviceTemplateVersion: EServiceTemplateVersion = {
      ...mockEServiceTemplateVersion,
      interface: mockDocument,
      state: descriptorState.published,
    };
    const eserviceTemplate: EServiceTemplate = {
      ...mockEServiceTemplate,
      versions: [eserviceTemplateVersion],
    };
    await addOneEServiceTemplate(eserviceTemplate);

    expect(
      eserviceTemplateService.updateEServiceTemplateVersionQuotas(
        eserviceTemplate.id,
        mockEServiceTemplateVersion.id,
        {
          voucherLifespan: 60,
          dailyCallsPerConsumer: 11,
          dailyCallsTotal: 10,
        },
        getMockContext({
          authData: getMockAuthData(mockEServiceTemplate.creatorId),
        })
      )
    ).rejects.toThrowError(inconsistentDailyCalls());
  });
});
