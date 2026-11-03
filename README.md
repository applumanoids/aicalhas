# AppCalhas

Demonstração interativa do AppCalhas (HTML, CSS e JavaScript, sem build): capa com os quatro modelos de operação, demonstração de cada cenário e o passo a passo do Cenário 3.

## Publicação

- **Endereço:** https://calhas.lumanoids.online
- **Hospedagem:** Cloudflare Workers (Static Assets), Worker `appcalhas`
- **Deploy automático:** cada push na branch `main` gera um novo deploy (Workers Builds). Outras branches geram uma URL de preview.
- O endereço antigo (GitHub Pages) continua funcionando pelo workflow `.github/workflows/pages.yml`.

Arquivos de publicação:

| Arquivo | Função |
|---|---|
| `wrangler.jsonc` | Configuração do Worker (o `name` deve ser igual ao nome no painel da Cloudflare) |
| `.assetsignore` | Arquivos do repositório que não são publicados no site |
| `_headers` | Cabeçalhos de segurança HTTP |

## Páginas

| Página | Conteúdo |
|---|---|
| `index.html` | Capa: modelo recomendado, os quatro cenários e o comparativo |
| `cenario-1.html` a `cenario-4.html` | Demonstrações interativas (dados fictícios) |
| `passo-a-passo.html` | Passo a passo do Cenário 3, com simulação |
