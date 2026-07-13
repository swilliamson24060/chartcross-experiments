import React from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { colors } from "../theme";

interface Props {
  visible: boolean;
  cost: number;
  canAfford: boolean;
  onBuyWild: () => void;
  onEndGame: () => void;
}

/**
 * Shown when no rack tile has a legal move and there's no wild connector
 * available to fall back on (GameState.awaitingStuckDecision) - the game no
 * longer ends itself in this spot, so the player has to explicitly choose:
 * spend points on a wild connector to open up a rescue, or give up now.
 */
export function StuckModal({ visible, cost, canAfford, onBuyWild, onEndGame }: Props) {
  if (!visible) return null;

  return (
    <Modal transparent animationType="fade" visible onRequestClose={() => {}}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>NO MOVES LEFT</Text>
          <Text style={styles.body}>
            None of your rack tiles can be legally placed. Buy a ★ Wild connector to open up a
            rescue and keep playing, or end the game now.
          </Text>
          <Pressable
            style={[styles.button, styles.buyButton, !canAfford && styles.buttonDisabled]}
            onPress={onBuyWild}
            disabled={!canAfford}
          >
            <Text style={styles.buyButtonText}>✨ BUY WILD ({cost})</Text>
          </Pressable>
          <Pressable style={[styles.button, styles.endButton]} onPress={onEndGame}>
            <Text style={styles.endButtonText}>END GAME</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(5, 8, 18, 0.8)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  card: {
    width: "100%",
    maxWidth: 340,
    backgroundColor: colors.headerBackground,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.wildcard,
    padding: 22,
    alignItems: "center",
  },
  title: {
    color: colors.wildcard,
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: 1,
    marginBottom: 14,
  },
  body: {
    color: colors.textPrimary,
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 18,
  },
  button: {
    width: "100%",
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
    marginBottom: 10,
  },
  buyButton: {
    backgroundColor: colors.wildcard,
  },
  endButton: {
    backgroundColor: colors.illegal,
    marginBottom: 0,
  },
  buttonDisabled: {
    opacity: 0.35,
  },
  buyButtonText: {
    color: "#101522",
    fontWeight: "800",
    letterSpacing: 1,
  },
  endButtonText: {
    color: "#fff",
    fontWeight: "800",
    letterSpacing: 1,
  },
});
