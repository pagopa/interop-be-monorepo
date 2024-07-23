import { agreementApi, catalogApi } from "pagopa-interop-api-clients";
import { z } from "zod";

export const catalogApiDescriptorState =
  catalogApi.EServiceDescriptorState.Values;

export const agreementApiState = agreementApi.AgreementState.Values;

export const EserviceConsumer = z.object({
  descriptorVersion: z.number(),
  descriptorState: catalogApi.EServiceDescriptorState,
  agreementState: agreementApi.AgreementState,
  consumerName: z.string(),
  consumerExternalId: z.string(),
});

