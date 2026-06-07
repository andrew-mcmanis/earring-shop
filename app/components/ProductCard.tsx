import Link from 'next/link';
import type { Earring } from '../data/earrings';
import { EarringIcon } from './EarringIcon';
import { AddToCartButton } from './AddToCartButton';

interface ProductCardProps {
  earring: Earring;
}

export function ProductCard({ earring }: ProductCardProps) {
  return (
    <article className="group relative flex flex-col bg-white rounded-lg overflow-hidden border border-cream-dark hover:border-kraft transition-all duration-200 hover:shadow-sm">
      <Link
        href={`/product/${earring.id}`}
        className="relative aspect-square w-full overflow-hidden flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-kraft focus-visible:ring-offset-2"
        style={{ backgroundColor: `${earring.accentColor}12` }}
        aria-label={`View details for ${earring.name}`}
      >
        <div className="transition-transform duration-300 group-hover:scale-105">
          <EarringIcon color={earring.accentColor} />
        </div>

        <span className="absolute top-3 left-3 bg-cream text-ink-light text-xs font-body font-medium px-2 py-0.5 rounded capitalize border border-cream-dark">
          {earring.type}
        </span>
      </Link>

      <div className="flex flex-col gap-1 p-4 border-t border-cream-dark">
        <h3 className="font-heading text-2xl font-bold text-ink leading-tight">
          <Link
            href={`/product/${earring.id}`}
            className="hover:text-kraft transition-colors duration-150 focus:outline-none focus-visible:underline"
          >
            {earring.name}
          </Link>
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
          <AddToCartButton earring={earring} />
        </div>
      </div>
    </article>
  );
}
