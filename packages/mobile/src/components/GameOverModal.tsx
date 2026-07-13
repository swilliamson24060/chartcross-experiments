import React from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import type { GameStatus } from "@chartcross/engine";
import { colors } from "../theme";

interface Props {
  status: GameStatus;
  penaltyApplied: number;
  rackSize: number;
  finalScore: number;
  onRestart: () => void;
}

function pts(n: number): string {
  return `${n} point${n === 1 ? "" : "s"}`;
}

function tiles(n: number): string {
  return `${n} tile${n === 1 ? "" : "s"}`;
}

export function GameOverModal({ status, penaltyApplied, rackSize, finalScore, onRestart }: Props) {
  if (status === "playing") return null;

  const title = status === "bridged" ? "BOARD BRIDGED" : "NO MOVES LEFT";
  const body =
    status === "bridged"
      ? `STARTER and END ANCHOR are now linked by a path of touching tiles. You lose ${pts(penaltyApplied)} for the ${tiles(rackSize)} left in your rack.`
      : `None of your rack tiles can be legally placed. You lose ${pts(penaltyApplied)} for the ${tiles(rackSize)} left in your rack.`;

  return (
    <Modal transparent animationType="fade" visible onRequestClose={onRestart}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.finalScoreLabel}>FINAL SCORE</Text>
          <Text style={styles.finalScoreValue}>{finalScore.toLocaleString()}</Text>
          <Text style={styles.body}>{body}</Text>
          <Pressable style={styles.button} onPress={onRestart}>
            <Text style={styles.buttonText}>TRY AGAIN ↻</Text>
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
    borderColor: colors.illegal,
    padding: 22,
    alignItems: "center",
  },
  title: {
    color: colors.illegal,
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: 1,
    marginBottom: 14,
  },
  finalScoreLabel: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.5,
  },
  finalScoreValue: {
    color: colors.textPrimary,
    fontSize: 36,
    fontWeight: "800",
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
    backgroundColor: colors.illegal,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  buttonText: {
    color: "#fff",
    fontWeight: "800",
    letterSpacing: 1,
  },
});
