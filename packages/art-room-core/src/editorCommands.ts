import { NaturalMediaDocument, PaintLayer } from "./documentModel";

export type EditableLayerPatch = Partial<Pick<PaintLayer, "name" | "visible" | "locked" | "opacity" | "blendMode">>;

type EditorCommandBase = {
  id: string;
  createdAt: string;
};

export type EditorCommand =
  | EditorCommandBase & { type: "layer.add"; layer: PaintLayer; index?: number; makeActive: boolean }
  | EditorCommandBase & { type: "layer.delete"; layerId: string }
  | EditorCommandBase & { type: "layer.move"; layerId: string; direction: -1 | 1 }
  | EditorCommandBase & { type: "layer.update"; layerId: string; patch: EditableLayerPatch };

const withUpdatedAt = (document: NaturalMediaDocument, command: EditorCommand) => ({
  ...document,
  updatedAt: command.createdAt,
});

export const applyEditorCommand = (
  document: NaturalMediaDocument,
  command: EditorCommand,
): NaturalMediaDocument => {
  if (command.type === "layer.add") {
    if (document.layers.some((layer) => layer.id === command.layer.id)) return document;
    const index = command.index === undefined
      ? document.layers.length
      : Math.max(0, Math.min(document.layers.length, command.index));
    const layers = [...document.layers];
    layers.splice(index, 0, command.layer);
    return {
      ...withUpdatedAt(document, command),
      layers,
      activeLayerId: command.makeActive ? command.layer.id : document.activeLayerId,
    };
  }

  if (command.type === "layer.delete") {
    if (document.layers.length <= 1 || !document.layers.some((layer) => layer.id === command.layerId)) return document;
    const layers = document.layers.filter((layer) => layer.id !== command.layerId);
    return {
      ...withUpdatedAt(document, command),
      layers,
      activeLayerId: document.activeLayerId === command.layerId ? layers[layers.length - 1].id : document.activeLayerId,
    };
  }

  if (command.type === "layer.move") {
    const index = document.layers.findIndex((layer) => layer.id === command.layerId);
    const target = index + command.direction;
    if (index < 0 || target < 0 || target >= document.layers.length) return document;
    const layers = [...document.layers];
    [layers[index], layers[target]] = [layers[target], layers[index]];
    return { ...withUpdatedAt(document, command), layers };
  }

  if (!document.layers.some((layer) => layer.id === command.layerId)) return document;
  return {
    ...withUpdatedAt(document, command),
    layers: document.layers.map((layer) => layer.id === command.layerId ? { ...layer, ...command.patch } : layer),
  };
};
