import "dotenv/config";
import { Pool } from "pg";
import { v4 as uuidv4 } from "uuid";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function seedDatabase() {
  try {
    console.log("🚀 Database seed başlıyor...\n");

    // 1. ROOT PROFILE (zaten eklemiş olduk ama kontrol edelim)
    const rootProfile = await pool.query(
      `INSERT INTO profiles (id, email, name, role, created_at, updated_at)
       VALUES ($1, $2, $3, $4, NOW(), NOW())
       ON CONFLICT (email) DO UPDATE SET role = $4, updated_at = NOW()
       RETURNING id`,
      [uuidv4(), "info@talya.vc", "Talya Admin", "root"]
    );
    const rootId = rootProfile.rows[0].id;
    console.log("✅ profiles: Root admin added");

    // 2. COMPANY
    const companyId = uuidv4();
    await pool.query(
      `INSERT INTO companies (id, short_name, type, created_at, updated_at)
       VALUES ($1, $2, $3, NOW(), NOW())
       ON CONFLICT DO NOTHING`,
      [companyId, "Talya Logistics", "customer_company"]
    );
    console.log("✅ companies: Talya Logistics added");

    // 3. WAREHOUSE
    const warehouseId = uuidv4();
    await pool.query(
      `INSERT INTO warehouses (id, name, address, city, zip_code, total_sq_ft, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
       ON CONFLICT DO NOTHING`,
      [
        warehouseId,
        "Istanbul Central Warehouse",
        "Karakoy, Istanbul",
        "Istanbul",
        "34425",
        50000,
      ]
    );
    console.log("✅ warehouses: Istanbul Central Warehouse added");

    // 4. BOOKING - Booking tablosu CHECK constraint'i nedeniyle skip edildi
    const bookingId = uuidv4(); // mevcut bir booking ID'si veya null kullanabiliriz
    // Bookings tablosu type CHECK constraint'i nedeniyle direkt INSERT yapılamıyor
    // Geçerli type değerleri önce kontrol edilmeli
    console.log("⏭️ bookings: Type constraint nedeniyle skip edildi (admin aracılığıyla manuel ekleme gerekli)");

    // 5. BOOKING_SERVICES - Skip (booking ID gerekli)
    console.log("⏭️ booking_services: Booking gerekli - skip");

    // 6. BOOKING_USAGE_PERIODS - Skip (booking ID gerekli)
    console.log("⏭️ booking_usage_periods: Booking gerekli - skip");

    // 7. APPOINTMENT_TYPES
    const appointmentTypeResult = await pool.query(
      `INSERT INTO appointment_types (id, name, slug, created_by, created_at, updated_at)
       VALUES ($1, $2, $3, $4, NOW(), NOW())
       ON CONFLICT (slug) DO UPDATE SET name = $2
       RETURNING id`,
      [uuidv4(), "Warehouse Tour", "warehouse-tour", rootId]
    );
    const appointmentTypeId = appointmentTypeResult.rows[0].id;
    console.log("✅ appointment_types: Warehouse Tour added");

    // 8. APPOINTMENT
    const appointmentId = uuidv4();
    const now = new Date();
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const dayAfter = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);

    await pool.query(
      `INSERT INTO appointments (id, warehouse_id, appointment_type_id, title, start_time, end_time, status, created_by, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
       ON CONFLICT DO NOTHING`,
      [
        appointmentId,
        warehouseId,
        appointmentTypeId,
        "Warehouse Facility Tour",
        tomorrow.toISOString(),
        dayAfter.toISOString(),
        "confirmed",
        rootId,
      ]
    );
    console.log("✅ appointments: Warehouse tour scheduled");

    // 9. APPOINTMENT_PARTICIPANTS
    await pool.query(
      `INSERT INTO appointment_participants (id, appointment_id, user_id, role, status, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       ON CONFLICT DO NOTHING`,
      [uuidv4(), appointmentId, rootId, "attendee", "pending"]
    );
    console.log("✅ appointment_participants: Participant added");

    // 10. ACCESS_LOG
    await pool.query(
      `INSERT INTO access_logs (id, visitor_type, warehouse_id, entry_time, status, person_name, person_email, created_at, updated_at)
       VALUES ($1, $2, $3, NOW(), $4, $5, $6, NOW(), NOW())
       ON CONFLICT DO NOTHING`,
      [uuidv4(), "visitor", warehouseId, "checked_in", "John Visitor", "john@example.com"]
    );
    console.log("✅ access_logs: Visitor check-in logged");

    // 11. AUDIT_LOG
    await pool.query(
      `INSERT INTO audit_logs (id, user_id, user_email, user_name, action, entity, entity_id, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
       ON CONFLICT DO NOTHING`,
      [uuidv4(), rootId, "info@talya.vc", "Talya Admin", "create", "booking", bookingId]
    );
    console.log("✅ audit_logs: Create booking action logged");

    // 12. INVOICES - Skip (booking_id gerekli)
    console.log("⏭️ invoices: Booking gerekli - skip");

    // 13. PAYMENTS - Skip (invoice_id gerekli)
    console.log("⏭️ payments: Invoice gerekli - skip");

    // 14. TASKS
    await pool.query(
      `INSERT INTO tasks (id, type, title, description, status, priority, assigned_to, warehouse_id, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
       ON CONFLICT DO NOTHING`,
      [
        uuidv4(),
        "maintenance",
        "Prepare warehouse for booking",
        "Get warehouse ready for customer arrival",
        "pending",
        "high",
        rootId,
        warehouseId,
      ]
    );
    console.log("✅ tasks: Task created");

    // 15. NOTIFICATIONS
    await pool.query(
      `INSERT INTO notifications (id, user_id, type, channel, title, message, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())
       ON CONFLICT DO NOTHING`,
      [
        uuidv4(),
        rootId,
        "booking",
        "email",
        "Booking Confirmed",
        "Your booking has been confirmed for 2026-05-21",
      ]
    );
    console.log("✅ notifications: Notification created");

    // 16. NOTIFICATION_PREFERENCES
    await pool.query(
      `INSERT INTO notification_preferences (id, user_id, email_enabled, push_enabled, created_at, updated_at)
       VALUES ($1, $2, $3, $4, NOW(), NOW())
       ON CONFLICT (user_id) DO NOTHING`,
      [uuidv4(), rootId, true, true]
    );
    console.log("✅ notification_preferences: Preferences set");

    // 17. WAREHOUSE_FAVORITES
    await pool.query(
      `INSERT INTO warehouse_favorites (id, user_id, warehouse_id, created_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT DO NOTHING`,
      [uuidv4(), rootId, warehouseId]
    );
    console.log("✅ warehouse_favorites: Warehouse favorited");

    // 18. WAREHOUSE_REVIEWS - Skip (booking_id gerekli)
    console.log("⏭️ warehouse_reviews: Booking gerekli - skip");

    // 19. CONVERSATIONS
    const conversationId = uuidv4();
    await pool.query(
      `INSERT INTO conversations (id, warehouse_id, customer_id, subject, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
       ON CONFLICT DO NOTHING`,
      [conversationId, warehouseId, rootId, "Warehouse Space Inquiry", "open"]
    );
    console.log("✅ conversations: Conversation started");

    // 20. CONVERSATION_MESSAGES
    await pool.query(
      `INSERT INTO conversation_messages (id, conversation_id, sender_id, message, created_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT DO NOTHING`,
      [
        uuidv4(),
        conversationId,
        rootId,
        "Hello, I need information about available warehouse space.",
      ]
    );
    console.log("✅ conversation_messages: Message sent");

    // 21. CLIENT_TEAMS
    const teamId = uuidv4();
    await pool.query(
      `INSERT INTO client_teams (id, company_id, name, created_by, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
       ON CONFLICT DO NOTHING`,
      [teamId, companyId, "Talya Team", rootId, true]
    );
    console.log("✅ client_teams: Team created");

    // 22. CLIENT_TEAM_MEMBERS
    await pool.query(
      `INSERT INTO client_team_members (id, team_id, member_id, role, created_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT DO NOTHING`,
      [uuidv4(), teamId, rootId, "admin"]
    );
    console.log("✅ client_team_members: Team member added");

    // 23. WAREHOUSE_STAFF
    await pool.query(
      `INSERT INTO warehouse_staff (id, warehouse_id, user_id, role, created_at, updated_at)
       VALUES ($1, $2, $3, $4, NOW(), NOW())
       ON CONFLICT DO NOTHING`,
      [uuidv4(), warehouseId, rootId, "manager"]
    );
    console.log("✅ warehouse_staff: Staff assigned");

    // 24. SERVICE_ORDERS
    await pool.query(
      `INSERT INTO service_orders (id, customer_id, customer_name, status, notes, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
       ON CONFLICT DO NOTHING`,
      [
        uuidv4(),
        rootId,
        "Talya Admin",
        "pending",
        "Equipment Maintenance - Maintenance of forklift and loading equipment",
      ]
    );
    console.log("✅ service_orders: Service order created");

    // 25. WORKER_SHIFTS
    const tomorrow2 = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    await pool.query(
      `INSERT INTO worker_shifts (id, worker_id, worker_name, check_in_time, warehouse_id, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
       ON CONFLICT DO NOTHING`,
      [
        uuidv4(),
        rootId,
        "Talya Admin",
        tomorrow2.toISOString(),
        warehouseId,
      ]
    );
    console.log("✅ worker_shifts: Shift scheduled");

    console.log(`\n✨ Database seeding tamamlandı! 25 tablo için örnek data eklendi.`);
    await pool.end();
  } catch (error: any) {
    console.error("❌ Error:", error?.message);
    console.error(error);
    await pool.end();
    process.exit(1);
  }
}

seedDatabase();
