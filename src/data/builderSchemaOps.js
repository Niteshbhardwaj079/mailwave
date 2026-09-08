// ---------------------------------------------------------------------------
// Drag & Drop builder ke block-tree par saare mutations — ek hi jagah, pure
// functions (koi React nahi). TemplateBuilderPage in sabko `setSchema(prev =>
// op(prev, ...))` se chalata hai. Har function ek NAYA schema object deta
// hai, kabhi input ko mutate nahi karta — taaki undo/redo aage jaake aasaani
// se add ho sake, aur React state updates hamesha sahi tarah re-render karein.
// ---------------------------------------------------------------------------
import { newBlock, newBlockId, newDefaultRow } from './builderCompiler.js';

function mapRow(schema, rowId, fn) {
  return { ...schema, rows: schema.rows.map((row) => (row.id === rowId ? fn(row) : row)) };
}

function mapColumn(row, colId, fn) {
  return { ...row, columns: row.columns.map((col) => (col.id === colId ? fn(col) : col)) };
}

// --- rows --------------------------------------------------------------------

export function addRow(schema, columnsCount = 1) {
  return { ...schema, rows: [...schema.rows, newDefaultRow(columnsCount)] };
}

export function removeRow(schema, rowId) {
  const rows = schema.rows.filter((r) => r.id !== rowId);
  return { ...schema, rows: rows.length ? rows : [newDefaultRow(1)] };
}

export function moveRow(schema, rowId, direction) {
  const index = schema.rows.findIndex((r) => r.id === rowId);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= schema.rows.length) return schema;
  const rows = [...schema.rows];
  [rows[index], rows[target]] = [rows[target], rows[index]];
  return { ...schema, rows };
}

export function updateRow(schema, rowId, patch) {
  return mapRow(schema, rowId, (row) => ({ ...row, ...patch }));
}

// --- blocks --------------------------------------------------------------------

export function addBlock(schema, rowId, colId, type) {
  return mapRow(schema, rowId, (row) =>
    mapColumn(row, colId, (col) => ({ ...col, blocks: [...col.blocks, newBlock(type)] }))
  );
}

export function updateBlock(schema, rowId, colId, blockId, patch) {
  return mapRow(schema, rowId, (row) =>
    mapColumn(row, colId, (col) => ({
      ...col,
      blocks: col.blocks.map((b) => (b.id === blockId ? { ...b, ...patch } : b)),
    }))
  );
}

export function removeBlock(schema, rowId, colId, blockId) {
  return mapRow(schema, rowId, (row) =>
    mapColumn(row, colId, (col) => ({ ...col, blocks: col.blocks.filter((b) => b.id !== blockId) }))
  );
}

export function duplicateBlock(schema, rowId, colId, blockId) {
  return mapRow(schema, rowId, (row) =>
    mapColumn(row, colId, (col) => {
      const index = col.blocks.findIndex((b) => b.id === blockId);
      if (index < 0) return col;
      const copy = { ...col.blocks[index], id: newBlockId() };
      const blocks = [...col.blocks];
      blocks.splice(index + 1, 0, copy);
      return { ...col, blocks };
    })
  );
}

export function moveBlock(schema, rowId, colId, blockId, direction) {
  return mapRow(schema, rowId, (row) =>
    mapColumn(row, colId, (col) => {
      const index = col.blocks.findIndex((b) => b.id === blockId);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= col.blocks.length) return col;
      const blocks = [...col.blocks];
      [blocks[index], blocks[target]] = [blocks[target], blocks[index]];
      return { ...col, blocks };
    })
  );
}

/** Drag-and-drop se ek block ko usi column ke andar kisi bhi index par le jaata hai. */
export function reorderBlockWithinColumn(schema, rowId, colId, draggedBlockId, targetBlockId) {
  if (draggedBlockId === targetBlockId) return schema;
  return mapRow(schema, rowId, (row) =>
    mapColumn(row, colId, (col) => {
      const fromIndex = col.blocks.findIndex((b) => b.id === draggedBlockId);
      const toIndex = col.blocks.findIndex((b) => b.id === targetBlockId);
      if (fromIndex < 0 || toIndex < 0) return col;
      const blocks = [...col.blocks];
      const [moved] = blocks.splice(fromIndex, 1);
      blocks.splice(toIndex, 0, moved);
      return { ...col, blocks };
    })
  );
}
