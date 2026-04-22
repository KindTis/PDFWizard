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
      expect(screen.getByText('업로드된 파일: 1')).toBeInTheDocument();
      expect(screen.getByLabelText('작업 선택')).toBeInTheDocument();
    });

    expect(screen.queryByLabelText('작업 인스펙터 패널')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: /합치기/ }));

    await waitFor(() => {
      const actionPanel = screen.getByLabelText('작업 인스펙터 패널');
      expect(within(actionPanel).getByText('현재 작업: 합치기')).toBeInTheDocument();
      expect(within(actionPanel).getByRole('button', { name: '작업 실행' })).toBeEnabled();
    });
  });

  it('supports split group editing and adding groups', async () => {
    render(<App />);

    const input = screen.getByLabelText('PDF 업로드 입력') as HTMLInputElement;
    const file = new File([new Uint8Array([37, 80, 68, 70])], 'split-source.pdf', { type: 'application/pdf' });
    fireEvent.change(input, { target: { files: [file] } });
    fireEvent.click(await screen.findByRole('tab', { name: /분할/ }));

    await waitFor(() => {
      expect(screen.getByText('전체 페이지: 5')).toBeInTheDocument();
      expect(screen.getByLabelText('시작 페이지')).toBeInTheDocument();
      expect(screen.getByLabelText('끝 페이지')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText('시작 페이지'), { target: { value: '1' } });
    fireEvent.change(screen.getByLabelText('끝 페이지'), { target: { value: '3' } });
    fireEvent.click(screen.getByRole('button', { name: '범위 추가' }));

    expect(screen.getByText('그룹 1: 1-3')).toBeInTheDocument();

    const actionPanel = screen.getByLabelText('작업 인스펙터 패널');
    expect(within(actionPanel).getByText('분할 그룹: 1개')).toBeInTheDocument();
    expect(within(actionPanel).getByText('최근 범위: 1-3')).toBeInTheDocument();
  });
});
