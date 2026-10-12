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
};

export type ImportersStackParamList = {
  ImportersList: undefined;
  ImporterProfile: { importerId: string; importerName?: string };
};

export type DashboardStackParamList = {
  DashboardHome: undefined;
  ContainerCaseFile: { containerId: string; containerNumber?: string };
  FindDriver: { containerId: string };
  DocumentScanner: { containerId: string; importerId: string; blId?: string; documentType: string };
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
};
