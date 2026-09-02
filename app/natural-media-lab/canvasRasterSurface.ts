import { BlendMode } from "./documentModel";
import { EncodedRasterRegion, RasterRect } from "../../packages/art-room-core/src/rasterSurface";
import { TileSetDescriptorV1 } from "../../packages/art-room-core/src/binaryStorage";

export type CanvasCompositeLayer = {
  canvas: HTMLCanvasElement;
  visible: boolean;
  opacity: number;
  blendMode: BlendMode;
};

const canvasToBlob = (canvas: HTMLCanvasElement, mediaType: string) => new Promise<Blob>((resolve, reject) => {
  canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Canvas encoding failed.")), mediaType);
});

export const createCanvasRasterSurface = (canvas: HTMLCanvasElement) => ({
  get width() { return canvas.width; },
  get height() { return canvas.height; },
  context2d() {
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas 2D is unavailable.");
    return context;
  },
  resize(width: number, height: number) {
    canvas.width = width;
    canvas.height = height;
  },
  clear() {
    canvas.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
  },
  snapshotDataUrl(mediaType = "image/png", quality?: number) {
    return canvas.toDataURL(mediaType, quality);
  },
  restoreDataUrl(dataUrl: string) {
    const context = canvas.getContext("2d");
    if (!context || !dataUrl) return Promise.resolve();
    return new Promise<void>((resolve) => {
      const image = new Image();
      image.onload = () => { context.drawImage(image, 0, 0); resolve(); };
      image.onerror = () => resolve();
      image.src = dataUrl;
    });
  },
  async encodeRegion(region: RasterRect): Promise<EncodedRasterRegion> {
    const tile = document.createElement("canvas");
    tile.width = region.width;
    tile.height = region.height;
    tile.getContext("2d")?.drawImage(canvas, region.x, region.y, region.width, region.height, 0, 0, region.width, region.height);
    const blob = await canvasToBlob(tile, "image/png");
    return { mediaType: blob.type || "image/png", bytes: new Uint8Array(await blob.arrayBuffer()) };
  },
  async restoreTileSet(descriptor: TileSetDescriptorV1, resolve: (handleId: string) => Promise<string>) {
    if (descriptor.width !== canvas.width || descriptor.height !== canvas.height) throw new Error("Tile set dimensions do not match the canvas.");
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas 2D is unavailable.");
    for (const tile of descriptor.tiles) {
      const dataUrl = await resolve(tile.handleId);
      await new Promise<void>((resolveImage, rejectImage) => {
        const image = new Image();
        image.onload = () => {
          context.drawImage(image, tile.column * descriptor.tileSize, tile.row * descriptor.tileSize);
          resolveImage();
        };
        image.onerror = () => rejectImage(new Error(`Tile image could not be decoded: ${tile.handleId}`));
        image.src = dataUrl;
      });
    }
  },
});

export const compositeCanvasLayers = (
  width: number,
  height: number,
  background: "transparent" | "paper",
  layers: CanvasCompositeLayer[],
) => {
  const output = document.createElement("canvas");
  output.width = width;
  output.height = height;
  const context = output.getContext("2d");
  if (!context) throw new Error("Canvas 2D is unavailable.");
  if (background === "paper") {
    context.fillStyle = "#f1ede3";
    context.fillRect(0, 0, width, height);
  }
  layers.forEach((layer) => {
    if (!layer.visible) return;
    context.globalAlpha = layer.opacity;
    context.globalCompositeOperation = layer.blendMode;
    context.drawImage(layer.canvas, 0, 0);
  });
  context.globalAlpha = 1;
  context.globalCompositeOperation = "source-over";
  return output;
};
