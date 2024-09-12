import { PurposeState, ReadModelClient } from '@interop-be-reports/commons'
import { Purpose } from '../models/index.js'

export class ReadModelQueriesClient {
  constructor(private readModel: ReadModelClient) {}

  async getSENDPurposes(pnEServiceId: string, comuniAttributeId: string): Promise<Array<Purpose>> {
    return await this.readModel.purposes
      .aggregate([
        {
          $match: {
            'data.eserviceId': pnEServiceId,
            'data.versions.state': {
              $in: ['Active', 'Suspended', 'WaitingForApproval'] satisfies Array<PurposeState>,
            },
          },
        },
        {
          $lookup: {
            from: 'tenants',
            localField: 'data.consumerId',
            foreignField: 'data.id',
            as: 'data.consumer',
          },
        },
        {
          $addFields: {
            'data.consumer': { $arrayElemAt: ['$data.consumer', 0] },
          },
        },
        {
          $match: {
            'data.consumer.data.attributes': {
              $elemMatch: { id: comuniAttributeId },
            },
          },
        },
        {
          $project: {
            _id: 0,
            'data.id': 1,
            'data.consumerId': 1,
            'data.versions.firstActivationAt': 1,
            'data.versions.state': 1,
            'data.versions.dailyCalls': 1,
            'data.consumerName': '$data.consumer.data.name',
            'data.consumerExternalId': '$data.consumer.data.externalId',
          },
        },
      ])
      .map(({ data }) => Purpose.parse(data))
      .toArray()
  }

  /**
   * Closes the connection to the database
   * */
  async close(): Promise<void> {
    await this.readModel.close()
  }
}
