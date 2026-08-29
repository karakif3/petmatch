import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Text, View } from "react-native";
import { Image } from "expo-image";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";

import { lightHaptic } from "../core/ui/haptics";
import {
  bumblePhotoFrames,
  moveItem,
  nearestFilledSlot,
  type SlotFrame,
} from "../core/ui/bumble-photo-slots";
import { AppPressable } from "./ui/pressable";
import { AppIcon } from "./ui/icon";

export type EditablePhoto = { id: string; uri: string };

type Props = {
  photos: EditablePhoto[];
  max: number;
  busy?: boolean;
  onChange: (photos: EditablePhoto[]) => void;
  onAdd: () => void;
  /** Sürüklerken dış ScrollView kilitlensin diye. */
  onDragActive?: (active: boolean) => void;
  /** Varsayılan pet kapağı (3/4). Sahip kare. */
  coverAspect?: number;
  /** Eski API: ızgara artık genişliğe göre ölçeklenir. */
  coverHeight?: number;
  emptyHint?: string;
  coverHint?: string;
  restHint?: string;
  /** Pet ızgarasında: kullanıcıyı da kareye al. Sahip ızgarasında kapalı. */
  includeSelfHint?: boolean;
};

const DEFAULT_COVER_ASPECT = 3 / 4;
const GAP = 8;
const SPRING = { damping: 18, stiffness: 220 };

