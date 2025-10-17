export default function GradientBG() {
  return (
    <div
      aria-hidden
      className="absolute inset-0 -z-10 opacity-70 scale-125 blur-[80px]"
      style={{
        background: 'linear-gradient(260deg, #b57cff, #5ba8ff, #63e6be, #b57cff)',
        backgroundSize: '300% 300%',
        animation: 'gradientFlow 18s ease infinite',
        filter: 'saturate(1.4) brightness(1.1)'
      }}
    />
  );
}
