-- COMPREHENSIVE FOREIGN KEY AUDIT
-- This file contains SQL queries to validate all foreign key relationships
-- across the entire schema. Run these queries to identify any FK inconsistencies.

-- ============================================================================
-- STEP 1: List ALL foreign key constraints currently in the database
-- ============================================================================
SELECT 
    tc.table_name AS src_table,
    kcu.column_name AS src_column,
    ccu.table_name AS tgt_table,
    ccu.column_name AS tgt_column,
    tc.constraint_name,
    rc.delete_rule,
    rc.update_rule
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
LEFT JOIN information_schema.referential_constraints AS rc
  ON tc.constraint_name = rc.constraint_name
  AND tc.table_schema = rc.constraint_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public'
ORDER BY tc.table_name, kcu.column_name;

-- ============================================================================
-- STEP 2: Check for orphaned records in all tables with foreign keys
-- ============================================================================

-- Check deployment_logs.project_id orphans
SELECT 'deployment_logs.project_id' AS fk_column, COUNT(*) AS orphan_count
FROM deployment_logs dl
WHERE NOT EXISTS (SELECT 1 FROM projects p WHERE p.id = dl.project_id);

-- Check deployment_logs.environment_id orphans
SELECT 'deployment_logs.environment_id' AS fk_column, COUNT(*) AS orphan_count
FROM deployment_logs dl
WHERE environment_id IS NOT NULL 
  AND NOT EXISTS (SELECT 1 FROM environments e WHERE e.id = dl.environment_id);

-- Check deployment_logs.rollback_from_deployment_id orphans
SELECT 'deployment_logs.rollback_from_deployment_id' AS fk_column, COUNT(*) AS orphan_count
FROM deployment_logs dl
WHERE rollback_from_deployment_id IS NOT NULL 
  AND NOT EXISTS (SELECT 1 FROM deployment_logs dl2 WHERE dl2.id = dl.rollback_from_deployment_id);

-- Check environments.project_id orphans
SELECT 'environments.project_id' AS fk_column, COUNT(*) AS orphan_count
FROM environments e
WHERE NOT EXISTS (SELECT 1 FROM projects p WHERE p.id = e.project_id);

-- Check context_snapshots.project_id orphans
SELECT 'context_snapshots.project_id' AS fk_column, COUNT(*) AS orphan_count
FROM context_snapshots cs
WHERE NOT EXISTS (SELECT 1 FROM projects p WHERE p.id = cs.project_id);

-- Check test_cases.project_id orphans
SELECT 'test_cases.project_id' AS fk_column, COUNT(*) AS orphan_count
FROM test_cases tc
WHERE NOT EXISTS (SELECT 1 FROM projects p WHERE p.id = tc.project_id);

-- Check alert_rules.project_id orphans
SELECT 'alert_rules.project_id' AS fk_column, COUNT(*) AS orphan_count
FROM alert_rules ar
WHERE NOT EXISTS (SELECT 1 FROM projects p WHERE p.id = ar.project_id);

-- Check file_moves.project_id orphans
SELECT 'file_moves.project_id' AS fk_column, COUNT(*) AS orphan_count
FROM file_moves fm
WHERE NOT EXISTS (SELECT 1 FROM projects p WHERE p.id = fm.project_id);

-- Check dashboard_widgets.project_id orphans (nullable)
SELECT 'dashboard_widgets.project_id' AS fk_column, COUNT(*) AS orphan_count
FROM dashboard_widgets dw
WHERE project_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM projects p WHERE p.id = dw.project_id);

-- Check project_members.project_id orphans
SELECT 'project_members.project_id' AS fk_column, COUNT(*) AS orphan_count
FROM project_members pm
WHERE NOT EXISTS (SELECT 1 FROM projects p WHERE p.id = pm.project_id);

-- Check project_members.user_id orphans
SELECT 'project_members.user_id' AS fk_column, COUNT(*) AS orphan_count
FROM project_members pm
WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.id = pm.user_id);

-- Check project_members.invited_by orphans (nullable)
SELECT 'project_members.invited_by' AS fk_column, COUNT(*) AS orphan_count
FROM project_members pm
WHERE invited_by IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM users u WHERE u.id = pm.invited_by);

-- Check activity_log.project_id orphans (nullable)
SELECT 'activity_log.project_id' AS fk_column, COUNT(*) AS orphan_count
FROM activity_log al
WHERE project_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM projects p WHERE p.id = al.project_id);

