import type { Metadata } from 'next';
import { Prose } from '../../components/Prose';
import { INSTAGRAM_URL, INSTAGRAM_HANDLE } from '../../lib/site';

export const metadata: Metadata = {
  title: 'Jewellery Care',
};

type IconProps = { className?: string };

// Simple hand-drawn line icons (24x24, stroke = currentColor) matching the
// cart icon's line style. They echo the printed care card without any icon
// library.
function SprayIcon({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M9 8h5a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2v-9a2 2 0 0 1 2-2Z" />
      <path d="M9 8V5h3" />
      <path d="M12 5V3" />
      <path d="M4 4h2M4 6.5h2.5M4 9h2" />
    </svg>
  );
}

function BoxIcon({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M4 8.5h16V19a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V8.5Z" />
      <path d="M3 5h18v3.5H3z" />
      <path d="M10 12h4" />
    </svg>
  );
}

function DropIcon({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M12 3.5c3.2 3.4 5 6 5 8.6a5 5 0 0 1-10 0c0-2.6 1.8-5.2 5-8.6Z" />
    </svg>
  );
}

function MoonIcon({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M20 13.5A7.5 7.5 0 1 1 10.5 4a6 6 0 0 0 9.5 9.5Z" />
    </svg>
  );
}

const tips: { Icon: (props: IconProps) => React.ReactElement; text: string }[] = [
  {
    Icon: SprayIcon,
    text: 'Avoid sprays or lotions near any jewellery as they can cause tarnishing.',
  },
  {
    Icon: BoxIcon,
    text: 'Keep jewellery stored separately from other pieces, in a cool, dark place using jewellery boxes & pouches.',
  },
  {
    Icon: DropIcon,
    text: 'Keep jewellery from getting wet. Remove before bathing or swimming.',
  },
  {
    Icon: MoonIcon,
    text: 'Remove jewellery before going to bed to prevent accidents in your sleep.',
  },
];

export default function JewelleryCarePage() {
  return (
    <>
      <Prose>
        <h1>Jewellery Care</h1>
        <p className="lead">
          Each BLG Creations piece is handmade to last. A little care keeps your
          earrings, bookmarks and gifts looking their best for years to come.
        </p>
      </Prose>

      <ul role="list" className="mt-8 mb-10 grid list-none grid-cols-1 gap-4 pl-0 sm:grid-cols-2">
        {tips.map(({ Icon, text }) => (
          <li
            key={text}
            className="border border-kraft-light bg-cream-dark p-5 sm:p-6"
          >
            <Icon className="h-8 w-8 text-kraft" />
            <p className="mt-3 font-body text-base leading-relaxed text-ink-light">
              {text}
            </p>
          </li>
        ))}
      </ul>

      <Prose>
        <p>Thank you so much for your purchase!</p>
        <p>
          Follow us on Instagram at{' '}
          <a
            href={INSTAGRAM_URL}
            target="_blank"
            rel="noopener noreferrer"
          >
            {INSTAGRAM_HANDLE}
          </a>{' '}
          for more beautiful designs.
        </p>
      </Prose>
    </>
  );
}
