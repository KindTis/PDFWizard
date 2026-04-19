import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import App from '../../App';

describe('App flow layout', () => {
  it('renders workflow sections and action tabs', () => {
    render(<App />);

    const stepHeader = screen.getByLabelText('작업 단계');
    expect(within(stepHeader).getByText('업로드')).toBeInTheDocument();
    expect(within(stepHeader).getByText('작업')).toBeInTheDocument();
    expect(within(stepHeader).getByText('내보내기')).toBeInTheDocument();

    expect(screen.getByLabelText('썸네일 작업 영역')).toBeInTheDocument();
    expect(screen.getByLabelText('파일 업로드 영역')).toBeInTheDocument();

    const actionPanel = screen.getByLabelText('작업 액션 패널');
    expect(within(actionPanel).getByRole('tab', { name: '합치기' })).toBeInTheDocument();
    expect(within(actionPanel).getByRole('tab', { name: '분할' })).toBeInTheDocument();
    expect(within(actionPanel).getByRole('tab', { name: '이미지 추출' })).toBeInTheDocument();
    expect(within(actionPanel).getByRole('tab', { name: '페이지→이미지' })).toBeInTheDocument();
    expect(within(actionPanel).queryByLabelText('원본 유지')).not.toBeInTheDocument();
    expect(within(actionPanel).queryByLabelText('강제 PNG/JPG 변환')).not.toBeInTheDocument();

    const progressPanel = screen.getByLabelText('진행 상태 패널');
    expect(progressPanel).toBeInTheDocument();
    expect(within(progressPanel).getByText('원본 유지: 0')).toBeInTheDocument();
    expect(within(progressPanel).getByText('변환: 0')).toBeInTheDocument();
    expect(within(progressPanel).getByText('실패: 0')).toBeInTheDocument();
    expect(screen.getByLabelText('결과 내보내기 패널')).toBeInTheDocument();
  });

  it('enables run button after a PDF upload is registered', async () => {
    render(<App />);

    const runButton = screen.getByRole('button', { name: '작업 실행' });
    expect(runButton).toBeDisabled();

    const input = screen.getByLabelText('PDF 업로드 입력') as HTMLInputElement;
    const file = new File([new Uint8Array([37, 80, 68, 70])], 'sample.pdf', { type: 'application/pdf' });
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText('업로드된 파일: 1')).toBeInTheDocument();
      expect(runButton).toBeEnabled();
    });
  });

  it('supports split group editing and adding groups', async () => {
    render(<App />);

    fireEvent.click(screen.getByRole('tab', { name: '분할' }));
    expect(screen.getByRole('heading', { name: '분할 그룹 편집' })).toBeInTheDocument();

    const input = screen.getByLabelText('PDF 업로드 입력') as HTMLInputElement;
    const file = new File([new Uint8Array([37, 80, 68, 70])], 'split-source.pdf', { type: 'application/pdf' });
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText('전체 페이지: 5')).toBeInTheDocument();
      expect(screen.getByLabelText('시작 페이지')).toBeInTheDocument();
      expect(screen.getByLabelText('끝 페이지')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText('시작 페이지'), { target: { value: '1' } });
    fireEvent.change(screen.getByLabelText('끝 페이지'), { target: { value: '3' } });
    fireEvent.click(screen.getByRole('button', { name: '범위 추가' }));

    expect(screen.getByText('그룹 1: 1-3')).toBeInTheDocument();

    const actionPanel = screen.getByLabelText('작업 액션 패널');
    expect(within(actionPanel).getByText('분할 그룹: 1개')).toBeInTheDocument();
    expect(within(actionPanel).getByText('최근 범위: 1-3')).toBeInTheDocument();
  });
});