-- Check activity_log.user_id orphans (nullable)
SELECT 'activity_log.user_id' AS fk_column, COUNT(*) AS orphan_count
FROM activity_log al
WHERE user_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM users u WHERE u.id = al.user_id);

-- Check comments.project_id orphans
SELECT 'comments.project_id' AS fk_column, COUNT(*) AS orphan_count
FROM comments c
WHERE NOT EXISTS (SELECT 1 FROM projects p WHERE p.id = c.project_id);

-- Check comments.user_id orphans
SELECT 'comments.user_id' AS fk_column, COUNT(*) AS orphan_count
FROM comments c
WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.id = c.user_id);

-- Check comments.parent_id orphans (nullable, self-referencing)
SELECT 'comments.parent_id' AS fk_column, COUNT(*) AS orphan_count
FROM comments c
WHERE parent_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM comments c2 WHERE c2.id = c.parent_id);

-- Check user_presence.user_id orphans
SELECT 'user_presence.user_id' AS fk_column, COUNT(*) AS orphan_count
FROM user_presence up
WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.id = up.user_id);

-- Check user_presence.project_id orphans (nullable)
SELECT 'user_presence.project_id' AS fk_column, COUNT(*) AS orphan_count
FROM user_presence up
WHERE project_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM projects p WHERE p.id = up.project_id);

-- Check deployment_approvals.deployment_id orphans
SELECT 'deployment_approvals.deployment_id' AS fk_column, COUNT(*) AS orphan_count
FROM deployment_approvals da
WHERE NOT EXISTS (SELECT 1 FROM deployment_logs dl WHERE dl.id = da.deployment_id);

-- Check deployment_approvals.created_by orphans (nullable)
SELECT 'deployment_approvals.created_by' AS fk_column, COUNT(*) AS orphan_count
FROM deployment_approvals da
WHERE created_by IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM users u WHERE u.id = da.created_by);

-- Check deployment_approvals.rejected_by orphans (nullable)
SELECT 'deployment_approvals.rejected_by' AS fk_column, COUNT(*) AS orphan_count
FROM deployment_approvals da
WHERE rejected_by IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM users u WHERE u.id = da.rejected_by);

-- Check approval_rules.project_id orphans
SELECT 'approval_rules.project_id' AS fk_column, COUNT(*) AS orphan_count
FROM approval_rules ar
WHERE NOT EXISTS (SELECT 1 FROM projects p WHERE p.id = ar.project_id);

-- Check approval_actions.approval_id orphans
SELECT 'approval_actions.approval_id' AS fk_column, COUNT(*) AS orphan_count
FROM approval_actions aa
WHERE NOT EXISTS (SELECT 1 FROM deployment_approvals da WHERE da.id = aa.approval_id);

-- Check approval_actions.user_id orphans
SELECT 'approval_actions.user_id' AS fk_column, COUNT(*) AS orphan_count
FROM approval_actions aa
WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.id = aa.user_id);

-- Check alert_conditions.alert_rule_id orphans
SELECT 'alert_conditions.alert_rule_id' AS fk_column, COUNT(*) AS orphan_count
FROM alert_conditions ac
WHERE NOT EXISTS (SELECT 1 FROM alert_rules ar WHERE ar.id = ac.alert_rule_id);

-- Check alert_condition_groups.alert_rule_id orphans
SELECT 'alert_condition_groups.alert_rule_id' AS fk_column, COUNT(*) AS orphan_count
FROM alert_condition_groups acg
WHERE NOT EXISTS (SELECT 1 FROM alert_rules ar WHERE ar.id = acg.alert_rule_id);

-- Check alert_actions.alert_rule_id orphans
SELECT 'alert_actions.alert_rule_id' AS fk_column, COUNT(*) AS orphan_count
FROM alert_actions aa
WHERE NOT EXISTS (SELECT 1 FROM alert_rules ar WHERE ar.id = aa.alert_rule_id);

-- Check alert_history.alert_rule_id orphans
SELECT 'alert_history.alert_rule_id' AS fk_column, COUNT(*) AS orphan_count
FROM alert_history ah
WHERE NOT EXISTS (SELECT 1 FROM alert_rules ar WHERE ar.id = ah.alert_rule_id);

