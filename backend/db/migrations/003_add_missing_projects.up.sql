INSERT INTO projects (name, description, status, health_score, metrics) VALUES
  ('Vetting-Vista', 'Automated candidate vetting and screening platform', 'active', 92, '{"deployment_count": 15, "uptime_pct": 99.5, "avg_response_time": 78, "error_rate": 0.5}'),
  ('PromoForge', 'Real-time promotional campaign generator with AI', 'active', 45, '{"deployment_count": 22, "uptime_pct": 92.1, "avg_response_time": 890, "error_rate": 8.7}'),
  ('FlashFusion', 'Lightning-fast image processing and CDN pipeline', 'active', 96, '{"deployment_count": 9, "uptime_pct": 99.7, "avg_response_time": 23, "error_rate": 0.3}');

UPDATE projects SET last_activity = NOW() - INTERVAL '2 hours' WHERE name = 'INT-triage-ai-2.0';
UPDATE projects SET last_activity = NOW() - INTERVAL '1 day' WHERE name = 'Server-Side Rate Limiting';
UPDATE projects SET last_activity = NOW() - INTERVAL '3 hours' WHERE name = 'LLM Model Chaining POC';
UPDATE projects SET last_activity = NOW() - INTERVAL '5 hours' WHERE name = 'Vetting-Vista';
UPDATE projects SET last_activity = NOW() - INTERVAL '30 minutes' WHERE name = 'PromoForge';
UPDATE projects SET last_activity = NOW() - INTERVAL '1 day' WHERE name = 'FlashFusion';