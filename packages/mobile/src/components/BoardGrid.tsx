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

export function BoardGrid({ board, cellSize, highlightCells, onCellPress }: Props) {
  const size = cellSize * GRID_SIZE;
  return (
    <View style={[styles.board, { width: size, height: size }]}>
      {board.map((row, rowIndex) => (
        <View key={rowIndex} style={styles.row}>
          {row.map((cell) => {
            const isHighlighted = highlightCells.has(`${cell.row},${cell.col}`);
            return (
              <Pressable
                key={cell.col}
                onPress={() => onCellPress(cell.row, cell.col)}
                style={[
                  styles.cell,
                  {
                    width: cellSize,
                    height: cellSize,
                    borderColor: isHighlighted ? colors.year : colors.cellBorder,
                    borderWidth: isHighlighted ? 2 : 1,
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
                          fontSize: Math.max(7, cellSize * 0.14),
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
