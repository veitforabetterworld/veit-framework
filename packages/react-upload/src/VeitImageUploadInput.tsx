import { useRef, type ReactNode } from 'react';

export type VeitImageUploadInputProps = {
  onSelect: (file: File) => void;
  accept?: string;
  disabled?: boolean;
  children: ReactNode;
};

export function VeitImageUploadInput({
  onSelect,
  accept = 'image/*',
  disabled = false,
  children,
}: VeitImageUploadInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <>
      <button type="button" onClick={() => inputRef.current?.click()} disabled={disabled}>
        {children}
      </button>
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        accept={accept}
        disabled={disabled}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onSelect(file);
          e.target.value = '';
        }}
      />
    </>
  );
}
