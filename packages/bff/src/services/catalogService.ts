/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { WithLogger } from "pagopa-interop-commons";
import {
  DescriptorId,
  EServiceId,
  TenantId,
  unsafeBrandId,
} from "pagopa-interop-models";
import {
  BffCatalogApiEService,
  BffCatalogApiProducersEServiceDescriptorResponse,
  BffGetCatalogApiHeaders,
  BffGetCatalogApiResponse,
} from "../model/api/bffTypes.js";
import {
  toBffCatalogApiDescriptorAttribute,
  toBffCatalogApiDescriptorInterface,
  toBffCatalogApiEService,
  toBffCatalogApiProducerDescriptorEService,
} from "../model/api/converters/catalogClientApiConverter.js";

import {
  CatalogProcessApiQueryParam,
  EServiceCatalogProcessApi,
  EServiceCatalogProcessApiDescriptor,
  EServicesCatalogProcessApiResponse,
  descriptorApiState,
} from "../model/api/catalogTypes.js";

import { TenantProcessApiResponse } from "../model/api/tenantTypes.js";

import {
  eserviceDescriptorNotFound,
  invalidEServiceRequester,
} from "../model/domain/errors.js";
import { certifiedAttributesSatisfied } from "../model/validators.js";
import {
  AgreementProcessClient,
  AttributeProcessClient,
  CatalogProcessClient,
  TenantProcessClient,
} from "../providers/clientProvider.js";
import { BffAppContext } from "../utilities/context.js";
import { getLatestAgreement } from "./agreementService.js";

const ACTIVE_DESCRIPTOR_STATES_FILTER = [
  descriptorApiState.DRAFT,
  descriptorApiState.SUSPENDED,
  descriptorApiState.DEPRECATED,
];

export type CatalogService = ReturnType<typeof catalogServiceBuilder>;

const enhanceCatalogEService =
  (
    tenantProcessClient: TenantProcessClient,
    agreementProcessClient: AgreementProcessClient,
    headers: BffGetCatalogApiHeaders,
    requesterId: string
  ): ((
    eservice: EServiceCatalogProcessApi
  ) => Promise<BffCatalogApiEService>) =>
  async (
    eservice: EServiceCatalogProcessApi
  ): Promise<BffCatalogApiEService> => {
    const producerTenant = await tenantProcessClient.getTenant({
      headers,
      params: {
        id: eservice.producerId,
      },
    });

    const requesterTenant: TenantProcessApiResponse =
      requesterId !== eservice.producerId
        ? await tenantProcessClient.getTenant({
            headers,
            params: {
              id: requesterId,
            },
          })
        : producerTenant;

    const latestActiveDescriptor:
      | EServiceCatalogProcessApiDescriptor
      | undefined = eservice.descriptors
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
      certifiedAttributesSatisfied(latestActiveDescriptor, requesterTenant);

    return toBffCatalogApiEService(
      eservice,
      requesterTenant,
      hasCertifiedAttributes,
      isRequesterEqProducer,
      latestActiveDescriptor,
      latestAgreement
    );
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
      queries: CatalogProcessApiQueryParam
    ): Promise<BffGetCatalogApiResponse> => {
      const requesterId = context.authData.organizationId;
      const { offset, limit } = queries;
      const eservicesResponse: EServicesCatalogProcessApiResponse =
        await catalogProcessClient.getEServices({
          headers: context.headers,
          queries,
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
      const response: BffGetCatalogApiResponse = {
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
      queries: CatalogProcessApiQueryParam,
      context: WithLogger<BffAppContext>
    ): Promise<BffCatalogApiProducersEServiceDescriptorResponse> => {
      const requesterId = context.authData.organizationId;
      const headers = context.headers;

      const eservice: EServiceCatalogProcessApi =
        await catalogProcessClient.getEServiceById({
          params: {
            eServiceId,
          },
          headers,
        });

      if (eservice.producerId === requesterId) {
        throw invalidEServiceRequester(
          unsafeBrandId<EServiceId>(eServiceId),
          unsafeBrandId<TenantId>(requesterId)
        );
      }

      const descriptor = eservice.descriptors.find(
        (e) => e.descriptorId === descriptorId
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

      const attributes = (
        await attributeProcessClient.getBulkedAttributes(
          descriptorAttributeIds,
          {
            headers,
            queries,
          }
        )
      ).results;

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
