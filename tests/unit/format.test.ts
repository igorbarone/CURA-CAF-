import assert from "node:assert/strict";
import { test } from "node:test";
import {
  checkoutErrors,
  fieldFromPath,
  isValidCpf,
  maskCep,
  maskCpf,
  maskPhone,
} from "../../lib/commerce/format";
test("checkout masks format while typing and ignore extra characters", () => {
  assert.equal(maskCpf("529"), "529");
  assert.equal(maskCpf("5299822"), "529.982.2");
  assert.equal(maskCpf("52998224725999"), "529.982.247-25");
  assert.equal(maskPhone("11"), "(11");
  assert.equal(maskPhone("1199999"), "(11) 99999");
  assert.equal(maskPhone("11999990000"), "(11) 99999-0000");
  assert.equal(maskPhone("1133334444"), "(11) 3333-4444");
  assert.equal(maskCep("01310"), "01310");
  assert.equal(maskCep("01310100"), "01310-100");
  assert.equal(maskCep("01310-1009"), "01310-100");
});
test("checkout validation names every wrong field, like the server", () => {
  const ok = {
    name: "Maria Teste",
    email: "maria@example.com",
    cpf: "529.982.247-25",
    phone: "(11) 99999-0000",
    cep: "01310-100",
    street: "Av. Paulista",
    number: "100",
    district: "Bela Vista",
    city: "São Paulo",
    state: "SP",
  };
  assert.deepEqual(checkoutErrors(ok), {});
  assert.deepEqual(
    Object.keys(
      checkoutErrors({
        ...ok,
        name: "Maria",
        cpf: "111.111.111-11",
        phone: "123",
        cep: "1",
        state: "",
      }),
    ),
    ["name", "cpf", "phone", "cep", "state"],
  );
  assert.ok(isValidCpf("52998224725"));
  assert.equal(fieldFromPath("customer.cpf"), "cpf");
  assert.equal(fieldFromPath("address.state"), "state");
});
