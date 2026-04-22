import { useRef, useState, type DragEventHandler } from 'react';

type UploadZoneProps = {
  uploadedFileCount: number;
  uploadedFileNames: string[];
  onFilesSelected: (files: FileList | null) => void | Promise<void>;
};

export default function UploadZone({ uploadedFileCount, uploadedFileNames, onFilesSelected }: UploadZoneProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const hasFiles = uploadedFileCount > 0;

  const openPicker = () => inputRef.current?.click();

  const onDragOver: DragEventHandler<HTMLDivElement> = (event) => {
    event.preventDefault();
    setIsDragOver(true);
  };

  const onDragLeave: DragEventHandler<HTMLDivElement> = () => {
    setIsDragOver(false);
  };

  const onDrop: DragEventHandler<HTMLDivElement> = (event) => {
    event.preventDefault();
    setIsDragOver(false);
    void onFilesSelected(event.dataTransfer.files);
  };

  return (
    <section aria-label="파일 업로드 영역" className={`upload-zone${hasFiles ? ' is-compact' : ''}`}>
      <div
        className={`upload-dropzone${isDragOver ? ' is-dragover' : ''}${hasFiles ? ' is-compact' : ''}`}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
      >
        <h3>{hasFiles ? '파일 추가 업로드' : 'PDF 파일 업로드'}</h3>
        <p>{hasFiles ? '추가 파일을 드래그하거나 선택해서 작업 목록에 넣으세요.' : '여기에 PDF를 드래그앤드롭하거나 파일 선택 버튼을 눌러 업로드하세요.'}</p>
        <button type="button" className="upload-control" onClick={openPicker}>
          파일 선택
        </button>
      </div>
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
      <p className="upload-meta">업로드된 파일: {uploadedFileCount}</p>
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
