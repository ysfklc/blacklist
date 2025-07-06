# Threat Intelligence Platform - Replit Project

## Overview
A comprehensive threat intelligence platform built with Express.js backend and React frontend. The application enables cybersecurity teams to manage threat indicators, data sources, and security analytics with role-based access control.

## Recent Changes
- **2025-01-06**: Successfully migrated from Replit Agent to Replit environment
- **2025-01-06**: Fixed database schema compatibility issue with dashboard stats API  
- **2025-01-06**: Set up PostgreSQL database with complete schema migration
- **2025-01-06**: Configured authentication system with admin user (username: admin, password: test123)
- **2025-01-06**: Optimized data processing performance with bulk database operations and whitelist checking
- **2025-01-06**: Increased batch sizes from 50-1000 to 1000-5000 for much faster threat intelligence processing
- **2025-01-06**: Added pause/resume controls for data sources to temporarily stop/start automatic fetching
- **2025-01-06**: Fixed bulk insert performance issues and improved data processing reliability
- **2025-01-06**: Enhanced indicators page source filter to display actual data sources from database
- **2025-01-06**: Updated source filter to show actual user names for manual entries instead of "manual entry"
- **2025-01-06**: Added Next Fetch time column to Data Sources page alongside Last Fetch timestamp

## Project Architecture

### Backend (Express.js)
- **Authentication**: JWT-based auth with role-based access control (admin, user, reporter)
- **Database**: PostgreSQL with Drizzle ORM for schema management
- **API Routes**: RESTful endpoints for users, data sources, indicators, audit logs
- **Security**: Password hashing with bcrypt, session management
- **Automation**: Scheduled data fetching from external threat intelligence sources

### Frontend (React + Vite)
- **UI Framework**: Tailwind CSS with custom components
- **State Management**: TanStack Query for server state
- **Routing**: Wouter for client-side routing
- **Components**: Custom UI components with shadcn/ui design system

### Database Schema
- **Users**: Authentication and role management
- **Data Sources**: External threat intelligence feeds
- **Indicators**: IP addresses, domains, hashes, URLs
- **Whitelist**: Excluded indicators
- **Audit Logs**: Security event tracking
- **Settings**: Application configuration

### Key Features
- Dashboard with real-time threat intelligence statistics
- Data source management with automated fetching
- Indicator management and search capabilities
- User management with LDAP integration support
- Audit logging for security compliance
- Public blacklist file generation

## User Preferences
*No specific user preferences recorded yet*

## Development Notes
- Uses Nix environment (no Docker/virtualization)
- Server binds to 0.0.0.0 for Replit compatibility
- Development server runs on port 5000
- Hot reloading enabled for both frontend and backend