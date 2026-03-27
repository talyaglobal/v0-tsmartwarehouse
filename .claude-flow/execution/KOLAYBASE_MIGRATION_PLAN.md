# 🔄 KOLAYBASE MIGRATION PLAN

## Supabase → Kolaybase Full Migration

**Date**: 2026-03-27T14:45:00Z  
**Status**: 🟡 **IN PROGRESS**  
**Priority**: P1 (High - Required for Production)

---

## 🎯 **CURRENT ISSUE: LOGIN FAILED**

### Error

```
TypeError: Failed to fetch
at supabase.auth.signInWithPassword()
```

### Root Cause

- ✅ DATABASE_URL updated to Kolaybase
- ❌ NEXT_PUBLIC_SUPABASE_URL still pointing to old Supabase instance
- ❌ Supabase auth client expecting Supabase API, not Kolaybase REST API
- ❌ Kolaybase uses Keycloak for auth, not Supabase Auth

---

## 📊 **MIGRATION SCOPE**

### What Needs Migration

| Component               | Current             | Target               | Status  |
| ----------------------- | ------------------- | -------------------- | ------- |
| **Database Connection** | Supabase PostgreSQL | Kolaybase PostgreSQL | ✅ DONE |
| **REST API**            | Supabase REST       | Kolaybase REST       | ⏳ TODO |
| **Authentication**      | Supabase Auth       | Keycloak             | ⏳ TODO |
| **Realtime**            | Supabase Realtime   | ?                    | ⏳ TODO |
| **Storage**             | Supabase Storage    | Firebase (existing)  | ✅ DONE |

---

## 🚀 **IMMEDIATE FIX: DUAL-MODE SUPPORT**

### Option A: Keep Supabase Auth, Use Kolaybase DB (Quick Fix)

**Rationale**: Kolaybase database compatible, but auth needs full Keycloak integration

**Changes**:

```bash
# .env.local
DATABASE_URL=postgresql://kb_user_warebnb:0Oug-vAw5PJIFUewk0wmyt6V4Djv7NPb@db.kolaybase.com:6432/kb_warebnb

# Keep Supabase Auth for now (working)
NEXT_PUBLIC_SUPABASE_URL=https://gyodzimmhtecocscyeip.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Add Kolaybase REST (for data access)
KOLAYBASE_REST_URL=https://api.kolaybase.com/rest/v1
KOLAYBASE_ANON_KEY=kb_anon_kOZsZwWuvL6oS55OLAVht3m6_Ept8m26qLOCUDFkG70
KOLAYBASE_SERVICE_KEY=kb_service_zhg_E3u8s3m605gv_OzQwohjQJEK7Kn9y5I4wNhp6cw
```

**Timeline**: 15 minutes (revert changes, restart server)

---

### Option B: Full Keycloak Integration (Proper Solution)

**Rationale**: Complete migration to Kolaybase ecosystem

**Required Changes**:

#### 1. Auth Client Replacement

- Replace `@supabase/ssr` with Keycloak OIDC client
- Implement Keycloak token flow
- Update all auth middleware

#### 2. Data Client Replacement

- Replace Supabase queries with Kolaybase REST API
- Update all `supabase.from()` calls
- Implement PostgREST query builder

#### 3. Session Management

- Store Keycloak JWT in cookies
- Implement token refresh
- Update auth middleware

**Timeline**: 2-3 days (significant refactoring)

---

## 💡 **RUFLO SWARM RECOMMENDATION**

### Immediate Action: **Option A** (Quick Fix)

**Why**:

- ✅ Login works immediately
- ✅ Database already on Kolaybase
- ✅ No code changes needed
- ✅ Can proceed with Phase 1B testing
- ✅ Keycloak migration can happen in parallel

**Implementation**:

```bash
# 1. Revert .env.local to use Supabase auth URLs
# 2. Keep DATABASE_URL pointing to Kolaybase
# 3. Restart dev server: npm run dev
# 4. Login should work
# 5. Database operations go to Kolaybase
```

### Later: **Option B** (Full Migration)

**When**: After Phase 1B complete and tested

**Agent Assignment**:

- `warebnb-architect` - Design Keycloak integration
- `warebnb-security` - Implement OIDC flow
- `warebnb-coder-1` - Replace auth client
- `warebnb-coder-2` - Replace data client
- `warebnb-tester` - Test auth flows

**Estimated Effort**: 2-3 days with 4 agents

