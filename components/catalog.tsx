"use client";
import { useState } from "react";
import {
  catalogFilters,
  filterCatalog,
  projectCoffee,
  type CatalogEntry,
} from "../lib/catalog-model";
import { CoffeeCard } from "./coffee-card";
export function Catalog({ entries }: { entries: CatalogEntry[] }) {
  const [query, setQuery] = useState("");
  const [profile, setProfile] = useState("");
  const [roast, setRoast] = useState("");
  const [preparation, setPreparation] = useState("");
  const options = catalogFilters(entries);
  const visible = filterCatalog(entries, {
    query,
    profile,
    roast,
    preparation,
  });
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
            {["", ...options.profiles].map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={profile === value}
                onClick={() => setProfile(value)}
              >
                {value || "Todos"}
              </button>
            ))}
          </div>
        </fieldset>
        <div>
          <label htmlFor="roast-filter">Torra</label>
          <select
            id="roast-filter"
            value={roast}
            onChange={(event) => setRoast(event.target.value)}
          >
            <option value="">Todas</option>
            {options.roasts.map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="preparation-filter">Preparo sugerido</label>
          <select
            id="preparation-filter"
            value={preparation}
            onChange={(event) => setPreparation(event.target.value)}
          >
            <option value="">Todos</option>
            {options.preparations.map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </div>
      </div>
      <p className="result-count mono" role="status">
        {visible.length}{" "}
        {visible.length === 1 ? "café encontrado" : "cafés encontrados"}
      </p>
      {visible.length ? (
        <div className="coffee-grid">
          {visible.map((entry) => (
            <CoffeeCard key={entry.coffee.id} coffee={projectCoffee(entry)} />
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
              setProfile("");
              setRoast("");
              setPreparation("");
            }}
          >
            Limpar filtros
          </button>
        </div>
      )}
    </>
  );
}
