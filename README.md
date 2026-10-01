# Installation & Setup Guide

### Prerequisites
- Node.js 18+
- PostgreSQL 14+ (Port 5432)

### Setup & Run Development

```bash
# 1. Install dependencies
npm install

# 2. Setup environment variables
cp .env.example .env

# 3. Database migration & seed initial data
npx prisma migrate dev
npx ts-node prisma/seed.ts

# 4. Start development server
npm run dev
```

Server will run at `http://localhost:5000`

### Build for Production

```bash
npm run build
npm start
```
