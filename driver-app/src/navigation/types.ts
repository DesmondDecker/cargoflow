export type AuthStackParamList = { Login: undefined; Signup: undefined };

export type MainStackParamList = {
  Tabs: undefined;
  JobDetail: { jobId: string };
  CompleteDelivery: { jobId: string };
  AddVehicle: undefined;
  RequestVerification: undefined;
  Settings: undefined;
};

export type TabParamList = { Jobs: undefined; Earnings: undefined; History: undefined; Profile: undefined };
