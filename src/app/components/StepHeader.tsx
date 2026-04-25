import { useMemo } from 'react';
import { useAppStore } from '../state/store';
import ThemeToggle from './ThemeToggle';

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
    <header className="top-header" aria-label="작업 단계">
      <div className="brand-block" aria-label="PDFWizard 브랜드">
        <span className="brand-block__logo" aria-hidden="true" />
        <strong>PDFWizard</strong>
      </div>
      <ThemeToggle />

      <ol className="sr-only" aria-label="현재 단계 안내">
        {STEPS.map((step, index) => (
          <li key={step}>
            <span>{step}</span>
            {index === activeStep ? <span> 현재 단계</span> : null}
            {index < activeStep ? <span> 완료 단계</span> : null}
          </li>
        ))}
      </ol>
    </header>
  );
}
