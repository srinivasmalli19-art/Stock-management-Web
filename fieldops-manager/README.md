# FieldOps Manager

A production-ready field operations management system for consumer durables installation companies.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + Vite + Tailwind CSS |
| State | TanStack Query v5 + React Hook Form + Zod |
| Backend | Node.js + Express.js |
| ORM | Prisma (PostgreSQL) |
| Cache / Token Store | Redis |
| Auth | JWT (access 15m) + Refresh Token (7d, httpOnly cookie) |
| Containerization | Docker + Docker Compose |
| CI/CD | GitHub Actions → AWS S3 + ECR + EC2 |

## Roles

| Role | Default Page |
|------|-------------|
| Admin | Approval Queue |
| Store Manager | Store Dashboard |
| Team Leader | Validation Queue |
| Engineer | My Dashboard |

## Local Development Setup

### Prerequisites
- Node.js 18+
- Docker Desktop
- Git

### 1. Clone and configure

```bash
git clone <repo-url>
cd fieldops-manager
cp .env.example .env
# Edit .env with your values
```

### 2. Start with Docker Compose (recommended)

```bash
docker-compose up -d
```

This starts:
- PostgreSQL on port 5432
- Redis on port 6379
- Backend API on port 5000
- Frontend dev server on port 3000

### 3. Manual setup (without Docker)

**Backend:**
```bash
cd backend
npm install
npx prisma generate
npx prisma migrate dev --name init
npx prisma db seed
npm run dev
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev
```

### 4. Access the app

Open http://localhost:3000

**Demo credentials** (all use password: `password`):

| Role | Email |
|------|-------|
| Admin | admin@fieldops.com |
| Store Manager | store@fieldops.com |
| Team Leader | leader@fieldops.com |
| Engineer | eng01@fieldops.com |

## Project Structure

```
fieldops-manager/
├── frontend/               # React + Vite frontend
│   └── src/
│       ├── components/     # Shared UI components
│       ├── pages/          # Role-specific pages
│       ├── services/       # API service modules
│       ├── context/        # Auth context
│       ├── hooks/          # Custom React hooks
│       └── utils/          # Formatters, helpers
├── backend/                # Node.js + Express API
│   ├── prisma/             # Schema + seed
│   └── src/
│       ├── controllers/    # Request handlers
│       ├── routes/         # Express routes
│       ├── middlewares/    # Auth, validation, errors
│       ├── services/       # Business logic
│       ├── utils/          # Logger, tokens, helpers
│       └── config/         # DB, Redis, env
├── .github/workflows/      # CI/CD pipelines
└── docker-compose.yml
```

## Key Business Rules

1. **Productivity Flow**: Engineer → Pending → TL Validates → Admin Approves
2. **Attendance**: Auto-marked Present when Admin approves a productivity log
3. **Stock Deduction**: Sold accessories deducted from engineer van stock on approval
4. **P&L Formula**: `Revenue − Incentive − Accessories Purchase Cost`
5. **Purchase Inward**: Admin must approve before warehouse stock updates
6. **Revoke Flow**: Store Manager requests → Admin approves/rejects
7. **Unit Price**: Always reflects latest approved purchase inward price (used for P&L cost)

## AWS Deployment Guide

### Prerequisites
- AWS account with IAM user having S3, ECR, EC2, RDS, ElastiCache, CloudFront, Route53 permissions
- Domain name (optional)

### 1. Database (RDS PostgreSQL)

```
Engine: PostgreSQL 15
Instance: db.t3.micro (dev) / db.t3.medium (prod)
Storage: 20 GB SSD
Multi-AZ: Yes (prod)
```

Set `DATABASE_URL` in your EC2 environment variables.

### 2. Cache (ElastiCache Redis)

```
Engine: Redis 7
Node type: cache.t3.micro
```

Set `REDIS_URL` in EC2 environment.

### 3. Frontend (S3 + CloudFront)

```bash
# Create S3 bucket
aws s3 mb s3://fieldops-frontend-<your-suffix>

# Configure for static hosting
aws s3 website s3://fieldops-frontend-<your-suffix> \
  --index-document index.html \
  --error-document index.html

# Create CloudFront distribution pointing to S3 bucket
# Enable OAI for private bucket access
```

### 4. Backend (ECR + EC2)

```bash
# Create ECR repository
aws ecr create-repository --repository-name fieldops-backend

# Launch EC2 (Amazon Linux 2, t3.small minimum)
# Install Docker on EC2:
sudo yum update -y && sudo yum install -y docker
sudo systemctl start docker
sudo usermod -aG docker ec2-user
```

### 5. GitHub Secrets required

```
AWS_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY
AWS_REGION
AWS_S3_BUCKET
AWS_CLOUDFRONT_DIST_ID
ECR_REGISTRY
EC2_HOST
EC2_USER
EC2_SSH_KEY
API_URL
```

### 6. SSL (ACM + Route53)

- Request a certificate in ACM for your domain
- Create Route53 A record pointing to CloudFront (frontend) and EC2 EIP (backend)
- Attach ACM certificate to CloudFront distribution and EC2 load balancer

## API Reference

All endpoints return: `{ success, data, message, pagination? }`

| Method | Path | Role | Description |
|--------|------|------|-------------|
| POST | /api/auth/login | Public | Login |
| POST | /api/auth/logout | Any | Logout |
| POST | /api/auth/refresh | Any | Refresh token |
| GET | /api/users/me | Any | Current user |
| GET | /api/productivity | Various | Get logs |
| POST | /api/productivity | Engineer | Submit log |
| PATCH | /api/productivity/:id/validate | Team Leader | Validate |
| PATCH | /api/productivity/:id/approve | Admin | Approve + attendance + stock |
| GET | /api/reports/pl | Admin | P&L report |
| GET | /api/attendance/csv | Admin | CSV download |

See full API documentation in the source code routes.

## Environment Variables

Copy `.env.example` to `.env` and fill in all values before running.
