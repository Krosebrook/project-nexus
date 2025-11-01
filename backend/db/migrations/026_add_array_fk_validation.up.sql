-- Add validation for BIGINT[] array columns that reference other tables
-- Uses triggers instead of standard FKs since Postgres doesn't support FK on arrays

BEGIN;

-- Function to validate user IDs in BIGINT arrays
CREATE OR REPLACE FUNCTION validate_user_ids_array(user_ids BIGINT[])
RETURNS BOOLEAN AS $$
DECLARE
  invalid_count INTEGER;
BEGIN
  IF user_ids IS NULL OR array_length(user_ids, 1) IS NULL THEN
    RETURN TRUE;
  END IF;
  
  SELECT COUNT(*) INTO invalid_count
  FROM unnest(user_ids) AS uid
  WHERE uid NOT IN (SELECT id FROM users);
  
  RETURN invalid_count = 0;
END;
$$ LANGUAGE plpgsql;

-- Trigger function for deployment_approvals.approved_by
CREATE OR REPLACE FUNCTION check_deployment_approvals_approved_by()
RETURNS TRIGGER AS $$
BEGIN
  IF NOT validate_user_ids_array(NEW.approved_by) THEN
    RAISE EXCEPTION 'Invalid user IDs in approved_by array';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_check_deployment_approvals_approved_by ON deployment_approvals;
CREATE TRIGGER trg_check_deployment_approvals_approved_by
  BEFORE INSERT OR UPDATE ON deployment_approvals
  FOR EACH ROW
  EXECUTE FUNCTION check_deployment_approvals_approved_by();

-- Trigger function for alert_escalations.user_ids
CREATE OR REPLACE FUNCTION check_alert_escalations_user_ids()
RETURNS TRIGGER AS $$
BEGIN
  IF NOT validate_user_ids_array(NEW.user_ids) THEN
    RAISE EXCEPTION 'Invalid user IDs in user_ids array';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_check_alert_escalations_user_ids ON alert_escalations;
CREATE TRIGGER trg_check_alert_escalations_user_ids
  BEFORE INSERT OR UPDATE ON alert_escalations
  FOR EACH ROW
  EXECUTE FUNCTION check_alert_escalations_user_ids();

-- Trigger function for approval_rules.allowed_approvers
CREATE OR REPLACE FUNCTION check_approval_rules_allowed_approvers()
RETURNS TRIGGER AS $$
BEGIN
  IF NOT validate_user_ids_array(NEW.allowed_approvers) THEN
    RAISE EXCEPTION 'Invalid user IDs in allowed_approvers array';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_check_approval_rules_allowed_approvers ON approval_rules;
CREATE TRIGGER trg_check_approval_rules_allowed_approvers
  BEFORE INSERT OR UPDATE ON approval_rules
  FOR EACH ROW
  EXECUTE FUNCTION check_approval_rules_allowed_approvers();

-- Function to validate alert condition IDs in arrays
CREATE OR REPLACE FUNCTION validate_condition_ids_array(condition_ids BIGINT[])
RETURNS BOOLEAN AS $$
DECLARE
  invalid_count INTEGER;
BEGIN
  IF condition_ids IS NULL OR array_length(condition_ids, 1) IS NULL THEN
    RETURN TRUE;
  END IF;
  
  SELECT COUNT(*) INTO invalid_count
  FROM unnest(condition_ids) AS cid
  WHERE cid NOT IN (SELECT id FROM alert_conditions);
  
  RETURN invalid_count = 0;
END;
$$ LANGUAGE plpgsql;

-- Trigger function for alert_condition_groups.condition_ids
CREATE OR REPLACE FUNCTION check_alert_condition_groups_condition_ids()
RETURNS TRIGGER AS $$
BEGIN
  IF NOT validate_condition_ids_array(NEW.condition_ids) THEN
    RAISE EXCEPTION 'Invalid condition IDs in condition_ids array';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_check_alert_condition_groups_condition_ids ON alert_condition_groups;
CREATE TRIGGER trg_check_alert_condition_groups_condition_ids
  BEFORE INSERT OR UPDATE ON alert_condition_groups
  FOR EACH ROW
  EXECUTE FUNCTION check_alert_condition_groups_condition_ids();

COMMIT;
