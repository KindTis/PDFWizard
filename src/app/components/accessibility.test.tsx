import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from '../../App';

describe('a11y essentials', () => {
  it('has main landmark and upload button', () => {
    render(<App />);
    expect(screen.getByRole('main')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /파일 선택/i })).toBeInTheDocument();
    expect(screen.getByLabelText('원본 유지')).toBeInTheDocument();
    expect(screen.getByLabelText('강제 PNG/JPG 변환')).toBeInTheDocument();
  });
});
