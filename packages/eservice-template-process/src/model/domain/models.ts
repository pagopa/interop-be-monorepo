/*
  NOTE: Temporary file to hold all the models imported from github packages
  This file will be removed once all models are converted from scala.
 */
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
  instanceId: z.string(),
  version: z.string(),
});

export type EServiceTemplateInstance = z.infer<typeof EServiceTemplateInstance>;
