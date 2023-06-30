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
import { readModelGateway } from "./ReadModelGateway.js";

export const catalogService = {
  createEService(
    apiEservicesSeed: ApiEServiceSeed,
    authData: AuthData
  ): Effect.Effect<DB, CatalogProcessError, void> {
    return Effect.gen(function* (_) {
      const eserviceSeed = convertToClientEServiceSeed(
        apiEservicesSeed,
        authData.organizationId
      );
      const eservice = yield* _(
        readModelGateway.getEServiceByName(eserviceSeed.name)
      );
      return _(
        Effect.noneOrFailWith(
          eservice,
          () =>
            new CatalogProcessError(
              `Error during EService creation with name ${eserviceSeed.name}`,
              ErrorCode.DuplicateEserviceName
            )
        ),
        Effect.flatMap(() =>
          eventRepository.createEvent(eserviceSeedToCreateEvent(eserviceSeed))
        )
      );
    });
  },
  updateEService(
    eServiceId: string,
    eservicesSeed: ApiEServiceSeed
  ): Effect.Effect<DB, CatalogProcessError, void> {
    return Effect.gen(function* (_) {
      const organizationId = yield* _(readModelGateway.getOrganizationID());
      const eservice = yield* _(
        readModelGateway.getEServiceById(eServiceId),
        Effect.someOrFail(() => eServiceNotFound(eServiceId))
      );

      if (eservice.producerId !== organizationId) {
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
        organizationId
      );

      yield* _(
        eventRepository.createEvent({
          streamId: eServiceId,
          version: eservice.version,
          type: "EServiceUpdated",
          data: eserviceSeed,
        })
      );
    });
  },
  deleteEService(
    eServiceId: string
  ): Effect.Effect<DB, CatalogProcessError, void> {
    return Effect.gen(function* (_) {
      const organizationId = yield* _(readModelGateway.getOrganizationID());
      const eservice = yield* _(
        readModelGateway.getEServiceById(eServiceId),
        Effect.someOrFail(() => eServiceNotFound(eServiceId))
      );

      if (eservice.descriptors.length > 0) {
        yield* _(Effect.fail(eServiceCannotBeDeleted(eServiceId)));
      }

      if (eservice.producerId !== organizationId) {
        yield* _(Effect.fail(operationForbidden));
      }

      return yield* _(
        eventRepository.createEvent({
          streamId: eServiceId,
          version: eservice.version,
          type: "EServiceDeleted",
          data: {},
        })
      );
    });
  },
};
