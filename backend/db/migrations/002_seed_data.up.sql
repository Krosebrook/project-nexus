-- Seed projects
INSERT INTO projects (name, description, status, health_score, metrics) VALUES
  ('INT-triage-ai-2.0', 'AI-powered incident triage system with LLM integration', 'active', 95, '{"deployment_count": 12, "uptime_pct": 99.7, "avg_response_time": 245, "error_rate": 0.3}'),
  ('Server-Side Rate Limiting', 'Distributed rate limiting service for API protection', 'active', 88, '{"deployment_count": 8, "uptime_pct": 99.9, "avg_response_time": 12, "error_rate": 0.1}'),
  ('LLM Model Chaining POC', 'Proof of concept for multi-model LLM orchestration', 'development', 72, '{"deployment_count": 3, "uptime_pct": 95.2, "avg_response_time": 1820, "error_rate": 2.1}');

-- Seed context snapshots
INSERT INTO context_snapshots (project_id, work_state, next_steps, open_files, notes, is_current) VALUES
  (1, '{"current_task": "Optimizing LLM response caching", "blockers": ["Waiting for cache warmup metrics"], "progress": 60}', 
   ARRAY['Analyze cache hit rates', 'Implement TTL optimization', 'Deploy to staging'],
   ARRAY['src/cache/manager.ts', 'src/llm/client.ts', 'tests/cache.test.ts'],
   'Cache hit rate improved from 45% to 78% after implementing semantic similarity matching',
   true),
  (2, '{"current_task": "Investigating Redis cluster failover", "blockers": [], "progress": 30}',
   ARRAY['Review failover logs', 'Test backup replica promotion', 'Update runbook'],
   ARRAY['config/redis.conf', 'docs/runbook.md'],
   'Identified issue with sentinel quorum configuration',
   true),
  (3, '{"current_task": "Comparing GPT-4 vs Claude for document summarization", "blockers": ["Need more test data"], "progress": 85}',
   ARRAY['Collect 50 more test documents', 'Run A/B comparison', 'Document findings'],
   ARRAY['src/models/gpt4.ts', 'src/models/claude.ts', 'analysis/results.csv'],
   'Initial results show Claude performs better on technical documentation',
   true);

-- Seed test cases
INSERT INTO test_cases (project_id, name, input, expected_output, actual_output, status, last_run) VALUES
  (1, 'Critical incident classification', 
   '{"incident_text": "Database replica lag exceeding 5 seconds, replication stopped"}',
   '{"severity": "critical", "category": "database", "confidence": 0.95}',
   '{"severity": "critical", "category": "database", "confidence": 0.96}',
   'passed', NOW() - INTERVAL '2 hours'),
  (1, 'Non-critical alert filtering',
   '{"incident_text": "Disk usage at 65% on cache server"}',
   '{"severity": "low", "category": "infrastructure", "confidence": 0.88}',
   '{"severity": "medium", "category": "infrastructure", "confidence": 0.82}',
   'failed', NOW() - INTERVAL '2 hours'),
  (3, 'Multi-step reasoning chain',
   '{"task": "Extract key metrics from quarterly report", "document_type": "financial"}',
   '{"metrics": ["revenue", "profit_margin", "customer_count"], "model_chain": ["extract", "classify", "summarize"]}',
   null,
   'pending', null);

-- Seed alert rules
INSERT INTO alert_rules (project_id, name, condition, threshold, notification_channel, enabled, last_triggered) VALUES
  (1, 'High Error Rate', 'error_rate', 1.0, 'slack:#sre-alerts', true, NOW() - INTERVAL '3 days'),
  (1, 'Response Time Degradation', 'avg_response_time', 500, 'pagerduty:oncall', true, null),
  (2, 'Redis Memory Usage', 'memory_usage_pct', 85, 'slack:#infra-alerts', true, NOW() - INTERVAL '1 day'),
  (2, 'Rate Limit Quota Exceeded', 'quota_utilization', 90, 'email:team@example.com', true, NOW() - INTERVAL '12 hours'),
  (3, 'Model Latency Spike', 'avg_response_time', 3000, 'slack:#ai-team', false, null);

-- Seed file moves
INSERT INTO file_moves (project_id, original_path, new_path, reason, moved_at) VALUES
  (1, 'src/triage.ts', 'src/core/triage.ts', 'Reorganized into core module', NOW() - INTERVAL '5 days'),
  (1, 'utils/helpers.ts', 'src/utils/text-processing.ts', 'Better naming convention', NOW() - INTERVAL '4 days'),
  (2, 'rate-limiter.ts', 'src/limiters/token-bucket.ts', 'Split into algorithm-specific files', NOW() - INTERVAL '7 days'),
  (3, 'poc/experiment.ts', 'src/chains/document-summarization.ts', 'Promoted from POC to production', NOW() - INTERVAL '2 days');

-- Seed default user preferences
INSERT INTO user_preferences (user_id, refresh_interval, default_view, theme) VALUES
  ('default', 30, 'projects', 'dark');
