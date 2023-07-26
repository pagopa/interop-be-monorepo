/* 
  This service is a mock for the AuthorizationManagementService it is used as entrypoint for authorization permission updates.
*/

export const authorizationManagementServiceMock = {
  async updateStateOnClients(): Promise<void> {
    // TODO : [https://buildo.atlassian.net/browse/PPA-25] handle the update of the state on the clients
    return Promise.resolve();
  },
};
