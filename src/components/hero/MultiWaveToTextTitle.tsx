'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, useAnimation, useAnimationFrame } from 'framer-motion';

function makeWavePath({
  width,
  height,
  amplitude,
  cycles,
  phase,
  yOffset,
  samples = 140,
}: {
  width: number;
  height: number;
  amplitude: number;
  cycles: number;
  phase: number;
  yOffset: number;
  samples?: number;
}) {
  const midY = height / 2 + yOffset;
  const step = width / samples;
  let d = `M 0 ${midY}`;
  for (let i = 1; i <= samples; i++) {
    const x = i * step;
    const t = (i / samples) * (Math.PI * 2 * cycles) + phase;
    const y = midY + Math.sin(t) * amplitude;
    d += ` L ${x} ${y}`;
  }
  return d;
}

export default function MultiWaveToTextTitle({
  phrase = 'Therapy that fits your time and pace',
  width = 1200,
  height = 160,
  lineCount = 22,
  baseAmplitude = 10,
  cycles = 6,
  flowSpeed = 1.6,
}: {
  phrase?: string;
  width?: number;
  height?: number;
  lineCount?: number;
  baseAmplitude?: number;
  cycles?: number;
  flowSpeed?: number;
}) {
  const lineParams = useMemo(() => {
    const rng = (seed: number) => {
      const x = Math.sin(seed) * 10000;
      return x - Math.floor(x);
    };
    const arr = Array.from({ length: lineCount }, (_, i) => {
      const r1 = rng(i + 1);
      const r2 = rng(i + 11);
      const r3 = rng(i + 111);
      return {
        ampMul: 0.6 + r1 * 0.6,
        alpha: 0.35 + r2 * 0.4,
        y: (i - lineCount / 2) * 1.2,
        phase0: r3 * Math.PI * 2,
        stroke: i % 4 === 0 ? 'url(#gradA)'
              : i % 4 === 1 ? 'url(#gradB)'
              : i % 4 === 2 ? 'url(#gradC)'
              : 'url(#gradD)',
        width: 1 + (i % 3 === 0 ? 0.2 : 0),
      };
    });
    return arr;
  }, [lineCount]);

  const wavesCtrls = useAnimation();
  const textCtrls  = useAnimation();

  const [ampProgress, setAmpProgress] = useState(0);
  const phaseRef = useRef(0);

  useAnimationFrame((_, delta) => {
    phaseRef.current += (delta / 1000) * flowSpeed * 2 * Math.PI * 0.5;
    setAmpProgress((p) => {
      if (p >= 1) return 1;
      const next = Math.min(1, p + delta / 1200);
      return next;
    });
  });

  useEffect(() => {
    const t = setTimeout(async () => {
      await textCtrls.start({
        fillOpacity: 1,
        opacity: 1,
        transition: { duration: 0.5, ease: 'easeOut' },
      });
      wavesCtrls.start({
        opacity: 0,
        transition: { duration: 0.6, ease: 'easeOut' },
      });
    }, 1800);
    return () => clearTimeout(t);
  }, [textCtrls, wavesCtrls]);

  const paths = useMemo(() => {
    const phase = phaseRef.current;
    const amp = baseAmplitude * (1 - Math.pow(1 - ampProgress, 3));
    return lineParams.map((p) =>
      makeWavePath({
        width,
        height,
        amplitude: amp * p.ampMul,
        cycles,
        phase: phase + p.phase0,
        yOffset: p.y,
      })
    );
  }, [ampProgress, baseAmplitude, cycles, height, width, lineParams]);

  return (
    <div className="w-full flex items-center justify-center">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full max-w-[1100px] h-[120px]"
        role="img"
        aria-label={phrase}
      >
        <defs>
          <linearGradient id="gradA" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%"  stopColor="#60A5FA" />
            <stop offset="100%" stopColor="#34D399" />
          </linearGradient>
          <linearGradient id="gradB" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%"  stopColor="#34D399" />
            <stop offset="100%" stopColor="#8B5CF6" />
          </linearGradient>
          <linearGradient id="gradC" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%"  stopColor="#A78BFA" />
            <stop offset="100%" stopColor="#60A5FA" />
          </linearGradient>
          <linearGradient id="gradD" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%"  stopColor="#22D3EE" />
            <stop offset="100%" stopColor="#60A5FA" />
          </linearGradient>

          <mask id="titleMask" maskUnits="userSpaceOnUse">
            <rect width={width} height={height} fill="black" />
            <text
              x={width / 2}
              y={height / 2 + 16}
              textAnchor="middle"
              fontSize="46"
              fontWeight={800}
              fontFamily="Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial"
              fill="white"
              style={{ letterSpacing: '-0.02em' }}
            >
              {phrase}
            </text>
          </mask>
        </defs>

        <motion.g mask="url(#titleMask)" animate={wavesCtrls} initial={{ opacity: 1 }}>
          {paths.map((d, i) => {
            const p = lineParams[i];
            return (
              <path
                key={i}
                d={d}
                fill="none"
                stroke={p.stroke}
                strokeWidth={p.width}
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={p.alpha}
              />
            );
          })}
        </motion.g>

        <motion.text
          x={width / 2}
          y={height / 2 + 16}
          textAnchor="middle"
          fontSize="46"
          fontWeight={800}
          fontFamily="Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial"
          fill="#FFFFFF"
          fillOpacity={0}
          animate={textCtrls}
          initial={{ fillOpacity: 0, opacity: 0 }}
          style={{ letterSpacing: '-0.02em' }}
        >
          {phrase}
        </motion.text>
      </svg>
    </div>
  );
}
