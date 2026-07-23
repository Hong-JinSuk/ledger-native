import { type ReactNode, useEffect, useRef, useState } from 'react';
import { Animated, Easing, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { Palette } from '@/constants/palette';

export interface DonutDatum {
  value: number;
  color: string;
}

/**
 * A donut (원형) chart drawn with react-native-svg. Each slice is a stroked arc on one shared circle,
 * rotated to sit end-to-end; a small gap the width of {@link gap} shows the surface between neighbours
 * (the dataviz "surface gap" — separation without a border). `children` render centred inside the ring
 * (e.g. a total figure).
 *
 * Slices are drawn in the order given — the caller assigns colours in a fixed categorical order (see
 * `constants/chart`), so identity never depends on slice size. An all-zero total renders a soft track
 * so the ring still reads as a chart on an empty period.
 *
 * When {@link pulseKey} changes (e.g. the period toggles) the ring dips-and-restores its opacity — a
 * soft dissolve that masks the arc swap instead of hard-cutting. Arcs can't tween cleanly between
 * different category sets, so a dissolve is the honest transition here.
 */
export function DonutChart({
  data,
  size = 168,
  thickness = 26,
  gap = 2.5,
  pulseKey,
  children,
}: {
  data: DonutDatum[];
  size?: number;
  thickness?: number;
  /** Surface gap between slices, in px of arc length. */
  gap?: number;
  /** Changing this value dissolves the ring (opacity dip→restore); the first render stays static. */
  pulseKey?: string | number;
  children?: ReactNode;
}) {
  const center = size / 2;
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  const total = data.reduce((sum, d) => sum + Math.max(d.value, 0), 0);
  // A lone slice draws a full ring with no notch (a gap on a 100% slice reads as a stray sliver).
  const positives = data.filter((d) => d.value > 0).length;

  // Opacity dissolve on pulseKey change. Starts visible; the first effect run is skipped so the initial
  // mount fades in via the parent's entrance, not here.
  const [opacity] = useState(() => new Animated.Value(1));
  const firstPulse = useRef(true);
  useEffect(() => {
    if (firstPulse.current) {
      firstPulse.current = false;
      return;
    }
    opacity.setValue(0.25);
    const anim = Animated.timing(opacity, {
      toValue: 1,
      duration: 450,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    anim.start();
    return () => anim.stop();
  }, [pulseKey, opacity]);

  let acc = 0; // cumulative fraction consumed by prior slices → this slice's start angle
  return (
    <Animated.View
      style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center', opacity }}>
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        {total <= 0 ? (
          <Circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke={Palette.line}
            strokeWidth={thickness}
          />
        ) : (
          data.map((d, i) => {
            if (d.value <= 0) return null;
            const fraction = d.value / total;
            const arc = fraction * circumference;
            const gapLen = positives > 1 ? Math.min(gap, arc * 0.5) : 0;
            const dash = Math.max(arc - gapLen, 0.001);
            const startAngle = -90 + acc * 360; // -90 → first slice starts at 12 o'clock
            acc += fraction;
            return (
              <Circle
                key={i}
                cx={center}
                cy={center}
                r={radius}
                fill="none"
                stroke={d.color}
                strokeWidth={thickness}
                strokeLinecap="butt"
                strokeDasharray={`${dash} ${circumference}`}
                rotation={startAngle}
                originX={center}
                originY={center}
              />
            );
          })
        )}
      </Svg>
      {children ? <View style={{ alignItems: 'center' }}>{children}</View> : null}
    </Animated.View>
  );
}
