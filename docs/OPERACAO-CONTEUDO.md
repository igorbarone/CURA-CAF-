# Operação editorial e migração

## O que já existe e o que falta ativar

O site lê conteúdo validado de `content/`, suporta múltiplos lotes/ofertas e fotos autorizadas, e o formulário Pages CMS está definido em `.pages.yml`. A instalação/autorização existente do serviço não foi modificada; acesso e usuários são administrados no Pages CMS/GitHub, conforme [CMS-DECISAO.md](CMS-DECISAO.md). A edição direta de conteúdo na main é preservada. Não existe painel fictício no site.

## Fluxo da equipe no CMS (após a ativação)

Antes de editar conteúdo no Pages CMS, conferir o repositório e selecionar `main`, preservando a edição editorial direta solicitada pela equipe. Alterações de código, schema e configuração seguem branch e PR; esta entrega não altera permissões do GitHub.

### Cadastrar um café e seus lotes

1. Abrir **Cafés → Criar**. Informar ID permanente sem acentos/espaços (`letras-minusculas-com-hifen`) e endereço/slug no mesmo formato. O sistema usa o ID como nome do arquivo; os dois campos não devem mudar depois de publicados.
2. Preencher nome, apresentação real, cor editorial e ordem. Selecionar **Rascunho**. Não cadastrar nomes conceituais como cafés reais.
3. Se houver fotografia autorizada, preencher o bloco de foto com arquivo, descrição acessível e autoria/crédito. Se não houver, deixar o bloco vazio: o site usa o estudo gráfico provisório. Não usar imagem sintética como registro real de produtor/fazenda.
4. Salvar. Em **Lotes → Criar**, informar um ID permanente diferente do código de apresentação se necessário, selecionar o café e preencher código de rastreabilidade. Preencher somente características confirmadas; campos opcionais desconhecidos ficam vazios, listas desconhecidas sem itens. Não usar zero para “não sei”.
5. Salvar e voltar ao café para selecionar o **Lote principal**. A validação exige que pertença ao próprio café. Publicar os lotes que devem aparecer e o café quando aprovados. Um café pode ter nenhum, um ou vários lotes; selecionar um lote não publica automaticamente os demais.

### Editar, publicar e arquivar

- Editar o registro existente; não duplicar café para trocar seu lote. Usar um novo registro de lote e atualizar a seleção principal. Os filtros vêm dos lotes publicados e mudam no próximo deploy, sem editar componentes.
- **Publicar conteúdo** significa escolher `Publicado` e salvar diretamente em `main` pelo Pages CMS, para executar o fluxo de validação e publicação já existente. O site só muda quando o deploy termina. Alterações de código continuam exigindo branch e PR; este PR não foi integrado nem publicado automaticamente.
- Para retirar um café, selecionar **Arquivado**, sem excluir ou alterar slug. A URL mantém um aviso e saída para o catálogo; Home e catálogo deixam de mostrá-lo. Para retirar só um lote, arquivar o lote: suas ofertas somem junto. Reativar exige revisão e novo deploy.
- Rascunhos são excluídos do export, mas continuam visíveis no histórico de um repositório público. Nunca armazenar dados confidenciais, contatos privados ou credenciais nos registros.
- O formulário desabilita exclusão/renomeação de arquivos para reduzir acidentes. Isso é proteção de UX, não substitui permissões GitHub, backups ou revisão.

### Trocar fotos

1. Fazer upload de um arquivo autorizado em JPEG/PNG/WebP/AVIF com nome simples e extensão minúscula. Preferir nome novo ao substituir, para evitar cache antigo e preservar reversão. Otimizar antes do envio (meta operacional: cerca de 300 KB quando a qualidade permitir).
2. No café, escolher a imagem e informar alt descritivo e crédito verdadeiro. Não incluir `/CURA-CAF-/` no campo: o CMS grava `/media/...`, e o build aplica o prefixo.
3. Salvar e revisar o PR. Conferir versão desktop/mobile, recorte, legibilidade do crédito e ausência de informação indevida na foto.
4. Não apagar imagens referenciadas. O build falha se o caminho não existir; o CMS não verifica automaticamente direitos autorais. Limpar assets antigos somente após verificar todas as referências e manter possibilidade de rollback.

### Destaques da Home

Abrir **Destaques da Home**: editar chamada, título, complemento e introdução sem presumir um número fixo de cafés. Selecionar a lista de referências em **Cafés em destaque** e ordenar os itens. Apenas cafés publicados aparecem; referências a arquivados/rascunhos são ignoradas. Lista vazia mostra uma mensagem editorial e acesso ao catálogo. Um ID inexistente ou duplicado impede o build.

### Ofertas

Por enquanto, **não há ofertas reais cadastradas**. A coleção está pronta, mas não preencher preços, estoque, peso ou moagem sem confirmação. Cada oferta usa ID, SKU e lote corretos; múltiplas ofertas podem referenciar o mesmo lote. Valores de preço são em centavos inteiros, estoque em unidades; campos vazios permanecem desconhecidos, não zero. Publicar uma oferta editorial não habilita compra. Não colocar dados de clientes/pagamentos na coleção.

## Verificação e publicação pelo responsável

