import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { useAuthStore } from '../store/authStore';
import { LoginPage } from './LoginPage';

describe('LoginPage', () => {
  beforeEach(() => {
    useAuthStore.setState({ status: 'signedOut', admin: null, loading: false, error: null });
  });

  it('shows a validation error when credentials are blank', () => {
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Log In' }));
    expect(screen.getByText('Enter your email and password.')).toBeInTheDocument();
  });

  it('shows the store error returned by authentication', () => {
    useAuthStore.setState({ error: 'Invalid credentials' });
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    );

    expect(screen.getByText('Invalid credentials')).toBeInTheDocument();
  });
});
