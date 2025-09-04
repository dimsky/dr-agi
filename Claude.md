# WeChat Medical Platform Project Structure

## Project Overview
A WeChat-based medical service platform built with Next.js 15 full-stack architecture, supporting both mini-program client and admin management.

## Tech Stack
- **Frontend**: Next.js 15 + TypeScript + App Router
- **UI Components**: Tailwind CSS + shadcn/ui
- **Database**: Drizzle ORM + Supabase
- **State Management**: TanStack React Query v5
- **Authentication**: JWT + WeChat Mini Program Login
- **Build Tools**: pnpm + Turbopack

## Root Directory Structure
```
dr-agi/
├── Claude.md                    # Project documentation (this file)
├── .claude/                     # Claude Code configuration
│   ├── agents/                  # Specialized agent configurations
│   ├── commands/                # Custom commands
│   ├── specs/                   # Project specifications
│   │   └── wechat-medical-platform/
│   │       ├── requirements.md  # Requirements document
│   │       ├── design.md        # Design document
│   │       └── tasks.md         # Task breakdown
│   └── templates/               # Document templates
└── admin-web/                   # Next.js full-stack application
```

## admin-web Application Structure

### Configuration Files
```
admin-web/
├── package.json                 # Dependencies and scripts
├── next.config.ts              # Next.js configuration
├── tsconfig.json               # TypeScript configuration
├── components.json             # shadcn/ui configuration
├── drizzle.config.ts           # Drizzle ORM configuration
├── migrate.ts                  # Database migration script
└── README.md                   # Project documentation
```

### Source Code Directory (src/)
```
src/
├── app/                        # Next.js App Router
│   ├── api/                    # API routes
│   │   ├── auth/               # Authentication APIs
│   │   │   ├── wechat/route.ts # WeChat login API
│   │   │   └── verify/route.ts # Token verification API
│   │   └── health/route.ts     # Health check API
│   ├── layout.tsx              # Root layout component
│   └── page.tsx                # Home page component
├── components/                 # React components
│   ├── client/                 # Client components
│   │   └── health-status.tsx   # Health status component
│   ├── providers/              # Context providers
│   │   └── query-provider.tsx  # React Query provider
│   └── ui/                     # shadcn/ui component library
│       ├── button.tsx
│       ├── dialog.tsx
│       ├── form.tsx
│       ├── input.tsx
│       ├── label.tsx
│       ├── table.tsx
│       └── index.ts
├── db/                         # Database related
│   ├── index.ts                # Database connection
│   ├── migrations/             # Database migration files
│   │   └── meta/               # Migration metadata
│   └── schema/                 # Data model definitions
│       ├── index.ts            # Export all models
│       ├── users.ts            # User model
│       ├── orders.ts           # Order model
│       ├── tasks.ts            # Task model
│       ├── feedback.ts         # Feedback model
│       └── service_configs.ts  # Service configuration model
├── hooks/                      # React Hooks
│   └── use-health-check.ts     # Health check hook
├── lib/                        # Utilities and configurations
│   ├── react-query.ts          # React Query configuration
│   ├── supabase.ts            # Supabase client
│   ├── utils.ts               # Common utilities
│   └── db-test.ts             # Database test utilities
└── types/                      # TypeScript type definitions
    └── auth.ts                 # Authentication types
```

## Implemented Feature Modules

### 1. Database Layer
- ✅ **User Model** (`users.ts`): WeChat user information storage
- ✅ **Order Model** (`orders.ts`): Medical service order management
- ✅ **Task Model** (`tasks.ts`): AI task execution tracking
- ✅ **Feedback Model** (`feedback.ts`): User feedback system
- ✅ **Service Config Model** (`service_configs.ts`): Medical service configuration
- ✅ **Database Migrations**: Complete migration scripts and metadata

### 2. Authentication System
- ✅ **WeChat Login API** (`/api/auth/wechat`): Handle WeChat mini-program login
- ✅ **Token Verification API** (`/api/auth/verify`): JWT token verification
- ✅ **Auth Type Definitions** (`auth.ts`): Complete TypeScript type support

### 3. Infrastructure
- ✅ **Next.js 15 Configuration**: App Router + Turbopack
- ✅ **Drizzle ORM Integration**: Type-safe data access
- ✅ **Supabase Connection**: Cloud database integration
- ✅ **React Query Configuration**: Client-side state management
- ✅ **shadcn/ui Components**: Unified UI design system

### 4. Development Tools
- ✅ **Health Check API** (`/api/health`): System status monitoring
- ✅ **Health Status Component**: Real-time system status display
- ✅ **Database Test Tools**: Connection and query testing

## Features Under Development

### WeChat Mini Program Client
- [ ] Mini program project initialization
- [ ] WeChat login component
- [ ] Service selection page
- [ ] Dynamic form component
- [ ] Order payment flow
- [ ] Task progress monitoring
- [ ] Result display page

### Medical Service Modules
- [ ] Dify AI workflow integration
- [ ] Seven medical service processors
- [ ] Task queue service
- [ ] File upload handling

### Admin Management Interface
- [ ] Order management page
- [ ] Task monitoring dashboard
- [ ] User management system
- [ ] Service configuration interface
- [ ] Data analytics dashboard

### Payment and Business Logic
- [ ] WeChat Pay integration
- [ ] Order status management
- [ ] Email notification service
- [ ] User feedback handling

## Project Highlights

### Architecture Advantages
1. **Type Safety**: Full-stack TypeScript + Drizzle ORM
2. **Modern**: Next.js 15 + App Router + Turbopack
3. **Scalable**: Component-based design + Clear directory structure
4. **High Performance**: Server Components + React Query caching

### Development Experience
1. **Fast Build**: Turbopack provides lightning-fast development
2. **Type Hints**: Complete TypeScript type definitions
3. **Component Reuse**: Standardized UI components with shadcn/ui
4. **Data Sync**: React Query automatic caching and synchronization

### Production Ready
1. **Database Migrations**: Versioned database schema management
2. **Error Handling**: Comprehensive API error handling mechanisms
3. **Secure Authentication**: JWT + Official WeChat authentication flow
4. **Monitoring Tools**: Built-in health checks and status monitoring

## Next Development Steps

1. **Complete WeChat Mini Program Development** (Tasks 13-21)
2. **Integrate Dify AI Workflows** (Tasks 22-24)
3. **Implement Medical Service Processors** (Tasks 25-31)
4. **Develop Admin Management Interface** (Tasks 32-40)
5. **Integrate Payment and Notification Services** (Tasks 41-50)

---

*Last Updated: 2025-09-01*
*Current Progress: Database and authentication system completed, Token verification API (Task 12) implemented*