/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { WithLogger } from "pagopa-interop-commons";
import {
  catalogApi,
  tenantApi,
  bffApi,
  attributeRegistryApi,
} from "pagopa-interop-api-clients";
import {
  DescriptorId,
  EServiceId,
  TenantId,
  unsafeBrandId,
} from "pagopa-interop-models";
import { descriptorApiState } from "../model/api/catalogTypes.js";
import {
  toBffCatalogApiDescriptorAttribute,
  toBffCatalogApiDescriptorInterface,
  toBffCatalogApiEService,
  toBffCatalogApiProducerDescriptorEService,
} from "../model/api/converters/catalogClientApiConverter.js";

import { catalogProcessApiEServiceDescriptorCertifiedAttributesSatisfied } from "../model/validators.js";
import {
  eserviceDescriptorNotFound,
  invalidEServiceRequester,
} from "../model/domain/errors.js";
import {
  AgreementProcessClient,
  AttributeProcessClient,
  CatalogProcessClient,
  TenantProcessClient,
} from "../providers/clientProvider.js";
import { BffAppContext, Headers } from "../utilities/context.js";
import { getLatestAgreement } from "./agreementService.js";

const ACTIVE_DESCRIPTOR_STATES_FILTER = [
  descriptorApiState.PUBLISHED,
  descriptorApiState.SUSPENDED,
  descriptorApiState.DEPRECATED,
];

export type CatalogService = ReturnType<typeof catalogServiceBuilder>;

const enhanceCatalogEService =
  (
    tenantProcessClient: TenantProcessClient,
    agreementProcessClient: AgreementProcessClient,
    headers: Headers,
    requesterId: string
  ): ((eservice: catalogApi.EService) => Promise<bffApi.CatalogEService>) =>
  async (eservice: catalogApi.EService): Promise<bffApi.CatalogEService> => {
    const producerTenant = await tenantProcessClient.getTenant({
      headers,
      params: {
        id: eservice.producerId,
      },
    });

    const requesterTenant: tenantApi.Tenant =
      requesterId !== eservice.producerId
        ? await tenantProcessClient.getTenant({
            headers,
            params: {
              id: requesterId,
            },
          })
        : producerTenant;

    const latestActiveDescriptor: catalogApi.EServiceDescriptor | undefined =
      eservice.descriptors
        .filter((d) => ACTIVE_DESCRIPTOR_STATES_FILTER.includes(d.state))
        .sort((a, b) => Number(a.version) - Number(b.version))
        .at(-1);

    const latestAgreement = await getLatestAgreement(
      agreementProcessClient,
      requesterId,
      eservice,
      headers
    );

    const isRequesterEqProducer = requesterId === eservice.producerId;
    const hasCertifiedAttributes =
      latestActiveDescriptor !== undefined &&
      catalogProcessApiEServiceDescriptorCertifiedAttributesSatisfied(
        latestActiveDescriptor,
        requesterTenant
      );

    return toBffCatalogApiEService(
      eservice,
      producerTenant,
      hasCertifiedAttributes,
      isRequesterEqProducer,
      latestActiveDescriptor,
      latestAgreement
    );
  };

const getBulkAttributes = async (
  attributeProcessClient: AttributeProcessClient,
  headers: Headers,
  descriptorAttributeIds: string[]
) => {
  // Fetched all attributes in a recursive way
  const attributesBulk = async (
    offset: number,
    result: attributeRegistryApi.Attribute[]
  ): Promise<attributeRegistryApi.Attribute[]> => {
    const attributes = await attributeProcessClient.getBulkedAttributes(
      descriptorAttributeIds,
      {
        headers,
        queries: {
          limit: 50,
          offset,
        },
      }
    );

    if (attributes.totalCount <= 50) {
      return result.concat(attributes.results);
    } else {
      return await attributesBulk(offset + 50, result);
    }
  };

  return await attributesBulk(0, []);
};

