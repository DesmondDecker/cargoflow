export type AuthStackParamList = {
  Welcome: undefined;
  Login: undefined;
  JoinAgency: undefined;
  RegisterAgency: undefined;
};

export type MainTabParamList = {
  Dashboard: undefined;
  Containers: undefined;
  Documents: undefined;
  More: undefined;
};

export type ContainersStackParamList = {
  ContainersList: undefined;
  ContainerCaseFile: { containerId: string; containerNumber?: string };
  FindDriver: { containerId: string };
  DocumentScanner: { containerId: string; importerId: string; blId?: string; documentType: string };
  AddContainer: undefined;
  Finance: { containerId: string; importerId?: string; importerName?: string };
  RecordExpense: { containerId: string };
  RecordPayment: { containerId: string; importerId?: string; importerName?: string };
};

export type ImportersStackParamList = {
  ImportersList: undefined;
  ImporterProfile: { importerId: string; importerName?: string };
  AddImporter: undefined;
};

export type DashboardStackParamList = {
  DashboardHome: undefined;
  ContainerCaseFile: { containerId: string; containerNumber?: string };
  FindDriver: { containerId: string };
  DocumentScanner: { containerId: string; importerId: string; blId?: string; documentType: string };
  Finance: { containerId: string; importerId?: string; importerName?: string };
  RecordExpense: { containerId: string };
  RecordPayment: { containerId: string; importerId?: string; importerName?: string };
};

export type DocumentsStackParamList = {
  DocumentsList: undefined;
};

export type GuidesStackParamList = {
  GuidesList: undefined;
  GuideDetail: { guideId: string; title: string };
};

export type MoreStackParamList = {
  MoreHome: undefined;
  Importers: undefined; // nested ImportersNavigator
  Guides: undefined; // nested GuidesNavigator
  DemurrageTerms: undefined;
  AddDemurrageTerm: { existing?: import('../api/agencyApi').DemurrageTerm } | undefined;
  EditAgencyProfile: undefined;
  EditLabels: undefined;
};
