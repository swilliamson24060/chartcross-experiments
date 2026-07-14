import React, { useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { colors } from "../theme";
import { fetchTop40, type LeaderboardEntry } from "../leaderboard";

interface Props {
  visible: boolean;
  onClose: () => void;
  /** Bumped by the caller after a score submission to force a refetch. */
  refreshKey?: number;
  highlightScore?: number;
}

export function LeaderboardModal({ visible, onClose, refreshKey, highlightScore }: Props) {
  const [entries, setEntries] = useState<LeaderboardEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    setEntries(null);
    setError(null);
    fetchTop40()
      .then((result) => {
        if (!cancelled) setEntries(result);
      })
      .catch(() => {
        if (!cancelled) setError("Couldn't load the leaderboard. Try again later.");
      });
    return () => {
      cancelled = true;
    };
  }, [visible, refreshKey]);

  if (!visible) return null;

  return (
    <Modal transparent animationType="fade" visible onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.card} onPress={() => {}}>
          <View style={styles.headerRow}>
            <Text style={styles.title}>TOP 40</Text>
            <Pressable onPress={onClose} hitSlop={10}>
              <Text style={styles.closeText}>✕</Text>
            </Pressable>
          </View>

          {error ? (
            <Text style={styles.emptyText}>{error}</Text>
          ) : entries === null ? (
            <ActivityIndicator color={colors.textPrimary} style={styles.loading} />
          ) : entries.length === 0 ? (
            <Text style={styles.emptyText}>No scores yet — be the first!</Text>
          ) : (
            <FlatList
              data={entries}
              keyExtractor={(_, i) => `${i}`}
              style={styles.list}
              renderItem={({ item, index }) => (
                <View
                  style={[
                    styles.row,
                    highlightScore != null && item.score === highlightScore && styles.rowHighlight,
                  ]}
                >
                  <Text style={styles.rankText}>{index + 1}</Text>
                  <Text style={styles.nameText} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <Text style={styles.scoreText}>{item.score.toLocaleString()}</Text>
                </View>
              )}
            />
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(5, 8, 18, 0.72)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  card: {
    width: "100%",
    maxWidth: 380,
    maxHeight: "70%",
    backgroundColor: colors.headerBackground,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.cellBorder,
    padding: 18,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  title: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: 1,
  },
  closeText: {
    color: colors.textSecondary,
    fontSize: 18,
    fontWeight: "700",
  },
  emptyText: {
    color: colors.textSecondary,
    fontSize: 13,
    paddingVertical: 16,
    textAlign: "center",
  },
  loading: {
    paddingVertical: 24,
  },
  list: {
    flexGrow: 0,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: colors.cellBorder,
  },
  rowHighlight: {
    backgroundColor: "rgba(255, 224, 102, 0.08)",
  },
  rankText: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: "800",
    width: 28,
  },
  nameText: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: "700",
  },
  scoreText: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: "800",
    marginLeft: 8,
  },
});
