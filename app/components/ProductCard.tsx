import type { Earring } from '../data/earrings';

interface ProductCardProps {
  earring: Earring;
}

export function ProductCard({ earring }: ProductCardProps) {
  return (
    <article className="group relative flex flex-col bg-white rounded-2xl overflow-hidden border border-cream-dark hover:border-kraft transition-all duration-200 hover:shadow-lg cursor-pointer">
      {/* Image placeholder — replace with next/image when product photos are ready */}
      <div
        className="relative aspect-square w-full overflow-hidden"
        style={{ backgroundColor: `${earring.accentColor}18` }}
      >
        <div className="absolute inset-0 flex items-center justify-center" aria-hidden="true">
          <div
            className="w-24 h-24 rounded-full opacity-30 transition-transform duration-300 group-hover:scale-110"
            style={{ backgroundColor: earring.accentColor }}
          />
          <div
            className="absolute w-12 h-12 rounded-full opacity-80"
            style={{ backgroundColor: earring.accentColor }}
          />
        </div>

        <span className="absolute top-3 left-3 bg-cream/90 backdrop-blur-sm text-ink-light text-xs font-body font-medium px-2.5 py-0.5 rounded-full capitalize">
          {earring.type}
        </span>
      </div>

      <div className="flex flex-col gap-1 p-4">
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
          <span className="font-body text-lg font-semibold text-ink">
            ${earring.price.toFixed(2)}
          </span>
          <button
            className="cursor-pointer bg-kraft text-cream font-body text-sm font-medium px-4 py-2 rounded-full hover:bg-kraft-dark transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-kraft focus:ring-offset-2"
            aria-label={`Add ${earring.name} to cart`}
          >
            Add to Cart
          </button>
        </div>
      </div>
    </article>
  );
}
