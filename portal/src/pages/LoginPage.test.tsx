import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { useAuthStore } from '../store/authStore';
import { LoginPage } from './LoginPage';

describe('Portal LoginPage', () => {
  beforeEach(() => {
    useAuthStore.setState({ status: 'signedOut', user: null, loading: false, error: null });
  });

  it('requires email and password', () => {
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(screen.getByText('Enter your email and password.')).toBeInTheDocument();
  });

  it('renders a server authentication error', () => {
    useAuthStore.setState({ error: 'This account is inactive' });
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    );

    expect(screen.getByText('This account is inactive')).toBeInTheDocument();
  });
});
