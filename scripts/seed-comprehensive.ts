/**
 * Comprehensive seed script for WarebnB / TSmart Warehouse
 * - Cleans up duplicate/irrelevant data
 * - Adds exactly 1 relevant sample per table
 * - Idempotent: safe to run multiple times
 */
import "dotenv/config";
import { Pool } from "pg";
import { v4 as uuidv4 } from "uuid";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function q(sql: string, params: any[] = []) {
  return pool.query(sql, params);
}

async function count(table: string): Promise<number> {
  const r = await q(`SELECT COUNT(*) FROM ${table}`);
  return Number(r.rows[0].count);
}

async function main() {
  console.log("🚀 Comprehensive seed başlıyor...\n");

  // ─── STEP 1: Clean up duplicates ─────────────────────────────────────────
  console.log("🧹 Temizlik yapılıyor...");

  await q(`DELETE FROM companies WHERE short_name = 'Talya Logistics' AND id != (SELECT id FROM companies WHERE short_name = 'Talya Logistics' ORDER BY created_at LIMIT 1)`);

  for (const [table, _dependency] of [
    ["access_logs", null], ["audit_logs", null], ["tasks", null],
    ["notifications", null], ["appointment_participants", "appointment_id"],
  ] as [string, string | null][]) {
    const c = await count(table);
    if (c > 1) {
      await q(`DELETE FROM ${table} WHERE id != (SELECT id FROM ${table} ORDER BY created_at LIMIT 1)`);
    }
  }

  const apptCount = await count("appointments");
  if (apptCount > 1) {
    await q(`DELETE FROM appointment_participants WHERE appointment_id != (SELECT id FROM appointments ORDER BY created_at LIMIT 1)`);
    await q(`DELETE FROM appointments WHERE id != (SELECT id FROM appointments ORDER BY created_at LIMIT 1)`);
  }

  const convCount = await count("conversations");
  if (convCount > 1) {
    await q(`DELETE FROM conversation_messages WHERE conversation_id != (SELECT id FROM conversations ORDER BY created_at LIMIT 1)`);
    await q(`DELETE FROM conversations WHERE id != (SELECT id FROM conversations ORDER BY created_at LIMIT 1)`);
  }

  // Remove duplicate warehouse_favorites
  await q(`DELETE FROM warehouse_favorites a USING warehouse_favorites b WHERE a.created_at < b.created_at AND a.user_id = b.user_id AND a.warehouse_id = b.warehouse_id`);

  console.log("  ✅ Temizlik tamamlandı\n");

  // ─── STEP 2: Gather existing key IDs ─────────────────────────────────────
  const rootUser = (await q("SELECT id FROM profiles WHERE email = 'info@talya.vc' LIMIT 1")).rows[0];
  if (!rootUser) throw new Error("Root user bulunamadı! Önce add-root-user scriptini çalıştırın.");
  const rootId = rootUser.id;

  const companyRow = (await q("SELECT id FROM companies WHERE short_name = 'Talya Logistics' LIMIT 1")).rows[0];
  const companyId = companyRow?.id || uuidv4();

  const warehouseRow = (await q("SELECT id FROM warehouses LIMIT 1")).rows[0];
  const warehouseId = warehouseRow?.id || uuidv4();

  console.log(`Root:      ${rootId}`);
  console.log(`Company:   ${companyId}`);
  console.log(`Warehouse: ${warehouseId}\n`);

  const now = new Date();
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  // ─── 1. WAREHOUSE_STAFF ───────────────────────────────────────────────────
  if (await count("warehouse_staff") === 0) {
    await q(`INSERT INTO warehouse_staff (id, warehouse_id, user_id, role, created_at) VALUES ($1,$2,$3,$4,NOW())`,
      [uuidv4(), warehouseId, rootId, "manager"]);
    console.log("✅ warehouse_staff: Depo müdürü atandı");
  } else console.log("⏭️  warehouse_staff");

  // ─── 2. WAREHOUSE_FLOORS ─────────────────────────────────────────────────
  let floorId: string;
  const floorRow = (await q("SELECT id FROM warehouse_floors WHERE warehouse_id=$1 LIMIT 1", [warehouseId])).rows[0];
  if (!floorRow) {
    floorId = uuidv4();
    await q(`INSERT INTO warehouse_floors (id, warehouse_id, floor_number, name, total_sq_ft, created_at, updated_at) VALUES ($1,$2,$3,$4,$5,NOW(),NOW())`,
      [floorId, warehouseId, 3, "Zemin Kat (Kat 3)", 15000]);
    console.log("✅ warehouse_floors: Zemin kat eklendi");
  } else {
    floorId = floorRow.id;
    console.log("⏭️  warehouse_floors");
  }

  // ─── 3. WAREHOUSE_HALLS ──────────────────────────────────────────────────
  let hallId: string;
  const hallRow = (await q("SELECT id FROM warehouse_halls WHERE floor_id=$1 LIMIT 1", [floorId])).rows[0];
  if (!hallRow) {
    hallId = uuidv4();
    await q(`INSERT INTO warehouse_halls (id, floor_id, hall_name, sq_ft, available_sq_ft, occupied_sq_ft, created_at, updated_at) VALUES ($1,$2,$3,$4,$5,$6,NOW(),NOW())`,
      [hallId, floorId, "A", 5000, 4800, 200]);
    console.log("✅ warehouse_halls: A Koridoru eklendi");
  } else {
    hallId = hallRow.id;
    console.log("⏭️  warehouse_halls");
  }

  // ─── 4. WAREHOUSE_ZONES ──────────────────────────────────────────────────
  let zoneId: string;
  const zoneRow = (await q("SELECT id FROM warehouse_zones WHERE hall_id=$1 LIMIT 1", [hallId])).rows[0];
  if (!zoneRow) {
    zoneId = uuidv4();
    await q(`INSERT INTO warehouse_zones (id, hall_id, name, type, total_slots, available_slots, total_sq_ft, available_sq_ft, created_at, updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW(),NOW())`,
      [zoneId, hallId, "A-001", "pallet", 50, 38, 2500, 1900]);
    console.log("✅ warehouse_zones: A-001 depolama zonu eklendi");
  } else {
    zoneId = zoneRow.id;
    console.log("⏭️  warehouse_zones");
  }

  // ─── 5. WAREHOUSE_REGIONS ────────────────────────────────────────────────
  if (await count("warehouse_regions") === 0) {
    await q(`INSERT INTO warehouse_regions (id, floor_id, name, description, created_at, updated_at) VALUES ($1,$2,$3,$4,NOW(),NOW())`,
      [uuidv4(), floorId, "A Bölgesi - Kuru Depo", "Standart kuru depolama alanı, oda sıcaklığı 15-25°C"]);
    console.log("✅ warehouse_regions: Kuru depo bölgesi tanımlandı");
  } else console.log("⏭️  warehouse_regions");

  // ─── 6. WAREHOUSE_PRICING ────────────────────────────────────────────────
  if (await count("warehouse_pricing") === 0) {
    await q(`INSERT INTO warehouse_pricing (id, warehouse_id, pricing_type, base_price, unit, created_at, updated_at) VALUES ($1,$2,$3,$4,$5,NOW(),NOW())`,
      [uuidv4(), warehouseId, "pallet", 150.00, "per_month"]);
    console.log("✅ warehouse_pricing: Palet fiyatlandırması ₺150/ay");
  } else console.log("⏭️  warehouse_pricing");

  // ─── 7. WAREHOUSE_PALLET_PRICING ─────────────────────────────────────────
  if (await count("warehouse_pallet_pricing") === 0) {
    await q(`INSERT INTO warehouse_pallet_pricing (id, warehouse_id, pallet_type, pricing_period, status, created_at, updated_at) VALUES ($1,$2,$3,$4,$5,NOW(),NOW())`,
      [uuidv4(), warehouseId, "euro", "month", true]);
    console.log("✅ warehouse_pallet_pricing: EUR palet aylık fiyatlandırması");
  } else console.log("⏭️  warehouse_pallet_pricing");

  // ─── 8. BOOKING ──────────────────────────────────────────────────────────
  let bookingId: string;
  const bookingRow = (await q("SELECT id FROM bookings LIMIT 1")).rows[0];
  if (!bookingRow) {
    bookingId = uuidv4();
    await q(`INSERT INTO bookings (id, customer_id, customer_name, customer_email, warehouse_id, type, status, start_date, end_date, total_amount, pallet_count, floor_number, hall_id, created_at, updated_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,NOW(),NOW())`,
      [bookingId, rootId, "Talya Admin", "info@talya.vc", warehouseId, "pallet", "confirmed",
       tomorrow.toISOString().split("T")[0], nextWeek.toISOString().split("T")[0],
       1800.00, 12, 3, hallId]);
    console.log("✅ bookings: 12 palet rezervasyon oluşturuldu");
  } else {
    bookingId = bookingRow.id;
    console.log("⏭️  bookings");
  }

  // ─── 9. INVENTORY_ITEMS ──────────────────────────────────────────────────
  if (await count("inventory_items") === 0) {
    await q(`INSERT INTO inventory_items (id, booking_id, customer_id, warehouse_id, floor_id, hall_id, zone_id, pallet_id, description, item_type, weight_kg, status, stored_at, created_at, updated_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,NOW(),NOW(),NOW())`,
      [uuidv4(), bookingId, rootId, warehouseId, floorId, hallId, zoneId, "PLT-2026-001",
       "Elektronik ekipman - laptop kasaları", "electronics", 250.5, "in_storage"]);
    console.log("✅ inventory_items: PLT-2026-001 envantere eklendi");
  } else console.log("⏭️  inventory_items");

  // ─── 10. INVOICE ─────────────────────────────────────────────────────────
  let invoiceId: string;
  const invoiceRow = (await q("SELECT id FROM invoices LIMIT 1")).rows[0];
  if (!invoiceRow) {
    invoiceId = uuidv4();
    await q(`INSERT INTO invoices (id, booking_id, customer_id, customer_name, status, items, subtotal, tax, total, due_date, created_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NOW())`,
      [invoiceId, bookingId, rootId, "Talya Admin", "pending",
       JSON.stringify([{description: "Palet depolama (12 palet x 1 ay)", qty: 12, unit_price: 150, total: 1800}]),
       1800.00, 324.00, 2124.00, nextWeek.toISOString().split("T")[0]]);
    console.log("✅ invoices: ₺2,124 fatura oluşturuldu");
  } else {
    invoiceId = invoiceRow.id;
    console.log("⏭️  invoices");
  }

  // ─── 11. PAYMENT ─────────────────────────────────────────────────────────
  if (await count("payments") === 0) {
    await q(`INSERT INTO payments (id, invoice_id, customer_id, amount, currency, status, payment_method, created_at, updated_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,NOW(),NOW())`,
      [uuidv4(), invoiceId, rootId, 2124.00, "TRY", "completed", "bank_transfer"]);
    console.log("✅ payments: ₺2,124 ödeme kaydedildi");
  } else console.log("⏭️  payments");

  // ─── 12. WAREHOUSE_REVIEW ────────────────────────────────────────────────
  if (await count("warehouse_reviews") === 0) {
    await q(`INSERT INTO warehouse_reviews (id, warehouse_id, booking_id, user_id, rating, title, comment, created_at, updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,NOW(),NOW())`,
      [uuidv4(), warehouseId, bookingId, rootId, 5, "Mükemmel depolama hizmeti",
       "Depo temiz ve güvenli, personel çok yardımsever. Kesinlikle tavsiye ederim."]);
    console.log("✅ warehouse_reviews: 5 yıldız değerlendirme eklendi");
  } else console.log("⏭️  warehouse_reviews");

  // ─── 13. SHIPMENT ────────────────────────────────────────────────────────
  if (await count("shipments") === 0) {
    await q(`INSERT INTO shipments (id, booking_id, tracking_number, carrier, status, created_at, updated_at) VALUES ($1,$2,$3,$4,$5,NOW(),NOW())`,
      [uuidv4(), bookingId, "TRK-2026-001234", "MNG Kargo", "in_transit"]);
    console.log("✅ shipments: TRK-2026-001234 sevkiyat eklendi");
  } else console.log("⏭️  shipments");

  // ─── 14. INCIDENTS ───────────────────────────────────────────────────────
  if (await count("incidents") === 0) {
    await q(`INSERT INTO incidents (id, type, title, description, severity, status, reported_by, reported_by_name, warehouse_id, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW())`,
      [uuidv4(), "maintenance", "Yükleme rampası bakım gereksinimi",
       "3 numaralı yükleme rampasında hafif hasar tespit edildi, bakım planlanmalı.",
       "low", "open", rootId, "Talya Admin", warehouseId]);
    console.log("✅ incidents: Rampa bakım olayı kaydedildi");
  } else console.log("⏭️  incidents");

  // ─── 15. CLAIMS ──────────────────────────────────────────────────────────
  if (await count("claims") === 0) {
    await q(`INSERT INTO claims (id, customer_id, customer_name, booking_id, type, description, amount, status, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW())`,
      [uuidv4(), rootId, "Talya Admin", bookingId, "damage",
       "Depolama sırasında 1 paket ürün hafifçe hasarlandı.", 500.00, "submitted"]);
    console.log("✅ claims: Hasar tazminat talebi oluşturuldu");
  } else console.log("⏭️  claims");

  // ─── 16. ESTIMATES ───────────────────────────────────────────────────────
  if (await count("estimates") === 0) {
    await q(`INSERT INTO estimates (id, customer_id, warehouse_id, status, items, subtotal, tax, total, valid_until, notes, created_at, updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NOW(),NOW())`,
      [uuidv4(), rootId, warehouseId, "draft",
       JSON.stringify([{description: "Palet depolama (20 palet x 1 ay)", qty: 20, unit_price: 150, total: 3000}]),
       3000.00, 540.00, 3540.00, nextWeek.toISOString().split("T")[0],
       "20 palet aylık depolama teklifi"]);
    console.log("✅ estimates: 20 palet depolama teklifi hazırlandı");
  } else console.log("⏭️  estimates");

  // ─── 17. SERVICE_ORDERS + ITEMS ──────────────────────────────────────────
  let soId: string;
  const soRow = (await q("SELECT id FROM service_orders LIMIT 1")).rows[0];
  if (!soRow) {
    soId = uuidv4();
    await q(`INSERT INTO service_orders (id, customer_id, customer_name, status, priority, notes, total_amount, created_at, updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,NOW(),NOW())`,
      [soId, rootId, "Talya Admin", "pending", "normal", "Forklift periyodik bakım ve paket sarma makinesi servisi", 800.00]);
    console.log("✅ service_orders: Forklift bakım emri oluşturuldu");

    if (await count("service_order_items") === 0) {
      const wsRow2 = (await q("SELECT id FROM warehouse_services LIMIT 1")).rows[0];
      const serviceId = wsRow2?.id || uuidv4();
      await q(`INSERT INTO service_order_items (id, order_id, service_id, service_name, quantity, unit_price, total_price, status, created_at, updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW(),NOW())`,
        [uuidv4(), soId, serviceId, "Forklift periyodik bakım", 1, 800.00, 800.00, "pending"]);
      console.log("✅ service_order_items: Bakım kalemi eklendi");
    }
  } else {
    soId = soRow.id;
    console.log("⏭️  service_orders");
  }

  // ─── 18. WORKER_SHIFTS ───────────────────────────────────────────────────
  if (await count("worker_shifts") === 0) {
    await q(`INSERT INTO worker_shifts (id, worker_id, worker_name, check_in_time, warehouse_id, created_at, updated_at) VALUES ($1,$2,$3,$4,$5,NOW(),NOW())`,
      [uuidv4(), rootId, "Talya Admin", now.toISOString(), warehouseId]);
    console.log("✅ worker_shifts: Bugünkü vardiya kaydedildi");
  } else console.log("⏭️  worker_shifts");

  // ─── 19. CRM_CONTACTS ────────────────────────────────────────────────────
  let crmContactId: string;
  const crmRow = (await q("SELECT id FROM crm_contacts LIMIT 1")).rows[0];
  if (!crmRow) {
    crmContactId = uuidv4();
    await q(`INSERT INTO crm_contacts (id, company_id, first_name, last_name, full_name, email, phone, created_at, updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,NOW(),NOW())`,
      [crmContactId, companyId, "Ahmet", "Yılmaz", "Ahmet Yılmaz", "ahmet.yilmaz@talya.vc", "+905551234567"]);
    console.log("✅ crm_contacts: Ahmet Yılmaz potansiyel müşteri eklendi");
  } else {
    crmContactId = crmRow.id;
    console.log("⏭️  crm_contacts");
  }

  // ─── 20. CRM_ACTIVITIES ──────────────────────────────────────────────────
  if (await count("crm_activities") === 0) {
    await q(`INSERT INTO crm_activities (id, company_id, contact_id, type, subject, description, status, created_by, created_at, updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW(),NOW())`,
      [uuidv4(), companyId, crmContactId, "call", "İlk müşteri görüşmesi",
       "Depolama ihtiyaçları görüşüldü, aylık 20 palet kapasitesi talep edildi.", "completed", rootId]);
    console.log("✅ crm_activities: Müşteri görüşme aktivitesi eklendi");
  } else console.log("⏭️  crm_activities");

  // ─── 21. CLIENT_TEAM_MEMBERS ─────────────────────────────────────────────
  if (await count("client_team_members") === 0) {
    const teamRow2 = (await q("SELECT id FROM client_teams LIMIT 1")).rows[0];
    if (teamRow2) {
      await q(`INSERT INTO client_team_members (team_id, member_id, role, joined_at) VALUES ($1,$2,$3,NOW()) ON CONFLICT DO NOTHING`,
        [teamRow2.id, rootId, "admin"]);
      console.log("✅ client_team_members: Talya Admin takıma eklendi");
    }
  } else console.log("⏭️  client_team_members");

  // ─── 22. BROKERS ─────────────────────────────────────────────────────────
  let brokerId: string;
  const brokerRow = (await q("SELECT id FROM brokers LIMIT 1")).rows[0];
  if (!brokerRow) {
    brokerId = uuidv4();
    await q(`INSERT INTO brokers (id, name, email, company, phone, created_at, updated_at) VALUES ($1,$2,$3,$4,$5,NOW(),NOW())`,
      [brokerId, "Mehmet Demir", "mehmet@lojistik-araci.com", "Lojistik Aracı A.Ş.", "+902121234567"]);
    console.log("✅ brokers: Lojistik aracı kaydedildi");
  } else {
    brokerId = brokerRow.id;
    console.log("⏭️  brokers");
  }

  // ─── 23. BROKER_CUSTOMERS ────────────────────────────────────────────────
  if (await count("broker_customers") === 0) {
    await q(`INSERT INTO broker_customers (broker_id, customer_id, created_at) VALUES ($1,$2,NOW()) ON CONFLICT DO NOTHING`,
      [brokerId, rootId]);
    console.log("✅ broker_customers: Müşteri aracıya bağlandı");
  } else console.log("⏭️  broker_customers");

  // ─── 24. PERFORMANCE_TARGETS ─────────────────────────────────────────────
  if (await count("performance_targets") === 0) {
    await q(`INSERT INTO performance_targets (id, warehouse_id, floor_number, target_capacity_percent, target_utilization_percent, filter_type, created_at, updated_at) VALUES ($1,$2,$3,$4,$5,$6,NOW(),NOW())`,
      [uuidv4(), warehouseId, 3, 85.0, 80.0, "floor"]);
    console.log("✅ performance_targets: %85 kapasite hedefi belirlendi");
  } else console.log("⏭️  performance_targets");

  // ─── 25. WAREHOUSE_CAPACITY_SNAPSHOTS ────────────────────────────────────
  if (await count("warehouse_capacity_snapshots") === 0) {
    await q(`INSERT INTO warehouse_capacity_snapshots (id, warehouse_id, zone_id, customer_id, total_capacity, used_capacity, percentage_used, snapshot_date, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW())`,
      [uuidv4(), warehouseId, zoneId, rootId, 200, 12, 6.0, now.toISOString().split("T")[0]]);
    console.log("✅ warehouse_capacity_snapshots: Bugünkü kapasite snapshot'ı alındı");
  } else console.log("⏭️  warehouse_capacity_snapshots");

  // ─── 26. CUSTOMER_GROUPS ─────────────────────────────────────────────────
  let cgId: string;
  const cgRow = (await q("SELECT id FROM customer_groups LIMIT 1")).rows[0];
  if (!cgRow) {
    cgId = uuidv4();
    await q(`INSERT INTO customer_groups (id, name, description, created_at, updated_at) VALUES ($1,$2,$3,NOW(),NOW())`,
      [cgId, "Premium Müşteriler", "Yüksek hacimli ve uzun vadeli depolama müşterileri"]);
    console.log("✅ customer_groups: Premium müşteri grubu oluşturuldu");
  } else {
    cgId = cgRow.id;
    console.log("⏭️  customer_groups");
  }

  // ─── 27. CUSTOMER_GROUP_MEMBERS ──────────────────────────────────────────
  if (await count("customer_group_members") === 0) {
    await q(`INSERT INTO customer_group_members (group_id, customer_id, created_at) VALUES ($1,$2,NOW()) ON CONFLICT DO NOTHING`,
      [cgId, rootId]);
    console.log("✅ customer_group_members: Talya Admin premium gruba eklendi");
  } else console.log("⏭️  customer_group_members");

  // ─── 28. MEMBERSHIP_SETTINGS ─────────────────────────────────────────────
  if (await count("membership_settings") === 0) {
    await q(`INSERT INTO membership_settings (id, tier_name, min_spend, discount_percent, benefits, program_enabled, status, created_at, updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,NOW(),NOW())`,
      [uuidv4(), "premium", 10000.00, 10.0,
       JSON.stringify(["Öncelikli müşteri hizmetleri", "Aylık kapasite raporu", "%10 indirim"]),
       true, "active"]);
    console.log("✅ membership_settings: Premium üyelik programı (%10 indirim) tanımlandı");
  } else console.log("⏭️  membership_settings");

  // ─── 29. INVOICE_TEMPLATES ───────────────────────────────────────────────
  if (await count("invoice_templates") === 0) {
    await q(`INSERT INTO invoice_templates (id, warehouse_id, name, items, notes, is_default, created_at, updated_at) VALUES ($1,$2,$3,$4,$5,$6,NOW(),NOW())`,
      [uuidv4(), warehouseId, "Standart Palet Depolama Faturası",
       JSON.stringify([{description: "Palet depolama", unit: "palet/ay", unit_price: 150}]),
       "Ödeme vadesi: 30 gün. IBAN: TR00 0000 0000 0000 0000 000000", true]);
    console.log("✅ invoice_templates: Standart fatura şablonu oluşturuldu");
  } else console.log("⏭️  invoice_templates");

  // ─── 30. WAREHOUSE_SERVICES (check existing) ─────────────────────────────
  const wsCount = await count("warehouse_services");
  if (wsCount === 0) {
    await q(`INSERT INTO warehouse_services (id, warehouse_id, name, description, base_price, is_active, created_at, updated_at) VALUES ($1,$2,$3,$4,$5,$6,NOW(),NOW())`,
      [uuidv4(), warehouseId, "Paletleme Hizmeti", "Ürünlerin standart EUR paletlere yerleştirilmesi", 50.00, true]);
    console.log("✅ warehouse_services: Paletleme hizmeti eklendi");
  } else {
    console.log(`⏭️  warehouse_services (${wsCount} kayıt mevcut)`);
  }

  // ─── SUMMARY ─────────────────────────────────────────────────────────────
  console.log(`\n✨ Comprehensive seed tamamlandı! Tüm tablolara ilgili örnek veriler eklendi.`);
  await pool.end();
}

main().catch(async (e) => {
  console.error("❌ Fatal error:", e.message);
  console.error(e);
  await pool.end();
  process.exit(1);
});
