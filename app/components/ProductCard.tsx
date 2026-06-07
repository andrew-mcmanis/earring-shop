import type { Earring } from '../data/earrings';

interface ProductCardProps {
  earring: Earring;
}

function EarringIcon({ color }: { color: string }) {
  return (
    <svg
      viewBox="0 0 60 90"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="w-16 h-24"
      aria-hidden="true"
    >
      {/* Ear wire hook */}
      <path
        d="M30 6 Q44 6 44 18 Q44 30 30 30"
        stroke={color}
        strokeWidth="2.5"
        strokeLinecap="round"
        fill="none"
      />
      {/* Stem */}
      <line x1="30" y1="30" x2="30" y2="56" stroke={color} strokeWidth="2" strokeLinecap="round" />
      {/* Drop */}
      <ellipse cx="30" cy="72" rx="13" ry="15" stroke={color} strokeWidth="2" fill={color} fillOpacity="0.2" />
    </svg>
  );
}

export function ProductCard({ earring }: ProductCardProps) {
  return (
    <article className="group relative flex flex-col bg-white rounded-lg overflow-hidden border border-cream-dark hover:border-kraft transition-all duration-200 hover:shadow-sm cursor-pointer">
      {/* Image placeholder — replace with next/image when product photos are ready */}
      <div
        className="relative aspect-square w-full overflow-hidden flex items-center justify-center"
        style={{ backgroundColor: `${earring.accentColor}12` }}
      >
        <div className="transition-transform duration-300 group-hover:scale-105">
          <EarringIcon color={earring.accentColor} />
        </div>

        <span className="absolute top-3 left-3 bg-cream text-ink-light text-xs font-body font-medium px-2 py-0.5 rounded capitalize border border-cream-dark">
          {earring.type}
        </span>
      </div>

      <div className="flex flex-col gap-1 p-4 border-t border-cream-dark">
        <h3 className="font-heading text-2xl font-bold text-ink leading-tight">
          {earring.name}
        </h3>
        <p className="font-body text-xs text-ink-light capitalize tracking-wide">
          {earring.metal}
        </p>
        <p className="font-body text-sm text-ink-light mt-1 line-clamp-2 leading-relaxed">
          {earring.description}
        </p>

        <div className="flex items-center justify-between mt-3">
          <span className="font-body text-lg font-semibold text-ink tabular-nums">
            ${earring.price.toFixed(2)}
          </span>
          <button
            className="cursor-pointer bg-kraft text-cream font-body text-sm font-medium px-4 py-2 rounded hover:bg-kraft-dark transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-kraft focus:ring-offset-2"
            aria-label={`Add ${earring.name} to cart`}
          >
            Add to Cart
          </button>
        </div>
      </div>
    </article>
  );
}
