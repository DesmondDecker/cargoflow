export interface TrackingResult {
  resolved: boolean;
  carrierName?: string;
  status?: string;
  vesselName?: string;
  eta?: Date;
  source: string; // e.g. 'dcsa_api:maersk', 'marinetraffic:MAEU', 'scraper:public_tracker', 'bic_owner_code_table'
  // An id the source gave this container, kept so the next refresh can go
  // straight to it (MarineTraffic's shipment id).
  externalRef?: string;
}

export interface TrackingContext {
  carrierName?: string;
  externalRef?: string;
}

export interface TrackingProvider {
  carrierName: string;
  fetchTracking(containerNumber: string, ctx?: TrackingContext): Promise<TrackingResult>;
}
