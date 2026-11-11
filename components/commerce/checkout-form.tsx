"use client";
import Link from "next/link";
import { PackThumb } from "./pack-thumb";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { formatBRL } from "../../lib/commerce/catalog";
import { api, messageFor, type ApiError } from "../../lib/commerce/client";
import { centsToValue, track } from "../../lib/analytics";
import { orderTotals } from "../../lib/commerce/pricing";
import { useCart } from "./cart-provider";
import { CEP_KEY, type Quote } from "./cart-view";
import {
  cepDigits,
  checkoutErrors,
  fieldFromPath,
  maskCep,
  maskCpf,
  maskPhone,
  type CheckoutFields,
} from "../../lib/commerce/format";
type FieldErrors = Partial<Record<keyof CheckoutFields, string>>;
const MASKS: Record<string, (value: string) => string> = {
  cpf: maskCpf,
  phone: maskPhone,
  cep: maskCep,
};
const STEPS = ["Carrinho", "Seus dados", "Entrega", "Pagamento"];
type Status = {
  enabled: boolean;
  pix: boolean;
  card: boolean;
  shipping: boolean;
  environment: string;
};
type OrderResult = {
  id: string;
  token?: string;
  status: string;
  payment: { invoiceUrl: string | null } | null;
};
const UFS =
  "AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO".split(
    " ",
  );
