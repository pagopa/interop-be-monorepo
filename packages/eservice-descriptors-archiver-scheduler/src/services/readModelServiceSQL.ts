/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { and, eq, inArray, lt, sql } from "drizzle-orm";
import {
  descriptorState,
  unsafeBrandId,
  archivingScope,
  EServiceId,
} from "pagopa-interop-models";
import { toUTCMidnight } from "pagopa-interop-commons";
import {
  eserviceDescriptorInReadmodelCatalog,
  eserviceInReadmodelCatalog,
  DrizzleReturnType,
  EServiceDescriptorSQL,
  eserviceDescriptorArchivingScheduleInReadmodelCatalog,
  EServiceDescriptorArchivingScheduleSQL,
  EServiceSQL,
} from "pagopa-interop-readmodel-models";
import {
  RefsToBeArchived,
  WrongDescriptor,
  WrongEServices,
} from "../models/models.js";

export function readModelServiceBuilderSQL(readModelDB: DrizzleReturnType) {
  return {
    /**
     * Fetches all expired archivable descriptor references from the database.
     * A descriptor is considered expired and archivable if it has a state of "archiving" or "archivingSuspended"
     * and its archivableOn date is in the past.
     *
     * @returns The array of expired archivable descriptor references
     */
    async getExpiredArchivableDescriptorRefs(): Promise<RefsToBeArchived[]> {
      const queryResult: {
        eservice: EServiceSQL;
        descriptor: EServiceDescriptorSQL;
        archivingSchedule: EServiceDescriptorArchivingScheduleSQL | null;
      }[] = await readModelDB
        .select({
          eservice: eserviceInReadmodelCatalog,
          descriptor: eserviceDescriptorInReadmodelCatalog,
          archivingSchedule:
            eserviceDescriptorArchivingScheduleInReadmodelCatalog,
        })
        .from(eserviceDescriptorInReadmodelCatalog)
        .innerJoin(
          eserviceInReadmodelCatalog,
          eq(
            eserviceInReadmodelCatalog.id,
            eserviceDescriptorInReadmodelCatalog.eserviceId
          )
        )
        .leftJoin(
          eserviceDescriptorArchivingScheduleInReadmodelCatalog,
          eq(
            eserviceDescriptorInReadmodelCatalog.id,
            eserviceDescriptorArchivingScheduleInReadmodelCatalog.descriptorId
          )
        )
        .where(
          and(
            inArray(eserviceDescriptorInReadmodelCatalog.state, [
              descriptorState.archiving,
              descriptorState.archivingSuspended,
            ]),
            lt(
              eserviceDescriptorArchivingScheduleInReadmodelCatalog.archivableOn,
              new Date(toUTCMidnight(new Date(), 0)).toISOString()
            ),
            eq(
              eserviceDescriptorArchivingScheduleInReadmodelCatalog.scope,
              archivingScope.descriptor
            )
          )
        );

      const refs = queryResult.map((row) => row.descriptor);

      const refsToBeArchived: RefsToBeArchived[] = refs.map((descriptor) => ({
        eserviceId: unsafeBrandId(descriptor.eserviceId),
        descriptorId: unsafeBrandId(descriptor.id),
      }));
      return refsToBeArchived;
    },
    async getExpiredArchivableEserviceRefs(): Promise<EServiceId[]> {
      const queryResult: {
        eservice: EServiceSQL;
      }[] = await readModelDB
        .selectDistinct({
          eservice: eserviceInReadmodelCatalog,
        })
        .from(eserviceInReadmodelCatalog)
        .innerJoin(
          eserviceDescriptorInReadmodelCatalog,
          eq(
            eserviceInReadmodelCatalog.id,
            eserviceDescriptorInReadmodelCatalog.eserviceId
          )
        )
        .leftJoin(
          eserviceDescriptorArchivingScheduleInReadmodelCatalog,
          eq(
            eserviceDescriptorInReadmodelCatalog.id,
            eserviceDescriptorArchivingScheduleInReadmodelCatalog.descriptorId
          )
        )
        .where(
          and(
            inArray(eserviceDescriptorInReadmodelCatalog.state, [
              descriptorState.archiving,
              descriptorState.archivingSuspended,
            ]),
            lt(
              eserviceDescriptorArchivingScheduleInReadmodelCatalog.archivableOn,
              new Date(toUTCMidnight(new Date(), 0)).toISOString()
            ),
            eq(
              eserviceDescriptorArchivingScheduleInReadmodelCatalog.scope,
              archivingScope.eservice
            )
          )
        );
      return queryResult.map((row) => unsafeBrandId(row.eservice.id));
    },
    async getWrongEservices(
      eserviceIds: EServiceId[]
    ): Promise<WrongEServices> {
      const queryResult = await readModelDB
        .select({
          eserviceId: eserviceDescriptorInReadmodelCatalog.eserviceId,
          wrongDescriptors: sql<WrongDescriptor[]>`
        array_agg(json_build_object(
          'id', ${eserviceDescriptorInReadmodelCatalog.id},
          'state', ${eserviceDescriptorInReadmodelCatalog.state},
          'scope', ${eserviceDescriptorArchivingScheduleInReadmodelCatalog.scope}
        ))
        filter (where ${eserviceDescriptorInReadmodelCatalog.state} not in ('Archiving', 'ArchivingSuspended', 'Archived'))
      `.as("wrong_descriptors"),
        })
        .from(eserviceDescriptorInReadmodelCatalog)
        .leftJoin(
          eserviceDescriptorArchivingScheduleInReadmodelCatalog,
          eq(
            eserviceDescriptorInReadmodelCatalog.id,
            eserviceDescriptorArchivingScheduleInReadmodelCatalog.descriptorId
          )
        )
        .where(
          inArray(eserviceDescriptorInReadmodelCatalog.eserviceId, eserviceIds)
        )
        .groupBy(eserviceDescriptorInReadmodelCatalog.eserviceId);

      return WrongEServices.parse(queryResult).filter(
        (report) => report.wrongDescriptors.length > 0
      );
    },
  };
}
export type ReadModelServiceSQL = ReturnType<typeof readModelServiceBuilderSQL>;
