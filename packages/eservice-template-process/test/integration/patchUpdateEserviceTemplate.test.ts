import { eserviceTemplateApi } from "pagopa-interop-api-clients";
import { genericLogger } from "pagopa-interop-commons";
import {
  decodeProtobufPayload,
  getMockEServiceTemplate,
  getMockContextM2MAdmin,
  getMockEServiceTemplateVersion,
  getMockEService,
  getMockDocument,
  getMockValidEServiceTemplateRiskAnalysis,
  readEventByStreamIdAndVersion,
} from "pagopa-interop-commons-test";
import {
  operationForbidden,
  EServiceTemplate,
  EServiceTemplateDraftUpdatedV2,
  toEServiceTemplateV2,
  eserviceTemplateVersionState,
  eserviceMode,
  tenantKind,
  EServiceTemplateEvent,
  EServiceTemplateVersionState,
  eventConflictError,
  hyperlinkDetectionError,
} from "pagopa-interop-models";
import { upsertEServiceTemplate } from "pagopa-interop-readmodel/testUtils";
import { expect, describe, it, vi } from "vitest";

import { config } from "../../src/config/config.js";
import {
  apiEServiceModeToEServiceMode,
  apiTechnologyToTechnology,
} from "../../src/model/domain/apiConverter.js";
import {
  eserviceTemplateDuplicate,
  eserviceTemplateNotFound,
  eserviceTemplateNotInDraftState,
  instanceNameConflict,
} from "../../src/model/domain/errors.js";
import {
  readLastEserviceTemplateEvent,
  addOneEServiceTemplate,
  eserviceTemplateService,
  addOneEService,
  fileManager,
  postgresDB,
  readModelDB,
} from "../integrationUtils.js";

