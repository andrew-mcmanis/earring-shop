import { ImageResponse } from 'next/og';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

export const alt = 'BLG Creations — Handmade Jewellery & Gifts';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function Image() {
  const [amatic, cabin] = await Promise.all([
    readFile(join(process.cwd(), 'assets/AmaticSC-Bold.ttf')),
    readFile(join(process.cwd(), 'assets/Cabin-SemiBold.ttf')),
  ]);

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#FDF8F0',
          border: '18px solid #B5865A',
        }}
      >
        <div
          style={{
            display: 'flex',
            fontFamily: 'Amatic SC',
            fontSize: 190,
            fontWeight: 700,
            color: '#1A1A1A',
            lineHeight: 1,
          }}
        >
          BLG Creations
        </div>
        <div
          style={{
            display: 'flex',
            fontFamily: 'Cabin',
            fontSize: 38,
            fontWeight: 600,
            letterSpacing: 14,
            color: '#8B6347',
          }}
        >
          HANDMADE JEWELLERY & GIFTS
        </div>
        <div style={{ display: 'flex', width: 120, height: 4, background: '#D4B896', marginTop: 44 }} />
        <div style={{ display: 'flex', fontFamily: 'Cabin', fontSize: 30, color: '#4A4A4A', marginTop: 40 }}>
          Every piece made by hand
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: 'Amatic SC', data: amatic, weight: 700, style: 'normal' },
        { name: 'Cabin', data: cabin, weight: 600, style: 'normal' },
      ],
    },
  );
}
