-- Cura Commerce: pedidos, pagamentos, estoque e eventos de webhook.
-- Valores monetários em centavos (inteiros). Datas em UTC.

CREATE TABLE inventory (
  sku text PRIMARY KEY,
  available integer NOT NULL CHECK (available >= 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE orders (
  id uuid PRIMARY KEY,
  -- Chave enviada pelo navegador por tentativa de checkout: repetir o envio
  -- devolve o mesmo pedido, em vez de criar outro.
  idempotency_key text NOT NULL UNIQUE,
  -- Hash do corpo da primeira tentativa: a mesma chave com outro carrinho
  -- é recusada. O token de acompanhamento é derivado do id (HMAC), não salvo.
  request_hash text NOT NULL,
  status text NOT NULL CHECK (status IN (
    'pending_payment', 'paid', 'payment_failed', 'cancelled',
    'shipped', 'delivered', 'refunded'
  )),
  -- Dados pessoais mínimos para entrega, cobrança e contato (LGPD: finalidade).
  customer jsonb NOT NULL,
  address jsonb NOT NULL,
  items jsonb NOT NULL,
  shipping jsonb NOT NULL,
  subtotal_cents integer NOT NULL CHECK (subtotal_cents >= 0),
  shipping_cents integer NOT NULL CHECK (shipping_cents >= 0),
  total_cents integer NOT NULL CHECK (total_cents > 0),
  payment_method text NOT NULL CHECK (payment_method IN ('pix', 'card')),
  -- O estoque reservado volta uma única vez se o pagamento não se concretiza.
  stock_released boolean NOT NULL DEFAULT false,
  tracking_code text,
  tracking_carrier text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX orders_status_created ON orders (status, created_at);

CREATE TABLE payments (
  provider_payment_id text PRIMARY KEY,
  order_id uuid NOT NULL REFERENCES orders (id),
  provider text NOT NULL DEFAULT 'mercadopago',
  method text NOT NULL,
  status text NOT NULL,
  status_detail text,
  amount_cents integer NOT NULL,
  pix_qr_code text,
  pix_qr_code_base64 text,
  pix_ticket_url text,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX payments_order ON payments (order_id);

-- Notificações recebidas: a mesma entrega repetida não é processada duas vezes.
CREATE TABLE webhook_events (
  id text PRIMARY KEY,
  provider text NOT NULL,
  resource_id text NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now()
);

-- Histórico de cada pedido, sem dados pessoais.
CREATE TABLE order_events (
  id bigserial PRIMARY KEY,
  order_id uuid NOT NULL REFERENCES orders (id),
  type text NOT NULL,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX order_events_order ON order_events (order_id, created_at);