No terminal, Node 22, `npm ci`. Primeiro `npm run validate:content`, `npm run lint` e `npm run test:unit`. Para uma verificação completa:

```bash
npx playwright install --with-deps chromium
npm run test:scenarios
npm test
```

O script de cenários faz builds com dados técnicos isolados e com catálogo completamente vazio, remove a imagem temporária e **reconstrói a exportação real ao final**. Não o executar junto do servidor dev. Alternativamente, para regressão apenas dos registros reais: `GITHUB_PAGES=true npm run build` e `npm test`. Num ambiente com Chromium instalado, prefixar os testes com `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium`.

O CI faz validação, lint, unidades, cenários, export real e regressões antes de publicar `out/`. Falhas interrompem a implantação. A publicação continua pelo workflow Pages existente, em commits editoriais na `main` ou após integrar um PR de código. Não enviar o export técnico ou fixar `CURA_CONTENT_ROOT` nas configurações do ambiente.

## Migração desta versão

| Antes | Agora |
| --- | --- |
| Array fixo de produtos em `lib/coffees.ts` | Adaptador server + JSON em `content/coffees`, `content/lots` e `content/offers` |
| Café e lote no mesmo objeto | Café duradouro relacionado a lotes; dados sensoriais/origem pertencem ao lote |
| Tipo de oferta futuro sem relação persistida | Entidade `Offer` validada e ligada a lote; coleção real vazia |
| Textos da Home e seleção fixos | `content/home.json` e referências ordenadas |
| Filtro derivado de um produto por lote | Filtros deduplicados de todos os lotes publicados |
| Suposição de um segundo café | Descoberta com lista variável de relacionados; funciona sem relacionados |

Preservados SAMBA (`/cafes/samba/`, CURA-26-01, 84 pontos, torra média, rapadura/melaço, produtores e dados anteriores) e SALSA (`/cafes/salsa/`, CURA-26-02, 86 pontos, torra clara, laranja/tangerina, produtor, Fazenda Serrinha e variedade Arara). Não foram confirmados município/UF ou outros dados novos. O teste de migração verifica esses valores no snapshot original; as regressões do site leem os registros publicados e preservam a navegação de catálogo/carrinho/Home, sem impedir futuras edições legítimas. Os IDs iniciais são `samba`, `salsa`, `cura-26-01` e `cura-26-02`.

Após integrar: revisar o diff dos JSON, executar checks, confirmar as duas URLs, conferir textos e registrar a ativação do CMS em tarefa própria. Não é necessária migração de banco nem credencial para ler o conteúdo Git. Dependências novas: Zod para schema, tsx para scripts/testes e yaml para teste de configuração.

## Reversão e incidentes

- Registro inválido: ler o erro do build, corrigir pelo formulário e reenviar. O site publicado fica na última versão bem-sucedida.
- Foto ausente: restaurar o arquivo ou corrigir a referência, sem preencher dados ou usar outra imagem sem autorização.
- Publicação indesejada: reverter o commit/PR pelo GitHub e executar o workflow Pages. Reverter o conteúdo não reverte automaticamente a versão servida antes do novo deploy.
- Relação quebrada: restaurar o ID original ou corrigir as referências; não criar cópias fictícias para satisfazer a validação.
- Export técnico interrompido: não publicar `out/`; conferir ausência de `public/media/cms-fixture.png`, remover apenas esse arquivo técnico se criado pelo teste e rodar o build real sem `CURA_CONTENT_ROOT`.
- Migração para API: seguir [CMS-DECISAO.md](CMS-DECISAO.md), preservando IDs/URLs e snapshot Git recuperável.

## Textos da V1

Em **Conteúdo editorial V1**, editar Hero da Home, Curadoria, Nossa história, Clube Cura, textos do quiz e rodapé. Os campos têm rótulos editoriais em português e são validados antes do build. Preferências, resultados e explicações do quiz são derivados dos lotes publicados; o CMS não cadastra recomendações fictícias ou uma regra fixa SAMBA/SALSA. Labels operacionais do fluxo e bloqueios de contratação continuam em código para manter a clareza da demonstração.

Consultar [APRESENTACAO-V1.md](APRESENTACAO-V1.md) para roteiro e pendências e [ASSETS-V1.md](ASSETS-V1.md) antes de trocar imagens. Uma arte genérica de embalagem ou referência conceitual não confirma dados de oferta.

## Identidade oficial de 26/10/2026

Cores de perfil disponíveis: Rapadura, Anil, Amora, Ipê e Cacau, além de Marrom Cura neutro. Títulos usam Archivo Expanded 125% e a marca/símbolo vêm dos vetores originais. O campo **Natureza da imagem** diferencia arte de fotografia; os rótulos oficiais SVG ficam em `public/media/rotulo-*.svg`. Para trocar imagens raster, mantém-se o upload normal; SVGs editoriais devem seguir esse padrão e são verificados contra conteúdo ativo/externo no build.

O campo de lote **Por que escolhemos** só deve receber uma nota real confirmada; vazio não gera texto fictício. Nenhum campo entre colchetes dos adesivos vira dado automaticamente. [Fontes e auditoria](MISSAO05.md).
