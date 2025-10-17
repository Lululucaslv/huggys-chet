'use client';

export default function HeroScrim({ strength = 0.34 }: { strength?: number }) {
  return (
    <div aria-hidden className="absolute inset-0 -z-10 pointer-events-none">
      <div
        className="absolute left-1/2 top-[18%] -translate-x-1/2 w-[88vw] max-w-[1400px] h-[260px] rounded-[28px]"
        style={{
          background: `radial-gradient(90% 140% at 50% 50%, rgba(2,6,23,${strength}) 0%, rgba(2,6,23,${strength*0.65}) 55%, rgba(2,6,23,0.05) 100%)`,
          backdropFilter: 'brightness(0.9)',
        }}
      />
      <div className="absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-[#00000022] to-transparent" />
      <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-[#00000010] to-transparent" />
    </div>
  );
}
