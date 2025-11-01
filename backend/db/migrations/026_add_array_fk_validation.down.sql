-- Rollback: Remove array validation triggers

BEGIN;

DROP TRIGGER IF EXISTS trg_check_deployment_approvals_approved_by ON deployment_approvals;
DROP TRIGGER IF EXISTS trg_check_alert_escalations_user_ids ON alert_escalations;
DROP TRIGGER IF EXISTS trg_check_approval_rules_allowed_approvers ON approval_rules;
DROP TRIGGER IF EXISTS trg_check_alert_condition_groups_condition_ids ON alert_condition_groups;

DROP FUNCTION IF EXISTS check_deployment_approvals_approved_by();
DROP FUNCTION IF EXISTS check_alert_escalations_user_ids();
DROP FUNCTION IF EXISTS check_approval_rules_allowed_approvers();
DROP FUNCTION IF EXISTS check_alert_condition_groups_condition_ids();
DROP FUNCTION IF EXISTS validate_user_ids_array(BIGINT[]);
DROP FUNCTION IF EXISTS validate_condition_ids_array(BIGINT[]);

COMMIT;
