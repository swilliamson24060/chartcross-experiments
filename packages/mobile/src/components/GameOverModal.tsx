import React, { useEffect, useState } from "react";
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import type { GameStatus } from "@chartcross/engine";
import { colors } from "../theme";
import { MAX_NAME_LENGTH, submitScore } from "../leaderboard";

interface Props {
  status: GameStatus;
  penaltyApplied: number;
  rackSize: number;
  finalScore: number;
  onRestart: () => void;
  onScoreSubmitted: () => void;
}

function pts(n: number): string {
  return `${n} point${n === 1 ? "" : "s"}`;
}

function tiles(n: number): string {
  return `${n} tile${n === 1 ? "" : "s"}`;
}

type SubmitState = "idle" | "submitting" | "done" | "error";

export function GameOverModal({
  status,
  penaltyApplied,
  rackSize,
  finalScore,
  onRestart,
  onScoreSubmitted,
}: Props) {
  const [name, setName] = useState("");
  const [submitState, setSubmitState] = useState<SubmitState>("idle");

  // The modal component stays mounted across restarts (App.tsx renders it
  // unconditionally and it early-returns while playing) - reset the entry
  // form every time a new game-over is reached.
  useEffect(() => {
    if (status !== "playing") {
      setName("");
      setSubmitState("idle");
    }
  }, [status]);

  if (status === "playing") return null;

  const title = status === "bridged" ? "BOARD BRIDGED" : "NO MOVES LEFT";
  const body =
    status === "bridged"
      ? `STARTER and ANCHOR are now linked by a path of touching tiles. You lose ${pts(penaltyApplied)} for the ${tiles(rackSize)} left in your rack.`
      : `None of your rack tiles can be legally placed. You lose ${pts(penaltyApplied)} for the ${tiles(rackSize)} left in your rack.`;

  async function handleSubmit() {
    if (!name.trim() || submitState === "submitting") return;
    setSubmitState("submitting");
    try {
      await submitScore(name, finalScore);
      setSubmitState("done");
      onScoreSubmitted();
    } catch {
      setSubmitState("error");
    }
  }

  return (
    <Modal transparent animationType="fade" visible onRequestClose={onRestart}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.finalScoreLabel}>FINAL SCORE</Text>
          <Text style={styles.finalScoreValue}>{finalScore.toLocaleString()}</Text>
          <Text style={styles.body}>{body}</Text>

          {submitState === "done" ? (
            <Text style={styles.submittedText}>✓ Submitted to the Top 40!</Text>
          ) : (
            <View style={styles.submitRow}>
              <TextInput
                style={styles.nameInput}
                value={name}
                onChangeText={setName}
                placeholder="YOUR NAME"
                placeholderTextColor={colors.textSecondary}
                maxLength={MAX_NAME_LENGTH}
                editable={submitState !== "submitting"}
                autoCapitalize="characters"
              />
              <Pressable
                style={[styles.submitButton, !name.trim() && styles.submitButtonDisabled]}
                onPress={handleSubmit}
                disabled={!name.trim() || submitState === "submitting"}
              >
                {submitState === "submitting" ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.buttonText}>SUBMIT</Text>
                )}
              </Pressable>
            </View>
          )}
          {submitState === "error" && (
            <Text style={styles.errorText}>Couldn't submit — try again.</Text>
          )}

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
  submitRow: {
    flexDirection: "row",
    width: "100%",
    marginBottom: 12,
    gap: 8,
  },
  nameInput: {
    flex: 1,
    backgroundColor: colors.rackSlotBg,
    borderWidth: 2,
    borderColor: colors.rackSlotBorder,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: "700",
  },
  submitButton: {
    backgroundColor: colors.artist,
    paddingHorizontal: 16,
    justifyContent: "center",
    borderRadius: 8,
  },
  submitButtonDisabled: {
    opacity: 0.4,
  },
  submittedText: {
    color: colors.decade,
    fontSize: 13,
    fontWeight: "800",
    marginBottom: 12,
  },
  errorText: {
    color: colors.illegal,
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 8,
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
