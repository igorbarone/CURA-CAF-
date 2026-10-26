# CMS para a equipe Cura Café

## Recomendação

Começar com **Pages CMS baseado em Git**, usando os formulários de `.pages.yml`, arquivos JSON e imagens locais. A equipe poderá cadastrar, editar, selecionar estado editorial, escolher referências e trocar fotos sem editar código. É uma proposta com configuração preparada: nenhum painel foi simulado ou instalado, nenhuma GitHub App foi autorizada e nenhum usuário foi convidado por este PR.

A ativação real exige uma pessoa administradora conectar o serviço ao repositório, revisar permissões e testar o fluxo com os editores. Os formulários foram conferidos contra a documentação oficial; YAML, cobertura dos campos e referências são testados localmente. Login, experiência no serviço hospedado, permissões e salvamento por esse serviço **não foram validados** nesta execução.

## Comparação

| Critério | Git + Pages CMS | CMS/API externo (ex.: Sanity) |
| --- | --- | --- |
| GitHub Pages / export estático | JSON e fotos ficam no checkout; o build atual já os consome. Sem API em runtime. | Adaptador consulta conteúdo no build, valida e gera o mesmo export. Funciona no Pages; API não exige migrar o hosting do site. |
| Custo | Projeto open source; sem licença de código necessária. Serviço hospedado tem condições/limites a conferir. Uso de GitHub Actions, armazenamento Git e revisão trazem custo operacional. Self-host requer hospedagem, manutenção e configuração de autenticação/banco. | Na tabela consultada, o plano Free usa datasets públicos; datasets privados e papéis editoriais mais finos dependem de plano pago. O custo cresce com usuários, documentos, assets, API/banda e recursos editoriais. Verificar preços vigentes e limites do plano antes de contratar. Mantém custos de build e integração. |
| Edição | Formulários, upload e referências; histórico/reversão pelo Git; bom para catálogo pequeno e mudanças moderadas. Equipe precisa entender ramo, status e revisão. | Melhor para equipe com edição frequente, biblioteca de mídia maior e trabalho simultâneo; papéis, revisão, agendamento e histórico dependem do plano e da configuração. |
| Segurança | App com acesso apenas ao repo necessário, conteúdo autorizado direto em `main` e código em branch/PR. Git público torna JSON/fotos legíveis, inclusive rascunhos. Ocultar campos/ações no CMS não substitui autorização. | Dataset privado quando necessário; credenciais de leitura só no build. Webhook e gatilho de CI precisam autenticação. Tokens jamais no bundle/`NEXT_PUBLIC_*`. Papéis e isolamento de drafts devem ser configurados e testados. |
| Publicação | Status `published` + salvamento editorial em `main` + CI/deploy. Código segue PR. Alteração não é instantânea. Preview editorial precisa estratégia adicional, sem presumir que o Pages oferece previews por branch. | Publicação no CMS precisa disparar rebuild por ponte autenticada; o site continua na versão anterior até o deploy. Preview autenticado/draft não é fornecido pelo export público. |
| Fotos | Upload no Git é simples e auditável; muitas imagens grandes aumentam o histórico e o tempo de clone. Não há transformação de imagem de servidor no Pages. | CDN/biblioteca/transformações podem escalar melhor. Para o modelo atual, baixar fotos autorizadas no build para `public/media` ou implementar adaptador de mídia com domínios permitidos e URLs estáveis. |
| Relações / migração | IDs explícitos entre café, lote e oferta; schema do build verifica integridade. Conflitos de edição ainda podem exigir suporte técnico. | Relações mais ricas e edição simultânea; o adaptador deve exportar IDs estáveis e apenas conteúdo publicado, sem acoplar o React ao fornecedor. |
| Comércio | Não gerencia reserva nem transação. | Também não substitui plataforma de commerce nem fonte real de estoque. |

Decap CMS também é viável sobre Git, mas servir uma página `/admin` estática não resolve sozinho autenticação/escrita no GitHub; requer uma integração OAuth/serviço confiável. O Pages CMS evita adicionar um “admin” aparente ao site enquanto a infraestrutura de edição não existe.

## Quando migrar para API

Migrar quando volume de fotos, frequência de edições, colaboração simultânea, papéis de revisão ou agendamento justificarem o custo. A ausência de servidor Next em produção não impede isso: a integração é no build.

Plano técnico: exportar o JSON atual como backup; criar tipos equivalentes no provedor; importar cafés/lotes/ofertas mantendo os IDs; mapear fotos e créditos; implementar um adaptador build-time que retorna `Content`; validar com `contentSchema`; manter a filtragem de publicação; substituir somente a chamada do carregador. Definir timeout, falha fechada e não publicar snapshot parcial se a API falhar. Configurar secret de leitura em GitHub Actions e ponte autenticada de rebuild. Rotacionar credenciais, limitar escopos e validar que o bundle/export não contém tokens nem rascunhos. Não há credenciais necessárias para o fluxo Git atual.

Antes da troca, comparar uma exportação completa do provedor com o snapshot Git, incluindo rotas, lotes principais, notas, imagens e status. Fazer build e testes de regressão; testar um cadastro, edição, arquivamento e rollback reais em ambiente de homologação. Não depender de sincronização bidirecional permanente entre CMS Git e API.

## Ativação segura do fluxo Git

1. Administrador escolhe hosted/self-host e revisa termos, custos e permissões. Conecta somente `igorbarone/CURA-CAF-`; não conceder acesso indiscriminado à organização.
2. Integrar este PR e confirmar que `.pages.yml` está no ramo utilizado pelo CMS. Configurar a App/usuários no serviço real, fora do site público. Não expor segredos em arquivos de conteúdo.
3. Preservar `main` como ramo de edição direta de conteúdo no CMS e manter os editores autorizados. Convites sem conta GitHub dependem da modalidade do Pages CMS; a documentação atual descreve colaboradores por email. Validar a política efetivamente disponível no serviço escolhido.
4. Manter alterações de código em branch/PR e validar conteúdo antes do deploy pelo workflow existente. Não aplicar neste PR regras de branch que impeçam a edição editorial direta na `main`. Esta separação é operacional; a configuração do CMS não cria uma autorização GitHub por caminho. Permissões/instalação existentes não foram alteradas.
5. Usar o [guia de operação](OPERACAO-CONTEUDO.md) para um teste completo. Os editores salvam conteúdo diretamente na main; o responsável usa PR para mudanças de código. Os editores não precisam alterar código.
6. Confirmar o deploy Pages e o site publicado. Salvar no CMS não significa deploy concluído. Não há publish automático por webhook externo neste PR.

## Fontes oficiais consultadas

- [Pages CMS — configuração](https://pagescms.org/docs/configuration/), [conteúdo](https://pagescms.org/docs/configuration/content/), [referências](https://pagescms.org/docs/configuration/fields/reference/), [mídia](https://pagescms.org/docs/configuration/media/), [colaboradores](https://pagescms.org/docs/configuration/collaborators/) e [settings](https://pagescms.org/docs/configuration/settings/).
- [Sanity — Next.js](https://www.sanity.io/docs/next-js), [preços](https://www.sanity.io/pricing) e [controle de acesso](https://www.sanity.io/docs/user-guides/roles).
- [Decap — autenticação GitHub](https://decapcms.org/docs/github-backend/).

Consulta em 26/10/2026. Não foram fixadas cifras ou assumidos recursos gratuitos permanentes; conferir condições de contratação na ativação.
