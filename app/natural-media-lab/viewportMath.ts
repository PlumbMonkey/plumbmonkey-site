export const MIN_EDITOR_ZOOM = 35;
export const MAX_EDITOR_ZOOM = 160;
export const DEFAULT_EDITOR_ZOOM = 70;

export type ViewportSize = { width: number; height: number };

export type CanvasViewportGeometry = {
  paperWidth: number;
  paperHeight: number;
  viewportWidth: number;
  viewportHeight: number;
};

export const clampEditorZoom = (zoom: number) =>
  Math.max(MIN_EDITOR_ZOOM, Math.min(MAX_EDITOR_ZOOM, zoom));

export const getPaperBaseSize = (
  documentWidth: number,
  documentHeight: number,
  browserWidth: number,
  browserHeight: number,
): ViewportSize => {
  const safeDocumentWidth = Math.max(1, documentWidth);
  const safeDocumentHeight = Math.max(1, documentHeight);
  const maxWidth = Math.max(1, Math.min(browserWidth * 0.72, 900));
  const maxHeight = Math.max(1, browserHeight * 0.75);
  const scale = Math.min(maxWidth / safeDocumentWidth, maxHeight / safeDocumentHeight);

  return {
    width: safeDocumentWidth * scale,
    height: safeDocumentHeight * scale,
  };
};

export const getCanvasViewportGeometry = (
  baseSize: ViewportSize,
  editorZoom: number,
  cameraZoom: number,
  rotationDegrees: number,
  gutter = 40,
): CanvasViewportGeometry => {
  const scale = clampEditorZoom(editorZoom) / 100 * Math.max(0.01, cameraZoom / 100);
  const paperWidth = Math.max(1, baseSize.width * scale);
  const paperHeight = Math.max(1, baseSize.height * scale);
  const radians = rotationDegrees * Math.PI / 180;
  const cosine = Math.abs(Math.cos(radians));
  const sine = Math.abs(Math.sin(radians));

  return {
    paperWidth,
    paperHeight,
    viewportWidth: paperWidth * cosine + paperHeight * sine + gutter * 2,
    viewportHeight: paperWidth * sine + paperHeight * cosine + gutter * 2,
  };
};

export const clientPointToPaperRatio = (
  clientX: number,
  clientY: number,
  centerX: number,
  centerY: number,
  paperWidth: number,
  paperHeight: number,
  rotationDegrees: number,
) => {
  const radians = rotationDegrees * Math.PI / 180;
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);
  const deltaX = clientX - centerX;
  const deltaY = clientY - centerY;
  const localX = deltaX * cosine + deltaY * sine;
  const localY = -deltaX * sine + deltaY * cosine;

  return {
    x: localX / Math.max(1, paperWidth) + 0.5,
    y: localY / Math.max(1, paperHeight) + 0.5,
  };
};

export const paperRatioToClientPoint = (
  ratioX: number,
  ratioY: number,
  centerX: number,
  centerY: number,
  paperWidth: number,
  paperHeight: number,
  rotationDegrees: number,
) => {
  const radians = rotationDegrees * Math.PI / 180;
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);
  const localX = (ratioX - 0.5) * paperWidth;
  const localY = (ratioY - 0.5) * paperHeight;

  return {
    x: centerX + localX * cosine - localY * sine,
    y: centerY + localX * sine + localY * cosine,
  };
};
