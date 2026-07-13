import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { Tile } from "@chartcross/engine";
import { colors } from "../theme";
import { TileChip } from "./TileChip";

interface Props {
  rack: Tile[];
  selectedIndex: number | null;
  onSelect: (index: number) => void;
  onShuffle: () => void;
}

const SLOT_SIZE = 56;

export function Rack({ rack, selectedIndex, onSelect, onShuffle }: Props) {
  return (
    <View>
      <View style={styles.toolbar}>
        <Text style={styles.rackLabel}>RACK</Text>
        <View style={styles.toolbarButtons}>
          <Pressable onPress={onShuffle} style={styles.iconButton}>
            <Text style={styles.iconText}>⇄</Text>
            <Text style={styles.iconCaption}>SHUFFLE</Text>
          </Pressable>
        </View>
      </View>
      <View style={styles.rackRow}>
        {rack.map((tile, index) => (
          <View key={tile.id} style={styles.slot}>
            <TileChip
              tile={tile}
              size={SLOT_SIZE}
              selected={selectedIndex === index}
              showValue
              onPress={() => onSelect(index)}
            />
            <Text style={styles.kindLabel}>{tile.kind}</Text>
          </View>
        ))}
        {Array.from({ length: Math.max(0, 5 - rack.length) }).map((_, i) => (
          <View key={`empty-${i}`} style={[styles.slot, styles.emptySlot]} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  toolbar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  rackLabel: {
    color: colors.textSecondary,
    fontWeight: "700",
    letterSpacing: 1,
  },
  toolbarButtons: {
    flexDirection: "row",
    gap: 16,
  },
  iconButton: {
    alignItems: "center",
  },
  iconText: {
    fontSize: 20,
  },
  iconCaption: {
    color: colors.textSecondary,
    fontSize: 9,
    marginTop: 2,
  },
  rackRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
  },
  slot: {
    alignItems: "center",
  },
  emptySlot: {
    width: SLOT_SIZE,
    height: SLOT_SIZE,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.rackSlotBorder,
    backgroundColor: colors.rackSlotBg,
  },
  kindLabel: {
    color: colors.textSecondary,
    fontSize: 8,
    marginTop: 2,
  },
});
