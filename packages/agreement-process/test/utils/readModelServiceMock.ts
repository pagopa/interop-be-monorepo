import {
  Agreement,
  EService,
  Tenant,
  Attribute,
  ListResult,
  WithMetadata,
} from "pagopa-interop-models";
import {
  CompactOrganization,
  CompactEService,
} from "../src/model/domain/models.js";
import {
  ReadModelService,
  AgreementQueryFilters,
} from "../src/services/readmodel/readModelService.js";

export class ReadModelServiceMock {
  public agreements: Agreement[] = [];
  public eServices: EService[] = [];
  public tenants: Tenant[] = [];
  public attributes: Attribute[] = [];

  public queryFunctions(): ReadModelService {
    return {
      getAgreements: this.getAgreements.bind(this),
      readAgreementById: this.readAgreementById.bind(this),
      getAllAgreements: this.getAllAgreements.bind(this),
      getEServiceById: this.getEServiceById.bind(this),
      getTenantById: this.getTenantById.bind(this),
      getAttributeById: this.getAttributeById.bind(this),
      listConsumers: this.listConsumers.bind(this),
      listProducers: this.listProducers.bind(this),
      listEServicesAgreements: this.listEServicesAgreements.bind(this),
    };
  }

  private async getAgreements(
    _filters: AgreementQueryFilters,
    _limit: number,
    _offset: number
  ): Promise<ListResult<Agreement>> {
    return {
      results: this.agreements,
      totalCount: this.agreements.length,
    };
  }

  private async readAgreementById(
    agreementId: string
  ): Promise<WithMetadata<Agreement> | undefined> {
    const agreement = this.agreements.find((a) => a.id === agreementId);
    return (
      agreement && {
        data: agreement,
        metadata: { version: 0 },
      }
    );
  }

  private async getAllAgreements(
    _filters: AgreementQueryFilters
  ): Promise<Array<WithMetadata<Agreement>>> {
    return this.agreements.map((a) => ({ data: a, metadata: { version: 0 } }));
  }

  private async getEServiceById(
    id: string
  ): Promise<WithMetadata<EService> | undefined> {
    const eService = this.eServices.find((es) => es.id === id);
    return (
      eService && {
        data: eService,
        metadata: { version: 0 },
      }
    );
  }

  private async getTenantById(
    tenantId: string
  ): Promise<WithMetadata<Tenant> | undefined> {
    const tenant = this.tenants.find((t) => t.id === tenantId);
    return (
      tenant && {
        data: tenant,
        metadata: { version: 0 },
      }
    );
  }
  private async getAttributeById(
    id: string
  ): Promise<WithMetadata<Attribute> | undefined> {
    const attribute = this.attributes.find((a) => a.id === id);
    return (
      attribute && {
        data: attribute,
        metadata: { version: 0 },
      }
    );
  }

  private async listConsumers(
    _name: string | undefined,
    _limit: number,
    _offset: number
  ): Promise<ListResult<CompactOrganization>> {
    const consumerIds = this.agreements.map((a) => a.consumerId);
    return {
      results: this.tenants
        .filter((t) => consumerIds.includes(t.id))
        .map((t) => ({
          id: t.id,
          name: t.name,
        })),
      totalCount: this.tenants.length,
    };
  }
  private async listProducers(
    _name: string | undefined,
    _limit: number,
    _offset: number
  ): Promise<ListResult<CompactOrganization>> {
    const producerIds = this.agreements.map((a) => a.producerId);
    return {
      results: this.tenants
        .filter((t) => producerIds.includes(t.id))
        .map((t) => ({
          id: t.id,
          name: t.name,
        })),
      totalCount: this.tenants.length,
    };
  }
  private async listEServicesAgreements(
    _eServiceName: string | undefined,
    _consumerIds: string[],
    _producerIds: string[],
    _limit: number,
    _offset: number
  ): Promise<ListResult<CompactEService>> {
    return {
      results: this.eServices.map((es) => ({
        id: es.id,
        name: es.name,
      })),
      totalCount: this.eServices.length,
    };
  }
}
