-- Phase 5: SMS Expansion
-- Add review interval column to medical_acts table
-- Add SMS opt-out flags to patients table

ALTER TABLE medical_acts
ADD COLUMN review_months INTEGER NULL;

-- Comment explaining the column
COMMENT ON COLUMN medical_acts.review_months IS 'Recall interval in months (e.g., 6 for every 6 months). NULL = no recall/review reminder.';

-- Add SMS opt-out flags to patients
ALTER TABLE patients
ADD COLUMN IF NOT EXISTS sms_optout_birthday BOOLEAN DEFAULT false;
ADD COLUMN IF NOT EXISTS sms_optout_holiday BOOLEAN DEFAULT false;
ADD COLUMN IF NOT EXISTS sms_optout_review BOOLEAN DEFAULT false;
ADD COLUMN IF NOT EXISTS sms_optout_followup BOOLEAN DEFAULT false;

-- Comments
COMMENT ON COLUMN patients.sms_optout_birthday IS 'If true, patient will not receive birthday SMS';
COMMENT ON COLUMN patients.sms_optout_holiday IS 'If true, patient will not receive holiday greeting SMS';
COMMENT ON COLUMN patients.sms_optout_review IS 'If true, patient will not receive review/recall reminder SMS';
COMMENT ON COLUMN patients.sms_optout_followup IS 'If true, patient will not receive follow-up/retention SMS';
