#!/usr/bin/env node

/**
 * DATABASE_URL Güncelleme Yardımcı Script
 * Bu script, Supabase Dashboard'dan aldığınız connection string'i .env.local dosyasına ekler
 * 
 * Kullanım:
 * 1. Supabase Dashboard → Settings → Database → Connection pooling (Session mode) → Copy
 * 2. node scripts/update-database-url.js "postgresql://postgres.xxx:xxx@aws-0-xxx.pooler.supabase.com:6543/postgres"
 */

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const envPath = path.join(root, '.env.local');

if (!fs.existsSync(envPath)) {
  console.error('❌ .env.local dosyası bulunamadı!');
  console.error('   Lütfen önce .env.local dosyası oluşturun.');
  process.exit(1);
}

// Command line argument'tan yeni DATABASE_URL'i al
const newDatabaseUrl = process.argv[2];

if (!newDatabaseUrl) {
  console.log('📋 DATABASE_URL Güncelleme Yardımcısı\n');
  console.log('Kullanım:');
  console.log('  node scripts/update-database-url.js "postgresql://postgres.xxx:xxx@aws-0-xxx.pooler.supabase.com:6543/postgres"\n');
  console.log('Adımlar:');
  console.log('1. Supabase Dashboard\'a gidin: https://app.supabase.com/project/gyodzimmhtecocscyeip');
  console.log('2. Settings → Database → Connection pooling (Session mode) → Copy');
  console.log('3. Yukarıdaki komutu çalıştırın ve connection string\'i yapıştırın\n');
  process.exit(0);
}

// .env.local dosyasını oku
let envContent = fs.readFileSync(envPath, 'utf8');
const lines = envContent.split(/\r?\n/);

// DATABASE_URL satırını bul ve güncelle
let found = false;
const updatedLines = lines.map(line => {
  if (line.trim().startsWith('DATABASE_URL=')) {
    found = true;
    return `DATABASE_URL=${newDatabaseUrl}`;
  }
  return line;
});

// Eğer DATABASE_URL bulunamadıysa, dosyanın sonuna ekle
if (!found) {
  updatedLines.push(`DATABASE_URL=${newDatabaseUrl}`);
}

// Dosyayı güncelle
fs.writeFileSync(envPath, updatedLines.join('\n'), 'utf8');

console.log('✅ DATABASE_URL başarıyla güncellendi!\n');
console.log('Yeni DATABASE_URL:');
console.log(`   ${newDatabaseUrl.substring(0, 50)}...\n`);

// Format kontrolü
const urlMatch = newDatabaseUrl.match(/postgresql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)/);
if (!urlMatch) {
  console.log('⚠️  Uyarı: DATABASE_URL formatı beklenen formatta değil.');
  console.log('   Format: postgresql://user:password@host:port/database\n');
} else {
  const [, user, , host, port, database] = urlMatch;
  console.log('📋 Connection Detayları:');
  console.log(`   User: ${user}`);
  console.log(`   Host: ${host}`);
  console.log(`   Port: ${port}`);
  console.log(`   Database: ${database}\n`);
}

console.log('🧪 Test etmek için:');
console.log('   node scripts/auto-run-migration.js\n');

