# Frontend App

Target host: Vercel

Current implementation:

```text
examples/marketplace/web
```

Production responsibilities:

- landing page
- marketplace dashboard
- market history
- agent profiles
- memo library
- developer portal
- documentation links

The frontend must remain stateless. It must not run CoralOS, perform settlement, execute agents, or
read database secrets. All business logic goes through `https://api.omniquantai.com`.

Build command:

```sh
npm install --prefix examples/marketplace/web
npm run build --prefix examples/marketplace/web
```

Required public environment:

```ini
VITE_API_BASE_URL=https://api.omniquantai.com
```
