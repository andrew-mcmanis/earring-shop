'use client';

// Catches errors in the root layout itself (rare). It replaces the whole
// document, so it must render its own <html>/<body> and can't rely on the
// app's CSS — styles are inline and brand-matched.
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en-GB">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          gap: 16,
          padding: 24,
          background: '#FDF8F0',
          color: '#1A1A1A',
          fontFamily: 'Cabin, system-ui, sans-serif',
        }}
      >
        <h1 style={{ fontSize: 40, fontWeight: 700, margin: 0 }}>Something went wrong</h1>
        <p style={{ fontSize: 15, color: '#4A4A4A', maxWidth: 360, lineHeight: 1.6, margin: 0 }}>
          Sorry — something broke on our side. Please try again in a moment.
        </p>
        <button
          onClick={reset}
          style={{
            cursor: 'pointer',
            background: '#B5865A',
            color: '#FDF8F0',
            border: 'none',
            fontSize: 14,
            fontWeight: 500,
            padding: '10px 20px',
            borderRadius: 6,
            marginTop: 8,
          }}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
