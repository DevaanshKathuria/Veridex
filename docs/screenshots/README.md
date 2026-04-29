# Veridex Screenshots

This directory is reserved for screenshots generated from a local or deployed Veridex run.

To generate screenshots:

1. Run `docker-compose up --build`.
2. Seed the knowledge base with `docker-compose exec worker npx ts-node scripts/seedKnowledgeBase.ts`.
3. Open `http://localhost:3000`.
4. Register an account and run an analysis on any news article.

Capture these screens:

- Landing page hero
- `/analyze` while the pipeline is running and claim cards are streaming in
- Completed analysis with credibility gauge, manipulation warning, and claim cards
- Dashboard with trend chart and recent analyses

Use descriptive filenames such as `landing-hero.png`, `analyze-streaming.png`, `analysis-complete.png`, and `dashboard.png`.
