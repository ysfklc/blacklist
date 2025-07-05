# ThreatIntel Platform

## Overview

ThreatIntel Platform is a full-stack web application designed to fetch, parse, and manage cybersecurity threat intelligence data. The system automatically collects threat indicators (IPs, domains, hashes, URLs) from configurable remote sources and provides a management interface for administrators to monitor and control the data collection process.

## System Architecture

The application follows a modern full-stack architecture with clear separation between frontend, backend, and data layers:

**Frontend Architecture:**
- React-based single-page application with TypeScript
- Vite for build tooling and development server
- Tailwind CSS for styling with shadcn/ui component library
- TanStack Query for state management and API communication
- Wouter for client-side routing

**Backend Architecture:**
- Node.js with Express server
- RESTful API design with JWT-based authentication
- PostgreSQL database with Drizzle ORM
- Cron-based scheduler for automated data fetching
- File-based blacklist generation system

**Database Design:**
- PostgreSQL database using Neon serverless connection
- Drizzle ORM for type-safe database operations
- Schema includes users, data sources, indicators, whitelist, audit logs, and settings tables

## Key Components

### Authentication & Authorization
- **Local Authentication**: Username/password with bcrypt hashing
- **Role-based Access Control**: Admin, User, and Reporter roles
- **JWT Token Management**: Secure token-based session handling
- **Protected Routes**: Frontend route protection based on user roles

### Data Collection System
- **Configurable Data Sources**: Admin-defined URLs with specific indicator types
- **Automated Fetching**: Cron-scheduled data collection based on configurable intervals
- **Regex-based Parsing**: Automatic extraction of IPs, domains, hashes, and URLs
- **Duplicate Detection**: Smart handling of existing indicators with timestamp updates

### Data Management
- **Indicator Management**: CRUD operations for threat indicators
- **Whitelist System**: Exclusion mechanism for false positives
- **Source Tracking**: Metadata preservation for audit trails
- **Status Monitoring**: Real-time tracking of data source health

### Blacklist Generation
- **File Export System**: Automated generation of consumable blacklist files
- **Multiple Formats**: Support for different indicator types in separate files
- **Pagination Support**: Large datasets split into manageable chunks
- **Public Access**: Generated files served via public endpoints

## Data Flow

1. **Configuration**: Administrators configure data sources via the web interface
2. **Scheduled Fetching**: Cron jobs trigger data collection based on defined intervals
3. **Data Processing**: Raw data is parsed using regex patterns to extract indicators
4. **Storage**: Valid indicators are stored in PostgreSQL with metadata
5. **Whitelist Filtering**: Indicators checked against whitelist before activation
6. **Blacklist Generation**: Active indicators exported to consumable file formats
7. **API Access**: Frontend and external systems access data via REST API

## External Dependencies

**Runtime Dependencies:**
- **@neondatabase/serverless**: PostgreSQL database connectivity
- **drizzle-orm**: Type-safe database ORM
- **express**: Web server framework
- **bcrypt**: Password hashing
- **jsonwebtoken**: JWT token management
- **node-cron**: Task scheduling
- **@tanstack/react-query**: Frontend state management
- **@radix-ui**: UI component primitives

**Development Dependencies:**
- **vite**: Frontend build tool
- **typescript**: Type safety
- **tailwindcss**: CSS framework
- **drizzle-kit**: Database migration tool

## Deployment Strategy

The application is designed for Replit deployment with the following characteristics:

**Build Process:**
- Frontend built with Vite to `/dist/public`
- Backend bundled with esbuild to `/dist/index.js`
- Single artifact deployment

**Environment Configuration:**
- `DATABASE_URL`: PostgreSQL connection string (required)
- `JWT_SECRET`: JWT signing key (defaults to development key)
- `NODE_ENV`: Environment flag (development/production)

**Database Setup:**
- Automatic schema migration via Drizzle
- Default admin user creation (username: admin, password: test123)
- Public directory structure initialization

**Runtime Considerations:**
- WebSocket support for Neon database connections
- Static file serving for generated blacklists
- Graceful error handling and logging

## Changelog

```
Changelog:
- July 05, 2025. Initial setup
```

## User Preferences

```
Preferred communication style: Simple, everyday language.
```