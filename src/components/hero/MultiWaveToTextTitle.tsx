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
  samples = 160,
}: {
  width: number; height: number; amplitude: number; cycles: number;
  phase: number; yOffset: number; samples?: number;
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
  height = 170,
  lineCount = 24,
  baseAmplitude = 16,
  cycles = 6,
  flowSpeed = 1.6,
  retractDelay = 1200,
  retractDuration = 600,
}: {
  phrase?: string; width?: number; height?: number;
  lineCount?: number; baseAmplitude?: number; cycles?: number; flowSpeed?: number;
  retractDelay?: number; retractDuration?: number;
}) {
  const lineParams = useMemo(() => {
    const rnd = (n: number) => {
      const x = Math.sin(n) * 10000;
      return x - Math.floor(x);
    };
    return Array.from({ length: lineCount }, (_, i) => {
      const r1 = rnd(i + 1), r2 = rnd(i + 11), r3 = rnd(i + 111);
      return {
        ampMul: 0.6 + r1 * 0.7,
        alpha: 0.35 + r2 * 0.45,
        y: (i - lineCount / 2) * 1.1,
        phase0: r3 * Math.PI * 2,
        stroke: i % 4 === 0 ? 'url(#gradA)'
              : i % 4 === 1 ? 'url(#gradB)'
              : i % 4 === 2 ? 'url(#gradC)'
              : 'url(#gradD)',
        width: 0.9 + (i % 5 === 0 ? 0.4 : 0),
      };
    });
  }, [lineCount]);

  const wavesCtrls = useAnimation();
  const textCtrls  = useAnimation();

  const [ampProgress, setAmpProgress] = useState(0);
  const phaseRef = useRef(0);

  useAnimationFrame((_, delta) => {
    phaseRef.current += (delta / 1000) * flowSpeed * 2 * Math.PI * 0.5;
    setAmpProgress((p) => (p >= 1 ? 1 : Math.min(1, p + delta / 1200)));
  });

  const textMeasureRef = useRef<SVGTextElement | null>(null);
  const [textBox, setTextBox] = useState<{x:number;y:number;width:number;height:number} | null>(null);
  useEffect(() => {
    if (!textMeasureRef.current) return;
    const box = textMeasureRef.current.getBBox();
    setTextBox({ x: box.x, y: box.y, width: box.width, height: box.height });
  }, []);

  useEffect(() => {
    const t = setTimeout(async () => {
      await textCtrls.start({ fillOpacity: 1, opacity: 1, transition: { duration: 0.5, ease: 'easeOut' } });
      wavesCtrls.start({ opacity: 0, transition: { duration: 0.6, ease: 'easeOut' } });
    }, retractDelay + retractDuration);
    return () => clearTimeout(t);
  }, [retractDelay, retractDuration, wavesCtrls, textCtrls]);

  const paths = useMemo(() => {
    const phase = phaseRef.current;
    const amp = baseAmplitude * (1 - Math.pow(1 - ampProgress, 3));
    return lineParams.map((p) =>
      makeWavePath({
        width, height, cycles,
        amplitude: amp * p.ampMul, phase: phase + p.phase0, yOffset: p.y,
      })
    );
  }, [ampProgress, baseAmplitude, cycles, height, width, lineParams]);

  const clipStart = { x: 0, y: 0, w: width, h: height };
  const clipEnd = useMemo(() => {
    const textW = textBox?.width ?? width * 0.8;
    const textH = textBox?.height ?? 60;
    const x = width / 2 - textW / 2;
    const y = height / 2 - textH / 2;
    return { x, y, w: textW, h: textH };
  }, [textBox, width, height]);

  return (
    <div className="w-full flex items-center justify-center">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full max-w-[1100px] h-[120px]" role="img" aria-label={phrase}>
        <defs>
          <linearGradient id="gradA" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%"  stopColor="#60A5FA" /><stop offset="100%" stopColor="#34D399" />
          </linearGradient>
          <linearGradient id="gradB" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%"  stopColor="#34D399" /><stop offset="100%" stopColor="#8B5CF6" />
          </linearGradient>
          <linearGradient id="gradC" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%"  stopColor="#A78BFA" /><stop offset="100%" stopColor="#60A5FA" />
          </linearGradient>
          <linearGradient id="gradD" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%"  stopColor="#22D3EE" /><stop offset="100%" stopColor="#60A5FA" />
          </linearGradient>

          <mask id="titleMask" maskUnits="userSpaceOnUse">
            <rect width={width} height={height} fill="black" />
            <text
              x={width / 2} y={height / 2 + 18} textAnchor="middle"
              fontSize="48" fontWeight={800}
              fontFamily="Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial"
              fill="white" style={{ letterSpacing: '-0.02em' }}
            >{phrase}</text>
          </mask>

          <clipPath id="retractClip">
            <motion.rect
              initial={{ x: clipStart.x, y: clipStart.y, width: clipStart.w, height: clipStart.h, rx: 6, ry: 6 }}
              animate={{ x: clipEnd.x, y: clipEnd.y, width: clipEnd.w, height: clipEnd.h }}
              transition={{ delay: retractDelay / 1000, duration: retractDuration / 1000, ease: 'easeInOut' }}
            />
          </clipPath>
        </defs>

        <motion.g clipPath="url(#retractClip)" animate={wavesCtrls} initial={{ opacity: 1 }}>
          <g mask="url(#titleMask)">
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
          </g>
        </motion.g>

        <text
          ref={textMeasureRef}
          x={width / 2} y={height / 2 + 18} textAnchor="middle"
          fontSize="48" fontWeight={800}
          fontFamily="Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial"
          fill="transparent" style={{ letterSpacing: '-0.02em' }}
        >{phrase}</text>

        <motion.text
          x={width / 2} y={height / 2 + 18} textAnchor="middle"
          fontSize="48" fontWeight={800}
          fontFamily="Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial"
          fill="#FFFFFF"
          fillOpacity={0}
          animate={textCtrls}
          initial={{ fillOpacity: 0, opacity: 0 }}
          style={{ letterSpacing: '-0.02em', textShadow: '0 0 12px rgba(2,6,23,0.25)' }}
        >{phrase}</motion.text>
      </svg>
    </div>
  );
}
