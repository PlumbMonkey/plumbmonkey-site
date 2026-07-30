type PdfPage = { jpegDataUrl: string; pixelWidth: number; pixelHeight: number };

const ascii = (value: string) => new TextEncoder().encode(value);
const join = (chunks: Array<Uint8Array<ArrayBufferLike>>) => {
  const output = new Uint8Array(chunks.reduce((sum, chunk) => sum + chunk.length, 0));
  let offset = 0; chunks.forEach((chunk) => { output.set(chunk, offset); offset += chunk.length; }); return output;
};
const jpegBytes = (url: string) => {
  const binary = atob(url.split(",")[1] ?? ""), bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
  return bytes;
};

export const encodeComicPdf = (
  pages: PdfPage[],
  pageWidth: number,
  pageHeight: number,
  title: string,
) => {
  const objects: Array<Uint8Array<ArrayBufferLike>> = [];
  const pageIds = pages.map((_, index) => 3 + index * 3);
  objects[0] = ascii("<< /Type /Catalog /Pages 2 0 R >>");
  objects[1] = ascii(`<< /Type /Pages /Count ${pages.length} /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] >>`);
  pages.forEach((page, index) => {
    const pageId = 3 + index * 3, imageId = pageId + 1, contentId = pageId + 2;
    const image = jpegBytes(page.jpegDataUrl);
    const content = ascii(`q\n${pageWidth} 0 0 ${pageHeight} 0 0 cm\n/Im0 Do\nQ\n`);
    objects[pageId - 1] = ascii(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /XObject << /Im0 ${imageId} 0 R >> >> /Contents ${contentId} 0 R >>`);
    objects[imageId - 1] = join([ascii(`<< /Type /XObject /Subtype /Image /Width ${page.pixelWidth} /Height ${page.pixelHeight} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${image.length} >>\nstream\n`), image, ascii("\nendstream")]);
    objects[contentId - 1] = join([ascii(`<< /Length ${content.length} >>\nstream\n`), content, ascii("endstream")]);
  });
  const infoId = objects.length + 1;
  objects.push(ascii(`<< /Title (${title.replace(/[()\\]/g, "\\$&")}) /Creator (Natural Media Lab) >>`));
  const chunks: Array<Uint8Array<ArrayBufferLike>> = [ascii("%PDF-1.4\n%NML\n")], offsets = [0];
  objects.forEach((object, index) => {
    offsets[index + 1] = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    chunks.push(ascii(`${index + 1} 0 obj\n`), object, ascii("\nendobj\n"));
  });
  const xrefOffset = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  chunks.push(ascii(`xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`).join("")}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R /Info ${infoId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`));
  return new Blob([join(chunks)], { type: "application/pdf" });
};
