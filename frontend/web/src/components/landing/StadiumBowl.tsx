const crowdRows = [
  { y: 92, color: "rgba(255,255,255,0.22)", offset: 0 },
  { y: 112, color: "rgba(255,42,95,0.28)", offset: 11 },
  { y: 132, color: "rgba(0,229,155,0.24)", offset: 4 },
  { y: 152, color: "rgba(212,255,0,0.2)", offset: 16 },
  { y: 172, color: "rgba(255,255,255,0.16)", offset: 7 },
];

const crowdDots = Array.from({ length: 39 }, (_, index) => index);

export function StadiumBowl() {
  return (
    <div className="absolute inset-x-0 top-[10%] mx-auto h-[42%] w-[92%] max-w-7xl opacity-90">
      <svg
        className="h-full w-full"
        fill="none"
        preserveAspectRatio="none"
        viewBox="0 0 1200 360"
      >
        <defs>
          <linearGradient id="stadium-shell" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="rgba(255,255,255,0.12)" />
            <stop offset="58%" stopColor="rgba(255,255,255,0.035)" />
            <stop offset="100%" stopColor="rgba(10,11,16,0)" />
          </linearGradient>
          <linearGradient id="stadium-ribbon" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stopColor="rgba(255,42,95,0)" />
            <stop offset="20%" stopColor="rgba(255,42,95,0.55)" />
            <stop offset="50%" stopColor="rgba(0,229,155,0.35)" />
            <stop offset="80%" stopColor="rgba(212,255,0,0.5)" />
            <stop offset="100%" stopColor="rgba(212,255,0,0)" />
          </linearGradient>
          <radialGradient id="stadium-glow" cx="50%" cy="24%" r="62%">
            <stop offset="0%" stopColor="rgba(255,255,255,0.14)" />
            <stop offset="62%" stopColor="rgba(255,255,255,0.02)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0)" />
          </radialGradient>
        </defs>

        <path
          d="M90 244 C132 74 1068 74 1110 244"
          stroke="rgba(255,255,255,0.22)"
          strokeWidth="2"
        />
        <path
          d="M130 256 C185 112 1015 112 1070 256"
          fill="url(#stadium-shell)"
          stroke="rgba(255,255,255,0.12)"
          strokeWidth="1"
        />
        <path
          d="M170 262 C230 152 970 152 1030 262"
          stroke="rgba(255,255,255,0.1)"
          strokeWidth="1"
        />
        <path
          d="M220 278 C285 194 915 194 980 278"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth="1"
        />

        <path
          d="M165 218 C230 176 970 176 1035 218"
          stroke="url(#stadium-ribbon)"
          strokeWidth="2"
        />
        <path
          d="M245 248 C310 218 890 218 955 248"
          stroke="url(#stadium-ribbon)"
          strokeOpacity="0.7"
          strokeWidth="1"
        />

        {crowdRows.map((row) =>
          crowdDots.map((dot) => {
            const x = 170 + dot * 22 + (row.offset % 17);
            const spread = Math.abs(x - 600) / 600;
            const y = row.y + spread * spread * 82;

            return (
              <circle
                cx={x}
                cy={y}
                fill={row.color}
                key={`${row.y}-${dot}`}
                r={1.3}
              />
            );
          }),
        )}

        <path
          d="M128 254 L78 340"
          stroke="rgba(255,42,95,0.22)"
          strokeWidth="2"
        />
        <path
          d="M1072 254 L1122 340"
          stroke="rgba(212,255,0,0.2)"
          strokeWidth="2"
        />

        <ellipse cx="600" cy="210" fill="url(#stadium-glow)" rx="420" ry="154" />
      </svg>
    </div>
  );
}
