import { match } from "ts-pattern";
import {
  TenantEventEnvelopeV1,
  fromTenantV1,
  genericInternalError,
  unsafeBrandId,
} from "pagopa-interop-models";
import { ReadModelService } from "./readModelService.js";

export async function handleMessageV1(
  message: TenantEventEnvelopeV1,
  readModelService: ReadModelService
): Promise<void> {
  await match(message)
    .with(
      { type: "TenantCreated" },
      { type: "TenantUpdated" },
      { type: "TenantMailAdded" },
      async (msg) => {
        if (!msg.data.tenant) {
          throw genericInternalError("Tenant not found in message");
        }

        await readModelService.upsertTenant(
          fromTenantV1(msg.data.tenant),
          message.version
        );
      }
    )
    .with({ type: "TenantDeleted" }, async (msg) => {
      await readModelService.deleteTenant(
        unsafeBrandId(msg.data.tenantId),
        message.version
      );
    })
    .with({ type: "SelfcareMappingCreated" }, async (msg) => {
      await readModelService.setSelfcareId(
        unsafeBrandId(msg.data.tenantId),
        msg.data.selfcareId,
        msg.version
      );
    })
    .with({ type: "SelfcareMappingDeleted" }, async () => Promise.resolve())
    .with({ type: "TenantMailDeleted" }, async (msg) => {
      await readModelService.deleteTenantMailById(
        unsafeBrandId(msg.data.tenantId),
        msg.data.mailId,
        msg.version
      );
    })
    .exhaustive();
}
