import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { CONNECTION_CATEGORIES, type ConnectionCategory } from "@chartcross/engine";
import { colors, connectorDim } from "../theme";

interface Props {
  active: boolean;
  onGuess: (type: ConnectionCategory) => void;
  wildcardCount: number;
  onUseWildcard: () => void;
}

const LABELS: Record<ConnectionCategory, string> = {
  COLLAB: "COLLAB\nCONNECT",
  ARTIST: "ARTIST\nCONNECT",
  DECADE: "DECADE\nCONNECT",
};

const ACCENT: Record<ConnectionCategory, string> = {
  COLLAB: colors.collab,
  ARTIST: colors.connectorArtist,
  DECADE: colors.decade,
};

/**
 * The three connection-type tiles are always available - not drawn from the
 * rack - so this renders as a permanent, reusable trio rather than a rack
 * slot. Only tappable while a gap placement is waiting on a guess. The wild
 * connector is a fourth slot alongside them, bought via buyWildcard() -
 * it's the only role a wildcard can play now, never a placeable rack tile.
 */
export function ConnectorPicker({ active, onGuess, wildcardCount, onUseWildcard }: Props) {
  const wildcardEnabled = active && wildcardCount > 0;
  return (
    <View>
      <Text style={[styles.label, active && styles.labelActive]}>
        {active ? "PICK A CONNECTION TYPE" : "CONNECTORS"}
      </Text>
      <View style={styles.row}>
        {CONNECTION_CATEGORIES.map((type) => {
          const accent = ACCENT[type];
          return (
            <Pressable
              key={type}
              disabled={!active}
              onPress={() => onGuess(type)}
              style={[
                styles.chip,
                {
                  borderColor: accent,
                  backgroundColor: connectorDim[type],
                  opacity: active ? 1 : 0.4,
                  boxShadow: active ? `0 0 6px ${accent}` : undefined,
                },
              ]}
            >
              <Text style={[styles.chipText, { color: accent }]}>{LABELS[type]}</Text>
            </Pressable>
          );
        })}
        <Pressable
          disabled={!wildcardEnabled}
          onPress={onUseWildcard}
          style={[
            styles.chip,
            {
              borderColor: colors.wildcard,
              backgroundColor: colors.wildcardDim,
              opacity: wildcardEnabled ? 1 : 0.4,
              boxShadow: wildcardEnabled ? `0 0 6px ${colors.wildcard}` : undefined,
            },
          ]}
        >
          <Text style={[styles.chipText, { color: colors.wildcard }]}>{`★ WILD\n(${wildcardCount})`}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    color: colors.textSecondary,
    fontWeight: "700",
    letterSpacing: 1,
    fontSize: 11,
    marginBottom: 8,
    textAlign: "center",
  },
  labelActive: {
    color: colors.pendingGap,
  },
  row: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
  },
  chip: {
    width: 74,
    height: 54,
    borderRadius: 8,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  chipText: {
    fontSize: 10,
    fontWeight: "800",
    textAlign: "center",
    lineHeight: 13,
  },
});
