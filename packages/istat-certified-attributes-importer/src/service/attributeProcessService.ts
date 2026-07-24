import { attributeRegistryApi } from "pagopa-interop-api-clients";
import { CORRELATION_ID_HEADER } from "pagopa-interop-commons";
import { Attribute, unsafeBrandId, attributeKind } from "pagopa-interop-models";

import { InteropContext } from "../model/interopContextModel.js";

export class AttributeProcessService {
  constructor(
    private client: ReturnType<
      typeof attributeRegistryApi.createAttributeApiClient
    >
  ) {}

  public async createInternalCertifiedDiscreteAttribute(
    origin: string,
    code: string,
    name: string,
    description: string,
    context: InteropContext
  ): Promise<Attribute> {
    const seed: attributeRegistryApi.InternalCertifiedDiscreteAttributeSeed = {
      name,
      description,
      origin,
      code,
    };

    const response = await this.client.createInternalCertifiedDiscreteAttribute(
      seed,
      {
        headers: {
          [CORRELATION_ID_HEADER]: context.correlationId,
          Authorization: `Bearer ${context.bearerToken}`,
        },
      }
    );

    return {
      id: unsafeBrandId(response.id),
      name: response.name,
      description: response.description,
      kind: attributeKind.certifiedDiscrete,
      creationTime: new Date(response.creationTime),
      origin: response.origin,
      code: response.code,
    };
  }
}
