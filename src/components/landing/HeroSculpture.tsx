// Abstract 3D-inspired sculpture: radial metallic blades around a central ring,
// with floating chrome rings. Pure SVG + CSS — no 3D engine, no external assets.

const BLADES = 18

export function HeroSculpture() {
  const cx = 300
  const cy = 300
  return (
    <div className="relative mx-auto aspect-square w-full max-w-[620px]" aria-hidden>
      {/* soft glow */}
      <div className="absolute inset-[12%] rounded-full bg-[radial-gradient(circle,rgba(65,105,255,0.45),rgba(155,92,255,0.18)_45%,transparent_70%)] blur-2xl" />

      <div className="absolute inset-0" style={{ transform: 'perspective(1400px) rotateX(52deg) rotateZ(-22deg)', transformStyle: 'preserve-3d' }}>
        <svg viewBox="0 0 600 600" className="h-full w-full overflow-visible">
          <defs>
            <linearGradient id="blade-a" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#0a0f5c" />
              <stop offset="35%" stopColor="#1b2bc4" />
              <stop offset="70%" stopColor="#4169FF" />
              <stop offset="88%" stopColor="#7fe3ff" />
              <stop offset="100%" stopColor="#c9b3ff" />
            </linearGradient>
            <linearGradient id="blade-b" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#120a5e" />
              <stop offset="40%" stopColor="#3a2bd0" />
              <stop offset="72%" stopColor="#9B5CFF" />
              <stop offset="90%" stopColor="#ffb8ec" />
              <stop offset="100%" stopColor="#e6f4ff" />
            </linearGradient>
            <linearGradient id="blade-side" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#05083a" />
              <stop offset="100%" stopColor="#1a2390" />
            </linearGradient>
            <linearGradient id="ring-metal" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#ffffff" />
              <stop offset="30%" stopColor="#a9c1ff" />
              <stop offset="55%" stopColor="#3154DF" />
              <stop offset="75%" stopColor="#d6c4ff" />
              <stop offset="100%" stopColor="#ffffff" />
            </linearGradient>
            <radialGradient id="core" cx="0.42" cy="0.38" r="0.7">
              <stop offset="0%" stopColor="#6b8bff" />
              <stop offset="45%" stopColor="#151DA4" />
              <stop offset="100%" stopColor="#060a3f" />
            </radialGradient>
          </defs>

          {/* blades */}
          {Array.from({ length: BLADES }, (_, i) => {
            const angle = (360 / BLADES) * i
            const long = i % 3 === 0 ? 250 : i % 3 === 1 ? 210 : 228
            const width = i % 2 === 0 ? 30 : 24
            const fill = i % 4 === 1 || i % 4 === 2 ? 'url(#blade-b)' : 'url(#blade-a)'
            return (
              <g key={i} transform={`rotate(${angle} ${cx} ${cy})`}>
                {/* side face gives thickness */}
                <rect x={cx + 70} y={cy - width / 2 + 7} width={long - 70} height={width} rx={width / 2.4} fill="url(#blade-side)" opacity={0.9} />
                <rect x={cx + 66} y={cy - width / 2} width={long - 66} height={width} rx={width / 2.4} fill={fill} />
                {/* specular highlight */}
                <rect x={cx + 96} y={cy - width / 2 + 3} width={long - 120} height={2.5} rx={1.25} fill="#ffffff" opacity={0.55} />
              </g>
            )
          })}

          {/* central ring */}
          <circle cx={cx} cy={cy} r={86} fill="none" stroke="#05083a" strokeWidth={30} transform="translate(0 7)" />
          <circle cx={cx} cy={cy} r={86} fill="none" stroke="url(#ring-metal)" strokeWidth={30} />
          <circle cx={cx} cy={cy} r={71} fill="url(#core)" />
          <circle cx={cx} cy={cy} r={42} fill="none" stroke="#9fd8ff" strokeOpacity={0.5} strokeWidth={2} />
          <ellipse cx={cx - 18} cy={cy - 22} rx={22} ry={12} fill="#ffffff" opacity={0.22} />
        </svg>
      </div>

      {/* floating chrome rings & cylinders */}
      <div className="absolute top-[6%] right-[10%] h-20 w-20 rounded-full" style={{ background: 'conic-gradient(from 140deg, #ffffff, #b9c8ff, #3154DF, #e5d6ff, #ffffff, #8fa6ff, #ffffff)', WebkitMask: 'radial-gradient(farthest-side, transparent 58%, #000 60%)', mask: 'radial-gradient(farthest-side, transparent 58%, #000 60%)', transform: 'rotateX(60deg) rotateZ(20deg)', boxShadow: '0 20px 40px -10px rgba(49,84,223,0.5)' }} />
      <div className="absolute bottom-[14%] left-[4%] h-14 w-14 rounded-full" style={{ background: 'conic-gradient(from 20deg, #ffffff, #ffc7ee, #9B5CFF, #c9d6ff, #ffffff)', WebkitMask: 'radial-gradient(farthest-side, transparent 55%, #000 57%)', mask: 'radial-gradient(farthest-side, transparent 55%, #000 57%)', transform: 'rotateX(55deg) rotateZ(-30deg)' }} />
      <div className="absolute top-[22%] left-[8%] h-6 w-16 -rotate-[28deg] rounded-full" style={{ background: 'linear-gradient(180deg, #ffffff 0%, #c4d2ff 30%, #4169FF 62%, #e2d4ff 85%, #ffffff 100%)', boxShadow: '0 10px 24px -8px rgba(21,29,164,0.55)' }} />
      <div className="absolute right-[4%] bottom-[28%] h-5 w-12 rotate-[34deg] rounded-full" style={{ background: 'linear-gradient(180deg, #ffffff 0%, #ffd3f1 35%, #9B5CFF 65%, #ffffff 100%)', boxShadow: '0 10px 24px -8px rgba(155,92,255,0.55)' }} />
    </div>
  )
}
