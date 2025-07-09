# The BlackList Platform

A comprehensive blacklist platform built with Express.js backend and React frontend. The application enables cybersecurity teams to manage threat indicators, data sources, and security analytics with role-based access control.

## Features

- **Dashboard**: Real-time blacklist statistics and analytics
- **Data Sources**: Automated fetching from external blacklist feeds
- **Indicators Management**: IP addresses, domains, hashes, and URLs with search capabilities
- **User Management**: Role-based access control with LDAP integration support
- **Whitelist System**: Exclude indicators with CIDR subnet support
- **Audit Logging**: Security event tracking for compliance
- **Public Blacklist Files**: Automated generation of downloadable blacklist files
- **Multi-note System**: Collaborative notes on indicators with user attribution

## Technology Stack

### Backend
- **Express.js**: RESTful API server
- **PostgreSQL**: Database with Drizzle ORM
- **JWT Authentication**: Token-based authentication
- **LDAP Support**: Active Directory integration
- **Automated Scheduling**: Node-cron for periodic tasks

### Frontend
- **React + Vite**: Modern frontend framework
- **Tailwind CSS**: Utility-first CSS framework
- **TanStack Query**: Server state management
- **Wouter**: Lightweight client-side routing
- **shadcn/ui**: Component library

## Prerequisites

- Node.js (v18 or higher)
- PostgreSQL (v12 or higher)
- npm or yarn package manager

## Installation & Setup

### 1. Clone the Repository

```bash
git clone <repository-url>
cd blacklist
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Database Setup

#### Option A: Using PostgreSQL locally

1. Install PostgreSQL on your system
2. Create a database for the project:
   ```sql
   CREATE DATABASE blacklist_db;
   ```

3. Set environment variables:
   ```bash
   export DATABASE_URL="postgresql://username:password@localhost:5432/blacklist_db"
   export PGHOST="localhost"
   export PGPORT="5432"
   export PGUSER="your_username"
   export PGPASSWORD="your_password"
   export PGDATABASE="blacklist_db"
   ```

#### Option B: Using Docker for PostgreSQL

```bash
docker run --name blacklist_db_con \
  -e POSTGRES_DB=blacklist_db \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=password \
  -p 5432:5432 

export DATABASE_URL="postgresql://postgres:password@localhost:5432/blacklist_db"
```

### 4. Database Migration

Run the database schema migration:

```bash
npm run db:push
```

### 5. Environment Variables

Create a `.env` file in the root directory (optional, for additional configuration):

```env
# Database (if not set via system environment)
DATABASE_URL=postgresql://username:password@localhost:5432/blacklist_db

# JWT Secret (optional, defaults to generated secret)
JWT_SECRET=your-jwt-secret-key

# Server Configuration
PORT=8082
NODE_ENV=development
```

## Running the Application

### Development Mode

Start the development server (both backend and frontend):

```bash
npm run dev
```

This will start:
- Backend API server on `http://localhost:8082`
- Frontend development server with hot reload
- Database initialization with default admin user

### Production Mode

1. Build the frontend:
   ```bash
   npm run build
   ```

2. Start the production server:
   ```bash
   npm start
   ```

## Default Credentials

After first setup, you can log in with:
- **Username**: `admin`
- **Password**: `test123`

⚠️ **Important**: Change the default password immediately after first login!

## Database Commands

```bash
# Push schema changes to database
npm run db:push

# Generate database migrations (if needed)
npm run db:generate

# View database with Drizzle Studio
npm run db:studio
```

## Project Structure

```
├── client/                 # React frontend
│   ├── src/
│   │   ├── components/     # Reusable UI components
│   │   ├── pages/         # Page components
│   │   ├── hooks/         # Custom React hooks
│   │   └── lib/           # Utility functions
├── server/                 # Express.js backend
│   ├── routes.ts          # API endpoints
│   ├── storage.ts         # Database operations
│   ├── auth.ts            # Authentication middleware
│   ├── ldap.ts            # LDAP integration
│   └── fetcher.ts         # Data source fetching
├── shared/                 # Shared types and schemas
│   └── schema.ts          # Database schema definitions
└── public/                 # Static files and blacklist outputs
    └── blacklist/         # Generated blacklist files
```

## Configuration

### LDAP/Active Directory Setup

1. Navigate to Settings page in the application
2. Configure LDAP settings:
   - Server URL (e.g., `ldap://your-domain.com:389`)
   - Base DN (e.g., `dc=company,dc=com`)
   - Bind DN (e.g., `cn=admin,dc=company,dc=com`)
   - Bind Password
3. Test connection before saving
4. Enable LDAP authentication

### Data Sources

Add external blacklist feeds:
1. Go to Data Sources page
2. Add new data source with URL and fetch interval
3. Configure indicator types (IP, Domain, Hash, URL)
4. Enable automatic fetching

### Proxy Configuration

For corporate environments:
1. Navigate to Settings → Proxy Configuration
2. Enable proxy and configure host, port, credentials
3. All external data fetching will use proxy settings

## API Endpoints

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout

### Users
- `GET /api/users` - List all users
- `POST /api/users` - Create new user
- `PUT /api/users/:id` - Update user
- `DELETE /api/users/:id` - Delete user

### Data Sources
- `GET /api/data-sources` - List data sources
- `POST /api/data-sources` - Create data source
- `PUT /api/data-sources/:id` - Update data source
- `DELETE /api/data-sources/:id` - Delete data source

### Indicators
- `GET /api/indicators` - List indicators (with pagination and filters)
- `POST /api/indicators` - Create indicator
- `PUT /api/indicators/:id` - Update indicator
- `DELETE /api/indicators/:id` - Delete indicator

### LDAP
- `GET /api/ldap/search` - Search LDAP directory
- `POST /api/ldap/test` - Test LDAP connection

### Logs

Application logs are available in the console output. For production, consider implementing proper logging with levels and file output.