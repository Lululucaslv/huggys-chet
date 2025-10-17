'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, useAnimation, useAnimationFrame } from 'framer-motion';

/** 生成正弦波 path（phase 控制从左到右流动） */
function makeWavePath({
  width, height, amplitude, cycles, phase, yOffset, samples = 220,
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
  /** 高度固定让字重心稳定；宽度由容器实时测量 → 实现从左到右的"贯穿" */
  height = 180,
  lineCount = 28,
  baseAmplitude = 26,       // ↑ 幅度更大（可调 22–30）
  cycles = 6,
  flowSpeed = 1.8,
  retractDelay = 1200,
  retractDuration = 650,
  fontSize = 64,            // ↑ 桌面字号（≈旧版视觉）
  fontSizeSm = 38,          // 移动端字号
  darkText = false,         // 若背景很亮，可切 true 用深色字
}: {
  phrase?: string; height?: number; lineCount?: number;
  baseAmplitude?: number; cycles?: number; flowSpeed?: number;
  retractDelay?: number; retractDuration?: number;
  fontSize?: number; fontSizeSm?: number; darkText?: boolean;
}) {
  /** ---- 关键：用 ResizeObserver 获取"容器真实宽度"，保证贯穿全幅 ---- */
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [w, setW] = useState(1200);
  useEffect(() => {
    if (!wrapRef.current) return;
    const ro = new ResizeObserver(([entry]) => {
      setW(Math.max(600, Math.floor(entry.contentRect.width)));
    });
    ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, []);

  const isSm = w < 768;
  const FS = isSm ? fontSizeSm : fontSize;
  const ampScaled = baseAmplitude * Math.sqrt(w / 1200); // 宽度越大，波幅略增

  const lineParams = useMemo(() => {
    const rnd = (n: number) => (Math.sin(n) * 10000) % 1 + 1; // 0~2
    return Array.from({ length: lineCount }, (_, i) => {
      const r1 = rnd(i + 1), r2 = rnd(i + 11), r3 = rnd(i + 111);
      return {
        ampMul: 0.6 + (r1 % 1) * 0.8,                 // 0.6~1.4
        alpha: 0.35 + (r2 % 1) * 0.45,                // 0.35~0.8
        y: (i - lineCount / 2) * 1.0,                 // 细密分层
        phase0: (r3 % 1) * Math.PI * 2,
        stroke: i % 4 === 0 ? 'url(#gradA)'
              : i % 4 === 1 ? 'url(#gradB)'
              : i % 4 === 2 ? 'url(#gradC)'
              : 'url(#gradD)',
        width: 0.9 + (i % 5 === 0 ? 0.4 : 0),         // 细线为主
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
  }, [w, FS, phrase]);

  useEffect(() => {
    const t = setTimeout(async () => {
      await textCtrls.start({ fillOpacity: 1, opacity: 1, transition: { duration: 0.5, ease: 'easeOut' } });
      wavesCtrls.start({ opacity: 0, transition: { duration: 0.6, ease: 'easeOut' } });
    }, retractDelay + retractDuration);
    return () => clearTimeout(t);
  }, [retractDelay, retractDuration, wavesCtrls, textCtrls]);

  const paths = useMemo(() => {
    const phase = phaseRef.current;
    const amp = ampScaled * (1 - Math.pow(1 - ampProgress, 3)); // easeOutCubic
    return lineParams.map((p) =>
      makeWavePath({
        width: w, height,
        amplitude: amp * p.ampMul,
        cycles,
        phase: phase + p.phase0,
        yOffset: p.y,
      })
    );
  }, [ampProgress, ampScaled, cycles, height, w, lineParams]);

  const clipStart = { x: 0, y: 0, width: w, height };
  const clipEnd = useMemo(() => {
    const textW = textBox?.width ?? w * 0.82;
    const textH = textBox?.height ?? FS * 1.2;
    const x = w / 2 - textW / 2;
    const y = height / 2 - textH / 2;
    return { x, y, width: textW, height: textH };
  }, [textBox, w, height, FS]);

  return (
    <div ref={wrapRef} className="w-full">
      <svg
        viewBox={`0 0 ${w} ${height}`}
        width="100%"
        height={height}
        preserveAspectRatio="none"
        role="img"
        aria-label={phrase}
      >
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

          {/* 动画裁剪：从全宽→文字宽度 */}
          <clipPath id="retractClip">
            <motion.rect
              initial={{ x: clipStart.x, y: clipStart.y, width: clipStart.width, height: clipStart.height, rx: 6, ry: 6 }}
              animate={{ x: clipEnd.x, y: clipEnd.y, width: clipEnd.width, height: clipEnd.height }}
              transition={{ delay: retractDelay / 1000, duration: retractDuration / 1000, ease: 'easeInOut' }}
            />
          </clipPath>

          {/* 文字 Mask：用于"最终在文字形状内充满" */}
          <mask id="titleMask" maskUnits="userSpaceOnUse">
            <rect width={w} height={height} fill="black" />
            <text
              x={w / 2}
              y={height / 2 + Math.round(FS * 0.32)}
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

        {/* 线束：先全幅贯穿 → 裁剪收回到文字宽度 → 与文字 mask 结合形成"充满文字"的过渡 */}
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

        {/* 隐形测量文本（获取真实宽度） */}
        <text
          ref={textMeasureRef}
          x={w / 2}
          y={height / 2 + Math.round(FS * 0.32)}
          textAnchor="middle"
          fontSize={FS}
          fontWeight={800}
          fontFamily="Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial"
          fill="transparent"
          style={{ letterSpacing: '-0.02em' }}
        >
          {phrase}
        </text>

        {/* 最终实心标题（更大 & 颜色可选） */}
        <motion.text
          x={w / 2}
          y={height / 2 + Math.round(FS * 0.32)}
          textAnchor="middle"
          fontSize={FS}
          fontWeight={800}
          fontFamily="Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial"
          fill={darkText ? '#0F172A' : '#FFFFFF'}
          fillOpacity={0}
          animate={textCtrls}
          initial={{ fillOpacity: 0, opacity: 0 }}
          style={{ letterSpacing: '-0.02em', textShadow: darkText ? undefined : '0 0 12px rgba(2,6,23,0.25)' }}
        >
          {phrase}
        </motion.text>
      </svg>
    </div>
  );
}
