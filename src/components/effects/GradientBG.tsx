export default function GradientBG() {
  return (
    <div
      aria-hidden
      className="absolute inset-0 -z-10 opacity-50"
      style={{
        background: 'linear-gradient(270deg,#c4e0f9,#a1c4fd,#c2e9fb)',
        backgroundSize: '600% 600%',
        animation: 'gradientFlow 20s ease infinite'
      }}
    />
  );
}
