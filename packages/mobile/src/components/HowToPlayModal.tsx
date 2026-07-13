import React, { useRef, useState } from "react";
import {
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  CHART_BOOST_FLAT_BONUS,
  decadePoints,
  REASON_POINTS,
  WILD_TILE_COST,
  WRONG_CONNECTOR_PENALTY,
} from "@chartcross/engine";
import { colors } from "../theme";

interface Props {
  visible: boolean;
  onClose: () => void;
}

function Section({
  title,
  color,
  children,
}: {
  title: string;
  color?: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, color ? { color } : null]}>{title}</Text>
      {children}
    </View>
  );
}

function ScoreRow({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={styles.scoreRow}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text style={styles.scoreLabel}>{label}</Text>
      <Text style={[styles.scoreValue, { color }]}>{value}</Text>
    </View>
  );
}

export function HowToPlayModal({ visible, onClose }: Props) {
  const [canScrollMore, setCanScrollMore] = useState(false);
  const metrics = useRef({ scrollY: 0, viewportHeight: 0, contentHeight: 0 });

  function recomputeScrollHint() {
    const { scrollY, viewportHeight, contentHeight } = metrics.current;
    setCanScrollMore(contentHeight - scrollY - viewportHeight > 8);
  }

  function handleScroll(e: NativeSyntheticEvent<NativeScrollEvent>) {
    metrics.current.scrollY = e.nativeEvent.contentOffset.y;
    recomputeScrollHint();
  }

  function handleLayout(e: { nativeEvent: { layout: { height: number } } }) {
    metrics.current.viewportHeight = e.nativeEvent.layout.height;
    recomputeScrollHint();
  }

  function handleContentSizeChange(_width: number, height: number) {
    metrics.current.contentHeight = height;
    recomputeScrollHint();
  }

  if (!visible) return null;

  return (
    <Modal transparent animationType="fade" visible onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.headerRow}>
            <Text style={styles.title}>HOW TO PLAY</Text>
            <Pressable onPress={onClose} hitSlop={10}>
              <Text style={styles.closeText}>✕</Text>
            </Pressable>
          </View>

          <View style={styles.scrollWrap}>
            <ScrollView
              style={styles.scroll}
              showsVerticalScrollIndicator={false}
              onScroll={handleScroll}
              onLayout={handleLayout}
              onContentSizeChange={handleContentSizeChange}
              scrollEventThrottle={32}
            >
            <Section title="GOAL">
              <Text style={styles.body}>
                Place tiles from your rack onto the board to rack up points. Careful — the game
                can end suddenly, and when it does, it costs you.
              </Text>
            </Section>

            <Section title="PLACING TILES">
              <Text style={styles.body}>
                Tap a rack tile, then tap a highlighted cell two squares away from a tile already
                on the board, in a straight line, with an empty gap between them.
              </Text>
            </Section>

            <Section title="GUESS THE CONNECTION">
              <Text style={styles.body}>
                Placing a real tile doesn't score yet — you still have to fill the gap. Pick one
                of the three always-available connector tiles below the board and guess how the
                two tiles relate:
              </Text>
              <ScoreRow label="Collab Connect" value={`+${REASON_POINTS.COLLAB}`} color={colors.collab} />
              <ScoreRow label="Artist Connect" value={`+${REASON_POINTS.ARTIST}`} color={colors.connectorArtist} />
              <ScoreRow label="Decade Connect" value={`+${REASON_POINTS.DECADE}`} color={colors.decade} />
              <Text style={styles.body}>
                Guess wrong and you lose {WRONG_CONNECTOR_PENALTY} points, but the gap stays open
                — just try a different connector. The connector tiles themselves never run out.
              </Text>
              <Text style={styles.body}>
                Not sure? A ★ Wild connector (bought with ✨ BUY WILD) always fills the gap
                correctly for +{REASON_POINTS.WILDCARD} connection points — a guaranteed rescue,
                not a scoring play. Wildcards can only ever be used this way, never placed as a
                rack tile.
              </Text>
            </Section>

            <Section title="SCORING">
              <Text style={styles.body}>
                Every tile also carries its own Point Value (the badge on rack tiles), based on
                the decade it charted in — 2020s is worth {decadePoints(2023)}, all the way back
                to the 1950s at {decadePoints(1958)}. Older is worth more. This value is added on
                top of the connection score once you guess correctly.
              </Text>
              <Text style={styles.body}>
                Landing on a 2X or 3X SONG/ARTIST cell multiplies your connection score if the
                tile type matches. CHART BOOST adds a flat +{CHART_BOOST_FLAT_BONUS}. Multipliers
                never apply to connector tiles (Wild included) — if one ends up on a gap cell, it
                hops to a fresh spot on the board instead of going to waste.
              </Text>
            </Section>

            <Section title="GAME OVER — WATCH OUT" color={colors.illegal}>
              <Text style={styles.body}>
                The game ends immediately, and you lose points equal to the total value of every
                tile left in your rack, if either of these happens:
              </Text>
              <Text style={styles.bullet}>
                •  STARTER and END ANCHOR become linked by a path of touching tiles — even tiles
                that don't score anything together.
              </Text>
              <Text style={styles.bullet}>
                •  None of your rack tiles have any legal placement left — unless you're holding a
                ★ Wild connector, in which case you get a rescue: tap the ★ WILD chip, tap an empty
                board cell next to any placed tile with empty space beyond it, then place any rack
                tile there for free. It keeps the game going but scores no points at all.
              </Text>
            </Section>

            <Section title="TOOLS">
              <Text style={styles.bullet}>💡 HINT — selects a playable tile and highlights where it can go.</Text>
              <Text style={styles.bullet}>⇄ SHUFFLE — reorders your rack.</Text>
              <Text style={styles.bullet}>
                ✨ BUY WILD ({WILD_TILE_COST}) — spend points for a ★ Wild connector charge, usable
                any time to resolve a pending guess for free.
              </Text>
              <Text style={styles.bullet}>📊 CONNECTIONS — view every scored connection on the board.</Text>
              <Text style={styles.bullet}>Tap any placed tile to see its full details.</Text>
            </Section>
            </ScrollView>
            {canScrollMore && (
              <View style={styles.scrollHint} pointerEvents="none">
                <Text style={styles.scrollHintText}>▼ SCROLL FOR MORE</Text>
              </View>
            )}
          </View>

          <Pressable style={styles.button} onPress={onClose}>
            <Text style={styles.buttonText}>START PLAYING</Text>
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
    padding: 20,
  },
  card: {
    width: "100%",
    maxWidth: 420,
    maxHeight: "85%",
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
    marginBottom: 10,
  },
  title: {
    color: colors.textPrimary,
    fontSize: 17,
    fontWeight: "800",
    letterSpacing: 1,
  },
  closeText: {
    color: colors.textSecondary,
    fontSize: 18,
    fontWeight: "700",
  },
  scrollWrap: {
    flex: 1,
    position: "relative",
    marginBottom: 14,
  },
  scroll: {
    flex: 1,
  },
  scrollHint: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: "center",
    paddingVertical: 6,
    paddingTop: 18,
    backgroundColor: "rgba(22, 33, 63, 0.95)",
  },
  scrollHintText: {
    color: colors.textSecondary,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1,
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    color: colors.textPrimary,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1,
    marginBottom: 6,
  },
  body: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 6,
  },
  bullet: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 4,
  },
  scoreRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 4,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  scoreLabel: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: "600",
  },
  scoreValue: {
    fontSize: 13,
    fontWeight: "800",
  },
  button: {
    backgroundColor: colors.artist,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  buttonText: {
    color: "#fff",
    fontWeight: "800",
    letterSpacing: 1,
  },
});
