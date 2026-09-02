export type RasterWorkloadInput = {
  width: number;
  height: number;
  layerCount: number;
  frameCount?: number;
  pageCount?: number;
  tileSize?: number;
};

const positiveInteger = (value: number, label: string, allowZero = false) => {
  if (!Number.isInteger(value) || value < (allowZero ? 0 : 1)) throw new Error(`${label} must be ${allowZero ? "a non-negative" : "a positive"} integer.`);
};

export const profileRasterWorkload = (input: RasterWorkloadInput) => {
  const frameCount = input.frameCount ?? 0;
  const pageCount = input.pageCount ?? 0;
  const tileSize = input.tileSize ?? 256;
  positiveInteger(input.width, "Width");
  positiveInteger(input.height, "Height");
  positiveInteger(input.layerCount, "Layer count");
  positiveInteger(frameCount, "Frame count", true);
  positiveInteger(pageCount, "Page count", true);
  positiveInteger(tileSize, "Tile size");

  const tileColumns = Math.ceil(input.width / tileSize);
  const tileRows = Math.ceil(input.height / tileSize);
  const tilesPerLayer = tileColumns * tileRows;
  const rawLayerBytes = input.width * input.height * 4 * input.layerCount;
  const exposureSlots = input.layerCount * (frameCount + pageCount);
  const tier = rawLayerBytes > 1_073_741_824 || exposureSlots > 2_000
    ? "extreme"
    : rawLayerBytes > 268_435_456 || exposureSlots > 400
      ? "heavy"
      : "interactive";

  return {
    tileColumns,
    tileRows,
    tilesPerLayer,
    maximumTileCount: tilesPerLayer * input.layerCount,
    rawLayerBytes,
    exposureSlots,
    tier: tier as "interactive" | "heavy" | "extreme",
  };
};
