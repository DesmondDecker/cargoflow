import { TrackingContext, TrackingProvider, TrackingResult } from './types';

export interface ChainMember {
  label: string;
  provider: TrackingProvider;
}

// Tries each source in order and returns the first that actually has an
// answer. `source` on the result says which one answered, so the app can say
// where a status came from. If none do, the result is unresolved and its
// status lists what every source said, so a failure is never hidden.
export class ChainTrackingProvider implements TrackingProvider {
  constructor(public carrierName: string, private members: ChainMember[]) {}

  get labels(): string[] {
    return this.members.map((m) => m.label);
  }

  async fetchTracking(containerNumber: string, ctx?: TrackingContext): Promise<TrackingResult> {
    const notes: string[] = [];
    for (const member of this.members) {
      let result: TrackingResult;
      try {
        result = await member.provider.fetchTracking(containerNumber, ctx);
      } catch (err) {
        result = { resolved: false, status: `failed: ${(err as Error).message}`, source: `${member.label}_error` };
      }
      if (result.resolved) return { ...result, carrierName: result.carrierName ?? this.carrierName };
      notes.push(`${member.label}: ${result.status ?? 'no result'}`);
    }
    return { resolved: false, carrierName: this.carrierName, status: notes.join(' | '), source: 'tracking_chain:all_failed' };
  }
}
