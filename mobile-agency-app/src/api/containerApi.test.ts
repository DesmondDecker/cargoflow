import { beforeEach, describe, expect, it, vi } from 'vitest';

const apiGet = vi.hoisted(() => vi.fn());

vi.mock('./client', () => ({
  api: { get: apiGet },
}));

import { trackUnregisteredContainer } from './containerApi';

describe('trackUnregisteredContainer', () => {
  beforeEach(() => {
    apiGet.mockReset();
    apiGet.mockResolvedValue({
      data: {
        data: {
          containerNumber: '270560510',
          trackingNumber: '270560510',
          trackingType: 'bill_of_lading',
          saved: false,
        },
      },
    });
  });

  it('allows time for a slow carrier lookup without extending other API timeouts', async () => {
    await trackUnregisteredContainer('270560510', 'bill_of_lading', 'Maersk');

    expect(apiGet).toHaveBeenCalledWith('/search/track-live', {
      params: {
        code: '270560510',
        referenceType: 'bill_of_lading',
        carrierName: 'Maersk',
      },
      timeout: 70_000,
    });
  });
});
