import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import App from '../App.jsx';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient();

describe('App Component', () => {
  it('renders the welcome message or dashboard', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    );
    // Based on App.jsx, the header has PharmaCore
    expect(screen.getByText(/PharmaCore/i)).toBeInTheDocument();
  });
});
