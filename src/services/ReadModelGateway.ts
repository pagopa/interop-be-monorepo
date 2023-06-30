/*  =======================================================================
  IMPORTANT: This service mocks all operations performed throught read models
===========================================================================  */

import * as Effect from "@effect/io/Effect";
import * as Option from "@effect/data/Option";
import { EService } from "../model/domain/models.js";

export const readModelGateway = {
  getEServiceById(
    _id: string
  ): Effect.Effect<never, never, Option.Option<EService>> {
    return Effect.succeed(Option.none());
  },
  getEServiceByName(
    _name: string
  ): Effect.Effect<never, never, Option.Option<EService>> {
    return Effect.succeed(Option.none());
  },
  getOrganizationID(): Effect.Effect<never, never, string> {
    return Effect.succeed("6A568A80-1B05-48EA-A74A-9A4C1B825CFB"); // read organization id from context instead
  },
};
