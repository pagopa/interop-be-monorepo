import { uuid } from "uuidv4";
import { EServiceSeed } from "../../model/domain/models.js";
import { CreateEvent } from "../events.js";

export const eserviceSeedToCreateEvent = (
  eserviceSeed: EServiceSeed
): CreateEvent<EServiceSeed> => ({
  streamId: uuid(),
  version: 0,
  type: "EServiceCreated",
  data: eserviceSeed,
});
