// Client-safe input helpers for the checkout: masks while typing and the
// same checks the server applies, so mistakes show next to the field.
const digits = (value: string) => value.replace(/\D/g, "");
export function maskCpf(value: string) {
  const d = digits(value).slice(0, 11);
  return d
    .replace(/^(\d{3})(\d)/, "$1.$2")
    .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d{1,2})$/, ".$1-$2");
}
export function maskPhone(value: string) {
  const d = digits(value).slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : "";
  const rest = d.slice(2);
  // Mobile numbers start with 9 and have 5 digits before the hyphen.
  const split = rest[0] === "9" ? 5 : 4;
  return `(${d.slice(0, 2)}) ${rest.slice(0, split)}${rest.length > split ? `-${rest.slice(split)}` : ""}`;
}
export function maskCep(value: string) {
  const d = digits(value).slice(0, 8);
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
}
export const cepDigits = (value: string) => digits(value);
// CPF check digits (Receita Federal algorithm); rejects repeated digits.
export function isValidCpf(value: string) {
  const d = digits(value);
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  const check = (length: number) => {
    const sum = [...d.slice(0, length)].reduce(
      (total, digit, index) => total + Number(digit) * (length + 1 - index),
      0,
    );
    const rest = (sum * 10) % 11;
    return rest === 10 ? 0 : rest;
  };
  return check(9) === Number(d[9]) && check(10) === Number(d[10]);
}
export type CheckoutFields = {
  name: string;
  email: string;
  cpf: string;
  phone: string;
  cep: string;
  street: string;
  number: string;
  district: string;
  city: string;
  state: string;
};
// Field → message, empty when everything is fine. Mirrors the server schema.
export function checkoutErrors(values: CheckoutFields) {
  const errors: Partial<Record<keyof CheckoutFields, string>> = {};
  if (values.name.trim().split(/\s+/).length < 2)
    errors.name = "Informe nome e sobrenome.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim()))
    errors.email = "Informe um e-mail válido.";
  if (!isValidCpf(values.cpf)) errors.cpf = "CPF inválido. Confira os números.";
  if (!/^\d{10,11}$/.test(digits(values.phone)))
    errors.phone = "Informe o celular com DDD.";
  if (digits(values.cep).length !== 8) errors.cep = "CEP com 8 números.";
  for (const [field, message] of [
    ["street", "Informe a rua."],
    ["number", "Informe o número."],
    ["district", "Informe o bairro."],
    ["city", "Informe a cidade."],
    ["state", "Selecione o estado."],
  ] as const)
    if (!values[field].trim()) errors[field] = message;
  return errors;
}
// Server validation paths (e.g. "customer.cpf") → form field names.
export const fieldFromPath = (path: string) =>
  path.split(".").pop() as keyof CheckoutFields;
