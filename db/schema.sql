-- ShelfRelay PostgreSQL schema (PostgreSQL 15+).
--
-- Design rules:
--   * Every supplier-stated value lives in a column with an explicit source
--     reference; NULL means "not stated", never "zero".
--   * Calculated and AI-produced values are stored separately from imported
--     values and carry a provenance enum.
--   * All tenant data is scoped by organization_id and protected by RLS.

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TYPE provenance AS ENUM ('imported', 'user', 'calculated', 'estimate', 'ai');
CREATE TYPE supplier_kind AS ENUM ('wholesaler', 'distributor', 'cash_and_carry', 'direct');
CREATE TYPE base_unit AS ENUM ('ml', 'g', 'each', 'sheet');
CREATE TYPE extraction_method AS ENUM ('csv', 'textract', 'manual');
CREATE TYPE catalogue_status AS ENUM ('uploaded', 'extracting', 'needs_input', 'imported', 'failed');
CREATE TYPE match_status AS ENUM ('proposed', 'needs_review', 'confirmed', 'rejected');
CREATE TYPE po_status AS ENUM ('draft', 'ready', 'sent', 'acknowledged', 'partially_received', 'received', 'cancelled');

-- ---------------------------------------------------------------- tenancy
CREATE TABLE organizations (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text NOT NULL,
  kind            text NOT NULL CHECK (kind IN ('retailer', 'wholesaler')),
  currency        char(3) NOT NULL DEFAULT 'USD',
  hubspot_company_id text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE app_users (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email           text NOT NULL UNIQUE CHECK (email = lower(email)),
  role            text NOT NULL CHECK (role IN ('owner', 'buyer', 'viewer')),
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE locations (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name            text NOT NULL
);

-- ---------------------------------------------------------------- suppliers
CREATE TABLE suppliers (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name            text NOT NULL,
  kind            supplier_kind NOT NULL,
  region          text,
  order_email     text,
  hubspot_company_id text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, name)
);

-- Versioned terms. A new row is written whenever terms change; the latest
-- effective row applies. NULL = not stated by the supplier.
CREATE TABLE supplier_terms (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id              uuid NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  delivery_fee             numeric(12,2) CHECK (delivery_fee >= 0),
  free_delivery_threshold  numeric(12,2) CHECK (free_delivery_threshold >= 0),
  minimum_order_value      numeric(12,2) CHECK (minimum_order_value >= 0),
  stated_lead_time         text,
  payment_terms            text,
  provenance               provenance NOT NULL CHECK (provenance IN ('imported', 'user')),
  source_document_id       uuid,
  effective_from           timestamptz NOT NULL DEFAULT now(),
  recorded_by              uuid REFERENCES app_users(id)
);

CREATE TABLE supplier_volume_discounts (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_terms_id uuid NOT NULL REFERENCES supplier_terms(id) ON DELETE CASCADE,
  min_subtotal      numeric(12,2) NOT NULL CHECK (min_subtotal >= 0),
  percent           numeric(5,2) NOT NULL CHECK (percent > 0 AND percent < 100)
);

-- Planning settings are the buyer's own and are kept apart from stated terms.
CREATE TABLE supplier_planning (
  supplier_id               uuid PRIMARY KEY REFERENCES suppliers(id) ON DELETE CASCADE,
  planning_lead_time_days   integer CHECK (planning_lead_time_days >= 0),
  updated_by                uuid REFERENCES app_users(id),
  updated_at                timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------- catalogues
CREATE TABLE catalogue_documents (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  supplier_id       uuid NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  s3_bucket         text NOT NULL,
  s3_key            text NOT NULL,
  file_name         text NOT NULL,
  content_sha256    text NOT NULL,
  method            extraction_method,
  status            catalogue_status NOT NULL DEFAULT 'uploaded',
  textract_job_id   text,
  price_basis       text CHECK (price_basis IN ('case', 'unit')),
  column_mapping    jsonb,
  issues            jsonb NOT NULL DEFAULT '[]'::jsonb,
  uploaded_by       uuid REFERENCES app_users(id),
  uploaded_at       timestamptz NOT NULL DEFAULT now(),
  imported_at       timestamptz,
  UNIQUE (supplier_id, content_sha256)
);

ALTER TABLE supplier_terms
  ADD CONSTRAINT supplier_terms_source_fk FOREIGN KEY (source_document_id) REFERENCES catalogue_documents(id);

-- One row per item per catalogue version. Superseded rows are kept for price history.
CREATE TABLE catalogue_items (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  supplier_id         uuid NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  document_id         uuid NOT NULL REFERENCES catalogue_documents(id) ON DELETE CASCADE,
  sku                 text NOT NULL,
  name                text NOT NULL,
  brand               text,
  category            text,
  pack_raw            text,
  units_per_case      integer CHECK (units_per_case > 0),
  unit_size           numeric(12,3) CHECK (unit_size > 0),
  base_unit           base_unit,
  case_price          numeric(12,2) CHECK (case_price >= 0),
  case_price_basis    text NOT NULL CHECK (case_price_basis IN ('stated_case', 'derived_from_unit', 'missing')),
  stated_availability text,
  source_row          integer,
  source_page         integer,
  raw                 jsonb NOT NULL,
  is_current          boolean NOT NULL DEFAULT true,
  created_at          timestamptz NOT NULL DEFAULT now(),
  -- A derived price requires a pack size; a missing price must be NULL.
  CHECK ((case_price_basis = 'missing') = (case_price IS NULL)),
  CHECK (case_price_basis <> 'derived_from_unit' OR units_per_case IS NOT NULL)
);
CREATE UNIQUE INDEX catalogue_items_current_sku ON catalogue_items (supplier_id, sku) WHERE is_current;
CREATE INDEX catalogue_items_name_trgm ON catalogue_items USING gin (name gin_trgm_ops);

CREATE TABLE catalogue_item_tiers (
  item_id     uuid NOT NULL REFERENCES catalogue_items(id) ON DELETE CASCADE,
  min_cases   integer NOT NULL CHECK (min_cases > 1),
  case_price  numeric(12,2) NOT NULL CHECK (case_price >= 0),
  PRIMARY KEY (item_id, min_cases)
);

-- ---------------------------------------------------------------- matching
CREATE TABLE product_groups (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  label           text NOT NULL,
  base_unit       base_unit,
  status          match_status NOT NULL,
  heuristic_score numeric(4,3) NOT NULL,
  reasons         jsonb NOT NULL DEFAULT '[]'::jsonb,
  warnings        jsonb NOT NULL DEFAULT '[]'::jsonb,
  decided_by      uuid REFERENCES app_users(id),
  decided_at      timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  -- Only a person can confirm or reject.
  CHECK ((status IN ('confirmed', 'rejected')) = (decided_by IS NOT NULL))
);

CREATE TABLE product_group_items (
  group_id    uuid NOT NULL REFERENCES product_groups(id) ON DELETE CASCADE,
  item_id     uuid NOT NULL REFERENCES catalogue_items(id) ON DELETE CASCADE,
  supplier_id uuid NOT NULL REFERENCES suppliers(id),
  PRIMARY KEY (group_id, item_id),
  UNIQUE (group_id, supplier_id)
);

-- Bedrock second opinions. Advisory only; never changes product_groups.status.
CREATE TABLE match_ai_reviews (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id    uuid NOT NULL REFERENCES product_groups(id) ON DELETE CASCADE,
  model_id    text NOT NULL,
  verdict     text NOT NULL CHECK (verdict IN ('equivalent', 'not_equivalent', 'uncertain')),
  rationale   text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------- inventory
CREATE TABLE stock_items (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  location_id     uuid NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  name            text NOT NULL,
  pos_sku         text,
  current_item_id uuid REFERENCES catalogue_items(id),
  UNIQUE (location_id, pos_sku)
);

CREATE TABLE stock_counts (
  stock_item_id uuid NOT NULL REFERENCES stock_items(id) ON DELETE CASCADE,
  counted_on    date NOT NULL,
  on_hand       integer NOT NULL CHECK (on_hand >= 0),
  PRIMARY KEY (stock_item_id, counted_on)
);

CREATE TABLE daily_sales (
  stock_item_id uuid NOT NULL REFERENCES stock_items(id) ON DELETE CASCADE,
  sales_date    date NOT NULL,
  units_sold    integer NOT NULL CHECK (units_sold >= 0),
  PRIMARY KEY (stock_item_id, sales_date)
);

CREATE TABLE stock_targets (
  organization_id  uuid PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
  safety_days      integer NOT NULL DEFAULT 3,
  cover_days       integer NOT NULL DEFAULT 14,
  min_history_days integer NOT NULL DEFAULT 14
);

-- ---------------------------------------------------------------- orders
CREATE TABLE purchase_orders (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id          uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  location_id              uuid REFERENCES locations(id),
  supplier_id              uuid NOT NULL REFERENCES suppliers(id),
  po_number                text NOT NULL,
  status                   po_status NOT NULL DEFAULT 'draft',
  supplier_reference       text,
  -- Only ever entered by a user from a supplier confirmation.
  confirmed_delivery_date  date,
  notes                    text,
  created_by               uuid REFERENCES app_users(id),
  created_at               timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, po_number)
);

CREATE TABLE purchase_order_lines (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id uuid NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  item_id           uuid NOT NULL REFERENCES catalogue_items(id),
  cases             integer NOT NULL CHECK (cases > 0),
  -- Snapshot of the imported price when the line was added.
  case_price        numeric(12,2) NOT NULL
);

CREATE TABLE purchase_order_events (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id uuid NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  status            po_status NOT NULL,
  note              text,
  recorded_by       uuid REFERENCES app_users(id),
  recorded_at       timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------- CRM sync log
CREATE TABLE crm_sync_events (
  id            bigserial PRIMARY KEY,
  event_type    text NOT NULL,
  payload       jsonb NOT NULL,
  hubspot_ids   jsonb,
  status        text NOT NULL CHECK (status IN ('pending', 'sent', 'failed')),
  error         text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------- row-level security
-- The API sets `SET app.organization_id = '<uuid>'` per request/transaction.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['locations','suppliers','catalogue_documents','catalogue_items','product_groups','stock_items','purchase_orders']
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I USING (organization_id = current_setting(''app.organization_id'')::uuid)', t);
  END LOOP;
END $$;
