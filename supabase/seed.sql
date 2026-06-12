-- BLG Creations — seed data (sample catalogue)
-- Run after schema.sql. Safe to re-run: labels upsert; products insert only
-- when the table is empty so you don't create duplicates.

-- Categories
insert into categories (slug, name, sort_order) values
  ('earrings',  'Earrings',  1),
  ('bookmarks', 'Bookmarks', 2),
  ('gifts',     'Gifts',     3)
on conflict (slug) do update set name = excluded.name, sort_order = excluded.sort_order;

-- Subcategories (Earrings only, for now)
insert into subcategories (slug, name, category_slug, sort_order) values
  ('dangles', 'Dangles', 'earrings', 1),
  ('hoops',   'Hoops',   'earrings', 2),
  ('studs',   'Studs',   'earrings', 3)
on conflict (slug) do update set name = excluded.name, sort_order = excluded.sort_order;

-- Colours
insert into colours (slug, name, hex) values
  ('gold',        'Gold',        '#D4A853'),
  ('silver',      'Silver',      '#A8A8A8'),
  ('rose-gold',   'Rose Gold',   '#C49A6C'),
  ('black',       'Black',       '#3C3C3C'),
  ('white',       'White',       '#E8DDD0'),
  ('blue',        'Blue',        '#2E6DA4'),
  ('green',       'Green',       '#27AE60'),
  ('red',         'Red',         '#C0392B'),
  ('purple',      'Purple',      '#9B59B6'),
  ('multicolour', 'Multicolour', '')
on conflict (slug) do update set name = excluded.name, hex = excluded.hex;

-- Sample products (only when products is empty)
insert into products (name, description, price, category_slug, subcategory_slug, colour_slug, accent_color, sort_order)
select * from (values
  ('Classic Gold Hoops',      'Simple and elegant 14K gold-filled hoops, perfect for everyday wear.', 28.00, 'earrings', 'hoops',   'gold',        '#D4A853', 1),
  ('Amethyst Drop',           'Faceted amethyst drops set in sterling silver with a delicate chain.',  35.00, 'earrings', 'dangles', 'purple',      '#9B59B6', 2),
  ('Freshwater Pearl Studs',  'Lustrous freshwater pearls in 14K gold-filled stud settings.',          22.00, 'earrings', 'studs',   'white',       '#C8B99A', 3),
  ('Hammered Copper Dangle',  'Handcrafted copper dangles with a beautiful hammered finish.',          30.00, 'earrings', 'dangles', 'rose-gold',   '#C0705A', 4),
  ('Sapphire Huggie',         'Sapphire-set huggies in polished sterling silver.',                     40.00, 'earrings', 'hoops',   'blue',        '#2E6DA4', 5),
  ('Emerald Leaf Dangle',     'Leaf-shaped brass dangles with hand-applied green enamel.',             45.00, 'earrings', 'dangles', 'green',       '#27AE60', 6),
  ('Black Onyx Stud',         'Polished black onyx cabochons in sterling silver bezel settings.',      25.00, 'earrings', 'studs',   'black',       '#3C3C3C', 7),
  ('Rose Gold Textured Hoop', 'Delicate rose gold-filled hoops with a hand-textured finish.',          32.00, 'earrings', 'hoops',   'rose-gold',   '#C49A6C', 8),
  ('Ruby Drop',               'Deep red ruby drops suspended in gold-filled wire settings.',           38.00, 'earrings', 'dangles', 'red',         '#C0392B', 9),
  ('Rainbow Stone Tassel',    'Boho-inspired brass tassel earrings with mixed semi-precious stone beads.', 29.00, 'earrings', 'dangles', 'multicolour', '#B5865A', 10),
  ('Minimal Silver Huggie',   'Clean sterling silver huggies for everyday minimalist style.',          26.00, 'earrings', 'hoops',   'silver',      '#A8A8A8', 11),
  ('Geometric Brass Stud',    'Geometric square brass studs with a satin gold finish.',                20.00, 'earrings', 'studs',   'gold',        '#B8860B', 12),
  ('Pressed Flower Bookmark', 'A real pressed flower sealed in a slim, clear resin bookmark.',         12.00, 'bookmarks', null,     'green',       '#27AE60', 13),
  ('Beaded Tassel Bookmark',  'A glass-beaded strand finished with a hand-knotted tassel.',            10.00, 'bookmarks', null,     'blue',        '#2E6DA4', 14),
  ('Gold Leaf Bookmark',      'A brushed gold-tone metal bookmark with a delicate leaf motif.',        14.00, 'bookmarks', null,     'gold',        '#D4A853', 15),
  ('Ceramic Trinket Dish',    'A hand-painted ceramic trinket dish — perfect for rings and earrings.', 18.00, 'gifts',     null,     'white',       '#C8B99A', 16),
  ('Soy Wax Melts (Set)',     'A set of hand-poured soy wax melts with a soft floral scent.',           9.00, 'gifts',     null,     'purple',      '#9B59B6', 17),
  ('Mini Gift Bundle',        'A surprise mix of small handmade pieces, picked and wrapped by hand.',     25.00, 'gifts',     null,     'multicolour', '#B5865A', 18)
) as v(name, description, price, category_slug, subcategory_slug, colour_slug, accent_color, sort_order)
where not exists (select 1 from products);