const KEY = "cura-checkout-attempt";
export function CheckoutForm() {
  const cart = useCart();
  const router = useRouter();
  const [status, setStatus] = useState<Status | null>(null);
  const [customer, setCustomer] = useState({
    name: "",
    email: "",
    cpf: "",
    phone: "",
  });
  const [address, setAddress] = useState({
    cep: "",
    street: "",
    number: "",
    complement: "",
    district: "",
    city: "",
    state: "",
  });
  const [quote, setQuote] = useState<Quote | null>(null);
  const [optionId, setOptionId] = useState("");
  const [method, setMethod] = useState<"pix" | "card">("pix");
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [cepState, setCepState] = useState<
    "idle" | "loading" | "found" | "not_found" | "unavailable"
  >("idle");
  // Values filled from the CEP, so a later lookup never overwrites what the
  // visitor typed by hand.
  const autofilled = useRef<Record<string, string>>({});
  // Only the latest freight request may update the screen: an older answer
  // (previous CEP or cart) arriving late is ignored.
  const quoteRequest = useRef(0);
  const [busy, setBusy] = useState(false);
  // One idempotency key per attempt: resubmitting the same data after a
  // network failure reuses it, so the server never creates a second order.
  const attempt = useRef<{ key: string; signature: string } | null>(null);
  useEffect(() => {
    api<Status>("/api/commerce/status/").then((result) =>
      setStatus(
        result.ok
          ? result.data
          : {
              enabled: false,
              pix: false,
              card: false,
              shipping: false,
              environment: "",
            },
      ),
    );
    try {
      const saved = sessionStorage.getItem(KEY);
      if (saved) attempt.current = JSON.parse(saved);
      setAddress((current) => ({
        ...current,
        cep: sessionStorage.getItem(CEP_KEY) ?? "",
      }));
    } catch {
      /* optional */
    }
  }, []);
  useEffect(() => {
    if (cart.ready && cart.lines.length)
      track("begin_checkout", {
        value: centsToValue(cart.subtotalCents),
        items: items(),
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cart.ready]);
  // Freight depends on the cart and the CEP; any change asks for a new quote.
  // A complete CEP fills the address and quotes the freight by itself.
  const cep = cepDigits(address.cep);
  useEffect(() => {
    quoteRequest.current += 1;
    setQuote(null);
    setOptionId("");
    if (cep.length !== 8 || !cart.ready || !cart.lines.length) return;
    let active = true;
    setCepState("loading");
    api<{ street: string; district: string; city: string; state: string }>(
      `/api/address/cep/?cep=${cep}`,
    ).then((result) => {
      if (!active) return;
      if (result.ok) {
        setCepState("found");
        setAddress((current) => {
          const next = { ...current };
          for (const key of ["street", "district", "city", "state"] as const) {
            const value = result.data[key];
            if (
              value &&
              (!current[key] || current[key] === autofilled.current[key])
            ) {
              next[key] = value;
              autofilled.current[key] = value;
            }
          }
          return next;
        });
      } else
        setCepState(
          (result.error as ApiError).error === "cep_not_found"
            ? "not_found"
            : "unavailable",
        );
    });
    loadQuote(cep);
    return () => {
      active = false;
    };
    // loadQuote reads the cart through the same dependencies.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cep, cart.ready, cart.subtotalCents, cart.weightGrams]);
  const option = quote?.options.find((item) => item.id === optionId);
  // Recomputed whenever the method changes: Pix takes the discount off the
  // coffees (never off the freight). The server computes it again.
  const { discountCents, totalCents } = orderTotals({
    subtotalCents: cart.subtotalCents,
    shippingCents: option?.chargedCents ?? 0,
    method,
    rules: cart.rules,
  });
  function items() {
    return cart.lines.map((line) => ({
      item_id: line.id,
      item_name: line.item.name,
      item_variant: line.item.label,
      price: centsToValue(line.item.unitPriceCents),
      quantity: line.quantity,
    }));
  }
  async function loadQuote(forCep = cep) {
    setError("");
    if (forCep.length !== 8)
      return setErrors((current) => ({
        ...current,
        cep: "CEP com 8 números.",
      }));
    const request = ++quoteRequest.current;
    const result = await api<Quote>("/api/shipping/quote/", {
      method: "POST",
      body: JSON.stringify({
        cep: forCep,
        lines: cart.lines.map(({ id, quantity }) => ({ id, quantity })),
      }),
    });
    if (request !== quoteRequest.current) return;
    if (!result.ok) return setError(messageFor(result.error as ApiError));
    setQuote(result.data);
    setOptionId(result.data.options[0]?.id ?? "");
  }
  async function submit(payment: { method: "pix" | "card" }) {
    setError("");
    const found = checkoutErrors({ ...customer, ...address });
    setErrors(found);
    const first = Object.keys(found)[0];
    if (first) {
      document
        .getElementById(
          `${["name", "email", "cpf", "phone"].includes(first) ? "customer" : "address"}-${first}`,
        )
        ?.focus();
      return setError("Revise os campos destacados.");
    }
    if (!option) return setError("Calcule e escolha o frete antes de pagar.");
    if (!consent) return setError("Confirme o uso dos dados para o pedido.");
    const body = {
      lines: cart.lines.map(({ id, quantity }) => ({ id, quantity })),
      customer,
      address,
      shippingOptionId: option.id,
      shippingPriceCents: option.chargedCents,
      consent: true as const,
      payment,
    };
    const signature = JSON.stringify({
      ...body,
      payment: { method: payment.method },
    });
    if (!attempt.current || attempt.current.signature !== signature)
      attempt.current = { key: crypto.randomUUID(), signature };
    try {
      sessionStorage.setItem(KEY, JSON.stringify(attempt.current));
    } catch {
      /* optional */
    }
    setBusy(true);
    track("add_payment_info", {
      value: centsToValue(totalCents),
      payment_type: payment.method,
      items: items(),
    });
    const result = await api<OrderResult>("/api/checkout/", {
      method: "POST",
      body: JSON.stringify({ ...body, idempotencyKey: attempt.current.key }),
    });
    setBusy(false);
    if (!result.ok) {
      const code = (result.error as ApiError).error;
      // Only a retry of the very same data may reuse the key.
      if (
        !["network_error", "payment_unavailable", "internal_error"].includes(
          code,
        )
      )
        attempt.current = null;
      if (code === "shipping_changed") {
        // The server sent the current options: show them and ask again.
        const options = (result.error as ApiError).options;
        if (quote && Array.isArray(options)) {
          setQuote({ ...quote, options: options as Quote["options"] });
          setOptionId("");
        } else setQuote(null);
      }
      const fields = (result.error as ApiError).fields;
      if (code === "invalid_input" && Array.isArray(fields)) {
        const server: FieldErrors = {};
        for (const path of fields as string[])
          server[fieldFromPath(path)] = "Confira este campo.";
        setErrors(server);
      }
      return setError(messageFor(result.error as ApiError));
    }
    sessionStorage.removeItem(KEY);
    cart.clear();
    // Card: the buyer types the card on the Asaas page, which returns to the
    // order page. Pix: the order page shows the QR Code.
    const invoice = result.data.payment?.invoiceUrl;
    if (payment.method === "card" && invoice) window.location.assign(invoice);
    else
      router.push(`/pedido/?id=${result.data.id}&token=${result.data.token}`);
  }
  if (!status || !cart.ready)
    return <p className="body-copy">Preparando o checkout…</p>;
  if (!status.enabled || !status.pix)
    return (
      <section className="empty-state">
        <p className="eyebrow">CHECKOUT</p>
        <h1>Compra online em breve.</h1>
        <p>
          A loja ainda não está recebendo pagamentos. Nenhum pedido foi criado.
        </p>
        <Link className="button" href="/cafes/">
          Ver os cafés
        </Link>
      </section>
    );
  if (!cart.lines.length)
    return (
      <section className="empty-state">
        <h1>Seu carrinho está vazio.</h1>
        <Link className="button" href="/cafes/">
          Escolher cafés
        </Link>
      </section>
    );
  const field = (
    group: "customer" | "address",
    name: string,
    label: string,
    props: React.InputHTMLAttributes<HTMLInputElement> = {},
  ) => {
    const values: Record<string, string> =
      group === "customer" ? customer : address;
    const id = `${group}-${name}`;
    const message = errors[name as keyof CheckoutFields];
    return (
      <div className="checkout-field">
        <label htmlFor={id}>{label}</label>
        <input
          id={id}
          name={name}
          value={values[name]}
          aria-invalid={message ? true : undefined}
          aria-describedby={message ? `${id}-error` : undefined}
          onChange={(event) => {
            const value = (MASKS[name] ?? ((text: string) => text))(
              event.target.value,
            );
            if (message)
              setErrors((current) => ({ ...current, [name]: undefined }));
            if (group === "customer")
              setCustomer((current) => ({ ...current, [name]: value }));
            else setAddress((current) => ({ ...current, [name]: value }));
          }}
          {...props}
        />
        {message && (
          <p id={`${id}-error`} className="field-error">
            {message}
          </p>
        )}
      </div>
    );
  };
  // Where the visitor is: data, then delivery, then payment.
  const dataDone = !["name", "email", "cpf", "phone"].some(
    (key) =>
      checkoutErrors({ ...customer, ...address })[key as keyof CheckoutFields],
  );
  const current = !dataDone ? 1 : !option ? 2 : 3;
  return (
    <div className="checkout-layout">
      <nav className="checkout-steps" aria-label="Etapas da compra">
        <ol>
          {STEPS.map((step, index) => (
            <li
              key={step}
              className={
                index < current
                  ? "is-done"
                  : index === current
                    ? "is-current"
                    : ""
              }
              aria-current={index === current ? "step" : undefined}
            >
              {index === 0 ? <Link href="/carrinho/">{step}</Link> : step}
            </li>
          ))}
        </ol>
      </nav>
      <form
        className="checkout-form"
        // Our own messages, next to each field, replace the browser bubbles.
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          submit({ method });
        }}
      >
        {status.environment === "sandbox" && (
          <p className="checkout-sandbox" role="note">
            Ambiente de testes: pagamentos simulados, nenhuma cobrança real.
          </p>
        )}
        <fieldset>
          <legend>1. Seus dados</legend>
          {field("customer", "name", "Nome completo", {
            autoComplete: "name",
            required: true,
          })}
          {field("customer", "email", "E-mail", {
            type: "email",
            autoComplete: "email",
            required: true,
          })}
          {field("customer", "cpf", "CPF", {
            inputMode: "numeric",
            placeholder: "000.000.000-00",
            required: true,
          })}
          {field("customer", "phone", "Celular com DDD", {
            type: "tel",
            autoComplete: "tel",
            placeholder: "(00) 00000-0000",
            required: true,
          })}
        </fieldset>
        <fieldset>
          <legend>2. Entrega</legend>
          {field("address", "cep", "CEP", {
            inputMode: "numeric",
            autoComplete: "postal-code",
            placeholder: "00000-000",
            required: true,
          })}
          <p className="cep-status" role="status">
            {cepState === "loading"
              ? "Buscando o endereço…"
              : cepState === "found"
                ? "Endereço preenchido pelo CEP. Confira e informe o número."
                : cepState === "not_found"
                  ? "CEP não encontrado. Preencha o endereço."
                  : cepState === "unavailable"
                    ? "Não conseguimos buscar o CEP agora. Preencha o endereço."
                    : ""}
          </p>
          {field("address", "street", "Rua", {
            autoComplete: "address-line1",
            required: true,
          })}
          {field("address", "number", "Número", { required: true })}
          {field("address", "complement", "Complemento (opcional)", {
            autoComplete: "address-line2",
          })}
          {field("address", "district", "Bairro", { required: true })}
          {field("address", "city", "Cidade", {
            autoComplete: "address-level2",
            required: true,
          })}
          <div className="checkout-field">
            <label htmlFor="address-state">Estado</label>
            <select
              id="address-state"
              value={address.state}
              required
              aria-invalid={errors.state ? true : undefined}
              aria-describedby={
                errors.state ? "address-state-error" : undefined
              }
              onChange={(event) => {
                setErrors((current) => ({ ...current, state: undefined }));
                setAddress({ ...address, state: event.target.value });
              }}
            >
              <option value="">Selecione</option>
              {UFS.map((uf) => (
                <option key={uf}>{uf}</option>
              ))}
            </select>
            {errors.state && (
              <p id="address-state-error" className="field-error">
                {errors.state}
              </p>
            )}
          </div>
          <button
            type="button"
            className="checkout-quote"
            onClick={() => loadQuote()}
          >
            Calcular frete
          </button>
          {quote && (
            <div
              role="radiogroup"
              aria-label="Opções de entrega"
              className="shipping-options"
            >
              {quote.options.map((item) => (
                <label key={item.id} className="package-option">
                  <input
                    type="radio"
                    name="shipping"
                    checked={item.id === optionId}
                    onChange={() => {
                      setOptionId(item.id);
                      track("add_shipping_info", {
                        value: centsToValue(
                          cart.subtotalCents + item.chargedCents,
                        ),
                        shipping_tier: item.name,
                        items: items(),
                      });
                    }}
                  />
                  <span className="package-label">
                    {item.company} {item.name}
                    {item.days !== null && ` · até ${item.days} dias úteis`}
                    {item.volumes > 1 && ` · ${item.volumes} volumes`}
                  </span>
                  <span className="package-price">
                    {item.chargedCents === 0
                      ? "Grátis"
                      : formatBRL(item.chargedCents)}
                  </span>
                </label>
              ))}
            </div>
          )}
        </fieldset>
        <fieldset>
          <legend>3. Pagamento</legend>
          <label className="package-option">
            <input
              type="radio"
              name="method"
              checked={method === "pix"}
              onChange={() => setMethod("pix")}
            />
            <span className="package-label">
              Pix
              {cart.rules.pixDiscountPercent > 0 &&
                ` · ${cart.rules.pixDiscountPercent}% de desconto nos cafés`}
            </span>
            <span className="package-unit mono">
              QR Code e copia e cola na próxima tela
            </span>
          </label>
          {status.card && (
            <label className="package-option">
              <input
                type="radio"
                name="method"
                checked={method === "card"}
                onChange={() => setMethod("card")}
              />
              <span className="package-label">Cartão de crédito</span>
              <span className="package-unit mono">
                você digita o cartão na página segura do Asaas
              </span>
            </label>
          )}
          <label className="checkout-consent">
            <input
              type="checkbox"
              checked={consent}
              onChange={(event) => setConsent(event.target.checked)}
            />
            <span>
              Autorizo o uso do meu nome, CPF, contato e endereço apenas para
              processar este pedido, o pagamento (Asaas) e a entrega
              (transportadora, via Melhor Envio).
            </span>
          </label>
          <button type="submit" className="button" disabled={busy}>
            {busy
              ? method === "pix"
                ? "Gerando Pix…"
                : "Abrindo o pagamento…"
              : method === "pix"
                ? `Gerar Pix de ${formatBRL(totalCents)}`
                : `Pagar ${formatBRL(totalCents)} no cartão`}
          </button>
          <p className="checkout-secure">
            <span aria-hidden="true">🔒</span> Pagamento processado pelo Asaas.
            No cartão, os dados são digitados na página do Asaas: a Cura não
            recebe nem guarda os dados do seu cartão. O pedido só é confirmado
            quando o Asaas confirma o pagamento.
          </p>
          <p role="alert" className="cart-warning">
            {error}
          </p>
        </fieldset>
        <Link className="text-link checkout-back" href="/carrinho/">
          Voltar ao carrinho
        </Link>
      </form>
      <aside className="checkout-summary" aria-label="Resumo do pedido">
        <p className="eyebrow">RESUMO</p>
        <ul>
          {cart.lines.map((line) => (
            <li key={line.id}>
              <PackThumb item={line.item} size={44} />
              <span className="summary-line-name">
                {line.quantity}× {line.item.name} · {line.item.label}
              </span>
              <span>{formatBRL(line.lineTotalCents)}</span>
            </li>
          ))}
        </ul>
        <dl>
          <div>
            <dt>Subtotal</dt>
            <dd>{formatBRL(cart.subtotalCents)}</dd>
          </div>
          {discountCents > 0 && (
            <div className="summary-discount">
              <dt>Desconto Pix ({cart.rules.pixDiscountPercent}% nos cafés)</dt>
              <dd>−{formatBRL(discountCents)}</dd>
            </div>
          )}
          <div>
            <dt>Frete</dt>
            <dd>
              {option
                ? option.chargedCents === 0
                  ? "Grátis"
                  : formatBRL(option.chargedCents)
                : "—"}
            </dd>
          </div>
          <div className="cart-total">
            <dt>Total</dt>
            <dd>{formatBRL(totalCents)}</dd>
          </div>
        </dl>
        <p className="availability">
          Preços, frete e estoque são conferidos novamente pela loja ao
          finalizar.
        </p>
      </aside>
    </div>
  );
}
