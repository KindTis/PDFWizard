import './styles/app.css';
import { useEffect, useState } from 'react';
import ActionPanel from './app/components/ActionPanel';
import BottomActionBar from './app/components/BottomActionBar';
import JobTypeSelector from './app/components/JobTypeSelector';
import ProgressPanel from './app/components/ProgressPanel';
import type { SplitGroupStatus } from './app/components/SplitGroupEditor';
import StepHeader from './app/components/StepHeader';
import ThumbnailWorkspace from './app/components/ThumbnailWorkspace';
import { usePdfWorkflow } from './app/hooks/usePdfWorkflow';
import { useAppStore } from './app/state/store';

const EMPTY_SPLIT_GROUP_STATUS: SplitGroupStatus = {
  groupCount: 0,
  latestRange: null,
  mergedRange: null,
  groups: [],
  previewGroups: [],
};

function hasSplitGroupStatus(status: SplitGroupStatus): boolean {
  return (
    status.groupCount > 0 ||
    status.latestRange !== null ||
    status.mergedRange !== null ||
    status.groups.length > 0 ||
    status.previewGroups.length > 0
  );
}

export default function App() {
  const activeJobType = useAppStore((state) => state.activeJobType);
  const [splitGroupStatus, setSplitGroupStatus] = useState<SplitGroupStatus>(EMPTY_SPLIT_GROUP_STATUS);
  const isSplitJob = activeJobType === 'split';
  const effectiveSplitGroupStatus = isSplitJob ? splitGroupStatus : EMPTY_SPLIT_GROUP_STATUS;
  const workflow = usePdfWorkflow({
    splitRanges: effectiveSplitGroupStatus.mergedRange,
    splitGroups: effectiveSplitGroupStatus.groups,
  });
  const primaryFile = workflow.uploadedFiles[0] ?? null;
  const showInspector = workflow.uploadedFileCount > 0 && Boolean(activeJobType);

  useEffect(() => {
    if (isSplitJob || !hasSplitGroupStatus(splitGroupStatus)) {
      return;
    }
    setSplitGroupStatus(EMPTY_SPLIT_GROUP_STATUS);
  }, [isSplitJob, splitGroupStatus]);

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
          selectedRange={effectiveSplitGroupStatus.latestRange}
          selectedGroups={effectiveSplitGroupStatus.previewGroups}
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
              selectedRange={effectiveSplitGroupStatus.mergedRange}
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
