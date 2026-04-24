import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import App from '../../App';

describe('App flow layout', () => {
  it('renders upload-first canvas without inspector before file selection', () => {
    render(<App />);

    const stepHeader = screen.getByLabelText('작업 단계');
    expect(within(stepHeader).getByText('업로드')).toBeInTheDocument();
    expect(within(stepHeader).getByText('작업')).toBeInTheDocument();
    expect(within(stepHeader).getByText('내보내기')).toBeInTheDocument();

    expect(screen.getByLabelText('썸네일 작업 영역')).toBeInTheDocument();
    expect(screen.getByLabelText('파일 업로드 영역')).toBeInTheDocument();
    expect(screen.queryByLabelText('작업 선택')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('작업 인스펙터 패널')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('진행 상태 패널')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('결과 내보내기 패널')).not.toBeInTheDocument();
  });

  it('shows preview first and enables inspector only after selecting a job', async () => {
    render(<App />);

    const input = screen.getByLabelText('PDF 업로드 입력') as HTMLInputElement;
    const file = new File([new Uint8Array([37, 80, 68, 70])], 'sample.pdf', { type: 'application/pdf' });
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText('sample.pdf')).toBeInTheDocument();
      expect(screen.getByLabelText('작업 선택')).toBeInTheDocument();
    });

    expect(screen.queryByLabelText('작업 인스펙터 패널')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: /합치기/ }));

    await waitFor(() => {
      const actionPanel = screen.getByLabelText('작업 인스펙터 패널');
      const actionBar = screen.getByLabelText('하단 작업 바');
      expect(within(actionPanel).getByText('현재 작업: 합치기')).toBeInTheDocument();
      expect(within(actionBar).getByRole('button', { name: '실행' })).toBeEnabled();
    });
  });

  it('supports split range editing and syncs it to inspector summary', async () => {
    render(<App />);

    const input = screen.getByLabelText('PDF 업로드 입력') as HTMLInputElement;
    const file = new File([new Uint8Array([37, 80, 68, 70])], 'split-source.pdf', { type: 'application/pdf' });
    fireEvent.change(input, { target: { files: [file] } });
    fireEvent.click(await screen.findByRole('tab', { name: /분할/ }));

    await waitFor(() => {
      expect(screen.getByLabelText('전체 시작 페이지')).toBeInTheDocument();
      expect(screen.getByLabelText('전체 끝 페이지')).toBeInTheDocument();
      expect(screen.getByLabelText('전체 시작 페이지')).toHaveAttribute('max', '5');
    });

    fireEvent.change(screen.getByLabelText('전체 시작 페이지'), { target: { value: '1' } });
    fireEvent.change(screen.getByLabelText('전체 끝 페이지'), { target: { value: '3' } });

    expect(screen.getByText('전체 1-3 (총 3페이지)')).toBeInTheDocument();

    const actionPanel = screen.getByLabelText('작업 인스펙터 패널');
    expect(within(actionPanel).getByText(/페이지 1-3/)).toBeInTheDocument();
  });
});
