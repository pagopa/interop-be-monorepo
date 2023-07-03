import * as Effect from "@effect/io/Effect";
import {
  CatalogProcessError,
  ErrorCode,
  eServiceCannotBeDeleted,
  eServiceCannotBeUpdated,
  eServiceNotFound,
  operationForbidden,
} from "../model/domain/errors.js";
import { AuthData } from "../auth/authData.js";
import { convertToClientEServiceSeed } from "../model/domain/models.js";
import { ApiEServiceSeed } from "../model/types.js";
import { eserviceSeedToCreateEvent } from "../repositories/adapters/adapters.js";
import { DB } from "../repositories/db.js";
import { eventRepository } from "../repositories/events.js";
import { AuthDataCtx } from "../effectCtx.js";
import { readModelGateway } from "./ReadModelGateway.js";

function repositoryErrorsToCatalogErrors(): CatalogProcessError {
  return new CatalogProcessError(
    "Error during EService creation",
    ErrorCode.GenericError
  );
}

export const catalogService = {
  createEService(
    apiEservicesSeed: ApiEServiceSeed
  ): Effect.Effect<DB | AuthData, CatalogProcessError, void> {
    return Effect.gen(function* (_) {
      const authData = yield* _(AuthDataCtx);
      const eserviceSeed = convertToClientEServiceSeed(
        apiEservicesSeed,
        authData.organizationId
      );
      const eservice = yield* _(
        readModelGateway.getEServiceByName(eserviceSeed.name)
      );
      yield* _(
        Effect.noneOrFailWith(
          eservice,
          () =>
            new CatalogProcessError(
              `Error during EService creation with name ${eserviceSeed.name}`,
              ErrorCode.DuplicateEserviceName
            )
        )
      );
      return yield* _(
        eventRepository.createEvent(eserviceSeedToCreateEvent(eserviceSeed)),
        Effect.mapError(repositoryErrorsToCatalogErrors)
      );
    });
  },
  updateEService(
    eServiceId: string,
    eservicesSeed: ApiEServiceSeed
  ): Effect.Effect<DB | AuthData, CatalogProcessError, void> {
    return Effect.gen(function* (_) {
      const authData = yield* _(AuthDataCtx);
      const eservice = yield* _(
        readModelGateway.getEServiceById(eServiceId),
        Effect.someOrFail(() => eServiceNotFound(eServiceId))
      );

      if (eservice.producerId !== authData.organizationId) {
        yield* _(Effect.fail(operationForbidden));
      }

      if (
        !(
          eservice.descriptors.length === 0 ||
          (eservice.descriptors.length === 1 &&
            eservice.descriptors[0].state === "DRAFT")
        )
      ) {
        yield* _(Effect.fail(eServiceCannotBeUpdated(eServiceId)));
      }

      const eserviceSeed = convertToClientEServiceSeed(
        eservicesSeed,
        authData.organizationId
      );

      yield* _(
        eventRepository.createEvent({
          streamId: eServiceId,
          version: eservice.version,
          type: "EServiceUpdated",
          data: eserviceSeed,
        }),
        Effect.mapError(repositoryErrorsToCatalogErrors)
      );
    });
  },
  deleteEService(
    eServiceId: string
  ): Effect.Effect<DB | AuthData, CatalogProcessError, void> {
    return Effect.gen(function* (_) {
      const authData = yield* _(AuthDataCtx);
      const eservice = yield* _(
        readModelGateway.getEServiceById(eServiceId),
        Effect.someOrFail(() => eServiceNotFound(eServiceId))
      );

      if (eservice.descriptors.length > 0) {
        yield* _(Effect.fail(eServiceCannotBeDeleted(eServiceId)));
      }

      if (eservice.producerId !== authData.organizationId) {
        yield* _(Effect.fail(operationForbidden));
      }

      return yield* _(
        eventRepository.createEvent({
          streamId: eServiceId,
          version: eservice.version,
          type: "EServiceDeleted",
          data: {},
        }),
        Effect.mapError(repositoryErrorsToCatalogErrors)
      );
    });
  },
};
