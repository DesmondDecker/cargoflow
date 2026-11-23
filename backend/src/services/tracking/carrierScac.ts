// Standard Carrier Alpha Codes, the identifier container-tracking services
// ask for alongside a container number. They are carriers' official codes;
// a service can still reject one it does not support, and that rejection is
// reported rather than hidden. Where a carrier uses more than one code, the
// one its own bookings and bills of lading normally carry is used.
const SCAC_BY_CARRIER: Record<string, string> = {
  Maersk: 'MAEU',
  MSC: 'MSCU',
  'CMA CGM': 'CMDU',
  'Hapag-Lloyd': 'HLCU',
  'Ocean Network Express': 'ONEY',
  COSCO: 'COSU',
  Evergreen: 'EGLV',
  'Yang Ming': 'YMLU',
  HMM: 'HDMU',
  ZIM: 'ZIMU',
  'Pacific International Lines': 'PABV',
  'Wan Hai': 'WHLC',
};

export function scacFor(carrierName: string | undefined): string | undefined {
  return carrierName ? SCAC_BY_CARRIER[carrierName] : undefined;
}
