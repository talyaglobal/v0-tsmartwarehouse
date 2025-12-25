# Role Rename Summary

**Date:** December 25, 2025  
**Task:** Rename user roles for better clarity

## Changes Made

### 1. System-Wide Roles (User Roles)

**Before:**
- `admin` - Full system access
- `customer` - Booking and claim management
- `worker` - Task and inventory management

**After:**
- `super_admin` - Full system access (renamed from `admin`)
- `customer` - Booking and claim management (unchanged)
- `worker` - Task and inventory management (unchanged)

### 2. Company-Level Roles

**Before:**
- `owner` - Company owner
- `admin` - Company administrator
- `member` - Regular member

**After:**
- `owner` - Company owner (unchanged)
- `company_admin` - Company administrator (renamed from `admin`)
- `member` - Regular member (unchanged)

## Files Updated

### Type Definitions
- ✅ `types/index.ts` - Updated UserRole type and User interface

### Authentication & Authorization
- ✅ `lib/auth/actions.ts` - Updated role validation and redirects
- ✅ `lib/auth/company-admin.ts` - Updated company role checks
- ✅ `middleware.ts` - Updated role-based routing
- ✅ `lib/supabase/middleware.ts` - Updated session handling

### API Routes
- ✅ `app/api/v1/users/route.ts` - Updated role filtering and mapping
- ✅ `app/api/v1/companies/[id]/route.ts` - Updated permission checks
- ✅ `app/api/v1/companies/[id]/members/route.ts` - Updated permission checks
- ✅ `app/api/v1/companies/[id]/members/[memberId]/route.ts` - Updated role mapping
- ✅ `app/api/v1/companies/[id]/invitations/route.ts` - Updated role mapping
- ✅ `app/api/v1/companies/[id]/invitations/[invitationId]/route.ts` - Updated permission checks
- ✅ `app/api/v1/claims/route.ts` - Updated permission checks
- ✅ `app/api/v1/claims/[id]/route.ts` - Updated permission checks
- ✅ `app/api/v1/payments/refunds/route.ts` - Updated permission checks

### UI Components & Pages
- ✅ `app/(auth)/register/page.tsx` - Updated role-based redirects
- ✅ `app/(auth)/login/page.tsx` - Updated role-based redirects
- ✅ `app/(auth)/admin-login/page.tsx` - Updated admin verification
- ✅ `app/(auth)/verify-email/page.tsx` - Updated role-based redirects
- ✅ `app/(dashboard)/dashboard/settings/page.tsx` - Updated company role mapping
- ✅ `app/(dashboard)/dashboard/team/page.tsx` - Updated role selection and display
- ✅ `app/(admin)/admin/customers/page.tsx` - Updated role type and display

### Mock Data
- ✅ `lib/mock-data.ts` - Updated admin user role

### Documentation
- ✅ `docs/DATABASE_SCHEMA.md` - Updated role descriptions
- ✅ `docs/ROLE_RENAME_SUMMARY.md` - Created this summary

### Database Migration
- ✅ `supabase/migrations/051_update_role_names.sql` - Created migration script

## Migration Steps

### For Development/Testing

1. **Update Code** (Already Done)
   - All code changes have been applied

2. **Run Database Migration**
   ```bash
   # Apply the migration to update existing roles in database
   npx supabase migration up
   ```

3. **Verify Changes**
   - Check that existing admin users are now super_admin
   - Check that company admins are now company_admin
   - Test login flows for all role types
   - Test permission checks in API routes

### For Production

1. **Backup Database**
   ```bash
   # Create a backup before running migration
   pg_dump -h <host> -U <user> -d <database> > backup_before_role_rename.sql
   ```

2. **Run Migration During Low-Traffic Period**
   ```bash
   # Apply migration
   npx supabase migration up
   ```

3. **Verify Migration**
   - Check migration logs
   - Verify role counts match expectations
   - Test critical user flows

4. **Monitor**
   - Watch for any authentication errors
   - Check logs for role-related issues
   - Verify RLS policies are working correctly

## Breaking Changes

⚠️ **Important:** This is a breaking change that affects:

1. **Authentication Flows**
   - Admin login now checks for `super_admin` role
   - Company admin checks now look for `company_admin` role

2. **API Endpoints**
   - Role-based filtering uses new role names
   - Permission checks use new role names

3. **Database Queries**
   - Any direct database queries checking for 'admin' role need updating

4. **External Integrations**
   - Any external systems checking user roles need updating

## Testing Checklist

- [ ] Super admin can access admin panel
- [ ] Super admin can manage all companies
- [ ] Company admin can manage their company team
- [ ] Company admin cannot access other companies
- [ ] Company owner has full company control
- [ ] Regular members have appropriate access
- [ ] Workers can access worker portal
- [ ] Customers can access dashboard
- [ ] Role-based redirects work correctly
- [ ] API permission checks work correctly
- [ ] Team invitation with roles works
- [ ] Team member role updates work

## Rollback Plan

If issues occur, you can rollback by:

1. **Revert Code Changes**
   ```bash
   git revert <commit-hash>
   ```

2. **Rollback Database**
   ```sql
   -- Revert role names
   UPDATE profiles SET role = 'admin' WHERE role = 'super_admin';
   UPDATE profiles SET role = 'admin' WHERE role = 'company_admin';
   ```

3. **Restore from Backup**
   ```bash
   psql -h <host> -U <user> -d <database> < backup_before_role_rename.sql
   ```

## Notes

- The migration script attempts to intelligently distinguish between system admins and company admins
- System admins are identified as those without a company_id or with @tsmart.com emails
- All other admins with a company_id are converted to company_admin
- The UI now displays "Company Admin" instead of "Admin" for company-level administrators
- All RLS policies should continue to work, but manual verification is recommended

## Support

If you encounter any issues:
1. Check the migration logs in the database
2. Verify user roles in the profiles table
3. Check application logs for authentication errors
4. Review RLS policies for role references

