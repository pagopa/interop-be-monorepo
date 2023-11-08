/* 
  IMPORTANT
  TODO: This service is a mock for the AuthorizationManagementService it is used as entrypoint for authorization permission updates.
*/

export const authorizationManagementServiceMock = {
  async updateStateOnClients(): Promise<void> {
    // TODO : [https://buildo.atlassian.net/browse/PPA-25] handle the update of the state on the clients
    return Promise.resolve();
  },
  async updateAgreementAndEServiceStates(
    _eserviceId: string,
    _consumerId: string,
    _payload: {
      agreementId: string;
      agreementState: "active" | "inactive";
      descriptorId: string;
      audience: string[];
      voucherLifespan: number;
      eserviceState: "active" | "inactive";
    }
  ): Promise<void> {
    // TODO :
    return Promise.resolve();
  },
};
