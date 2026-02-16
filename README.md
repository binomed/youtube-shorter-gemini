# youtube-shorter-gemini

`youtube-shorter-gemini` est un outil de productivité pour transformer des vidéos YouTube longues en Shorts verticaux via l'IA Gemini.

## 🚀 Vision
Automatiser la détection et l'assemblage de moments clés, la séparation audio et le sous-titrage dynamique en local.

## 🛠 Stack Technique
- **Monorepo :** Turborepo + npm workspaces
- **Backend :** NestJS + SQLite + FFmpeg
- **Frontend :** Lit + Lit Signals + Tailwind CSS 4.x + Shoelace
- **IA :** Gemini (Cloud/Local)

## 📁 Structure du Projet
- `apps/back` : API Backend (NestJS)
- `apps/front` : Client Web (Lit)
- `packages/shared` : Types et DTOs partagés
- `.agent/skills` : Custom skills pour Antigravity ([voir documentation](.agent/skills/README.md))
- `.agent/workflows` : Workflows BMAD pour le développement

## 🛠 Installation
```bash
npm install
npm run dev
```

## 🧪 Tests
```bash
# Run all tests
npm run test

# Run with coverage
npm run test:cov --workspace=back
npm run test:coverage --workspace=front
```

Pour plus de détails, voir [CONTRIBUTING.md](CONTRIBUTING.md#-running-tests) et [ADR-002](docs/adr/002-testing-strategy.md).

## 📜 Licence
Apache License 2.0
