export type AuthStackParamList = {
  Welcome: undefined;
  Login: undefined;
  JoinAgency: undefined;
  RegisterAgency: undefined;
};

export type MainTabParamList = {
  Dashboard: undefined;
  Containers: undefined;
  Tracking: undefined;
  Customs: undefined;
  More: undefined;
};

export type TrackingStackParamList = {
  TrackingList: undefined;
  TrackingTimeline: { containerId: string; containerNumber?: string };
};

export type FinanceHomeStackParamList = {
  FinanceHome: undefined;
};

export type ContainersStackParamList = {
  ContainersList: { search?: string } | undefined;
  ContainerCaseFile: { containerId: string; containerNumber?: string };
  FindDriver: { containerId: string };
  FindStorage: { containerId: string };
  ContainerLetters: { containerId: string };
  LetterEditor: { letterId: string };
  DocumentScanner: { containerId: string; importerId: string; blId?: string; documentType: string };
  AddContainer: undefined;
  ScanCode: undefined;
  Finance: { containerId: string; importerId?: string; importerName?: string };
  RecordExpense: { containerId: string };
  RecordPayment: { containerId: string; importerId?: string; importerName?: string };
};

export type ImportersStackParamList = {
  ImportersList: undefined;
  ImporterProfile: { importerId: string; importerName?: string };
  AddImporter: { importerId?: string } | undefined;
};

export type DashboardStackParamList = {
  DashboardHome: undefined;
  ContainerCaseFile: { containerId: string; containerNumber?: string };
  FindDriver: { containerId: string };
  FindStorage: { containerId: string };
  ContainerLetters: { containerId: string };
  LetterEditor: { letterId: string };
  DocumentScanner: { containerId: string; importerId: string; blId?: string; documentType: string };
  Finance: { containerId: string; importerId?: string; importerName?: string };
  RecordExpense: { containerId: string };
  RecordPayment: { containerId: string; importerId?: string; importerName?: string };
};

export type DocumentsStackParamList = {
  DocumentsList: undefined;
};

export type CustomsStackParamList = {
  CustomsSubmissions: undefined;
  CustomsSubmission: { submissionId?: string; prefill?: Partial<import('../types/api').CustomsFields> } | undefined;
};

export type GuidesStackParamList = {
  GuidesList: undefined;
  GuideDetail: { guideId: string; title: string };
};

export type MoreStackParamList = {
  MoreHome: undefined;
  Finance: undefined; // nested FinanceNavigator
  Importers: undefined; // nested ImportersNavigator
  Guides: undefined; // nested GuidesNavigator
  DemurrageTerms: undefined;
  AddDemurrageTerm: { existing?: import('../api/agencyApi').DemurrageTerm } | undefined;
  EditAgencyProfile: undefined;
  EditLabels: undefined;
  Documents: undefined; // nested DocumentsNavigator
  Notifications: undefined;
  AppPreferences: undefined;
  Team: undefined;
  Rules: undefined;
  Reports: undefined;
  StorageBookings: undefined;
  ChangeAgencyPassword: undefined;
  ChangeMyPin: undefined;
  ResetPin: { userId: string; name: string };
};
