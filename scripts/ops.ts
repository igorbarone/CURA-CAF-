// Operação da loja em homologação (sem painel web): banco, estoque e pedidos.
// Uso: npm run ops -- <comando> [argumentos]. Lê DATABASE_URL e as demais
// variáveis do ambiente; nada aqui imprime CPF, e-mail, telefone ou endereço.
import { buildPriceBook } from "../lib/commerce/catalog";
import { getCommerceRules } from "../lib/commerce/rules";
import { readConfig } from "../lib/commerce/server/config";
import { migrate, openDb } from "../lib/commerce/server/db";
import { mercadoPagoGateway } from "../lib/commerce/server/mercadopago";
import { resendNotifier, skippedNotifier } from "../lib/commerce/server/notify";
import {
  markShipped,
  reconcilePending,
  type Deps,
} from "../lib/commerce/server/orders";
import { loadContent } from "../lib/content-loader";

const HELP = `Comandos:
  migrate                         aplica db/migrations
  stock:list                      estoque por SKU (com os SKUs vendáveis do CMS)
  stock:set <SKU> <quantidade>    define o estoque disponível de um SKU
  orders:list [status]            últimos pedidos (sem dados pessoais)
  order:events <id>               histórico do pedido
  order:ship <id> <rastreio> [transportadora]   marca como enviado e avisa o cliente
  order:deliver <id>              marca como entregue
  orders:reconcile [minutos]      revisa pendentes antigos (padrão 60) e libera estoque`;

async function main() {
  const [command, ...args] = process.argv.slice(2);
  const config = readConfig();
  if (!config.databaseUrl) throw new Error("Defina DATABASE_URL.");
  const db = await openDb(config.databaseUrl);
  try {
    const content = loadContent();
    const book = buildPriceBook(content);
    const unavailable = async () => {
      throw new Error("Mercado Pago não configurado");
    };
    const deps: Deps = {
      db,
      book,
      rules: getCommerceRules(),
      siteUrl: config.siteUrl,
      tokenSecret: config.orderTokenSecret,
      payments: config.payments
        ? mercadoPagoGateway({
            base: config.mp.base,
            accessToken: config.mp.accessToken,
          })
        : { create: unavailable, get: unavailable },
      shipping: { quote: unavailable },
      notifier: config.email ? resendNotifier(config.resend) : skippedNotifier,
    };
    switch (command) {
      case "migrate":
        console.log("Aplicadas:", (await migrate(db)).join(", ") || "nenhuma");
        break;
      case "stock:list": {
        const rows = await db.query<{ sku: string; available: number }>(
          "SELECT sku, available FROM inventory ORDER BY sku",
        );
        const stock = new Map(rows.map((row) => [row.sku, row.available]));
        const skus = new Set([
          ...stock.keys(),
          ...content.offers.map((offer) => offer.sku),
        ]);
        console.table(
          [...skus].sort().map((sku) => ({
            sku,
            disponivel: stock.get(sku) ?? "sem registro (indisponível)",
            vendavel: Object.values(book).some((item) =>
              item.skus.some((entry) => entry.sku === sku),
            ),
          })),
        );
        break;
      }
      case "stock:set": {
        const [sku, value] = args;
        const quantity = Number(value);
        if (!sku || !Number.isInteger(quantity) || quantity < 0)
          throw new Error("Uso: stock:set <SKU> <quantidade inteira ≥ 0>");
        if (!content.offers.some((offer) => offer.sku === sku))
          throw new Error(`SKU ${sku} não existe nas ofertas do CMS.`);
        await db.query(
          "INSERT INTO inventory (sku, available) VALUES ($1, $2) ON CONFLICT (sku) DO UPDATE SET available = EXCLUDED.available, updated_at = now()",
          [sku, quantity],
        );
        console.log(`${sku}: ${quantity} disponível(is).`);
        break;
      }
      case "orders:list":
        console.table(
          await db.query(
            `SELECT id, status, payment_method AS metodo, total_cents AS total_centavos,
               address->>'state' AS uf, tracking_code AS rastreio, created_at AS criado
             FROM orders ${args[0] ? "WHERE status = $1" : ""} ORDER BY created_at DESC LIMIT 50`,
            args[0] ? [args[0]] : [],
          ),
        );
        break;
      case "order:events":
        console.table(
          await db.query(
            "SELECT type, data, created_at FROM order_events WHERE order_id = $1 ORDER BY id",
            [args[0]],
          ),
        );
        break;
      case "order:ship":
        if (!args[0] || !args[1])
          throw new Error("Uso: order:ship <id> <rastreio> [transportadora]");
        console.log(
          (await markShipped(deps, args[0], {
            code: args[1],
            carrier: args[2] ?? null,
          }))
            ? "Pedido marcado como enviado."
            : "Nada alterado: só pedidos pagos podem ser enviados.",
        );
        break;
      case "order:deliver": {
        const rows = await db.query(
          "UPDATE orders SET status = 'delivered', updated_at = now() WHERE id = $1 AND status = 'shipped' RETURNING id",
          [args[0]],
        );
        if (rows.length)
          await db.query(
            "INSERT INTO order_events (order_id, type) VALUES ($1, 'order.delivered')",
            [args[0]],
          );
        console.log(
          rows.length
            ? "Pedido entregue."
            : "Nada alterado: o pedido precisa estar enviado.",
        );
        break;
      }
      case "orders:reconcile":
        console.log(await reconcilePending(deps, Number(args[0] ?? 60)));
        break;
      default:
        console.log(HELP);
    }
  } finally {
    await db.close();
  }
}
main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
