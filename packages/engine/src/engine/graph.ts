import { adjacentCells, END_ANCHOR_POS, STARTER_POS } from "./board";
import { Board } from "./types";

/**
 * True once STARTER and END_ANCHOR are joined by a path of placed tiles
 * that are simply orthogonally adjacent to one another - no year/peak/
 * collab match is required between any pair along the path. This is
 * deliberately more permissive than the scoring connections shown in the
 * connections list: two tiles can "touch" and bridge the path even if
 * they don't score anything together.
 */
export function isStarterPathConnectedToAnchor(board: Board): boolean {
  const startCell = board[STARTER_POS.row][STARTER_POS.col];
  if (!startCell.tile) return false;

  const visited = new Set<string>();
  const stack = [startCell];
  visited.add(`${startCell.row},${startCell.col}`);

  while (stack.length > 0) {
    const current = stack.pop()!;
    if (current.row === END_ANCHOR_POS.row && current.col === END_ANCHOR_POS.col) {
      return true;
    }
    for (const neighbor of adjacentCells(board, current.row, current.col)) {
      const key = `${neighbor.row},${neighbor.col}`;
      if (visited.has(key) || !neighbor.tile) continue;
      visited.add(key);
      stack.push(neighbor);
    }
  }
  return false;
}
