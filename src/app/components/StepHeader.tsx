import { useMemo } from 'react';
import { useAppStore } from '../state/store';

const STEPS = ['업로드', '작업', '내보내기'] as const;

type StepHeaderProps = {
  uploadedFileCount: number;
};

function resolveActiveStep(uploadedFileCount: number, hasJobSelection: boolean, artifactCount: number): number {
  if (artifactCount > 0) {
    return 2;
  }
  if (uploadedFileCount > 0 && hasJobSelection) {
    return 1;
  }
  return 0;
}

export default function StepHeader({ uploadedFileCount }: StepHeaderProps) {
  const activeJobType = useAppStore((state) => state.activeJobType);
  const artifactCount = useAppStore((state) => state.artifacts.length);
  const activeStep = useMemo(
    () => resolveActiveStep(uploadedFileCount, activeJobType !== null, artifactCount),
    [activeJobType, artifactCount, uploadedFileCount],
  );
  return (
    <header className="step-header" aria-label="작업 단계">
      {STEPS.map((step, index) => (
        <span
          key={step}
          className={`step-chip${index === activeStep ? ' is-active' : ''}${index < activeStep ? ' is-done' : ''}`}
        >
          <em>{index + 1}</em>
          {step}
        </span>
      ))}
    </header>
  );
}
