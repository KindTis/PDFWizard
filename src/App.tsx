import './styles/app.css';
import { useState } from 'react';
import ActionPanel from './app/components/ActionPanel';
import BottomActionBar from './app/components/BottomActionBar';
import JobTypeSelector from './app/components/JobTypeSelector';
import ProgressPanel from './app/components/ProgressPanel';
import type { SplitGroupStatus } from './app/components/SplitGroupEditor';
import StepHeader from './app/components/StepHeader';
import ThumbnailWorkspace from './app/components/ThumbnailWorkspace';
import { usePdfWorkflow } from './app/hooks/usePdfWorkflow';
import { useAppStore } from './app/state/store';

export default function App() {
  const [splitGroupStatus, setSplitGroupStatus] = useState<SplitGroupStatus>({
    groupCount: 0,
    latestRange: null,
    mergedRange: null,
    groups: [],
    previewGroups: [],
  });
  const workflow = usePdfWorkflow({ splitRanges: splitGroupStatus.mergedRange, splitGroups: splitGroupStatus.groups });
  const activeJobType = useAppStore((state) => state.activeJobType);
  const primaryFile = workflow.uploadedFiles[0] ?? null;
  const showInspector = workflow.uploadedFileCount > 0 && Boolean(activeJobType);

  return (
    <main role="main" className="app-shell">
      <div className="top-shell">
        <StepHeader uploadedFileCount={workflow.uploadedFileCount} />
        <JobTypeSelector uploadedFileCount={workflow.uploadedFileCount} />
      </div>
      <section aria-label="작업 레이아웃" className={`layout${showInspector ? ' has-inspector' : ''}`}>
        <ThumbnailWorkspace
          uploadedFileCount={workflow.uploadedFileCount}
          primaryPdfPageCount={workflow.primaryPdfPageCount}
          primaryFileSizeBytes={primaryFile ? primaryFile.bytes.byteLength : null}
          uploadedFileNames={workflow.uploadedFiles.map((file) => file.name)}
          thumbnails={workflow.thumbnails}
          isThumbnailLoading={workflow.isThumbnailLoading}
          thumbnailError={workflow.thumbnailError}
          onFilesSelected={workflow.onFilesSelected}
          selectedRange={splitGroupStatus.latestRange}
          selectedGroups={splitGroupStatus.previewGroups}
        />
        {showInspector ? (
          <aside aria-label="제어 사이드바" className="control-sidebar">
            <ActionPanel
              uploadedFileCount={workflow.uploadedFileCount}
              uploadedFileName={primaryFile?.name ?? null}
              uploadedFiles={workflow.uploadedFiles}
              primaryPdfPageCount={workflow.primaryPdfPageCount}
              splitGroupStatus={splitGroupStatus}
              onSplitGroupStatusChange={setSplitGroupStatus}
              onAddUploadedFiles={workflow.addUploadedFiles}
              onRemoveUploadedFile={workflow.removeUploadedFile}
              onReorderUploadedFiles={workflow.reorderUploadedFiles}
            />
            <ProgressPanel
              uploadedFiles={workflow.uploadedFiles}
              selectedRange={splitGroupStatus.mergedRange}
            />
          </aside>
        ) : null}
      </section>
      {showInspector ? (
        <BottomActionBar
          uploadedFileCount={workflow.uploadedFileCount}
          uploadedFileName={primaryFile?.name ?? null}
          onRunCurrentJob={workflow.runCurrentJob}
          onCancelCurrentJob={workflow.cancelCurrentJob}
        />
      ) : null}
    </main>
  );
}
