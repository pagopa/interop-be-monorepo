import { match } from "ts-pattern";
import {
  TenantEventEnvelopeV1,
  fromTenantV1,
  missingKafkaMessageDataError,
  unsafeBrandId,
} from "pagopa-interop-models";
import { TenantWriterService } from "./tenantWriterService.js";

export async function handleMessageV1(
  message: TenantEventEnvelopeV1,
  tenantWriterService: TenantWriterService
): Promise<void> {
  await match(message)
    .with(
      { type: "TenantCreated" },
      { type: "TenantUpdated" },
      { type: "TenantMailAdded" },
      async (msg) => {
        if (!msg.data.tenant) {
          throw missingKafkaMessageDataError("tenant", msg.type);
        }

        await tenantWriterService.upsertTenant(
          fromTenantV1(msg.data.tenant),
          message.version
        );
      }
    )
    .with({ type: "TenantDeleted" }, async (msg) => {
      await tenantWriterService.deleteTenantById(
        unsafeBrandId(msg.data.tenantId),
        message.version
      );
    })
    .with({ type: "SelfcareMappingCreated" }, async (msg) => {
      await tenantWriterService.setSelfcareId(
        unsafeBrandId(msg.data.tenantId),
        msg.data.selfcareId,
        msg.version
      );
    })
    .with({ type: "SelfcareMappingDeleted" }, async () => Promise.resolve())
    .with({ type: "TenantMailDeleted" }, async (msg) => {
      await tenantWriterService.deleteTenantMailById(
        unsafeBrandId(msg.data.tenantId),
        msg.data.mailId,
        msg.version
      );
    })
    .exhaustive();
}
