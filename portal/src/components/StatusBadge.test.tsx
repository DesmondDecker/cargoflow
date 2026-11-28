import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { StatusBadge } from './StatusBadge';

describe('StatusBadge', () => {
  it.each([
    ['pending', 'Pending', 'status-pending'],
    ['approved', 'Approved', 'status-approved'],
    ['returned', 'Returned', 'status-returned'],
  ] as const)('renders %s submissions correctly', (status, label, className) => {
    const { container } = render(<StatusBadge status={status} />);
    expect(screen.getByText(label)).toBeInTheDocument();
    expect(container.querySelector(`.${className}`)).not.toBeNull();
  });
});
