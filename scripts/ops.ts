// Operação da loja pela linha de comando (o painel /admin faz o mesmo pela
// web). Uso: npm run ops -- <comando> [argumentos]. Lê DATABASE_URL e as
// demais variáveis do ambiente; nada aqui imprime CPF, e-mail, telefone ou
// endereço.
import { stdin, stdout } from "node:process";
import { createInterface } from "node:readline/promises";
import { buildPriceBook } from "../lib/commerce/catalog";
import { getCommerceRules } from "../lib/commerce/rules";
import { hashPassword } from "../lib/commerce/server/admin-auth";
import { readConfig } from "../lib/commerce/server/config";
import { migrate, openDb } from "../lib/commerce/server/db";
import { indicators } from "../lib/commerce/server/indicators";
import {
  buyLabel,
  refreshTracking,
  type LabelDeps,
} from "../lib/commerce/server/labels";
import { resendNotifier, skippedNotifier } from "../lib/commerce/server/notify";
import {
  advanceFulfillment,
  reconcile,
  seedStockFromContent,
} from "../lib/commerce/server/orders";
import { gateways } from "../lib/commerce/server/runtime";
import {
  adjustStock,
  setPaused,
  stockReport,
} from "../lib/commerce/server/stock";
import { loadContent } from "../lib/content-loader";

const HELP = `Comandos:
  admin:hash                      gera ADMIN_PASSWORD_HASH (pede a senha, não a imprime)
  migrate                         aplica db/migrations
  stock:list                      variantes, bloqueios de venda, estoque, reservado e vendido
  stock:set <SKU> <qtd> <motivo>  define o estoque disponível (registra o ajuste)
  stock:pause <SKU> | stock:resume <SKU>   pausa ou retoma a venda de um SKU
  stock:seed-cms                  cria o estoque dos SKUs sem registro a partir do estoque editorial do CMS
  orders:list [status]            últimos pedidos (sem dados pessoais)
  order:events <id>               histórico do pedido
  order:prepare <id>              marca como "em preparação"
  order:label <id> [chave NF-e]   compra e gera a etiqueta no Melhor Envio (ação explícita)
  order:tracking <id>             atualiza o rastreio da etiqueta
  order:ship <id> <rastreio> [transportadora]   marca como enviado sem etiqueta do site
  order:deliver <id>              marca como entregue
  indicators [dias]               indicadores (padrão: 30 dias; "todos" = desde o início)
  reconcile                       relê cobranças pendentes e expira pedidos vencidos`;

async function main() {
  const [command, ...args] = process.argv.slice(2);
  if (command === "admin:hash") {
    const rl = createInterface({ input: stdin, output: stdout });
    const password = await rl.question(
      "Senha do painel (mín. 12 caracteres): ",
    );
    rl.close();
    if (password.length < 12) throw new Error("Use pelo menos 12 caracteres.");
    console.log(`ADMIN_PASSWORD_HASH=${hashPassword(password)}`);
    return;
  }
  const config = readConfig();
  if (!config.databaseUrl) throw new Error("Defina DATABASE_URL.");
  const db = await openDb(config.databaseUrl);
  try {
    const content = loadContent();
    const book = buildPriceBook(content);
    const skus = content.offers.map((offer) => offer.sku);
    const rules = getCommerceRules();
    const deps: LabelDeps = {
      db,
      book,
      rules,
      siteUrl: config.siteUrl,
      tokenSecret: config.orderTokenSecret,
      ...gateways(config),
      notifier: config.email ? resendNotifier(config.resend) : skippedNotifier,
    };
    switch (command) {
      case "migrate":
        console.log("Aplicadas:", (await migrate(db)).join(", ") || "nenhuma");
        break;
      case "stock:list":
        console.table(
          (await stockReport(db, content, book)).map((row) => ({
            sku: row.sku,
            estado: row.status,
            vendavel: row.sellable ? "sim" : row.issues.join("; "),
            disponivel: row.available ?? "sem registro",
            pausado: row.paused,
            reservado: row.held,
            vendido: row.sold,
          })),
        );
        break;
      case "stock:set": {
        const [sku, value, ...reason] = args;
        const result = await adjustStock(
          db,
          {
            sku,
            set: Number(value),
            reason: reason.join(" ") || "ajuste pela linha de comando",
            actor: "ops",
          },
          skus,
        );
        console.log(`${result.sku}: ${result.before} → ${result.after}.`);
        break;
      }
      case "stock:pause":
      case "stock:resume":
        await setPaused(db, args[0], command === "stock:pause", "ops", skus);
        console.log(
          `${args[0]}: venda ${command === "stock:pause" ? "pausada" : "retomada"}.`,
        );
        break;
      case "stock:seed-cms":
        console.log(
          "Criados:",
          (await seedStockFromContent(db, content.offers)).join(", ") ||
            "nenhum",
        );
        break;
      case "orders:list":
        console.table(
          await db.query(
            `SELECT id, status, fulfillment_status AS logistica, payment_method AS metodo,
               total_cents AS total_centavos, discount_cents AS desconto, address->>'state' AS uf,
               tracking_code AS rastreio, created_at AS criado
             FROM orders ${args[0] ? "WHERE status = $1 OR fulfillment_status = $1" : ""}
             ORDER BY created_at DESC LIMIT 50`,
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
      case "order:prepare":
        await advanceFulfillment(deps, args[0], "preparing");
        console.log("Pedido em preparação.");
        break;
      case "order:label":
        console.log(
          await buyLabel(deps, args[0], { invoiceKey: args[1] ?? null }),
        );
        break;
      case "order:tracking":
        console.log(await refreshTracking(deps, args[0]));
        break;
      case "order:ship":
        if (!args[0] || !args[1])
          throw new Error("Uso: order:ship <id> <rastreio> [transportadora]");
        await advanceFulfillment(deps, args[0], "shipped", {
          code: args[1],
          carrier: args[2] ?? null,
        });
        console.log("Pedido marcado como enviado.");
        break;
      case "order:deliver":
        await advanceFulfillment(deps, args[0], "delivered");
        console.log("Pedido entregue.");
        break;
      case "indicators":
        console.log(
          await indicators(db, rules, {
            days: args[0] === "todos" ? null : Number(args[0] ?? 30),
          }),
        );
        break;
      case "reconcile":
      case "orders:reconcile":
        console.log(await reconcile(deps));
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
