export {
  VeitThumbnailImageLightbox,
  type VeitThumbnailImageLightboxProps,
  type VeitThumbnailImageLightboxMode,
} from './VeitThumbnailImageLightbox.js';
export { VeitImageUploadInput, type VeitImageUploadInputProps } from './VeitImageUploadInput.tsx';

export async function uploadImageViaFormData(
  file: File,
  upload: (formData: FormData) => Promise<{ file_id: number }>,
  normalize?: (file: File) => Promise<File>
): Promise<number> {
  const source = normalize ? await normalize(file) : file;
  const fd = new FormData();
  fd.append('file', source);
  const result = await upload(fd);
  return result.file_id;
}
