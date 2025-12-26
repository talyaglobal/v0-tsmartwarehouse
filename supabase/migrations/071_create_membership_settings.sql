-- TSmart Warehouse Management System - Membership Settings
-- Membership programı ayarları için database tablosu
-- Root kullanıcılar tarafından program açılıp kapatılabilir ve tier ayarları yönetilebilir

-- ============================================
-- MEMBERSHIP SETTINGS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS membership_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  program_enabled BOOLEAN DEFAULT false NOT NULL, -- Program açık/kapalı durumu
  tier_name TEXT NOT NULL CHECK (tier_name IN ('bronze', 'silver', 'gold', 'platinum')),
  min_spend DECIMAL(10,2) NOT NULL, -- Bu tier için minimum harcama eşiği
  discount_percent DECIMAL(5,2) NOT NULL CHECK (discount_percent >= 0 AND discount_percent <= 100), -- İndirim yüzdesi
  benefits TEXT[], -- Tier faydaları listesi
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  status BOOLEAN DEFAULT true NOT NULL, -- Soft delete
  CONSTRAINT unique_tier UNIQUE (tier_name, status) -- Her tier için aktif bir kayıt olmalı
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_membership_settings_tier_name ON membership_settings(tier_name);
CREATE INDEX IF NOT EXISTS idx_membership_settings_program_enabled ON membership_settings(program_enabled);
CREATE INDEX IF NOT EXISTS idx_membership_settings_status ON membership_settings(status);

-- Enable Row Level Security
ALTER TABLE membership_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Herkes program ayarlarını okuyabilir (public pricing için)
CREATE POLICY "Everyone can view membership settings"
  ON membership_settings FOR SELECT
  USING (status = true);

-- Sadece root kullanıcılar membership ayarlarını yönetebilir
CREATE POLICY "Root users can manage membership settings"
  ON membership_settings FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'root'
      AND profiles.status = true
    )
  );

-- Default membership tier ayarlarını ekle (program kapalı durumda)
INSERT INTO membership_settings (program_enabled, tier_name, min_spend, discount_percent, benefits, status)
VALUES 
  (false, 'bronze', 0, 0, ARRAY['Standard pricing', 'Email support', 'Basic reporting'], true),
  (false, 'silver', 10000, 5, ARRAY['5% discount on storage', 'Priority support', 'Monthly reports'], true),
  (false, 'gold', 50000, 10, ARRAY['10% discount on all services', 'Dedicated account manager', 'Weekly reports', 'Free value-added services'], true),
  (false, 'platinum', 100000, 15, ARRAY['15% discount on all services', '24/7 priority support', 'Real-time analytics', 'Custom solutions', 'Annual review meetings'], true)
ON CONFLICT (tier_name, status) DO NOTHING;

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_membership_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to update updated_at
DROP TRIGGER IF EXISTS update_membership_settings_updated_at ON membership_settings;
CREATE TRIGGER update_membership_settings_updated_at
  BEFORE UPDATE ON membership_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_membership_settings_updated_at();

-- Comment on columns
COMMENT ON TABLE membership_settings IS 'Membership programı ayarları - Root kullanıcılar tarafından yönetilir';
COMMENT ON COLUMN membership_settings.program_enabled IS 'Program açık/kapalı durumu - Sistem genelinde geçerlidir';
COMMENT ON COLUMN membership_settings.tier_name IS 'Membership tier adı (bronze, silver, gold, platinum)';
COMMENT ON COLUMN membership_settings.min_spend IS 'Bu tier için minimum toplam harcama eşiği (USD)';
COMMENT ON COLUMN membership_settings.discount_percent IS 'Bu tier için uygulanacak indirim yüzdesi (0-100)';
COMMENT ON COLUMN membership_settings.benefits IS 'Bu tier için müşteri faydaları listesi';
COMMENT ON COLUMN membership_settings.status IS 'Soft delete flag: true = not deleted, false = deleted';

