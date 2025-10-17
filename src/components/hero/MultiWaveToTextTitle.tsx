'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';

/** 生成正弦波 path */
function makeWavePath({
  width, height, amplitude, cycles, phase, yOffset, samples = 260,
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
  height = 200,
  lineCount = 32,
  baseAmplitude = 28,
  cycles = 6,
  speed = 1.8,
  retractDelay = 1200,
  retractDuration = 700,
  fontSize = 64,
  fontSizeSm = 38,
  finalFill = '#FFFFFF',
}: {
  phrase?: string; height?: number; lineCount?: number;
  baseAmplitude?: number; cycles?: number; speed?: number;
  retractDelay?: number; retractDuration?: number;
  fontSize?: number; fontSizeSm?: number; finalFill?: string;
}) {
  /** ---- 关键 1：用视口宽度渲染，保证从最左到最右贯穿 ---- */
  const [vw, setVw] = useState<number>(typeof window !== 'undefined' ? window.innerWidth : 1200);
  useEffect(() => {
    const onR = () => setVw(window.innerWidth);
    window.addEventListener('resize', onR);
    return () => window.removeEventListener('resize', onR);
  }, []);

  const isSm = vw < 768;
  const FS = isSm ? fontSizeSm : fontSize;
  const amp = baseAmplitude * Math.sqrt(vw / 1200);

  /** ---- 关键 2：phase 用 state 驱动 → 每帧重绘，才会看到左→右流动 ---- */
  const [phase, setPhase] = useState(0);
  useEffect(() => {
    let raf = 0, last = performance.now();
    const tick = (now: number) => {
      const delta = (now - last) / 1000;
      last = now;
      setPhase(p => p + delta * speed * Math.PI);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [speed]);

  /** 线束的个体差异 */
  const lineParams = useMemo(() => {
    const rnd = (n: number) => (Math.sin(n) * 10000) % 1;
    return Array.from({ length: lineCount }, (_, i) => {
      const r1 = rnd(i + 1), r2 = rnd(i + 11), r3 = rnd(i + 111);
      return {
        ampMul: 0.6 + r1 * 0.9,
        alpha: 0.35 + r2 * 0.5,
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

  /** 生成当前帧所有路径（注意依赖 phase） */
  const paths = useMemo(
    () => lineParams.map(p =>
      makeWavePath({
        width: vw,
        height,
        amplitude: amp * p.ampMul,
        cycles,
        phase: phase + p.phase0,
        yOffset: p.y,
      })
    ),
    [phase, lineParams, vw, height, amp, cycles]
  );

  /** 测量文字宽度，用于"收回" */
  const measureRef = useRef<SVGTextElement | null>(null);
  const [box, setBox] = useState<{w: number; h: number}>({ w: vw * 0.8, h: FS * 1.2 });
  useEffect(() => {
    if (measureRef.current) {
      const b = measureRef.current.getBBox();
      setBox({ w: b.width, h: b.height });
    }
  }, [vw, FS, phrase]);

  const yBaseline = height / 2 + Math.round(FS * 0.32);

  return (
    <div className="w-screen">
      <svg
        viewBox={`0 0 ${vw} ${height}`}
        width="100vw"
        height={height}
        preserveAspectRatio="none"
        role="img"
        aria-label={phrase}
      >
        <defs>
          <linearGradient id="gradA" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#60A5FA"/><stop offset="100%" stopColor="#34D399"/>
          </linearGradient>
          <linearGradient id="gradB" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#34D399"/><stop offset="100%" stopColor="#8B5CF6"/>
          </linearGradient>
          <linearGradient id="gradC" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#A78BFA"/><stop offset="100%" stopColor="#60A5FA"/>
          </linearGradient>
          <linearGradient id="gradD" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#22D3EE"/><stop offset="100%" stopColor="#60A5FA"/>
          </linearGradient>

          {/* 动画裁剪：从全宽 → 文字宽度（左右"收回"） */}
          <clipPath id="clipRetract">
            <motion.rect
              initial={{ x: 0, y: 0, width: vw, height }}
              animate={{
                x: vw / 2 - box.w / 2,
                y: height / 2 - box.h / 2,
                width: box.w,
                height: box.h,
              }}
              transition={{
                delay: retractDelay / 1000,
                duration: retractDuration / 1000,
                ease: 'easeInOut',
              }}
              rx={6} ry={6}
            />
          </clipPath>

          {/* 文字形状 mask：最后阶段让线束"充满文字" */}
          <mask id="maskTitle">
            <rect width={vw} height={height} fill="black" />
            <text
              x={vw / 2}
              y={yBaseline}
              textAnchor="middle"
              fontSize={FS}
              fontWeight={800}
              fontFamily="Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial"
              fill="white"
              style={{ letterSpacing: '-0.02em' }}
            >
              {phrase}
            </text>
          </mask>
        </defs>

        {/* 全宽贯穿的线束 → 收回到文字宽度 → 与文字 mask 交叠 */}
        <g clipPath="url(#clipRetract)" mask="url(#maskTitle)">
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

        {/* 隐形测量用文本（不要删） */}
        <text
          ref={measureRef}
          x={vw / 2}
          y={yBaseline}
          textAnchor="middle"
          fontSize={FS}
          fontWeight={800}
          fontFamily="Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial"
          fill="transparent"
          style={{ letterSpacing: '-0.02em' }}
        >
          {phrase}
        </text>

        {/* 最终实心标题（在收回完成后快速淡入，可交给父级控制 opacity） */}
        <motion.text
          x={vw / 2}
          y={yBaseline}
          textAnchor="middle"
          fontSize={FS}
          fontWeight={800}
          fontFamily="Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial"
          fill={finalFill}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: (retractDelay + retractDuration) / 1000, duration: 0.45, ease: 'easeOut' }}
          style={{ letterSpacing: '-0.02em' }}
        >
          {phrase}
        </motion.text>
      </svg>
    </div>
  );
}
