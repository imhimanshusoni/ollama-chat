declare module 'heic2any' {
  interface Options {
    blob: Blob;
    toType?: string;
    quality?: number;
    gifInterval?: number;
  }
  export default function heic2any(options: Options): Promise<Blob | Blob[]>;
}
