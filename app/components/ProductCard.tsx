import Link from 'next/link';
import type { Product, Colour } from '../data/types';
import { ProductImage } from './ProductImage';
import { AddToCartButton } from './AddToCartButton';

interface ProductCardProps {
  product: Product;
  /** Display label for the badge (subcategory name for earrings, else category). */
  badge: string;
  /** Colour name shown under the title, when the product has a colour. */
  colour?: Colour;
}

export function ProductCard({ product, badge, colour }: ProductCardProps) {
  return (
    <article className="group relative flex flex-col bg-white rounded-lg overflow-hidden border border-cream-dark hover:border-kraft transition-all duration-200 hover:shadow-sm">
      <Link
        href={`/product/${product.id}`}
        className="relative aspect-square w-full overflow-hidden flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-kraft focus-visible:ring-offset-2"
        style={{ backgroundColor: `${product.accentColor}12` }}
        aria-label={`View details for ${product.name}`}
      >
        <ProductImage
          image={product.image}
          accentColor={product.accentColor}
          category={product.categorySlug}
          alt={product.name}
          sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 33vw"
          iconClassName="w-16 h-24 transition-transform duration-300 group-hover:scale-105"
        />

        <span className="absolute top-3 left-3 z-10 bg-cream text-ink-light text-xs font-body font-medium px-2 py-0.5 rounded capitalize border border-cream-dark">
          {badge}
        </span>

        {product.soldOut && (
          <span className="absolute top-3 right-3 z-10 bg-ink/85 text-cream text-xs font-body font-medium px-2 py-0.5 rounded">
            Sold out
          </span>
        )}
      </Link>

      <div className="flex flex-col gap-1 p-4 border-t border-cream-dark flex-1">
        <h3 className="font-heading text-2xl font-bold text-ink leading-tight">
          <Link
            href={`/product/${product.id}`}
            className="hover:text-kraft transition-colors duration-150 focus:outline-none focus-visible:underline"
          >
            {product.name}
          </Link>
        </h3>
        {colour && (
          <p className="font-body text-xs text-ink-light capitalize tracking-wide">{colour.name}</p>
        )}
        <p className="font-body text-sm text-ink-light mt-1 line-clamp-2 leading-relaxed">
          {product.description}
        </p>

        <div className="flex items-center justify-between mt-auto pt-3">
          <span className="font-body text-lg font-semibold text-ink tabular-nums">
            £{product.price.toFixed(2)}
          </span>
          <AddToCartButton product={product} />
        </div>
      </div>
    </article>
  );
}