describe("update eserviceTemplate", () => {
  const mockEServiceTemplate = {
    ...getMockEServiceTemplate(),
    isSignalHubEnabled: false,
  };

  it.each([
    {
      name: "New name",
    },
    {
      name: "New name",
      description: "New description",
    },
    {
      name: "New name",
      description: "New description",
      technology: "SOAP",
    },
    {
      name: "New name",
      description: "New description",
      technology: "SOAP",
      mode: "DELIVER",
    },
    {
      name: "New name",
      description: "New description",
      technology: "SOAP",
      mode: "DELIVER",
      isSignalHubEnabled: true,
    },
    {
      name: "New name",
      description: "New description",
      technology: "SOAP",
      mode: "DELIVER",
      isSignalHubEnabled: true,
      intendedTarget: "intendedTarget",
    },
    {
      name: "New name",
      description: "New description",
      technology: "SOAP",
      mode: "DELIVER",
      isSignalHubEnabled: true,
      intendedTarget: "intendedTarget",
      asyncExchange: true,
    },
  ] as eserviceTemplateApi.PatchUpdateEServiceTemplateSeed[])(
    "should write on event-store and update only the fields set in the seed, and leave undefined fields unchanged (seed #%#)",
    async (seed) => {
      const eserviceTemplate: EServiceTemplate = {
        ...mockEServiceTemplate,
        technology: "Rest",
        mode: "Receive",
        isSignalHubEnabled: false,
        intendedTarget: "old intended target",
      };

      await addOneEServiceTemplate(eserviceTemplate);

      const ctx = getMockContextM2MAdmin({
        organizationId: mockEServiceTemplate.creatorId,
      });
      const updateEServiceTemplateReturn =
        await eserviceTemplateService.patchUpdateEServiceTemplate(
          mockEServiceTemplate.id,
          seed,
          ctx
        );

      const expectedEServiceTemplate: EServiceTemplate = {
        ...eserviceTemplate,
        name: seed.name ?? eserviceTemplate.name,
        description: seed.description ?? eserviceTemplate.description,
        technology: seed.technology
          ? apiTechnologyToTechnology(seed.technology)
          : eserviceTemplate.technology,
        mode: seed.mode
          ? apiEServiceModeToEServiceMode(seed.mode)
          : eserviceTemplate.mode,
        isSignalHubEnabled:
          seed.isSignalHubEnabled ?? eserviceTemplate.isSignalHubEnabled,
        intendedTarget: seed.intendedTarget ?? eserviceTemplate.intendedTarget,
        asyncExchange: seed.asyncExchange ?? eserviceTemplate.asyncExchange,
        riskAnalysis:
          seed.mode === "DELIVER" ? [] : eserviceTemplate.riskAnalysis,
      };

      const expectedEvents = ["EServiceTemplateDraftUpdated"];
      await Promise.all(
        expectedEvents.map(async (type, index) => {
          const writtenEvent = await readEventByStreamIdAndVersion(
            eserviceTemplate.id,
            index + 1,
            "eservice_template",
            postgresDB
          );
          expect(writtenEvent).toMatchObject({
            stream_id: eserviceTemplate.id,
            version: String(index + 1),
            type,
            event_version: 2,
            correlation_id: ctx.correlationId,
          });
          const decodedEvent = EServiceTemplateEvent.parse(writtenEvent);
          expect(decodedEvent.data.eserviceTemplate).toEqual(
            toEServiceTemplateV2(expectedEServiceTemplate)
          );
          if (decodedEvent.type === "EServiceTemplateNameUpdated") {
            expect(decodedEvent.data.oldName).toBe(eserviceTemplate.name);
          }
        })
      );
      expect(updateEServiceTemplateReturn).toEqual({
        data: expectedEServiceTemplate,
        metadata: { version: expectedEvents.length },
      });
      expect(
        (await readLastEserviceTemplateEvent(eserviceTemplate.id)).version
      ).toBe(String(expectedEvents.length));
    }
  );

  it("should ignore asyncExchange from seed and leave it undefined when featureFlagAsyncExchange is disabled", async () => {
    config.featureFlagAsyncExchange = false;

    const eserviceTemplate: EServiceTemplate = {
      ...mockEServiceTemplate,
      technology: "Rest",
      mode: "Receive",
      isSignalHubEnabled: false,
      intendedTarget: "old intended target",
    };

    await addOneEServiceTemplate(eserviceTemplate);

    const updateResult =
      await eserviceTemplateService.patchUpdateEServiceTemplate(
        mockEServiceTemplate.id,
        { asyncExchange: true },
        getMockContextM2MAdmin({
          organizationId: mockEServiceTemplate.creatorId,
        })
      );

    const writtenEvent = await readLastEserviceTemplateEvent(
      mockEServiceTemplate.id
    );
    expect(updateResult.data.asyncExchange).toBeUndefined();
    expect(updateResult).toEqual({
      data: eserviceTemplate,
      metadata: { version: 0 },
    });
    expect(writtenEvent.version).toBe("0");

    config.featureFlagAsyncExchange = true;
  });

  it("should throw eServiceTemplateNotFound if the eserviceTemplate doesn't exist", async () => {
    await expect(
      eserviceTemplateService.patchUpdateEServiceTemplate(
        mockEServiceTemplate.id,
        {
          name: "eserviceTemplate new name",
          description: "eserviceTemplate description",
          technology: "REST",
          mode: "DELIVER",
        },
        getMockContextM2MAdmin({
          organizationId: mockEServiceTemplate.creatorId,
        })
      )
    ).rejects.toThrowError(eserviceTemplateNotFound(mockEServiceTemplate.id));
  });

  it("should throw operationForbidden if the requester is not the producer", async () => {
    await addOneEServiceTemplate(mockEServiceTemplate);

    await expect(
      eserviceTemplateService.patchUpdateEServiceTemplate(
        mockEServiceTemplate.id,
        {
          name: "eserviceTemplate new name",
          description: "eserviceTemplate description",
          technology: "REST",
          mode: "DELIVER",
        },
        getMockContextM2MAdmin({})
      )
    ).rejects.toThrowError(operationForbidden);
  });

  it("should throw eserviceTemplateDuplicateName if the updated name is already in use, case insensitive", async () => {
    const name = "eserviceTemplate name already in use";

    const eserviceTemplate: EServiceTemplate = {
      ...getMockEServiceTemplate(),
      name,
    };

    await addOneEServiceTemplate(eserviceTemplate);

    await expect(
      eserviceTemplateService.patchUpdateEServiceTemplate(
        eserviceTemplate.id,
        {
          name: name.toUpperCase(),
          description: "eserviceTemplate description",
          technology: "REST",
          mode: "DELIVER",
        },
        getMockContextM2MAdmin({ organizationId: eserviceTemplate.creatorId })
      )
    ).rejects.toThrowError(eserviceTemplateDuplicate(name.toUpperCase()));
  });

  const metadataSeeds: eserviceTemplateApi.PatchUpdateEServiceTemplateSeed[] = [
    { name: "Updated template name" },
    { description: "Updated template description" },
    { intendedTarget: "Updated intended target" },
    {
      name: "Updated template name",
      description: "Updated template description",
    },
    {
      name: "Updated template name",
      intendedTarget: "Updated intended target",
    },
    {
      description: "Updated template description",
      intendedTarget: "Updated intended target",
    },
    {
      name: "Updated template name",
      description: "Updated template description",
      intendedTarget: "Updated intended target",
    },
  ];
  const versionStates: EServiceTemplateVersionState[][] = [
    [],
    [eserviceTemplateVersionState.draft],
    [eserviceTemplateVersionState.draft, eserviceTemplateVersionState.draft],
    [eserviceTemplateVersionState.published],
    [eserviceTemplateVersionState.suspended],
    [eserviceTemplateVersionState.deprecated],
    [
      eserviceTemplateVersionState.deprecated,
      eserviceTemplateVersionState.deprecated,
    ],
    [
      eserviceTemplateVersionState.published,
      eserviceTemplateVersionState.draft,
    ],
  ];

  describe.each(versionStates.map((states) => ({ states })))(
    "metadata with version states $states",
    ({ states }) => {
      it.each(metadataSeeds)(
        "should update only metadata with seed %j",
        async (seed) => {
          const template: EServiceTemplate = {
            ...getMockEServiceTemplate(),
            mode: eserviceMode.receive,
            riskAnalysis: [
              getMockValidEServiceTemplateRiskAnalysis(tenantKind.PA),
            ],
            versions: states.map((state, index) => ({
              ...getMockEServiceTemplateVersion(),
              version: index + 1,
              state,
              interface: getMockDocument(),
              asyncExchangeCallbackInterface: getMockDocument(),
            })),
          };
          await addOneEServiceTemplate(template);
          const deleteSpy = vi.spyOn(fileManager, "delete").mockClear();
          const ctx = getMockContextM2MAdmin({
            organizationId: template.creatorId,
          });
          const result =
            await eserviceTemplateService.patchUpdateEServiceTemplate(
              template.id,
              seed,
              ctx
            );
          const expected: EServiceTemplate = {
            ...template,
            name: seed.name ?? template.name,
            description: seed.description ?? template.description,
            intendedTarget: seed.intendedTarget ?? template.intendedTarget,
          };
          const expectedTypes = states.every(
            (state) => state === eserviceTemplateVersionState.draft
          )
            ? ["EServiceTemplateDraftUpdated"]
            : [
                ...(seed.name ? ["EServiceTemplateNameUpdated"] : []),
                ...(seed.description
                  ? ["EServiceTemplateDescriptionUpdated"]
                  : []),
                ...(seed.intendedTarget
                  ? ["EServiceTemplateIntendedTargetUpdated"]
                  : []),
              ];
          expect(result).toEqual({
            data: {
              ...expected,
              versions: expect.arrayContaining(template.versions),
            },
            metadata: { version: expectedTypes.length },
          });
          expect(result.data.versions).toHaveLength(template.versions.length);
          await Promise.all(
            expectedTypes.map(async (type, index) => {
              const event = await readEventByStreamIdAndVersion(
                template.id,
                index + 1,
                "eservice_template",
                postgresDB
              );
              expect(event).toMatchObject({
                type,
                event_version: 2,
                version: String(index + 1),
                correlation_id: ctx.correlationId,
              });
              const decoded = EServiceTemplateEvent.parse(event);
              expect(decoded.data.eserviceTemplate).toEqual(
                toEServiceTemplateV2(result.data)
              );
              if (decoded.type === "EServiceTemplateNameUpdated") {
                expect(decoded.data.oldName).toBe(template.name);
              }
            })
          );
          expect(deleteSpy).not.toHaveBeenCalled();
        }
      );

      it("should not write events for unchanged metadata or an empty seed", async () => {
        const template: EServiceTemplate = {
          ...getMockEServiceTemplate(),
          versions: states.map((state, index) => ({
            ...getMockEServiceTemplateVersion(),
            version: index + 1,
            state,
          })),
        };
        await addOneEServiceTemplate(template);
        const ctx = getMockContextM2MAdmin({
          organizationId: template.creatorId,
        });
        for (const seed of [
          {},
          { name: template.name },
          { description: template.description },
          { intendedTarget: template.intendedTarget },
          {
            name: template.name,
            description: template.description,
            intendedTarget: template.intendedTarget,
          },
        ]) {
          expect(
            await eserviceTemplateService.patchUpdateEServiceTemplate(
              template.id,
              seed,
              ctx
            )
          ).toEqual({
            data: {
              ...template,
              versions: expect.arrayContaining(template.versions),
            },
            metadata: { version: 0 },
          });
        }
        expect((await readLastEserviceTemplateEvent(template.id)).version).toBe(
          "0"
        );
      });
    }
  );

  const operationalSeeds: eserviceTemplateApi.PatchUpdateEServiceTemplateSeed[] =
    [
      { technology: "SOAP" },
      { mode: "DELIVER" },
      { isSignalHubEnabled: true },
      { personalData: null },
      { asyncExchange: null },
      { personalData: false },
      { asyncExchange: false },
    ];

  describe.each([
    eserviceTemplateVersionState.published,
    eserviceTemplateVersionState.suspended,
    eserviceTemplateVersionState.deprecated,
  ])("operational fields with a %s version", (state) => {
    it.each(operationalSeeds)(
      "should reject a mixed seed atomically: %j",
      async (seed) => {
        const template: EServiceTemplate = {
          ...getMockEServiceTemplate(),
          personalData: true,
          asyncExchange: true,
          versions: [
            {
              ...getMockEServiceTemplateVersion(),
              state,
              interface: getMockDocument(),
              asyncExchangeCallbackInterface: getMockDocument(),
            },
            getMockEServiceTemplateVersion(),
          ],
        };
        await addOneEServiceTemplate(template);
        const deleteSpy = vi.spyOn(fileManager, "delete").mockClear();
        await expect(
          eserviceTemplateService.patchUpdateEServiceTemplate(
            template.id,
            { ...metadataSeeds[6], ...seed },
            getMockContextM2MAdmin({ organizationId: template.creatorId })
          )
        ).rejects.toThrowError(eserviceTemplateNotInDraftState(template.id));
        expect((await readLastEserviceTemplateEvent(template.id)).version).toBe(
          "0"
        );
        expect(deleteSpy).not.toHaveBeenCalled();
      }
    );

    it("should reject even an unchanged operational field", async () => {
      const template: EServiceTemplate = {
        ...getMockEServiceTemplate(),
        personalData: true,
        versions: [{ ...getMockEServiceTemplateVersion(), state }],
      };
      await addOneEServiceTemplate(template);
      await expect(
        eserviceTemplateService.patchUpdateEServiceTemplate(
          template.id,
          { name: "Updated template name", personalData: true },
          getMockContextM2MAdmin({ organizationId: template.creatorId })
        )
      ).rejects.toThrowError(eserviceTemplateNotInDraftState(template.id));
      expect((await readLastEserviceTemplateEvent(template.id)).version).toBe(
        "0"
      );
    });
  });

  describe.each([0, 1, 2])(
    "operational fields with %i draft versions",
    (count) => {
      it.each(operationalSeeds)(
        "should emit only one draft event with the full updated snapshot: %j",
        async (seed) => {
          const template: EServiceTemplate = {
            ...getMockEServiceTemplate(),
            technology: "Rest",
            mode: eserviceMode.receive,
            isSignalHubEnabled: false,
            personalData: true,
            asyncExchange: true,
            riskAnalysis: [
              getMockValidEServiceTemplateRiskAnalysis(tenantKind.PA),
            ],
            versions: Array.from({ length: count }, () =>
              getMockEServiceTemplateVersion()
            ),
          };
          await addOneEServiceTemplate(template);
          const result =
            await eserviceTemplateService.patchUpdateEServiceTemplate(
              template.id,
              {
                ...seed,
                name: "Updated template name",
                description: "Updated template description",
                intendedTarget: "Updated intended target",
              },
              getMockContextM2MAdmin({ organizationId: template.creatorId })
            );
          const expected: EServiceTemplate = {
            ...template,
            name: "Updated template name",
            description: "Updated template description",
            intendedTarget: "Updated intended target",
            technology: seed.technology === "SOAP" ? "Soap" : "Rest",
            mode:
              seed.mode === "DELIVER"
                ? eserviceMode.deliver
                : eserviceMode.receive,
            isSignalHubEnabled: seed.isSignalHubEnabled ?? false,
            personalData:
              seed.personalData === null
                ? undefined
                : (seed.personalData ?? true),
            asyncExchange:
              seed.asyncExchange === null
                ? undefined
                : (seed.asyncExchange ?? true),
            riskAnalysis: seed.mode === "DELIVER" ? [] : template.riskAnalysis,
          };
          expect(result).toEqual({
            data: {
              ...expected,
              versions: expect.arrayContaining(template.versions),
            },
            metadata: { version: 1 },
          });
          expect(result.data.versions).toHaveLength(template.versions.length);
          const event = await readEventByStreamIdAndVersion(
            template.id,
            1,
            "eservice_template",
            postgresDB
          );
          expect(event.type).toBe("EServiceTemplateDraftUpdated");
          expect(
            decodeProtobufPayload({
              messageType: EServiceTemplateDraftUpdatedV2,
              payload: event.data,
            })
          ).toEqual({ eserviceTemplate: toEServiceTemplateV2(result.data) });
          expect(
            await readLastEserviceTemplateEvent(template.id)
          ).toMatchObject({
            type: "EServiceTemplateDraftUpdated",
            version: "1",
          });
        }
      );

      it("should emit one Draft event when metadata changes and supplied operational values are unchanged", async () => {
        const template: EServiceTemplate = {
          ...getMockEServiceTemplate(),
          technology: "Rest",
          mode: eserviceMode.receive,
          isSignalHubEnabled: false,
          personalData: undefined,
          asyncExchange: undefined,
          versions: Array.from({ length: count }, () =>
            getMockEServiceTemplateVersion()
          ),
        };
        await addOneEServiceTemplate(template);
        const ctx = getMockContextM2MAdmin({
          organizationId: template.creatorId,
        });
        const result =
          await eserviceTemplateService.patchUpdateEServiceTemplate(
            template.id,
            {
              name: "Updated template name",
              description: "Updated template description",
              intendedTarget: "Updated intended target",
              technology: "REST",
              mode: "RECEIVE",
              isSignalHubEnabled: false,
              personalData: null,
              asyncExchange: null,
            },
            ctx
          );
        expect(result.metadata.version).toBe(1);
        await Promise.all(
          ["EServiceTemplateDraftUpdated"].map(async (type, index) => {
            const event = await readEventByStreamIdAndVersion(
              template.id,
              index + 1,
              "eservice_template",
              postgresDB
            );
            expect(event).toMatchObject({
              type,
              version: String(index + 1),
              correlation_id: ctx.correlationId,
            });
            expect(
              EServiceTemplateEvent.parse(event).data.eserviceTemplate
            ).toEqual(toEServiceTemplateV2(result.data));
          })
        );
        expect((await readLastEserviceTemplateEvent(template.id)).version).toBe(
          "1"
        );
      });

      it.each([false, true])(
        "should ignore structurally equal operational snapshots with undefined properties (metadata changes: %s)",
        async (hasMetadataChanges) => {
          const template: EServiceTemplate = {
            ...getMockEServiceTemplate(),
            mode: eserviceMode.deliver,
            riskAnalysis: [],
            versions: Array.from({ length: count }, () =>
              getMockEServiceTemplateVersion()
            ),
          };
          await addOneEServiceTemplate(template);
          const metadataSeed = {
            name: hasMetadataChanges ? "Updated template name" : template.name,
            description: hasMetadataChanges
              ? "Updated template description"
              : template.description,
            intendedTarget: hasMetadataChanges
              ? "Updated intended target"
              : template.intendedTarget,
          };
          const result =
            await eserviceTemplateService.patchUpdateEServiceTemplate(
              template.id,
              {
                ...metadataSeed,
                mode: "DELIVER",
                personalData: null,
                asyncExchange: null,
              },
              getMockContextM2MAdmin({ organizationId: template.creatorId })
            );
          expect(result).toEqual({
            data: {
              ...template,
              ...metadataSeed,
              versions: expect.arrayContaining(template.versions),
            },
            metadata: { version: hasMetadataChanges ? 1 : 0 },
          });
          expect(result.data.versions).toHaveLength(template.versions.length);
          expect(
            await readLastEserviceTemplateEvent(template.id)
          ).toMatchObject({
            type: hasMetadataChanges
              ? "EServiceTemplateDraftUpdated"
              : "EServiceTemplateAdded",
            version: hasMetadataChanges ? "1" : "0",
          });
        }
      );

      it("should not write events for unchanged operational values", async () => {
        const template: EServiceTemplate = {
          ...getMockEServiceTemplate(),
          technology: "Rest",
          mode: eserviceMode.receive,
          isSignalHubEnabled: false,
          personalData: undefined,
          asyncExchange: undefined,
          versions: Array.from({ length: count }, () =>
            getMockEServiceTemplateVersion()
          ),
        };
        await addOneEServiceTemplate(template);
        const result =
          await eserviceTemplateService.patchUpdateEServiceTemplate(
            template.id,
            {
              name: template.name,
              technology: "REST",
              mode: "RECEIVE",
              isSignalHubEnabled: false,
              personalData: null,
              asyncExchange: null,
            },
            getMockContextM2MAdmin({ organizationId: template.creatorId })
          );
        expect(result).toEqual({
          data: {
            ...template,
            versions: expect.arrayContaining(template.versions),
          },
          metadata: { version: 0 },
        });
        expect(result.data.versions).toHaveLength(template.versions.length);
        expect((await readLastEserviceTemplateEvent(template.id)).version).toBe(
          "0"
        );
      });
    }
  );

  it("should emit only the changed metadata event", async () => {
    const template: EServiceTemplate = {
      ...getMockEServiceTemplate(),
      versions: [
        {
          ...getMockEServiceTemplateVersion(),
          state: eserviceTemplateVersionState.published,
        },
      ],
    };
    await addOneEServiceTemplate(template);
    const result = await eserviceTemplateService.patchUpdateEServiceTemplate(
      template.id,
      {
        name: template.name,
        description: "Updated template description",
        intendedTarget: template.intendedTarget,
      },
      getMockContextM2MAdmin({ organizationId: template.creatorId })
    );
    expect(result.metadata.version).toBe(1);
    expect((await readLastEserviceTemplateEvent(template.id)).type).toBe(
      "EServiceTemplateDescriptionUpdated"
    );
  });

  it.each([undefined, "instance label"])(
    "should reject a rename conflicting with an instance name (label: %s)",
    async (instanceLabel) => {
      const template = getMockEServiceTemplate();
      const instance = {
        ...getMockEService(undefined, undefined, [], template.id),
        instanceLabel,
      };
      const name = "Updated template name";
      await addOneEServiceTemplate(template);
      await addOneEService(instance);
      await addOneEService({
        ...getMockEService(undefined, instance.producerId),
        name: instanceLabel ? `${name} - ${instanceLabel}` : name,
      });
      await expect(
        eserviceTemplateService.patchUpdateEServiceTemplate(
          template.id,
          { name, description: "Updated template description" },
          getMockContextM2MAdmin({ organizationId: template.creatorId })
        )
      ).rejects.toThrowError(instanceNameConflict(template.id));
      expect((await readLastEserviceTemplateEvent(template.id)).version).toBe(
        "0"
      );
    }
  );

  it("should delete both interfaces only after validation on a draft technology change", async () => {
    const interfaceDocument = getMockDocument();
    const callbackDocument = getMockDocument();
    const template: EServiceTemplate = {
      ...getMockEServiceTemplate(),
      technology: "Rest",
      versions: [
        {
          ...getMockEServiceTemplateVersion(),
          interface: {
            ...interfaceDocument,
            path: `${config.eserviceTemplateDocumentsPath}/${interfaceDocument.id}/${interfaceDocument.name}`,
          },
          asyncExchangeCallbackInterface: {
            ...callbackDocument,
            path: `${config.eserviceTemplateDocumentsPath}/${callbackDocument.id}/${callbackDocument.name}`,
          },
        },
      ],
    };
    await addOneEServiceTemplate(template);
    await Promise.all(
      [interfaceDocument, callbackDocument].map(async (document) => {
        await fileManager.storeBytes(
          {
            bucket: config.s3Bucket,
            path: config.eserviceTemplateDocumentsPath,
            resourceId: document.id,
            name: document.name,
            content: Buffer.from("test"),
          },
          genericLogger
        );
      })
    );
    const duplicate = {
      ...getMockEServiceTemplate(),
      name: "Another template name",
    };
    await addOneEServiceTemplate(duplicate);
    const deleteSpy = vi.spyOn(fileManager, "delete").mockClear();
    const ctx = getMockContextM2MAdmin({
      organizationId: template.creatorId,
    });
    await expect(
      eserviceTemplateService.patchUpdateEServiceTemplate(
        template.id,
        { technology: "SOAP", name: duplicate.name },
        ctx
      )
    ).rejects.toThrowError(eserviceTemplateDuplicate(duplicate.name));
    expect(deleteSpy).not.toHaveBeenCalled();
    expect((await readLastEserviceTemplateEvent(template.id)).version).toBe(
      "0"
    );

    const result = await eserviceTemplateService.patchUpdateEServiceTemplate(
      template.id,
      { technology: "SOAP", description: "Updated template description" },
      ctx
    );
    expect(result.data.versions).toEqual(
      template.versions.map((version) => ({
        ...version,
        interface: undefined,
        asyncExchangeCallbackInterface: undefined,
      }))
    );
    expect(deleteSpy).toHaveBeenCalledTimes(2);
    const files = await fileManager.listFiles(config.s3Bucket, genericLogger);
    template.versions.forEach((version) => {
      expect(files).not.toContain(version.interface?.path);
      expect(files).not.toContain(version.asyncExchangeCallbackInterface?.path);
    });
    expect(result.metadata.version).toBe(1);
  });

  it("should reject a stale write without persisting any of its events", async () => {
    const template: EServiceTemplate = {
      ...getMockEServiceTemplate(),
      versions: [
        {
          ...getMockEServiceTemplateVersion(),
          state: eserviceTemplateVersionState.published,
        },
      ],
    };
    await addOneEServiceTemplate(template);
    const ctx = getMockContextM2MAdmin({
      organizationId: template.creatorId,
    });
    await eserviceTemplateService.patchUpdateEServiceTemplate(
      template.id,
      { description: "First updated description" },
      ctx
    );
    await expect(
      eserviceTemplateService.patchUpdateEServiceTemplate(
        template.id,
        {
          name: "Another template name",
          description: "Another updated description",
          intendedTarget: "Another intended target",
        },
        ctx
      )
    ).rejects.toThrowError(
      eventConflictError(ctx.correlationId, template.id, 0)
    );
    const lastEvent = await readLastEserviceTemplateEvent(template.id);
    expect(lastEvent.version).toBe("1");
    expect(lastEvent.type).toBe("EServiceTemplateDescriptionUpdated");
  });

  it("should preserve a non-zero version on a no-op and continue with consecutive versions", async () => {
    const template: EServiceTemplate = {
      ...getMockEServiceTemplate(),
      versions: [
        {
          ...getMockEServiceTemplateVersion(),
          state: eserviceTemplateVersionState.published,
        },
      ],
    };
    await addOneEServiceTemplate(template);
    const ctx = getMockContextM2MAdmin({
      organizationId: template.creatorId,
    });
    const first = await eserviceTemplateService.patchUpdateEServiceTemplate(
      template.id,
      {
        name: "Updated template name",
        description: "Updated template description",
        intendedTarget: "Updated intended target",
      },
      ctx
    );
    await upsertEServiceTemplate(
      readModelDB,
      first.data,
      first.metadata.version
    );
    const noOp = await eserviceTemplateService.patchUpdateEServiceTemplate(
      template.id,
      {
        name: first.data.name,
        description: first.data.description,
        intendedTarget: first.data.intendedTarget,
      },
      ctx
    );
    expect(noOp).toEqual(first);
    expect((await readLastEserviceTemplateEvent(template.id)).version).toBe(
      "3"
    );
    const second = await eserviceTemplateService.patchUpdateEServiceTemplate(
      template.id,
      {
        description: "Second updated description",
        intendedTarget: "Second intended target",
      },
      ctx
    );
    expect(second.metadata.version).toBe(5);
    expect(
      await readEventByStreamIdAndVersion(
        template.id,
        4,
        "eservice_template",
        postgresDB
      )
    ).toMatchObject({
      type: "EServiceTemplateDescriptionUpdated",
      correlation_id: ctx.correlationId,
    });
    expect((await readLastEserviceTemplateEvent(template.id)).type).toBe(
      "EServiceTemplateIntendedTargetUpdated"
    );
  });

  it.each([
    {
      seed: { name: "Template https://example.com" },
      text: "Template https://example.com",
    },
    {
      seed: { description: "Details at www.example.com" },
      text: "Details at www.example.com",
    },
    {
      seed: { intendedTarget: "Target http://example.com" },
      text: "Target http://example.com",
    },
  ])(
    "should validate all metadata before side effects: $seed",
    async ({ seed, text }) => {
      const template: EServiceTemplate = {
        ...getMockEServiceTemplate(),
        technology: "Rest",
        versions: [
          {
            ...getMockEServiceTemplateVersion(),
            interface: getMockDocument(),
            asyncExchangeCallbackInterface: getMockDocument(),
          },
        ],
      };
      await addOneEServiceTemplate(template);
      const deleteSpy = vi.spyOn(fileManager, "delete").mockClear();
      await expect(
        eserviceTemplateService.patchUpdateEServiceTemplate(
          template.id,
          { technology: "SOAP", ...seed },
          getMockContextM2MAdmin({ organizationId: template.creatorId })
        )
      ).rejects.toThrowError(hyperlinkDetectionError(text));
      expect(deleteSpy).not.toHaveBeenCalled();
      expect((await readLastEserviceTemplateEvent(template.id)).version).toBe(
        "0"
      );
    }
  );
});
