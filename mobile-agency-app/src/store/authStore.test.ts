import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getAccessToken: vi.fn(),
  clearTokens: vi.fn(),
  fetchMe: vi.fn(),
  setForceLogoutHandler: vi.fn(),
  setSubscriptionInactiveHandler: vi.fn(),
}));

vi.mock('expo-application', () => ({ getAndroidId: vi.fn(), applicationId: 'test-app' }));
vi.mock('react-native', () => ({ Platform: { OS: 'android' } }));
vi.mock('../api/authApi', () => ({ fetchMe: mocks.fetchMe }));
vi.mock('../notifications/pushRegistration', () => ({ clearPushToken: vi.fn() }));
vi.mock('../api/client', () => ({
  setTokens: vi.fn(),
  clearTokens: mocks.clearTokens,
  getAccessToken: mocks.getAccessToken,
  setForceLogoutHandler: mocks.setForceLogoutHandler,
  setSubscriptionInactiveHandler: mocks.setSubscriptionInactiveHandler,
  apiErrorMessage: vi.fn(),
}));

import { useAuthStore } from './authStore';

describe('auth session bootstrap', () => {
  beforeEach(() => {
    mocks.getAccessToken.mockReset();
    mocks.clearTokens.mockReset();
    mocks.fetchMe.mockReset();
    useAuthStore.setState({
      status: 'checking',
      user: null,
      agency: null,
      error: null,
      loading: false,
      subscriptionInactive: false,
    });
  });

  it('signs out without an unhandled rejection if token cleanup also fails', async () => {
    mocks.getAccessToken.mockRejectedValue(new TypeError('undefined is not a function'));
    mocks.clearTokens.mockRejectedValue(new TypeError('deleteItemAsync is unavailable'));
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(useAuthStore.getState().bootstrap()).resolves.toBeUndefined();

    expect(useAuthStore.getState().status).toBe('signedOut');
    expect(errorLog).toHaveBeenCalledWith(
      'Could not clear expired session tokens',
      expect.objectContaining({
        sessionError: expect.objectContaining({ message: 'undefined is not a function' }),
        cleanupError: expect.objectContaining({ message: 'deleteItemAsync is unavailable' }),
      }),
    );
    errorLog.mockRestore();
  });

  it('restores a signed-out state when no access token exists', async () => {
    mocks.getAccessToken.mockResolvedValue(null);

    await useAuthStore.getState().bootstrap();

    expect(useAuthStore.getState().status).toBe('signedOut');
    expect(mocks.fetchMe).not.toHaveBeenCalled();
    expect(mocks.clearTokens).not.toHaveBeenCalled();
  });
});