function PhotoImage({
  uri,
  width,
  height,
  compact = false,
  fill = false,
}: {
  uri: string;
  width?: number;
  height?: number;
  compact?: boolean;
  fill?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const size = fill
    ? { width: "100%" as const, height: "100%" as const }
    : { width: width ?? 0, height: height ?? 0 };

  useEffect(() => setFailed(false), [uri]);

  if (failed) {
    return (
      <View
        style={size}
        className="items-center justify-center bg-bg-tertiary px-2"
      >
        <AppIcon name="image" color="#9A8B82" size={compact ? 20 : 30} />
        {!compact ? (
          <Text className="mt-2 text-center text-xs leading-4 text-text-secondary">
            Bu fotoğraf görüntülenemiyor. Yeniden yüklemeyi dene.
          </Text>
        ) : null}
      </View>
    );
  }

  return (
    <Image
      source={{ uri }}
      contentFit="cover"
      recyclingKey={uri}
      style={size}
      onError={() => setFailed(true)}
    />
  );
}

function FilledSlot({
  photo,
  index,
  frame,
  originFrame,
  lifted,
  isCover,
  busy,
  compact,
  onRemove,
  onDrop,
  onHover,
  onDragActive,
  onMoveBy,
}: {
  photo: EditablePhoto;
  index: number;
  frame: SlotFrame;
  originFrame: SlotFrame;
  lifted: boolean;
  isCover: boolean;
  busy?: boolean;
  compact: boolean;
  onRemove: () => void;
  onDrop: (from: number, cx: number, cy: number) => void;
  onHover: (from: number, cx: number, cy: number) => void;
  onDragActive?: (active: boolean) => void;
  onMoveBy: (offset: -1 | 1) => void;
}) {
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const scale = useSharedValue(1);
  const zIndex = useSharedValue(0);
  const left = useSharedValue(originFrame.x);
  const top = useSharedValue(originFrame.y);
  const boxW = useSharedValue(originFrame.w);
  const boxH = useSharedValue(originFrame.h);
  const dragging = useSharedValue(false);
  const placed = useRef(false);

  useEffect(() => {
    if (!placed.current) {
      left.value = lifted ? originFrame.x : frame.x;
      top.value = lifted ? originFrame.y : frame.y;
      boxW.value = lifted ? originFrame.w : frame.w;
      boxH.value = lifted ? originFrame.h : frame.h;
      placed.current = true;
      return;
    }
    if (lifted) {
      left.value = originFrame.x;
      top.value = originFrame.y;
      boxW.value = originFrame.w;
      boxH.value = originFrame.h;
      return;
    }
    left.value = withSpring(frame.x, SPRING);
    top.value = withSpring(frame.y, SPRING);
    boxW.value = withSpring(frame.w, SPRING);
    boxH.value = withSpring(frame.h, SPRING);
  }, [boxH, boxW, frame.h, frame.w, frame.x, frame.y, left, lifted, originFrame.h, originFrame.w, originFrame.x, originFrame.y, top]);

  const dragStart = useCallback(() => {
    onDragActive?.(true);
    lightHaptic();
  }, [onDragActive]);

  const dragStop = useCallback(() => {
    onDragActive?.(false);
  }, [onDragActive]);

  const commitDrop = useCallback(
    (cx: number, cy: number) => {
      onDrop(index, cx, cy);
    },
    [index, onDrop],
  );

  const reportHover = useCallback(
    (cx: number, cy: number) => {
      onHover(index, cx, cy);
    },
    [index, onHover],
  );

  const originX = originFrame.x;
  const originY = originFrame.y;
  const originW = originFrame.w;
  const originH = originFrame.h;

  const gesture = useMemo(
    () =>
      Gesture.Pan()
        .activateAfterLongPress(180)
        .enabled(!busy)
        .onStart(() => {
          dragging.value = true;
          zIndex.value = 40;
          scale.value = withSpring(1.06, SPRING);
          runOnJS(dragStart)();
        })
        .onUpdate((event) => {
          translateX.value = event.translationX;
          translateY.value = event.translationY;
          runOnJS(reportHover)(
            originX + originW / 2 + event.translationX,
            originY + originH / 2 + event.translationY,
          );
        })
        .onEnd((event) => {
          if (!dragging.value) return;
          runOnJS(commitDrop)(
            originX + originW / 2 + event.translationX,
            originY + originH / 2 + event.translationY,
          );
        })
        .onFinalize(() => {
          const wasDragging = dragging.value;
          dragging.value = false;
          translateX.value = withSpring(0, SPRING);
          translateY.value = withSpring(0, SPRING);
          scale.value = withSpring(1, SPRING, (finished) => {
            if (finished) zIndex.value = 0;
          });
          if (wasDragging) runOnJS(dragStop)();
        }),
    [
      busy,
      commitDrop,
      dragStart,
      dragStop,
      dragging,
      originH,
      originW,
      originX,
      originY,
      reportHover,
      scale,
      translateX,
      translateY,
      zIndex,
    ],
  );

  const animatedStyle = useAnimatedStyle(() => ({
    position: "absolute" as const,
    left: left.value,
    top: top.value,
    width: boxW.value,
    height: boxH.value,
    zIndex: zIndex.value,
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  return (
    <Animated.View
      accessibilityLabel={isCover ? "Kapak fotoğrafı" : `Fotoğraf ${index + 1}`}
      accessibilityHint="Sıralamak için basılı tutup sürükle"
      accessibilityActions={[
        { name: "decrement", label: "Öne al" },
        { name: "increment", label: "Geri al" },
      ]}
      onAccessibilityAction={(event) =>
        onMoveBy(event.nativeEvent.actionName === "decrement" ? -1 : 1)
      }
      style={animatedStyle}
    >
      <GestureDetector gesture={gesture}>
        <Animated.View
          className="overflow-hidden rounded-2xl border border-border bg-bg-tertiary"
          style={{
            width: lifted ? originFrame.w : frame.w,
            height: lifted ? originFrame.h : frame.h,
          }}
        >
          <PhotoImage
            uri={photo.uri}
            width={lifted ? originFrame.w : frame.w}
            height={lifted ? originFrame.h : frame.h}
            compact={compact}
          />
        </Animated.View>
      </GestureDetector>
      {isCover ? (
        <View
          pointerEvents="none"
          className="absolute left-2 top-2 rounded-full bg-brand px-2.5 py-1"
        >
          <Text className="text-[10px] font-bold text-white">Kapak</Text>
        </View>
      ) : null}
      <AppPressable
        onPress={onRemove}
        disabled={busy}
        accessibilityRole="button"
        accessibilityLabel={isCover ? "Kapak fotoğrafını kaldır" : "Fotoğrafı kaldır"}
        hitSlop={10}
        className="absolute right-1 top-1 z-10 h-7 w-7 items-center justify-center rounded-full bg-black/70"
      >
        <AppIcon name="x" color="#FFFFFF" size={14} />
      </AppPressable>
    </Animated.View>
  );
}

/**
 * Bumble tarzı foto ızgarası: kapak solda büyük, diğerleri etrafında,
 * her karede çarpı, basılı tutup sürükleyerek sıra.
 *
 * Önceki yatay thumb şeridi 3. fotoğrafı ekranın sağına kaçırıyordu.
 */
export function PetPhotoEditor({
  photos,
  max,
  busy,
  onChange,
  onAdd,
  onDragActive,
  coverAspect = DEFAULT_COVER_ASPECT,
  coverHeight: _coverHeight,
  emptyHint = "İlk fotoğraf keşfet kapağı olur",
  coverHint = "Kapak soldaki büyük fotoğraf — keşfette görünen kare.",
  restHint = "Kapak soldaki büyük fotoğraf. Çarpı ile sil; basılı tutup başka yuvaya sürükleyerek sırayı değiştir.",
  includeSelfHint = true,
}: Props) {
  const [width, setWidth] = useState(0);
  const [hover, setHover] = useState<{ from: number; to: number } | null>(null);
  const photosRef = useRef(photos);
  const hoverRef = useRef<{ from: number; to: number } | null>(null);

  useEffect(() => {
    photosRef.current = photos;
  }, [photos]);

  const slotCount = Math.max(max, photos.length);
  const { frames, height } =
    width > 0
      ? bumblePhotoFrames(slotCount, width, coverAspect, GAP)
      : { frames: [] as SlotFrame[], height: 220 };

  const preview = hover ? moveItem(photos, hover.from, hover.to) : photos;

  const reportHover = useCallback(
    (from: number, cx: number, cy: number) => {
      if (width <= 0) return;
      const layout = bumblePhotoFrames(slotCount, width, coverAspect, GAP);
      const to = nearestFilledSlot(cx, cy, layout.frames, photosRef.current.length);
      const prev = hoverRef.current;
      if (prev && prev.from === from && prev.to === to) return;
      hoverRef.current = { from, to };
      setHover({ from, to });
    },
    [coverAspect, slotCount, width],
  );

  const clearHover = useCallback(() => {
    hoverRef.current = null;
    setHover(null);
  }, []);

  const drop = useCallback(
    (from: number, cx: number, cy: number) => {
      const current = photosRef.current;
      if (!current.length || width <= 0) return;
      const layout = bumblePhotoFrames(slotCount, width, coverAspect, GAP);
      const to = nearestFilledSlot(cx, cy, layout.frames, current.length);
      const next = moveItem(current, from, to);
      clearHover();
      if (next === current) return;
      lightHaptic();
      onChange(next);
    },
    [clearHover, coverAspect, onChange, slotCount, width],
  );

  const handleDragActive = useCallback(
    (active: boolean) => {
      if (!active) clearHover();
      onDragActive?.(active);
    },
    [clearHover, onDragActive],
  );

  const remove = (id: string) => onChange(photos.filter((photo) => photo.id !== id));

  const moveBy = (id: string, offset: -1 | 1) => {
    const from = photos.findIndex((photo) => photo.id === id);
    if (from < 0) return;
    const next = moveItem(photos, from, from + offset);
    if (next === photos) return;
    lightHaptic();
    onChange(next);
  };

  if (!photos.length) {
    const emptyWidth = width > 0 ? Math.min(width * 0.58, 220) : 168;
    const emptyHeight = emptyWidth / coverAspect;
    return (
      <View onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
        <AppPressable
          onPress={onAdd}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel="Fotoğraf ekle"
          style={{ width: emptyWidth, height: emptyHeight }}
          className="items-center justify-center self-start rounded-3xl border border-dashed border-brand bg-brand/5"
        >
          <AppIcon name="camera" color="#F97362" size={34} />
          <Text className="mt-2.5 font-bold text-brand-dark">Fotoğraf ekle</Text>
          <Text className="mt-1 px-3 text-center text-xs text-text-tertiary">
            {emptyHint}
          </Text>
        </AppPressable>
      </View>
    );
  }

  return (
    <View>
      <View
        onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
        className="w-full"
        style={{ height, overflow: "visible" }}
      >
        {photos.map((photo, dataIndex) => {
          const previewIndex = preview.findIndex((item) => item.id === photo.id);
          const slot = frames[previewIndex] ?? frames[dataIndex];
          const origin = frames[dataIndex];
          if (!slot || !origin) return null;
          return (
            <FilledSlot
              key={photo.id}
              photo={photo}
              index={dataIndex}
              frame={slot}
              originFrame={origin}
              lifted={hover?.from === dataIndex}
              isCover={previewIndex === 0}
              busy={busy}
              compact={previewIndex > 0}
              onRemove={() => remove(photo.id)}
              onDrop={drop}
              onHover={reportHover}
              onDragActive={handleDragActive}
              onMoveBy={(offset) => moveBy(photo.id, offset)}
            />
          );
        })}
        {frames.slice(photos.length).map((frame, offset) => (
          <View
            key={`empty-${photos.length + offset}`}
            pointerEvents={hover ? "none" : "auto"}
            style={{
              position: "absolute",
              left: frame.x,
              top: frame.y,
              width: frame.w,
              height: frame.h,
              borderRadius: 16,
              borderWidth: 1,
              borderStyle: "dashed",
              borderColor: "#F97362",
              backgroundColor: "rgba(249, 115, 98, 0.05)",
              alignItems: "center",
              justifyContent: "center",
              opacity: hover ? 0.35 : 1,
            }}
          >
            <AppPressable
              onPress={onAdd}
              disabled={busy || Boolean(hover)}
              accessibilityRole="button"
              accessibilityLabel="Fotoğraf ekle"
              style={{
                width: frame.w,
                height: frame.h,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <AppIcon name="plus" color="#F97362" size={22} />
            </AppPressable>
          </View>
        ))}
      </View>
      <Text className="mt-2.5 text-xs leading-4 text-text-tertiary">
        {photos.length > 1 ? restHint : coverHint}
      </Text>
      {includeSelfHint ? (
        <Text className="mt-1.5 text-xs leading-4 text-text-secondary">
          Petinle aynı karede olduğun fotoğraflar daha çok işe yarar — kendini de al.
        </Text>
      ) : null}
    </View>
  );
}
