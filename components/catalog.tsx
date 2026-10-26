"use client";
import { useState } from "react";
import { coffees } from "../lib/coffees";
import { CoffeeCard } from "./coffee-card";
export function Catalog() {
  const [query, setQuery] = useState("");
  const [profile, setProfile] = useState("Todos");
  const visible = coffees.filter(
    (coffee) =>
      (profile === "Todos" || coffee.profile === profile) &&
      `${coffee.name} ${coffee.lot} ${coffee.notes} ${coffee.producers}`
        .toLocaleLowerCase("pt-BR")
        .includes(query.trim().toLocaleLowerCase("pt-BR")),
  );
  return (
    <>
      <div className="catalog-tools">
        <div>
          <label htmlFor="coffee-search">Encontre seu café</label>
          <input
            id="coffee-search"
            type="search"
            placeholder="Nome, nota sensorial ou produtor"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <fieldset>
          <legend>Perfil na xícara</legend>
          <div className="filter-options">
            {["Todos", ...coffees.map((coffee) => coffee.profile)].map(
              (value) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={profile === value}
                  onClick={() => setProfile(value)}
                >
                  {value}
                </button>
              ),
            )}
          </div>
        </fieldset>
      </div>
      <p className="result-count mono" role="status">
        {visible.length}{" "}
        {visible.length === 1 ? "café encontrado" : "cafés encontrados"}
      </p>
      {visible.length ? (
        <div className="coffee-grid">
          {visible.map((coffee) => (
            <CoffeeCard key={coffee.lot} coffee={coffee} />
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <h2>Nenhum café por aqui.</h2>
          <p>Tente outro nome ou explore a seleção completa.</p>
          <button
            type="button"
            className="button"
            onClick={() => {
              setQuery("");
              setProfile("Todos");
            }}
          >
            Limpar filtros
          </button>
        </div>
      )}
    </>
  );
}
