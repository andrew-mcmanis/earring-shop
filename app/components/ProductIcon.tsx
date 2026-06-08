// Placeholder graphic shown until a real product photo exists. Picks a shape
// based on the product category so bookmarks and gifts don't show an earring.

interface ProductIconProps {
  color: string;
  category?: string;
  className?: string;
}

export function ProductIcon({ color, category = 'earrings', className = 'w-16 h-24' }: ProductIconProps) {
  return (
    <svg
      viewBox="0 0 60 90"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      {category === 'bookmarks' ? (
        // Bookmark — tall tag with a notched foot
        <path
          d="M20 8 h20 a2 2 0 0 1 2 2 v68 l-12 -10 -12 10 v-68 a2 2 0 0 1 2 -2 z"
          stroke={color}
          strokeWidth="2"
          strokeLinejoin="round"
          fill={color}
          fillOpacity="0.18"
        />
      ) : category === 'gifts' ? (
        // Gift — wrapped box with ribbon and bow
        <>
          <rect x="14" y="36" width="32" height="30" rx="2" stroke={color} strokeWidth="2" fill={color} fillOpacity="0.18" />
          <line x1="30" y1="36" x2="30" y2="66" stroke={color} strokeWidth="2" />
          <path d="M30 36 C30 26 20 26 21 32 C22 37 30 36 30 36 Z" stroke={color} strokeWidth="2" strokeLinejoin="round" fill="none" />
          <path d="M30 36 C30 26 40 26 39 32 C38 37 30 36 30 36 Z" stroke={color} strokeWidth="2" strokeLinejoin="round" fill="none" />
        </>
      ) : (
        // Earrings — ear-wire hook, stem and drop
        <>
          <path d="M30 6 Q44 6 44 18 Q44 30 30 30" stroke={color} strokeWidth="2.5" strokeLinecap="round" fill="none" />
          <line x1="30" y1="30" x2="30" y2="56" stroke={color} strokeWidth="2" strokeLinecap="round" />
          <ellipse cx="30" cy="72" rx="13" ry="15" stroke={color} strokeWidth="2" fill={color} fillOpacity="0.2" />
        </>
      )}
    </svg>
  );
}
