-- Fast, typo-tolerant product search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Weighted full-text document: name > brand/tags > description.
-- Wrapped in an IMMUTABLE function so it can back an expression index;
-- queries must call the same function to hit the index.
CREATE OR REPLACE FUNCTION product_search_doc(p_name text, p_brand text, p_tags text[], p_description text)
RETURNS tsvector LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
  SELECT
    setweight(to_tsvector('simple'::regconfig, coalesce(p_name, '')), 'A') ||
    setweight(to_tsvector('simple'::regconfig, coalesce(p_brand, '')), 'B') ||
    setweight(to_tsvector('simple'::regconfig, coalesce(array_to_string(p_tags, ' '), '')), 'B') ||
    setweight(to_tsvector('english'::regconfig, coalesce(p_description, '')), 'C')
$$;

CREATE INDEX IF NOT EXISTS "Product_search_fts_idx" ON "Product"
  USING GIN (product_search_doc("name", "brand", "tags", "description"));

-- Trigram index for fuzzy matching ("hodie" -> "hoodie")
CREATE INDEX IF NOT EXISTS "Product_name_trgm_idx" ON "Product" USING GIN ("name" gin_trgm_ops);
