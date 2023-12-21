/* 
  IMPORTANT
  This service is a mock for the selfcare-v2 service it is used as entrypoint for updates.
  TODO: remove this with development in [https://pagopa.atlassian.net/browse/IMN-139] when a new package is ready
*/
import {
  UserResource,
  WorkContactResource,
  certificationType,
} from "pagopa-interop-models";

export const selfcareServiceMock = {
  async getUserById(userId: string): Promise<UserResource> {
    const mockUser: UserResource = {
      birthDate: {
        certification: certificationType.NONE,
        value: new Date("1990-01-01"),
      },
      email: {
        certification: certificationType.SPID,
        value: "john.doe@example.com",
      },
      familyName: {
        certification: certificationType.NONE,
        value: "Doe",
      },
      fiscalCode: "ABCDEF12G34H567I",
      id: userId,
      name: {
        certification: certificationType.NONE,
        value: "John",
      },
      workContacts: new Map<string, WorkContactResource>([
        [
          "work-contratct-1",
          {
            email: {
              certification: certificationType.NONE,
              value: "john.doe@work.com",
            },
          },
        ],
      ]),
    };

    return Promise.resolve(mockUser);
  },
};
