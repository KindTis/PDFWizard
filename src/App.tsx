import './styles/app.css';
import { useState } from 'react';
import ActionPanel from './app/components/ActionPanel';
import ExportPanel from './app/components/ExportPanel';
import ProgressPanel from './app/components/ProgressPanel';
import type { SplitGroupStatus } from './app/components/SplitGroupEditor';
import StepHeader from './app/components/StepHeader';
import ThumbnailWorkspace from './app/components/ThumbnailWorkspace';
import { usePdfWorkflow } from './app/hooks/usePdfWorkflow';

export default function App() {
  const [splitGroupStatus, setSplitGroupStatus] = useState<SplitGroupStatus>({
    groupCount: 0,
    latestRange: null,
    mergedRange: null,
  });
  const workflow = usePdfWorkflow({ splitRanges: splitGroupStatus.mergedRange });

  return (
    <main role="main" className="app-shell">
      <StepHeader uploadedFileCount={workflow.uploadedFileCount} />
      <section aria-label="작업 레이아웃" className="layout">
        <ThumbnailWorkspace
          uploadedFileCount={workflow.uploadedFileCount}
          primaryPdfPageCount={workflow.primaryPdfPageCount}
          uploadedFileNames={workflow.uploadedFiles.map((file) => file.name)}
          thumbnails={workflow.thumbnails}
          isThumbnailLoading={workflow.isThumbnailLoading}
          thumbnailError={workflow.thumbnailError}
          onFilesSelected={workflow.onFilesSelected}
          onSplitGroupStatusChange={setSplitGroupStatus}
        />
        <section aria-label="제어 사이드바" className="control-sidebar">
          <ActionPanel
            uploadedFileCount={workflow.uploadedFileCount}
            splitGroupStatus={splitGroupStatus}
            onRunCurrentJob={workflow.runCurrentJob}
            onCancelCurrentJob={workflow.cancelCurrentJob}
          />
          <ProgressPanel />
          <ExportPanel />
        </section>
      </section>
    </main>
  );
}
