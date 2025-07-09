/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { ReadModelRepository } from "pagopa-interop-commons";
import {
  AgreementState,
  DelegationState,
  DescriptorState,
  EServiceTemplateVersionState,
  PurposeVersionState,
} from "pagopa-interop-models";
import {
  ExportedAgreement,
  ExportedEService,
  ExportedPurpose,
  ExportedTenant,
  ExportedDelegation,
  ExportedEServiceTemplate,
} from "../config/models/models.js";

export function readModelServiceBuilder(
  readModelRepository: ReadModelRepository
) {
  const {
    eservices,
    purposes,
    tenants,
    agreements,
    delegations,
    eserviceTemplates,
  } = readModelRepository;

  return {
    async getTenants(): Promise<ExportedTenant[]> {
      return tenants
        .find({ "data.selfcareId": { $exists: true } })
        .map(({ data }) => ExportedTenant.parse(data))
        .toArray();
    },
    async getEServices(): Promise<ExportedEService[]> {
      return eservices
        .find({
          $or: [
            {
              "data.descriptors.1": { $exists: true },
            },
            {
              "data.descriptors": {
                $size: 1,
                $elemMatch: {
                  state: {
                    $in: [
                      "Published",
                      "Archived",
                      "Suspended",
                      "Deprecated",
                    ] satisfies DescriptorState[],
                  },
                },
              },
            },
          ],
        })
        .map(({ data }) =>
          ExportedEService.parse({
            ...data,
            descriptors: data.descriptors.filter(
              (descriptor) =>
                descriptor.state !== "Draft" &&
                descriptor.state !== "WaitingForApproval"
            ),
          })
        )
        .toArray();
    },
    async getAgreements(): Promise<ExportedAgreement[]> {
      return agreements
        .find({
          "data.state": { $ne: "Draft" satisfies AgreementState },
        })
        .map(({ data }) => ExportedAgreement.parse(data))
        .toArray();
    },
    async getPurposes(): Promise<ExportedPurpose[]> {
      return purposes
        .find({
          $or: [
            {
              "data.versions.1": { $exists: true },
            },
            {
              "data.versions": {
                $size: 1,
                $elemMatch: {
                  state: {
                    $in: [
                      "Active",
                      "Archived",
                      "Suspended",
                      "Rejected",
                    ] satisfies PurposeVersionState[],
                  },
                },
              },
            },
          ],
        })
        .map(({ data }) => ExportedPurpose.parse(data))
        .toArray();
    },
    async getDelegations(): Promise<ExportedDelegation[]> {
      return delegations
        .find({
          "data.state": { $ne: "WaitingForApproval" satisfies DelegationState },
        })
        .map(({ data }) => ExportedDelegation.parse(data))
        .toArray();
    },

    async getEServiceTemplates(): Promise<ExportedEServiceTemplate[]> {
      return eserviceTemplates
        .find({
          $or: [
            {
              "data.versions.1": { $exists: true },
            },
            {
              "data.versions": {
                $size: 1,
                $elemMatch: {
                  state: {
                    $in: [
                      "Deprecated",
                      "Published",
                      "Suspended",
                    ] satisfies EServiceTemplateVersionState[],
                  },
                },
              },
            },
          ],
        })
        .map(({ data }) =>
          ExportedEServiceTemplate.parse({
            ...data,
            versions: data.versions.filter(
              (version) => version.state !== "Draft"
            ),
          })
        )
        .toArray();
    },
  };
}

export type ReadModelService = ReturnType<typeof readModelServiceBuilder>;
