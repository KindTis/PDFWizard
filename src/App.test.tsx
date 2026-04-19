import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import App from './App';

describe('App shell', () => {
  it('renders 3-step header', () => {
    render(<App />);
    const stepHeader = screen.getByLabelText('작업 단계');
    expect(within(stepHeader).getByText('업로드')).toBeInTheDocument();
    expect(within(stepHeader).getByText('작업')).toBeInTheDocument();
    expect(within(stepHeader).getByText('내보내기')).toBeInTheDocument();
  });
});
