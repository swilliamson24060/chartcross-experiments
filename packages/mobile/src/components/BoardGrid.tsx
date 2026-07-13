import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Board, GRID_SIZE, MultiplierType } from "@chartcross/engine";
import { colors } from "../theme";
import { TileChip } from "./TileChip";
import { ConnectionLines } from "./ConnectionLines";

interface Props {
  board: Board;
  cellSize: number;
  highlightCells: Set<string>;
  /** The cell currently awaiting player action - a connector guess or a rescue tile. */
  pendingActionCell?: { row: number; col: number } | null;
  onCellPress: (row: number, col: number) => void;
}

const MULTIPLIER_LABELS: Record<MultiplierType, string> = {
  "2X_SONG": "2X\nSONG",
  "3X_SONG": "3X\nSONG",
  "2X_ARTIST": "2X\nARTIST",
  "3X_ARTIST": "3X\nARTIST",
  CHART_BOOST: "CHART\nBOOST",
};

const MULTIPLIER_COLORS: Record<MultiplierType, string> = {
  "2X_SONG": colors.multiplierSong,
  "3X_SONG": colors.multiplierSong,
  "2X_ARTIST": colors.multiplierArtist,
  "3X_ARTIST": colors.multiplierArtist,
  CHART_BOOST: colors.chartBoost,
};

// 3X cells get a bolder fill, a glowing border, and bigger text so they
// visually outrank 2X cells at a glance instead of only differing by label.
const MULTIPLIER_TIER: Record<MultiplierType, 2 | 3 | 1> = {
  "2X_SONG": 2,
  "3X_SONG": 3,
  "2X_ARTIST": 2,
  "3X_ARTIST": 3,
  CHART_BOOST: 1,
};

export function BoardGrid({ board, cellSize, highlightCells, pendingActionCell, onCellPress }: Props) {
  const size = cellSize * GRID_SIZE;
  return (
    <View style={[styles.board, { width: size, height: size }]}>
      {board.map((row, rowIndex) => (
        <View key={rowIndex} style={styles.row}>
          {row.map((cell) => {
            const isHighlighted = highlightCells.has(`${cell.row},${cell.col}`);
            const isPendingGap =
              pendingActionCell?.row === cell.row && pendingActionCell?.col === cell.col;
            const tier = cell.multiplier ? MULTIPLIER_TIER[cell.multiplier] : undefined;
            const multiplierColor = cell.multiplier ? MULTIPLIER_COLORS[cell.multiplier] : undefined;
            return (
              <Pressable
                key={cell.col}
                onPress={() => onCellPress(cell.row, cell.col)}
                style={[
                  styles.cell,
                  {
                    width: cellSize,
                    height: cellSize,
                    borderColor: isPendingGap
                      ? colors.pendingGap
                      : isHighlighted
                        ? colors.decade
                        : tier === 3
                          ? multiplierColor
                          : colors.cellBorder,
                    borderWidth: isPendingGap ? 3 : isHighlighted ? 2 : tier === 3 ? 2 : 1,
                    backgroundColor: isPendingGap
                      ? `${colors.pendingGap}22`
                      : tier === 3
                        ? `${multiplierColor}33`
                        : tier === 2
                          ? `${multiplierColor}15`
                          : colors.cellEmpty,
                  },
                ]}
              >
                {cell.tile ? (
                  <TileChip tile={cell.tile} size={cellSize - 4} role={cell.role} />
                ) : cell.multiplier ? (
                  <View style={styles.multiplierWrap}>
                    <Text
                      style={[
                        styles.multiplierText,
                        {
                          color: MULTIPLIER_COLORS[cell.multiplier],
                          fontSize: Math.max(7, cellSize * (tier === 3 ? 0.17 : 0.14)),
                        },
                      ]}
                    >
                      {MULTIPLIER_LABELS[cell.multiplier]}
                    </Text>
                  </View>
                ) : null}
                {cell.role === "STARTER" && (
                  <Text style={[styles.roleLabel, styles.roleLabelBelow, { color: colors.starter }]}>
                    STARTER
                  </Text>
                )}
                {cell.role === "END_ANCHOR" && (
                  <Text style={[styles.roleLabel, styles.roleLabelAbove, { color: colors.endAnchor }]}>
                    END ANCHOR
                  </Text>
                )}
              </Pressable>
            );
          })}
        </View>
      ))}
      <ConnectionLines board={board} cellSize={cellSize} />
    </View>
  );
}

const styles = StyleSheet.create({
  board: {
    backgroundColor: colors.boardBackground,
  },
  row: {
    flexDirection: "row",
  },
  cell: {
    backgroundColor: colors.cellEmpty,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  multiplierWrap: {
    alignItems: "center",
    justifyContent: "center",
  },
  multiplierText: {
    fontWeight: "700",
    textAlign: "center",
  },
  roleLabel: {
    position: "absolute",
    fontSize: 8,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  roleLabelAbove: {
    top: -14,
  },
  roleLabelBelow: {
    bottom: -14,
  },
});
