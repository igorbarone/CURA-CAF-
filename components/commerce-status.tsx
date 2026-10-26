export function CommerceStatus() {
  return (
    <aside className="commerce-status" aria-label="Informações comerciais">
      <p className="eyebrow">UMA ESCOLHA COM TRANSPARÊNCIA</p>
      <p>
        Preço, estoque, peso e opções de moagem ainda não foram confirmados.
      </p>
      <button type="button" disabled>
        Compra online · Em breve
      </button>
      <p className="availability">
        Sem venda online, reserva ou cobrança nesta fase.
      </p>
    </aside>
  );
}
