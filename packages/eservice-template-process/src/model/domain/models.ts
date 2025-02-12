import { z } from "zod";
import { DescriptorState, EServiceId } from "pagopa-interop-models";

export type ApiGetEServiceTemplateIstancesFilters = {
  producerName?: string;
  states: DescriptorState[];
};

export const EServiceTemplateInstance = z.object({
  id: EServiceId,
  producerName: z.string(),
  state: DescriptorState,
  instanceId: z.string().optional(),
  version: z.string(),
});

export type EServiceTemplateInstance = z.infer<typeof EServiceTemplateInstance>;
