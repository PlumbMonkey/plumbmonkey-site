import { encodeComicPdf } from "./pdfEncoder";

type PdfWorkerRequest = {
  pages: Array<{ jpegDataUrl: string; pixelWidth: number; pixelHeight: number }>;
  pageWidth: number;
  pageHeight: number;
  title: string;
};

const scope = self as unknown as {
  onmessage: ((event: MessageEvent<PdfWorkerRequest>) => void) | null;
  postMessage: (message: { buffer?: ArrayBuffer; error?: string }, transfer?: Transferable[]) => void;
};

scope.onmessage = async ({ data }) => {
  try {
    const buffer = await encodeComicPdf(data.pages, data.pageWidth, data.pageHeight, data.title).arrayBuffer();
    scope.postMessage({ buffer }, [buffer]);
  } catch (error) {
    scope.postMessage({ error: error instanceof Error ? error.message : "PDF worker failed" });
  }
};
