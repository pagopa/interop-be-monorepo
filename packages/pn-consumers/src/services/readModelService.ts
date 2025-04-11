import { ReadModelRepository } from "pagopa-interop-commons";
import { PurposeVersionState } from "pagopa-interop-models";
import { Purpose } from "../models/purposeModel.js";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function readModelServiceBuilder(
  readModelRepository: ReadModelRepository
) {
  const { purposes } = readModelRepository;
  return {
    async getSENDPurposes(
      pnEServiceId: string,
      comuniAttributeId: string
    ): Promise<Purpose[]> {
      return await purposes
        .aggregate([
          {
            $match: {
              "data.eserviceId": pnEServiceId,
              "data.versions.state": {
                $in: [
                  "Active",
                  "Suspended",
                  "WaitingForApproval",
                ] satisfies PurposeVersionState[],
              },
            },
          },
          {
            $lookup: {
              from: "tenants",
              localField: "data.consumerId",
              foreignField: "data.id",
              as: "data.consumer",
            },
          },
          {
            $addFields: {
              "data.consumer": { $arrayElemAt: ["$data.consumer", 0] },
            },
          },
          {
            $match: {
              "data.consumer.data.attributes": {
                $elemMatch: { id: comuniAttributeId },
              },
            },
          },
          {
            $project: {
              _id: 0,
              "data.id": 1,
              "data.consumerId": 1,
              "data.versions.firstActivationAt": 1,
              "data.versions.state": 1,
              "data.versions.dailyCalls": 1,
              "data.consumerName": "$data.consumer.data.name",
              "data.consumerExternalId": "$data.consumer.data.externalId",
            },
          },
        ])
        .map(({ data }) => Purpose.parse(data))
        .toArray();
    },
  };
}
