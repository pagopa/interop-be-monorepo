/* eslint-disable functional/immutable-data */
/* eslint-disable fp/no-delete */
import {
  agreementState,
  DelegationId,
  delegationKind,
  delegationState,
  descriptorState,
  EServiceId,
  EServiceTemplateId,
  EServiceTemplateVersion,
  eserviceTemplateVersionState,
  generateId,
  purposeVersionState,
  Tenant,
  TenantId,
  unsafeBrandId,
} from "pagopa-interop-models";
import { describe, it, expect } from "vitest";
import {
  getMockAgreement,
  getMockDelegation,
  getMockDescriptor,
  getMockDescriptorList,
  getMockDocument,
  getMockEService,
  getMockEServiceTemplate,
  getMockEServiceTemplateVersion,
  getMockPurpose,
  getMockPurposeVersion,
  getMockTenant,
  randomArrayItem,
} from "pagopa-interop-commons-test";
import {
  seedAgreements,
  seedEServices,
  seedPurposes,
  seedTenants,
  seedDelegations,
  seedEServiceTemplates,
  readModelService,
} from "./utils.js";

describe("read-model-queries.service", () => {
  describe("getTenants", async () => {
    it("should return all tenants", async () => {
      const tenantsData: Tenant[] = [getMockTenant(), getMockTenant()];
      await seedTenants(tenantsData);

      const result = await readModelService.getTenants();
      expect(result).toHaveLength(tenantsData.length);
    });

    it("should return empty array if no tenants are found", async () => {
      const result = await readModelService.getTenants();
      expect(result).toHaveLength(0);
    });

    it("should not return tenants without 'selfcareId'", async () => {
      const tenantsData: Tenant[] = [getMockTenant(), getMockTenant()];
      delete tenantsData[1].selfcareId;
      await seedTenants(tenantsData);

      const result = await readModelService.getTenants();
      expect(result).toHaveLength(1);
    });
  });

  describe("getEServices", async () => {
    const validEserviceDescriptorStates = Object.values(descriptorState).filter(
      (state) =>
        state !== descriptorState.draft &&
        state !== descriptorState.waitingForApproval
    );

    it("should return all eServices", async () => {
      const eservicesData = [
        getMockEService(
          generateId<EServiceId>(),
          generateId<TenantId>(),
          getMockDescriptorList().map((d) => ({
            ...d,
            state: randomArrayItem(validEserviceDescriptorStates),
          }))
        ),
        getMockEService(
          generateId<EServiceId>(),
          generateId<TenantId>(),
          getMockDescriptorList().map((d) => ({
            ...d,
            state: randomArrayItem(validEserviceDescriptorStates),
          }))
        ),
      ];
      await seedEServices(eservicesData);

      const result = await readModelService.getEServices();
      expect(result).toHaveLength(eservicesData.length);
    });

    it("should not return draft descriptors in the e-service", async () => {
      const eservicesData = [
        getMockEService(generateId<EServiceId>(), generateId<TenantId>(), [
          {
            ...getMockDescriptor(),
            id: unsafeBrandId("a9c705d9-ecdb-47ff-bcd2-667495b111f2"),
            version: "2",
            state: descriptorState.published,
          },
          {
            ...getMockDescriptor(),
            id: unsafeBrandId("a9c705d9-ecdb-47ff-bcd2-667495b111f3"),
            state: descriptorState.draft,
            version: "1",
            attributes: {
              certified: [],
              verified: [],
              declared: [],
            },
          },
        ]),
      ];

      await seedEServices(eservicesData);

      const result = await readModelService.getEServices();
      expect(result).toHaveLength(eservicesData.length);
      expect(result.at(0)?.descriptors).toHaveLength(1);
      expect(result.at(0)?.descriptors.at(0)?.state).toEqual("Published");
    });

    it("should not return waiting for approval descriptors in the e-service", async () => {
      const eservicesData = [
        getMockEService(generateId<EServiceId>(), generateId<TenantId>(), [
          {
            ...getMockDescriptor(),
            id: unsafeBrandId("a9c705d9-ecdb-47ff-bcd2-667495b111f2"),
            version: "2",
            state: descriptorState.published,
          },
          {
            ...getMockDescriptor(),
            id: unsafeBrandId("a9c705d9-ecdb-47ff-bcd2-667495b111f3"),
            state: descriptorState.waitingForApproval,
            version: "1",
            attributes: {
              certified: [],
              verified: [],
              declared: [],
            },
          },
        ]),
      ];

      await seedEServices(eservicesData);

      const result = await readModelService.getEServices();
      expect(result).toHaveLength(eservicesData.length);
      expect(result.at(0)?.descriptors).toHaveLength(1);
      expect(result.at(0)?.descriptors.at(0)?.state).toEqual("Published");
    });

    it("should return empty array if no eServices are found", async () => {
      const result = await readModelService.getEServices();
      expect(result).toHaveLength(0);
    });

    it("should not return eServices with only one descriptor with Draft state", async () => {
      const eservicesData = [
        getMockEService(generateId<EServiceId>(), generateId<TenantId>(), [
          getMockDescriptor(randomArrayItem(validEserviceDescriptorStates)),
        ]),
        getMockEService(generateId<EServiceId>(), generateId<TenantId>(), [
          getMockDescriptor(descriptorState.draft),
        ]),
      ];

      await seedEServices(eservicesData);

      const result = await readModelService.getEServices();
      expect(result).toHaveLength(1);
      expect(result.at(0)?.id).toEqual(eservicesData.at(0)?.id);
    });

    it("should not return eServices with no descriptors", async () => {
      const eservicesData = [
        getMockEService(generateId<EServiceId>(), generateId<TenantId>(), [
          getMockDescriptor(descriptorState.published),
        ]),
        getMockEService(generateId<EServiceId>(), generateId<TenantId>(), []),
      ];

      await seedEServices(eservicesData);

      const result = await readModelService.getEServices();
      expect(result).toHaveLength(1);
      expect(result.at(0)?.id).toEqual(eservicesData.at(0)?.id);
    });
  });

  describe("getAgreements", async () => {
    const validAgreementStates = Object.values(agreementState).filter(
      (state) => state !== agreementState.draft
    );

    it("should return all agreements", async () => {
      const agreementsData = [
        getMockAgreement(
          generateId<EServiceId>(),
          generateId<TenantId>(),
          randomArrayItem(validAgreementStates)
        ),
        getMockAgreement(
          generateId<EServiceId>(),
          generateId<TenantId>(),
          randomArrayItem(validAgreementStates)
        ),
      ];
      await seedAgreements(agreementsData);

      const result = await readModelService.getAgreements();
      expect(result).toHaveLength(agreementsData.length);
    });

    it("should return empty array if no agreements are found", async () => {
      const result = await readModelService.getAgreements();
      expect(result).toHaveLength(0);
    });

    it("should not return agreements in 'Draft' state", async () => {
      const agreementsData = [
        getMockAgreement(
          generateId<EServiceId>(),
          generateId<TenantId>(),
          randomArrayItem(validAgreementStates)
        ),
        getMockAgreement(
          generateId<EServiceId>(),
          generateId<TenantId>(),
          agreementState.draft
        ),
      ];

      await seedAgreements(agreementsData);

      const result = await readModelService.getAgreements();
      expect(result).toHaveLength(1);
    });
  });

  describe("getPurposes", async () => {
    const validPurposeVersionStates = Object.values(purposeVersionState).filter(
      (state) =>
        state !== purposeVersionState.draft &&
        state !== purposeVersionState.waitingForApproval
    );

    it("should return all purposes", async () => {
      const purposesData = [
        getMockPurpose([
          getMockPurposeVersion(randomArrayItem(validPurposeVersionStates)),
        ]),
        getMockPurpose([
          getMockPurposeVersion(randomArrayItem(validPurposeVersionStates)),
        ]),
      ];

      await seedPurposes(purposesData);

      const result = await readModelService.getPurposes();
      expect(result).toHaveLength(purposesData.length);
    });

    it("should return empty array if no purposes are found", async () => {
      const result = await readModelService.getPurposes();
      expect(result).toHaveLength(0);
    });

    it("should not return purposes with only one version in 'Draft' or 'WaitingForApproval' state", async () => {
      const purposesData = [
        getMockPurpose([
          getMockPurposeVersion(randomArrayItem(validPurposeVersionStates)),
        ]),
        getMockPurpose([
          getMockPurposeVersion(purposeVersionState.waitingForApproval),
        ]),
        getMockPurpose([getMockPurposeVersion(purposeVersionState.draft)]),
      ];

      await seedPurposes(purposesData);

      const result = await readModelService.getPurposes();

      expect(result).toHaveLength(1);
      expect(result.at(0)?.id).toEqual(purposesData.at(0)?.id);
    });

    it("should not return purposes with no versions", async () => {
      const purposesData = [
        getMockPurpose([getMockPurposeVersion(purposeVersionState.active)]),
        getMockPurpose(),
      ];

      await seedPurposes(purposesData);

      const result = await readModelService.getPurposes();

      expect(result).toHaveLength(1);
      expect(result.at(0)?.id).toEqual(purposesData.at(0)?.id);
    });
  });

  describe("getDelegations", async () => {
    const validDelegationStates = Object.values(delegationState).filter(
      (state) => state !== delegationState.waitingForApproval
    );

    it("should return all delegations", async () => {
      const delegationsData = [
        getMockDelegation({
          kind: delegationKind.delegatedConsumer,
          id: generateId<DelegationId>(),
          state: randomArrayItem(validDelegationStates),
        }),
        getMockDelegation({
          kind: delegationKind.delegatedConsumer,
          id: generateId<DelegationId>(),
          state: randomArrayItem(validDelegationStates),
        }),
      ];

      await seedDelegations(delegationsData);

      const result = await readModelService.getDelegations();
      expect(result).toHaveLength(delegationsData.length);
    });

    it("should return empty array if no delegations are found", async () => {
      const result = await readModelService.getDelegations();
      expect(result).toHaveLength(0);
    });

    it("should not return delegations in 'Waiting for approval' state", async () => {
      const delegationsData = [
        getMockDelegation({
          kind: delegationKind.delegatedConsumer,
          id: generateId<DelegationId>(),
          state: randomArrayItem(validDelegationStates),
        }),
        getMockDelegation({
          kind: delegationKind.delegatedConsumer,
          id: generateId<DelegationId>(),
          state: delegationState.waitingForApproval,
        }),
      ];

      await seedDelegations(delegationsData);

      const result = await readModelService.getDelegations();
      expect(result).toHaveLength(1);
    });
  });

  describe("getEServiceTemplates", async () => {
    const validEserviceTemplateVersionStates = Object.values(
      eserviceTemplateVersionState
    ).filter((state) => state !== eserviceTemplateVersionState.draft);

    const eserviceTemplateVersion: EServiceTemplateVersion = {
      ...getMockEServiceTemplateVersion(),
      state: randomArrayItem(validEserviceTemplateVersionStates),
      interface: getMockDocument(),
    };

    it("should return all eService templates", async () => {
      const eserviceTemplateVersion: EServiceTemplateVersion = {
        ...getMockEServiceTemplateVersion(),
        state: randomArrayItem(validEserviceTemplateVersionStates),
        interface: getMockDocument(),
      };

      const eserviceTemplatesData = [
        getMockEServiceTemplate(
          generateId<EServiceTemplateId>(),
          generateId<TenantId>(),
          [eserviceTemplateVersion]
        ),
      ];
      await seedEServiceTemplates(eserviceTemplatesData);

      const result = await readModelService.getEServiceTemplates();
      expect(result).toHaveLength(eserviceTemplatesData.length);
    });

    it("should not return draft versions in the eService Template", async () => {
      const eserviceTemplatesData = [
        getMockEServiceTemplate(
          generateId<EServiceTemplateId>(),
          generateId<TenantId>(),
          [
            {
              ...getMockEServiceTemplateVersion(),
              state: eserviceTemplateVersionState.published,
              interface: getMockDocument(),
            },
            {
              ...getMockEServiceTemplateVersion(),
              state: eserviceTemplateVersionState.draft,
            },
          ]
        ),
      ];

      await seedEServiceTemplates(eserviceTemplatesData);

      const result = await readModelService.getEServiceTemplates();
      expect(result).toHaveLength(eserviceTemplatesData.length);
      expect(result.at(0)?.versions).toHaveLength(1);
      expect(result.at(0)?.versions.at(0)?.state).toEqual("Published");
    });

    it("should return empty array if no eService templates are found", async () => {
      const result = await readModelService.getEServiceTemplates();
      expect(result).toHaveLength(0);
    });

    it("should not return eService templates with only one version with Draft state", async () => {
      const eserviceTemplatesData = [
        getMockEServiceTemplate(
          generateId<EServiceTemplateId>(),
          generateId<TenantId>(),
          [eserviceTemplateVersion]
        ),
        getMockEServiceTemplate(
          generateId<EServiceTemplateId>(),
          generateId<TenantId>(),
          [
            {
              ...getMockEServiceTemplateVersion(),
              state: eserviceTemplateVersionState.draft,
            },
          ]
        ),
      ];

      await seedEServiceTemplates(eserviceTemplatesData);

      const result = await readModelService.getEServiceTemplates();
      expect(result).toHaveLength(1);
      expect(result.at(0)?.id).toEqual(eserviceTemplatesData.at(0)?.id);
    });
  });
});