-- Check alert_escalations.alert_rule_id orphans
SELECT 'alert_escalations.alert_rule_id' AS fk_column, COUNT(*) AS orphan_count
FROM alert_escalations ae
WHERE NOT EXISTS (SELECT 1 FROM alert_rules ar WHERE ar.id = ae.alert_rule_id);

-- Check deployment_queue.project_id orphans
SELECT 'deployment_queue.project_id' AS fk_column, COUNT(*) AS orphan_count
FROM deployment_queue dq
WHERE NOT EXISTS (SELECT 1 FROM projects p WHERE p.id = dq.project_id);

-- Check deployment_queue.environment_id orphans
SELECT 'deployment_queue.environment_id' AS fk_column, COUNT(*) AS orphan_count
FROM deployment_queue dq
WHERE NOT EXISTS (SELECT 1 FROM environments e WHERE e.id = dq.environment_id);

-- Check deployment_queue.deployment_id orphans (nullable)
SELECT 'deployment_queue.deployment_id' AS fk_column, COUNT(*) AS orphan_count
FROM deployment_queue dq
WHERE deployment_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM deployment_logs dl WHERE dl.id = dq.deployment_id);

-- Check deployment_schedules.project_id orphans
SELECT 'deployment_schedules.project_id' AS fk_column, COUNT(*) AS orphan_count
FROM deployment_schedules ds
WHERE NOT EXISTS (SELECT 1 FROM projects p WHERE p.id = ds.project_id);

-- Check deployment_schedules.environment_id orphans
SELECT 'deployment_schedules.environment_id' AS fk_column, COUNT(*) AS orphan_count
FROM deployment_schedules ds
WHERE NOT EXISTS (SELECT 1 FROM environments e WHERE e.id = ds.environment_id);

-- Check deployment_artifacts.deployment_id orphans
SELECT 'deployment_artifacts.deployment_id' AS fk_column, COUNT(*) AS orphan_count
FROM deployment_artifacts da
WHERE NOT EXISTS (SELECT 1 FROM deployment_logs dl WHERE dl.id = da.deployment_id);

-- Check deployment_diffs.deployment_a_id orphans
SELECT 'deployment_diffs.deployment_a_id' AS fk_column, COUNT(*) AS orphan_count
FROM deployment_diffs dd
WHERE NOT EXISTS (SELECT 1 FROM deployment_logs dl WHERE dl.id = dd.deployment_a_id);

-- Check deployment_diffs.deployment_b_id orphans
SELECT 'deployment_diffs.deployment_b_id' AS fk_column, COUNT(*) AS orphan_count
FROM deployment_diffs dd
WHERE NOT EXISTS (SELECT 1 FROM deployment_logs dl WHERE dl.id = dd.deployment_b_id);

-- Check artifact_versions.project_id orphans
SELECT 'artifact_versions.project_id' AS fk_column, COUNT(*) AS orphan_count
FROM artifact_versions av
WHERE NOT EXISTS (SELECT 1 FROM projects p WHERE p.id = av.project_id);

-- Check deployment_from_template.deployment_id orphans
SELECT 'deployment_from_template.deployment_id' AS fk_column, COUNT(*) AS orphan_count
FROM deployment_from_template dft
WHERE NOT EXISTS (SELECT 1 FROM deployment_logs dl WHERE dl.id = dft.deployment_id);

-- Check deployment_from_template.template_id orphans
SELECT 'deployment_from_template.template_id' AS fk_column, COUNT(*) AS orphan_count
FROM deployment_from_template dft
WHERE NOT EXISTS (SELECT 1 FROM deployment_templates dt WHERE dt.id = dft.template_id);

-- Check deployment_risk_assessments.project_id orphans
SELECT 'deployment_risk_assessments.project_id' AS fk_column, COUNT(*) AS orphan_count
FROM deployment_risk_assessments dra
WHERE NOT EXISTS (SELECT 1 FROM projects p WHERE p.id = dra.project_id);

-- Check deployment_notification_history.deployment_id orphans
SELECT 'deployment_notification_history.deployment_id' AS fk_column, COUNT(*) AS orphan_count
FROM deployment_notification_history dnh
WHERE NOT EXISTS (SELECT 1 FROM deployment_logs dl WHERE dl.id = dnh.deployment_id);

-- Check deployment_notification_history.project_id orphans
SELECT 'deployment_notification_history.project_id' AS fk_column, COUNT(*) AS orphan_count
FROM deployment_notification_history dnh
WHERE NOT EXISTS (SELECT 1 FROM projects p WHERE p.id = dnh.project_id);

