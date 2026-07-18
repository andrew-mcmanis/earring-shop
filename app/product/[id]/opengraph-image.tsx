import { ImageResponse } from 'next/og';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { getProduct } from '../../data/products';

export const alt = 'BLG Creations product';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [product, amatic, cabin] = await Promise.all([
    getProduct(id),
    readFile(join(process.cwd(), 'assets/AmaticSC-Bold.ttf')),
    readFile(join(process.cwd(), 'assets/Cabin-SemiBold.ttf')),
  ]);

  const name = product?.name ?? 'BLG Creations';
  const price = product ? `£${product.price.toFixed(2)}` : '';

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: '#FDF8F0',
          border: '18px solid #B5865A',
          padding: '72px 84px',
        }}
      >
        <div
          style={{
            display: 'flex',
            fontFamily: 'Cabin',
            fontSize: 30,
            fontWeight: 600,
            letterSpacing: 12,
            color: '#8B6347',
          }}
        >
          BLG CREATIONS
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div
            style={{
              display: 'flex',
              fontFamily: 'Amatic SC',
              fontSize: 128,
              fontWeight: 700,
              color: '#1A1A1A',
              lineHeight: 1.02,
            }}
          >
            {name}
          </div>
          {price ? (
            <div
              style={{
                display: 'flex',
                fontFamily: 'Cabin',
                fontSize: 56,
                fontWeight: 600,
                color: '#8B6347',
                marginTop: 24,
              }}
            >
              {price}
            </div>
          ) : null}
        </div>

        <div style={{ display: 'flex', fontFamily: 'Cabin', fontSize: 28, color: '#4A4A4A' }}>
          Handmade Jewellery & Gifts · made by hand
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
