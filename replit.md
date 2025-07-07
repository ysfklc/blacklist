# Threat Intelligence Platform - Replit Project

## Overview
A comprehensive threat intelligence platform built with Express.js backend and React frontend. The application enables cybersecurity teams to manage threat indicators, data sources, and security analytics with role-based access control.

## Recent Changes
- **2025-07-07**: Made LDAP option conditional in Create/Edit User forms
  - LDAP authentication type appears disabled and unselectable when LDAP is not active
  - Visual indicator shows "(Disabled)" when LDAP is turned off in settings
- **2025-07-07**: Added "Trust All Certificates" checkbox to LDAP/Active Directory Configuration
  - Allows LDAP connections to ignore SSL/TLS certificate errors when enabled
  - Useful for self-signed certificates or internal CA certificates
- **2025-07-07**: Implemented role-based access controls for Audit Logs section
  - User role: Cannot access Audit Logs section (removed from sidebar and API access)
  - Admin role: Full access to Audit Logs as before
- **2025-07-07**: Implemented role-based access controls for Recent Activity section
  - Reporter role: Cannot see Recent Activity tab at all
  - User role: Only sees fetch and blocked activities in Recent Activity
  - Admin role: Sees all activities as before
- **2025-07-07**: Enhanced Users page with table format including search and role filtering
- **2025-07-07**: Fixed API endpoints to return firstName, lastName, and email fields for users
- **2025-07-07**: Added green background color for Active status badges
- **2025-07-07**: Made "Max Indicators per File" setting dynamic - blacklist files now update automatically when this value is changed
- **2025-07-07**: Changed blacklist update interval from minutes to seconds in settings page with configurable scheduler
- **2025-07-07**: Fixed blacklist download links to include proper /public/ path prefix
- **2025-07-07**: Successfully migrated from Replit Agent to Replit environment
- **2025-07-06**: Fixed database schema compatibility issue with dashboard stats API  
- **2025-07-06**: Set up PostgreSQL database with complete schema migration
- **2025-07-06**: Configured authentication system with admin user (username: admin, password: test123)
- **2025-07-06**: Added public blacklist file download functionality with clickable links for IP, Domain, Hash, and URL files
- **2025-07-06**: Implemented API endpoint `/api/public-links/files` to list available blacklist files by type
- **2025-07-06**: Enhanced Public Links page with individual file download links instead of directory browsing
- **2025-07-06**: Updated dashboard icon to custom user-provided image with proper white theming for sidebar
- **2025-01-06**: Optimized data processing performance with bulk database operations and whitelist checking
- **2025-01-06**: Increased batch sizes from 50-1000 to 1000-5000 for much faster threat intelligence processing
- **2025-01-06**: Added pause/resume controls for data sources to temporarily stop/start automatic fetching
- **2025-01-06**: Fixed bulk insert performance issues and improved data processing reliability
- **2025-01-06**: Enhanced indicators page source filter to display actual data sources from database
- **2025-01-06**: Updated source filter to show actual user names for manual entries instead of "manual entry"
- **2025-01-06**: Added Next Fetch time column to Data Sources page alongside Last Fetch timestamp
- **2025-01-06**: Implemented proper upsert logic for indicators to prevent duplicates and update timestamps
- **2025-01-06**: Added duplicate cleanup functionality to maintain data integrity
- **2025-01-06**: Modified bulk processing to use smaller batches for better performance and reliability
- **2025-01-06**: Fixed data fetching issues with retry mechanism and improved connection handling
- **2025-01-06**: Implemented synchronous processing to ensure all indicators are saved before completion
- **2025-01-06**: Added exponential backoff and better error handling for network timeouts
- **2025-01-06**: Implemented multi-note system for indicators with user attribution and edit tracking
- **2025-01-06**: Added indicator details modal with notes management functionality
- **2025-01-06**: Fixed data source form to have no pre-selected indicator type by default
- **2025-01-06**: Optimized database performance by removing unnecessary updated_at timestamp updates during bulk re-fetching operations
- **2025-01-06**: Fixed Recent Activity section overflow issue with proper height constraints and scrolling
- **2025-01-06**: Updated note-taking system to integrate legacy notes with modern note functionality
- **2025-01-06**: Implemented debounced search in Indicators section to eliminate flickering and improve performance
- **2025-01-06**: Added notification badges to show notes count for each indicator in the table
- **2025-01-06**: Fixed notes count badge calculation by ensuring proper integer type conversion from database queries
- **2025-01-06**: Repositioned notification badge to appear on top of the MessageSquare icon for better visual design
- **2025-01-06**: Implemented CIDR subnet checking for IP whitelist entries (supports /24, /16, etc.)
- **2025-01-06**: Enhanced whitelist functionality to automatically deactivate blacklist indicators when whitelist entries are added
- **2025-01-06**: Added whitelist blocks tracking system to record when indicators from feeds are blocked by existing whitelist entries
- **2025-01-06**: Implemented "Recent Whitelist Blocks" section showing indicators that were attempted to be added to blacklist but blocked by whitelist
- **2025-01-06**: Added multi-select functionality to Indicators tab with checkboxes, select-all, and bulk operations (activate, deactivate, delete)
- **2025-01-06**: Enhanced pagination with configurable page size options (25, 50, 100, 250, 500 items per page)
- **2025-01-06**: Added comprehensive pagination controls with First, Previous, page numbers, Next, and Last buttons with ellipsis for large datasets
- **2025-01-06**: Added multi-select functionality to Whitelist table with checkboxes, select-all, and bulk delete operations

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