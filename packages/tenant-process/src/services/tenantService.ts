import {
  AuthData,
  CreateEvent,
  eventRepository,
  initDB,
} from "pagopa-interop-commons";
import {
  Tenant,
  TenantEvent,
  TenantKind,
  WithMetadata,
  tenantEventToBinaryData,
} from "pagopa-interop-models";
import { TenantProcessConfig } from "../utilities/config.js";
import { toCreateEventTenantUpdated } from "../model/domain/toEvent.js";
import { ApiTenantMailsSeed } from "../model/types.js";
import { toTenantMails } from "../model/domain/apiConverter.js";
import {
  assertResourceAllowed,
  assertTenantExists,
  getTenantKindLoadingCertifiedAttributes,
} from "./validators.js";
import { ReadModelService } from "./readModelService.js";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function tenantServiceBuilder(
  config: TenantProcessConfig,
  readModelService: ReadModelService
) {
  const repository = eventRepository(
    initDB({
      username: config.eventStoreDbUsername,
      password: config.eventStoreDbPassword,
      host: config.eventStoreDbHost,
      port: config.eventStoreDbPort,
      database: config.eventStoreDbName,
      schema: config.eventStoreDbSchema,
      useSSL: config.eventStoreDbUseSSL,
    }),
    tenantEventToBinaryData
  );
  return {
    async updateTenant({
      tenantId,
      mailsSeed,
      authData,
    }: {
      tenantId: string;
      mailsSeed: ApiTenantMailsSeed;
      authData: AuthData;
    }): Promise<string> {
      await assertResourceAllowed(tenantId, authData);
      const tenant = await readModelService.getTenantById(tenantId);
      assertTenantExists(tenantId, tenant);
      const tenantKind =
        tenant.data.kind ||
        (await getTenantKindLoadingCertifiedAttributes(
          readModelService,
          tenant.data.attributes,
          tenant.data.externalId
        ));

      return await repository.createEvent(
        await updateTenantLogic({
          tenant,
          mailsSeed,
          kind: tenantKind,
        })
      );
    },
  };
}

export async function updateTenantLogic({
  tenant,
  mailsSeed,
  kind,
}: {
  tenant: WithMetadata<Tenant>;
  mailsSeed: ApiTenantMailsSeed;
  kind: TenantKind;
}): Promise<CreateEvent<TenantEvent>> {
  const updatedTenant: Tenant = {
    ...tenant.data,
    mails: toTenantMails(mailsSeed),
    kind,
    updatedAt: new Date(),
  };

  return toCreateEventTenantUpdated(
    tenant.data.id,
    tenant.metadata.version,
    updatedTenant
  );
}
