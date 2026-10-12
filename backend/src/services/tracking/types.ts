export interface TrackingResult {
  resolved: boolean;
  carrierName?: string;
  status?: string;
  vesselName?: string;
  eta?: Date;
  source: string; // e.g. 'dcsa_api:maersk', 'bic_owner_code_table', 'dcsa_api:maersk_error'
}

export interface TrackingProvider {
  carrierName: string;
  fetchTracking(containerNumber: string): Promise<TrackingResult>;
}
