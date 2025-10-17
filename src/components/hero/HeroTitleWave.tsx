'use client';

import { motion, useAnimation } from 'framer-motion';
import { useEffect, useMemo } from 'react';

/**
 * 将一段正弦波生成成 SVG path 的 d 字符串
 */
function makeWavePath({
  width = 1200,
  height = 120,
  amplitude = 0,
  cycles = 6,
}: {
  width?: number;
  height?: number;
  amplitude?: number;
  cycles?: number;
}) {
  const midY = height / 2;
  const points = 120;
  const step = width / points;
  let d = `M 0 ${midY}`;
  for (let i = 1; i <= points; i++) {
    const x = i * step;
    const t = (i / points) * (Math.PI * 2 * cycles);
    const y = midY + Math.sin(t) * amplitude;
    d += ` L ${x} ${y}`;
  }
  return d;
}

export default function HeroTitleWave({
  phrase = 'Therapy that fits your time and pace',
}: {
  phrase?: string;
}) {
  const W = 1200;
  const H = 160;

  const dFlat = useMemo(() => makeWavePath({ width: W, height: H, amplitude: 0 }), []);
  const dMed  = useMemo(() => makeWavePath({ width: W, height: H, amplitude: 8 }), []);
  const dBig  = useMemo(() => makeWavePath({ width: W, height: H, amplitude: 14 }), []);

  const waveCtrls = useAnimation();
  const textCtrls = useAnimation();

  useEffect(() => {
    (async () => {
      await waveCtrls.start({
        d: [dFlat, dMed, dBig, dMed, dBig],
        transition: {
          duration: 1.6,
          times: [0, 0.25, 0.5, 0.75, 1],
          ease: 'easeInOut',
        },
      });
      waveCtrls.start({
        d: [dMed, dBig, dMed],
        transition: {
          repeat: Infinity,
          duration: 1.8,
          ease: 'easeInOut',
        },
      });
    })();

    const t = setTimeout(async () => {
      await textCtrls.start({
        strokeDashoffset: 0,
        opacity: 1,
        transition: { duration: 1.0, ease: 'easeInOut' },
      });
      textCtrls.start({
        fillOpacity: 1,
        transition: { duration: 0.6, ease: 'easeOut' },
      });
      waveCtrls.start({
        opacity: 0,
        transition: { duration: 0.6, ease: 'easeOut' },
      });
    }, 1800);

    return () => clearTimeout(t);
  }, [waveCtrls, textCtrls, dFlat, dMed, dBig]);

  return (
    <div className="w-full flex items-center justify-center">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full max-w-[1100px] h-[120px]"
        role="img"
        aria-label={phrase}
      >
        <motion.path
          animate={waveCtrls}
          stroke="url(#waveGrad)"
          strokeWidth="6"
          fill="none"
          initial={{ opacity: 1, d: dFlat }}
        />
        <defs>
          <linearGradient id="waveGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%"  stopColor="#60A5FA" />
            <stop offset="50%" stopColor="#34D399" />
            <stop offset="100%" stopColor="#8B5CF6" />
          </linearGradient>
        </defs>

        <motion.text
          x={W / 2}
          y={H / 2 + 10}
          textAnchor="middle"
          fontSize="40"
          fontWeight={800}
          fontFamily="Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial"
          fill="#FFFFFF"
          fillOpacity={0}
          stroke="#FFFFFF"
          strokeWidth={1.5}
          animate={textCtrls}
          initial={{
            opacity: 0,
            strokeDasharray: 2200,
            strokeDashoffset: 2200,
            fillOpacity: 0,
          }}
          style={{ letterSpacing: '-0.02em' }}
        >
          {phrase}
        </motion.text>
      </svg>
    </div>
  );
}
