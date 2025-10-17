export default function GradientBG() {
  return (
    <div
      aria-hidden
      className="absolute inset-0 z-[1] opacity-50"
      style={{
        background: 'linear-gradient(270deg, #667eea, #764ba2, #f093fb, #4facfe, #667eea)',
        backgroundSize: '400% 400%',
        animation: 'gradientFlow 12s ease infinite'
      }}
    />
  );
}