-- Check provisioned_databases.project_id orphans
SELECT 'provisioned_databases.project_id' AS fk_column, COUNT(*) AS orphan_count
FROM provisioned_databases pd
WHERE NOT EXISTS (SELECT 1 FROM projects p WHERE p.id = pd.project_id);

-- Check database_connection_logs.database_id orphans
SELECT 'database_connection_logs.database_id' AS fk_column, COUNT(*) AS orphan_count
FROM database_connection_logs dcl
WHERE NOT EXISTS (SELECT 1 FROM provisioned_databases pd WHERE pd.id = dcl.database_id);

-- Check backup_restore_history.backup_id orphans
SELECT 'backup_restore_history.backup_id' AS fk_column, COUNT(*) AS orphan_count
FROM backup_restore_history brh
WHERE NOT EXISTS (SELECT 1 FROM database_backups db WHERE db.id = brh.backup_id);

-- Check deployment_comparisons.project_id orphans
SELECT 'deployment_comparisons.project_id' AS fk_column, COUNT(*) AS orphan_count
FROM deployment_comparisons dc
WHERE NOT EXISTS (SELECT 1 FROM projects p WHERE p.id = dc.project_id);

-- Check deployment_comparisons.deployment_a_id orphans
SELECT 'deployment_comparisons.deployment_a_id' AS fk_column, COUNT(*) AS orphan_count
FROM deployment_comparisons dc
WHERE NOT EXISTS (SELECT 1 FROM deployment_logs dl WHERE dl.id = dc.deployment_a_id);

-- Check deployment_comparisons.deployment_b_id orphans
SELECT 'deployment_comparisons.deployment_b_id' AS fk_column, COUNT(*) AS orphan_count
FROM deployment_comparisons dc
WHERE NOT EXISTS (SELECT 1 FROM deployment_logs dl WHERE dl.id = dc.deployment_b_id);

-- Check test_coverage.project_id orphans
SELECT 'test_coverage.project_id' AS fk_column, COUNT(*) AS orphan_count
FROM test_coverage tc
WHERE NOT EXISTS (SELECT 1 FROM projects p WHERE p.id = tc.project_id);

-- Check test_coverage.deployment_id orphans (nullable)
SELECT 'test_coverage.deployment_id' AS fk_column, COUNT(*) AS orphan_count
FROM test_coverage tc
WHERE deployment_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM deployment_logs dl WHERE dl.id = tc.deployment_id);

-- Check incidents.project_id orphans
SELECT 'incidents.project_id' AS fk_column, COUNT(*) AS orphan_count
FROM incidents i
WHERE NOT EXISTS (SELECT 1 FROM projects p WHERE p.id = i.project_id);

-- Check incidents.deployment_id orphans (nullable)
SELECT 'incidents.deployment_id' AS fk_column, COUNT(*) AS orphan_count
FROM incidents i
WHERE deployment_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM deployment_logs dl WHERE dl.id = i.deployment_id);

-- Check project_dependencies.project_id orphans
SELECT 'project_dependencies.project_id' AS fk_column, COUNT(*) AS orphan_count
FROM project_dependencies pd
WHERE NOT EXISTS (SELECT 1 FROM projects p WHERE p.id = pd.project_id);

-- Check project_dependencies.depends_on_project_id orphans
SELECT 'project_dependencies.depends_on_project_id' AS fk_column, COUNT(*) AS orphan_count
FROM project_dependencies pd
WHERE NOT EXISTS (SELECT 1 FROM projects p WHERE p.id = pd.depends_on_project_id);

-- ============================================================================
-- STEP 3: Verify indexes exist for all foreign key columns
-- ============================================================================
SELECT 
    t.relname AS table_name,
    a.attname AS column_name,
    i.relname AS index_name,
    CASE WHEN i.relname IS NULL THEN 'MISSING INDEX' ELSE 'OK' END AS status
FROM pg_constraint c
JOIN pg_attribute a ON a.attnum = ANY(c.conkey) AND a.attrelid = c.conrelid
JOIN pg_class t ON t.oid = c.conrelid
LEFT JOIN pg_index ix ON ix.indrelid = c.conrelid AND a.attnum = ANY(ix.indkey)
LEFT JOIN pg_class i ON i.oid = ix.indexrelid
WHERE c.contype = 'f'
  AND t.relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
ORDER BY t.relname, a.attname;