---

## 📋 **DUAL-MODE CONFIGURATION**

### Recommended Interim Setup

```bash
# .env.local

# ==========================================
# DATABASE: Kolaybase (Production)
# ==========================================
DATABASE_URL=postgresql://kb_user_warebnb:0Oug-vAw5PJIFUewk0wmyt6V4Djv7NPb@db.kolaybase.com:6432/kb_warebnb

# ==========================================
# AUTH: Supabase (Temporary - Works)
# ==========================================
NEXT_PUBLIC_SUPABASE_URL=https://gyodzimmhtecocscyeip.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd5b2R6aW1taHRlY29jc2N5ZWlwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQzNDg0NTAsImV4cCI6MjA3OTkyNDQ1MH0.4DpwSeAjPA2QuB80EIajEm78pF_geDW9znPK9_FeQMU
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd5b2R6aW1taHRlY29jc2N5ZWlwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDM0ODQ1MCwiZXhwIjoyMDc5OTI0NDUwfQ.Aru8NnkoMRVnbzXh6nFV-uvroCHCdALlAcXb3hEFRZM

# ==========================================
# KOLAYBASE: REST API (Future Use)
# ==========================================
KOLAYBASE_REST_URL=https://api.kolaybase.com/rest/v1
KOLAYBASE_ANON_KEY=kb_anon_kOZsZwWuvL6oS55OLAVht3m6_Ept8m26qLOCUDFkG70
KOLAYBASE_SERVICE_KEY=kb_service_zhg_E3u8s3m605gv_OzQwohjQJEK7Kn9y5I4wNhp6cw

# ==========================================
# KEYCLOAK: Auth (Future Migration)
# ==========================================
KEYCLOAK_URL=https://auth.kolaybase.com
KEYCLOAK_REALM=kb-warebnb

# ... (rest of file unchanged)
```

### Architecture

```
┌─────────────────────────────────────────────┐
│           DUAL-MODE ARCHITECTURE            │
├─────────────────────────────────────────────┤
│                                             │
│  Frontend (Login)                           │
│       ↓                                     │
│  Supabase Auth Client ───→ Supabase Auth   │
│       ↓                     (JWT tokens)    │
│  Auth Session (JWT)                         │
│       ↓                                     │
│  API Routes                                 │
│       ↓                                     │
│  Prisma ORM ───────────→ Kolaybase DB      │
│                          (PostgreSQL)       │
└─────────────────────────────────────────────┘
```

**Benefits**:

- ✅ Login works immediately
- ✅ Database on Kolaybase (migration target)
- ✅ No breaking changes
- ✅ Time to plan Keycloak migration properly

---

## 🔄 **FULL KEYCLOAK MIGRATION PLAN** (Future)

### Phase 1: Research & Design (1 day)

- Study Keycloak OIDC flow
- Design token management
- Plan session storage
- Map user roles

### Phase 2: Auth Client (1 day)

- Create Keycloak auth client
- Implement login/logout
- Implement token refresh
- Update middleware

### Phase 3: Replace Supabase Client (1 day)

- Create Kolaybase data client (PostgREST)
- Update all `supabase.from()` calls
- Update RPC calls
- Test all queries

### Phase 4: Testing & Deployment (1 day)

- Test auth flows
- Test data operations
- Update documentation
- Deploy

**Total**: 4 days with dedicated agents

---

## 📝 **IMMEDIATE ACTION REQUIRED**

### Fix Login (15 minutes)

```bash
# Step 1: Revert .env.local to use Supabase auth
# (Keep DATABASE_URL pointing to Kolaybase)

# Step 2: Restart development server
npm run dev

# Step 3: Test login
# Should work with Supabase auth + Kolaybase database
```

---

## ✅ **RECOMMENDATION**

**Immediate**: Use **Option A** (Dual-Mode)  
**Reason**: Unblocks development, keeps progress on Phase 1B  
**Timeline**: 15 minutes

**Later**: Plan **Option B** (Full Keycloak) after Phase 1B complete  
**Reason**: Proper migration with dedicated time  
**Timeline**: 4 days

**Next Steps**:

1. Revert auth URLs in .env.local
2. Restart server
3. Test login
4. Continue Phase 1B (email notifications)

---

**Status**: ⏸️ **PAUSED - AWAITING ENV FIX**  
**Agent**: `warebnb-security` ready to implement Keycloak when approved
