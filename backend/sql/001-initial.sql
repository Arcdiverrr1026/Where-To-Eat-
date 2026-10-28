CREATE TABLE IF NOT EXISTS users (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  username text UNIQUE NOT NULL,
  password_hash text NOT NULL,
  role text NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS sessions (
  token_hash text PRIMARY KEY,
  user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_expiry_idx ON sessions(expires_at);
CREATE TABLE IF NOT EXISTS restaurants (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  source_id text UNIQUE NOT NULL,
  name text NOT NULL,
  address text NOT NULL,
  category text NOT NULL,
  lng double precision NOT NULL CHECK (lng BETWEEN -180 AND 180),
  lat double precision NOT NULL CHECK (lat BETWEEN -90 AND 90),
  price numeric(10,2) CHECK (price >= 0),
  hours text NOT NULL DEFAULT '',
  phone text NOT NULL DEFAULT '',
  name_override text,
  address_override text,
  price_override numeric(10,2) CHECK (price_override >= 0),
  price_overridden boolean NOT NULL DEFAULT false,
  hidden boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS favorites (
  user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  restaurant_id integer NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, restaurant_id)
);
CREATE TABLE IF NOT EXISTS reviews (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  restaurant_id integer NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  rating smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
  content text NOT NULL CHECK (char_length(content) BETWEEN 5 AND 500),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, restaurant_id)
);
CREATE INDEX IF NOT EXISTS reviews_restaurant_idx ON reviews(restaurant_id);
CREATE INDEX IF NOT EXISTS reviews_created_idx ON reviews(created_at DESC, id DESC);
