/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { ReadModelRepository } from "pagopa-interop-commons";
import {
  AgreementState,
  DescriptorState,
  PurposeVersionState,
} from "pagopa-interop-models";
import {
  ExportedAgreement,
  ExportedEService,
  ExportedPurpose,
  ExportedTenant,
} from "../config/models/models.js";

export function readModelServiceBuilder(
  readModelRepository: ReadModelRepository
) {
  const { eservices, purposes, tenants, agreements } = readModelRepository;

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
  };
}

export type ReadModelService = ReturnType<typeof readModelServiceBuilder>;
