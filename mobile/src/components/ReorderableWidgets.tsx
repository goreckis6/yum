import React, { useEffect, useRef, useState } from 'react';
import { Animated, PanResponder, StyleSheet, View } from 'react-native';
import { ThemeColors } from '../theme/colors';
import { useTheme } from '../theme/ThemeContext';
import { Icon } from './Icon';

// A small, dependency-free drag-and-drop list (core Animated + PanResponder —
// no react-native-gesture-handler/reanimated, so no native rebuild needed).
// The drag handle is handed to `renderItem` so each card can place it inline
// in its own header, next to its own content, instead of floating on top.
export function ReorderableWidgets({
  order,
  onReorder,
  renderItem,
  gap = 22,
  onDragStateChange,
}: {
  order: string[];
  onReorder: (order: string[]) => void;
  renderItem: (key: string, dragHandle: React.ReactNode) => React.ReactNode;
  gap?: number;
  onDragStateChange?: (dragging: boolean) => void;
}) {
  const c = useTheme();

  // Keep a stable mount order so React never remounts an item mid-drag —
  // visual order is driven entirely by animated translateY, not JSX order.
  const stableKeys = useRef<string[]>(order).current;
  useEffect(() => {
    order.forEach((k) => {
      if (!stableKeys.includes(k)) stableKeys.push(k);
    });
  }, [order]);

  const [heights, setHeights] = useState<Record<string, number>>({});
  const [draggingKey, setDraggingKey] = useState<string | null>(null);
  const anims = useRef<Record<string, Animated.Value>>({}).current;
  const orderRef = useRef(order);
  orderRef.current = order;
  // The Y the dragged item started at, captured fresh at touch-down — reading
  // this back from the Animated.Value itself would be unreliable, since
  // useNativeDriver springs update the value natively and can leave the JS
  // side stale.
  const dragStartY = useRef(0);

  const ensureAnim = (key: string) => {
    if (!anims[key]) anims[key] = new Animated.Value(0);
    return anims[key];
  };

  const targetY = (key: string, ord: string[]) => {
    const idx = ord.indexOf(key);
    let y = 0;
    for (let i = 0; i < idx; i++) y += (heights[ord[i]] ?? 0) + gap;
    return y;
  };

  // Spring every non-dragged item to its slot whenever the order or a
  // measured height changes.
  useEffect(() => {
    stableKeys.forEach((key) => {
      if (key === draggingKey) return;
      Animated.spring(ensureAnim(key), {
        toValue: targetY(key, order),
        useNativeDriver: true,
        friction: 8,
        tension: 60,
      }).start();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order, heights, draggingKey]);

  const totalHeight =
    stableKeys.reduce((sum, k) => sum + (heights[k] ?? 0), 0) + Math.max(0, stableKeys.length - 1) * gap;

  const makePanResponder = (key: string) =>
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        const anim = ensureAnim(key);
        anim.stopAnimation();
        dragStartY.current = targetY(key, orderRef.current);
        anim.setValue(dragStartY.current);
        setDraggingKey(key);
        onDragStateChange?.(true);
      },
      onPanResponderMove: (_, gesture) => {
        const anim = ensureAnim(key);
        const liveY = dragStartY.current + gesture.dy;
        anim.setValue(liveY);

        const center = liveY + (heights[key] ?? 0) / 2;

        const others = orderRef.current.filter((k) => k !== key);
        let acc = 0;
        let newIndex = others.length;
        for (let i = 0; i < others.length; i++) {
          const h = heights[others[i]] ?? 0;
          if (center < acc + h / 2 + gap / 2) {
            newIndex = i;
            break;
          }
          acc += h + gap;
        }
        const currentIndex = orderRef.current.indexOf(key);
        if (newIndex !== currentIndex) {
          const next = [...others];
          next.splice(newIndex, 0, key);
          onReorder(next);
        }
      },
      onPanResponderRelease: () => {
        setDraggingKey(null);
        onDragStateChange?.(false);
      },
      onPanResponderTerminate: () => {
        setDraggingKey(null);
        onDragStateChange?.(false);
      },
    });

  const responders = useRef<Record<string, ReturnType<typeof PanResponder.create>>>({}).current;
  const getResponder = (key: string) => {
    if (!responders[key]) responders[key] = makePanResponder(key);
    return responders[key];
  };

  const styles = makeStyles(c);

  return (
    <View style={{ height: totalHeight || undefined }}>
      {stableKeys.map((key) => {
        const anim = ensureAnim(key);
        const pan = getResponder(key);
        const isDragging = draggingKey === key;
        const dragHandle = (
          <View {...pan.panHandlers} style={styles.grip} hitSlop={10}>
            <Icon name="grip" size={14} color={c.grayMuted} />
          </View>
        );
        return (
          <Animated.View
            key={key}
            onLayout={(e) => {
              const h = e.nativeEvent.layout.height;
              setHeights((s) => (s[key] === h ? s : { ...s, [key]: h }));
            }}
            style={[
              styles.item,
              { transform: [{ translateY: anim }], zIndex: isDragging ? 10 : 1 },
              isDragging && styles.itemDragging,
            ]}
          >
            {renderItem(key, dragHandle)}
          </Animated.View>
        );
      })}
    </View>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    item: { position: 'absolute', left: 0, right: 0 },
    itemDragging: { opacity: 0.92 },
    grip: { width: 26, height: 26, alignItems: 'center', justifyContent: 'center' },
  });
