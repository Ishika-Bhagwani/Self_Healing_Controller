# Self-Healing Controller

Needs Node 18+, Python 3.10+, PostgreSQL. Run in three terminals:

1. AI service: cd ai-service && pip install -r requirements.txt && uvicorn main:app --port 8000
2. Backend:    cd backend && cp .env.example .env && npm install && npx prisma migrate dev --name init && npm run seed && npm run dev
3. Frontend:   cd frontend && npm install && npm run dev   (http://localhost:5173)

Analyst login: admin@shc.local / Admin@123
Requestors need no login: /new raises a ticket, /ticket/:id answers clarification questions.

Decision bands: 100 Self-Heal | 95-99 review with analyst note | 81-94 clarify (one retry, then escalate) | below 81 escalate.
Self-Heal runs only scripts that exist in backend/scripts. New clients, categories and articles: Knowledge base page, or POST /api/clients, /api/categories, /api/articles.
