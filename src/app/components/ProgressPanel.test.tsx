import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { useAppStore } from '../state/store';
import ProgressPanel from './ProgressPanel';

describe('ProgressPanel summary', () => {
  beforeEach(() => {
    useAppStore.getState().reset();
  });

  it('shows merged source and expected total pages from all uploaded files in merge mode', () => {
    useAppStore.getState().setJobType('merge');

    render(
      <ProgressPanel
        uploadedFiles={[
          { id: 'a', name: 'alpha.pdf', bytes: new ArrayBuffer(8), pageCount: 2 },
          { id: 'b', name: 'beta.pdf', bytes: new ArrayBuffer(8), pageCount: 3 },
          { id: 'c', name: 'charlie.pdf', bytes: new ArrayBuffer(8), pageCount: 4 },
        ]}
        selectedRange={null}
      />,
    );

    expect(screen.getByText('원본 파일들')).toBeInTheDocument();
    expect(screen.getByText('3개 (alpha.pdf, beta.pdf, charlie.pdf)')).toBeInTheDocument();
    expect(screen.getByText('예상 총 페이지')).toBeInTheDocument();
    expect(screen.getByText('9')).toBeInTheDocument();
  });

  it('keeps single-source summary for non-merge jobs', () => {
    useAppStore.getState().setJobType('split');

    render(
      <ProgressPanel
        uploadedFiles={[{ id: 'a', name: 'split-source.pdf', bytes: new ArrayBuffer(8), pageCount: 11 }]}
        selectedRange="1-3"
      />,
    );

    expect(screen.getByText('원본 파일')).toBeInTheDocument();
    expect(screen.getByText('split-source.pdf')).toBeInTheDocument();
    expect(screen.getByText('전체 페이지')).toBeInTheDocument();
    expect(screen.getByText('11')).toBeInTheDocument();
  });

  it('shows all uploaded files and generated group count for cross-PDF split jobs', () => {
    useAppStore.getState().setJobType('split');

    render(
      <ProgressPanel
        uploadedFiles={[
          { id: 'a', name: 'A.pdf', bytes: new ArrayBuffer(8), pageCount: 3 },
          { id: 'b', name: 'B.pdf', bytes: new ArrayBuffer(8), pageCount: 5 },
        ]}
        selectedRange="1-2,3-8"
      />,
    );

    expect(screen.getByText('원본 파일들')).toBeInTheDocument();
    expect(screen.getByText('2개 (A.pdf, B.pdf)')).toBeInTheDocument();
    expect(screen.getByText('예상 총 페이지')).toBeInTheDocument();
    expect(screen.getByText('8')).toBeInTheDocument();
    expect(screen.getByText('2개')).toBeInTheDocument();
  });
});