export function catalogServiceBuilder(
  catalogProcessClient: CatalogProcessClient,
  tenantProcessClient: TenantProcessClient,
  agreementProcessClient: AgreementProcessClient,
  attributeProcessClient: AttributeProcessClient
) {
  return {
    getCatalog: async (
      context: WithLogger<BffAppContext>,
      queries: catalogApi.GetCatalogQueryParam
    ): Promise<bffApi.CatalogEServices> => {
      const requesterId = context.authData.organizationId;
      const { offset, limit } = queries;
      const eservicesResponse: catalogApi.EServices =
        await catalogProcessClient.getEServices({
          headers: context.headers,
          queries: {
            ...queries,
            eservicesIds: queries.eservicesIds.join(","),
            producersIds: queries.producersIds.join(","),
            states: queries.states.join(","),
            attributesIds: queries.attributesIds.join(","),
            agreementStates: queries.agreementStates.join(","),
          },
        });

      const results = await Promise.all(
        eservicesResponse.results.map(
          enhanceCatalogEService(
            tenantProcessClient,
            agreementProcessClient,
            context.headers,
            requesterId
          )
        )
      );
      const response: bffApi.CatalogEServices = {
        results,
        pagination: {
          offset,
          limit,
          totalCount: eservicesResponse.totalCount,
        },
      };
      return response;
    },
    getProducerEServiceDescriptor: async (
      eServiceId: string,
      descriptorId: string,
      context: WithLogger<BffAppContext>
    ): Promise<bffApi.ProducerEServiceDescriptor> => {
      const requesterId = context.authData.organizationId;
      const headers = context.headers;

      const eservice: catalogApi.EService =
        await catalogProcessClient.getEServiceById({
          params: {
            eServiceId,
          },
          headers,
        });

      if (eservice.producerId !== requesterId) {
        throw invalidEServiceRequester(
          unsafeBrandId<EServiceId>(eServiceId),
          unsafeBrandId<TenantId>(requesterId)
        );
      }

      const descriptor = eservice.descriptors.find(
        (e) => e.id === descriptorId
      );

      if (!descriptor) {
        throw eserviceDescriptorNotFound(
          unsafeBrandId<EServiceId>(eServiceId),
          unsafeBrandId<DescriptorId>(descriptorId)
        );
      }

      const descriptorAttributeIds: string[] = [
        ...descriptor.attributes.certified.flatMap((atts) =>
          atts.map((att) => att.id)
        ),
        ...descriptor.attributes.declared.flatMap((atts) =>
          atts.map((att) => att.id)
        ),
        ...descriptor.attributes.verified.flatMap((atts) =>
          atts.map((att) => att.id)
        ),
      ];

      const attributes = await getBulkAttributes(
        attributeProcessClient,
        headers,
        descriptorAttributeIds
      );

      const descriptorAttributes = {
        certified: [
          toBffCatalogApiDescriptorAttribute(
            attributes,
            descriptor.attributes.certified.flat()
          ),
        ],
        declared: [
          toBffCatalogApiDescriptorAttribute(
            attributes,
            descriptor.attributes.declared.flat()
          ),
        ],
        verified: [
          toBffCatalogApiDescriptorAttribute(
            attributes,
            descriptor.attributes.verified.flat()
          ),
        ],
      };

      const requesterTenant = await tenantProcessClient.getTenant({
        headers,
        params: {
          id: requesterId,
        },
      });

      return {
        id: descriptor.id,
        version: descriptor.version,
        description: descriptor.description,
        interface:
          descriptor.interface &&
          toBffCatalogApiDescriptorInterface(descriptor.interface),
        docs: descriptor.docs.map(toBffCatalogApiDescriptorInterface),
        state: descriptor.state,
        audience: descriptor.audience,
        voucherLifespan: descriptor.voucherLifespan,
        dailyCallsPerConsumer: descriptor.dailyCallsPerConsumer,
        dailyCallsTotal: descriptor.dailyCallsTotal,
        agreementApprovalPolicy: descriptor.agreementApprovalPolicy,
        attributes: descriptorAttributes,
        eservice: toBffCatalogApiProducerDescriptorEService(
          eservice,
          requesterTenant
        ),
      };
    },
  };
}
