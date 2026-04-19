import { useRef } from 'react';

type UploadZoneProps = {
  uploadedFileCount: number;
  uploadedFileNames: string[];
  onFilesSelected: (files: FileList | null) => void | Promise<void>;
};

export default function UploadZone({ uploadedFileCount, uploadedFileNames, onFilesSelected }: UploadZoneProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  return (
    <section aria-label="파일 업로드 영역">
      <h2>파일 업로드</h2>
      <p>PDF 파일을 드래그하거나 클릭해서 업로드하세요.</p>
      <button type="button" className="upload-control" onClick={() => inputRef.current?.click()}>
        파일 선택
      </button>
      <input
        ref={inputRef}
        id="pdf-upload-input"
        className="upload-input-hidden"
        aria-label="PDF 업로드 입력"
        type="file"
        accept="application/pdf"
        multiple
        onChange={(event) => onFilesSelected(event.currentTarget.files)}
      />
      <p>업로드된 파일: {uploadedFileCount}</p>
      {uploadedFileNames.length > 0 ? (
        <ul aria-label="업로드 파일 목록" className="uploaded-file-list">
          {uploadedFileNames.slice(0, 5).map((name, index) => (
            <li key={`${name}-${index}`}>{name}</li>
          ))}
          {uploadedFileNames.length > 5 ? <li>+{uploadedFileNames.length - 5}개 더</li> : null}
        </ul>
      ) : null}
    </section>
  );
}
