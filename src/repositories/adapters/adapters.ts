import { v4 as uuidv4 } from "uuid";
import { EServiceSeed } from "../../model/domain/models.js";
import { CreateEvent } from "../events.js";

export const eserviceSeedToCreateEvent = (
  eserviceSeed: EServiceSeed
): CreateEvent<EServiceSeed> => ({
  streamId: uuidv4(),
  version: 0,
  type: "EServiceCreated",
  data: eserviceSeed,
});
