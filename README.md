# Livre Acesso

Aplicação full-stack para mapear e compartilhar locais acessíveis. O projeto nasceu com a missão de apoiar pessoas com deficiência, familiares e gestores públicos a encontrarem espaços inclusivos, avaliar estruturas existentes e cadastrar novos pontos de interesse.

---

## 🛠 Tecnologias

- **Backend:** Node.js + Express, Prisma ORM, PostgreSQL  
- **Frontend:** HTML/CSS/JS puro, Bootstrap 5, Leaflet + OpenStreetMap  
- **Infra:** Docker Compose (Postgres), JWT para autenticação

---

## 🗂 Estrutura

```
acesso_livre/
├── backend/          # API REST, Prisma e migrations
│   ├── src/
│   │   ├── index.js      # servidor Express
│   │   ├── routes/       # auth, users, places, feedback
│   │   └── lib/          # prisma, helpers, configuração
│   └── prisma/           # schema e migrations
├── public/           # SPA estática
│   ├── index.html         # landing
│   ├── cadastro-local.html
│   ├── local-detalhes.html
│   ├── perfil.html
│   └── assets/            # CSS, JS, imagens
└── README.md
```

---

## ✅ Pré-requisitos

- Node.js 18+
- Docker Desktop (ou um servidor PostgreSQL acessível)
- Git (opcional, mas recomendado)

---

## ⚙️ Setup rápido

```bash
# 1. Clone o repositório
git clone https://github.com/seuusuario/livre-acesso.git
cd livre-acesso

# 2. Backend — dependências
cd backend
npm install

# 3. Banco de dados (Docker)
docker compose up -d db

# 4. Variáveis de ambiente
cp .env.example .env
# ajuste DATABASE_URL, PORT e JWT_SECRET se necessário

# 5. Prisma
npx prisma migrate dev
npx prisma generate

# 6. Inicie a API
npm run dev
```

A API ficará acessível em `http://localhost:3000`. Certifique-se de apontar `public/assets/js/config.js` para o mesmo endereço (`apiBaseUrl`).

---

## 💻 Frontend

O front é estático: abra qualquer HTML da pasta `public/` diretamente no navegador ou sirva com um servidor estático (ex.: `npx serve public`).

Principais páginas:

- `index.html` — landing page com missão, chamadas para ação e destaques
- `pesquisa.html` — filtros e resultados dinâmicos de locais (via API `/places`)
- `cadastro-local.html` — formulário para cadastrar novo ponto acessível, com mapa Leaflet
- `perfil.html` — dashboard do usuário autenticado (dados de `/users/me`)

---

## 🔐 Autenticação

- Cadastro: `POST /users`
- Login: `POST /auth/login`  
  Retorna `token` (JWT) + dados básicos do usuário.
- Rotas protegidas (ex.: `GET /users/me`) exigem `Authorization: Bearer <token>`.

O front salva o token em `localStorage` e injeta automaticamente nas requisições via `apiRequest`.

---

## 🗺 Leaflet + OSM

Os mapas usam Leaflet com tiles do OpenStreetMap (sem depender de chaves do Google).  
Arquivo-chave: `public/assets/js/maps.js`.

---

## 📌 Roadmap / pendências

- [x] Persistir as seleções completas de acessibilidade (checkboxes) no backend
- [x] Implementar reviews e favoritos (APIs + UI)
- [ ] Melhorar UX (mensagens de erro, loading states, tratamento de token expirado)
- [ ] Geocodificar endereço → latitude/longitude automaticamente ao cadastrar local
- [ ] Documentar uma coleção de requests (Insomnia/Postman) e adicionar testes automatizados

---

## 🤝 Contribuição

1. Faça um fork
2. Crie uma branch: `git checkout -b feature/sua-feature`
3. Commit: `git commit -m 'feat: minha nova feature'`
4. Push: `git push origin feature/sua-feature`
5. Abra um Pull Request descrevendo o que mudou e como testar

---

## 📄 Licença

Defina aqui a licença desejada (MIT, Apache, GPL...). Enquanto isso, considere o repositório “todos os direitos reservados”.

---

Feito com ❤ e propósito por quem acredita em cidades mais inclusivas. Vamos abrir caminhos juntos! 🌱
