-- Asaas (Pix e cartão), desconto Pix, status logístico separado do financeiro,
-- volumes de envio, etiquetas do Melhor Envio e ajustes de estoque auditados.

-- Status financeiro (status) e logístico (fulfillment_status) separados.
ALTER TABLE orders ADD COLUMN fulfillment_status text NOT NULL DEFAULT 'unfulfilled'
  CHECK (fulfillment_status IN ('unfulfilled', 'preparing', 'shipped', 'delivered'));
UPDATE orders SET fulfillment_status = status WHERE status IN ('shipped', 'delivered');
UPDATE orders SET status = 'paid' WHERE status IN ('shipped', 'delivered');
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE orders ADD CONSTRAINT orders_status_check CHECK (status IN (
  'pending_payment', 'paid', 'payment_failed', 'cancelled', 'expired', 'refunded'
));

-- Desconto Pix sobre os cafés (nunca sobre o frete), calculado no servidor.
ALTER TABLE orders ADD COLUMN discount_cents integer NOT NULL DEFAULT 0 CHECK (discount_cents >= 0);
ALTER TABLE orders ADD COLUMN payment_provider text NOT NULL DEFAULT 'mercadopago';
-- Volumes calculados no checkout (caixa, medidas, peso, itens).
ALTER TABLE orders ADD COLUMN volumes jsonb NOT NULL DEFAULT '[]'::jsonb;
-- Trava curta da criação da cobrança: dois envios simultâneos do mesmo
-- pedido não criam duas cobranças.
ALTER TABLE orders ADD COLUMN payment_claimed_at timestamptz;
ALTER TABLE orders ADD COLUMN expires_at timestamptz;
ALTER TABLE orders ADD COLUMN paid_at timestamptz;
ALTER TABLE orders ADD COLUMN shipped_at timestamptz;
ALTER TABLE orders ADD COLUMN delivered_at timestamptz;
CREATE INDEX orders_fulfillment ON orders (fulfillment_status, created_at);

ALTER TABLE payments ALTER COLUMN provider SET DEFAULT 'asaas';
ALTER TABLE payments ADD COLUMN invoice_url text;

-- Venda pausada por SKU, sem alterar o conteúdo publicado.
ALTER TABLE inventory ADD COLUMN paused boolean NOT NULL DEFAULT false;

-- Todo ajuste manual de estoque fica registrado (quem, quanto e por quê).
CREATE TABLE inventory_adjustments (
  id bigserial PRIMARY KEY,
  sku text NOT NULL,
  delta integer NOT NULL,
  available_after integer NOT NULL,
  reason text NOT NULL,
  actor text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX inventory_adjustments_sku ON inventory_adjustments (sku, created_at);

-- Etiqueta do Melhor Envio: uma por pedido (chave primária), avançando por
-- etapas. Uma nova tentativa continua da etapa salva, sem comprar de novo.
CREATE TABLE shipments (
  order_id uuid PRIMARY KEY REFERENCES orders (id),
  status text NOT NULL CHECK (status IN (
    'creating', 'in_cart', 'purchased', 'generated', 'failed', 'cancelled'
  )),
  service_id text NOT NULL,
  -- Um id do Melhor Envio por volume.
  provider_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  tracking_codes jsonb NOT NULL DEFAULT '[]'::jsonb,
  label_url text,
  cost_cents integer,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
