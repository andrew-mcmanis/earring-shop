// Consistent reading typography for the static content pages. Styling lives in
// the `.prose-blg` block in globals.css and is applied to semantic descendants
// (h1/h2/p/ul/ol/a/strong), so pages just write plain markup inside <Prose>.
export function Prose({ children }: { children: React.ReactNode }) {
  return <div className="prose-blg">{children}</div>;
}
