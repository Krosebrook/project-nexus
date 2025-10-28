-- Migration 018: Agent Execution Engine - Cache and Audit Tables
-- Part of FlashFusion/Cortex-Nexus Autonomous AI Agent Execution Engine

-- Result Cache Table
-- Stores cached responses indexed by intent signature for idempotency
CREATE TABLE IF NOT EXISTS agent_result_cache (
    id SERIAL PRIMARY KEY,

    -- Intent signature (SHA256) - unique identifier for cache lookups
    intent_signature VARCHAR(64) NOT NULL UNIQUE,

    -- User who made the request (for multi-tenancy)
    user_id VARCHAR(255) NOT NULL,

    -- Cached response (full AguiResponse object as JSONB)
    response JSONB NOT NULL,

    -- Cache metadata
    hit_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP NOT NULL,
    last_accessed_at TIMESTAMP DEFAULT NOW(),

    -- Indexing
    INDEX idx_intent_signature (intent_signature),
    INDEX idx_user_id (user_id),
    INDEX idx_expires_at (expires_at)
);

-- Audit Logs Table
-- Stores complete audit trail for Dynamic Context Debugger (DCD)
CREATE TABLE IF NOT EXISTS agent_audit_logs (
    id SERIAL PRIMARY KEY,

    -- Correlation ID - groups all events for a single execution
    correlation_id UUID NOT NULL,

    -- User who triggered the execution
    user_id VARCHAR(255) NOT NULL,

    -- Intent signature for linking to cache
    intent_signature VARCHAR(64),

    -- Event details
    phase VARCHAR(50) NOT NULL,  -- e.g., "INGESTION", "POLICY", "EXECUTION"
    event VARCHAR(100) NOT NULL,  -- e.g., "CACHE_LOOKUP", "VALIDATION_SUCCESS"
    details JSONB NOT NULL,

    -- Timestamp
    timestamp TIMESTAMP DEFAULT NOW(),

    -- Indexing for fast lookups by correlation ID
    INDEX idx_correlation_id (correlation_id),
    INDEX idx_user_id_audit (user_id),
    INDEX idx_timestamp (timestamp),
    INDEX idx_phase (phase)
);

-- Agent Execution Metadata Table
-- Stores high-level execution information for billing and analytics
CREATE TABLE IF NOT EXISTS agent_execution_metadata (
    id SERIAL PRIMARY KEY,

    -- Execution identifiers
    correlation_id UUID NOT NULL UNIQUE,
    intent_signature VARCHAR(64) NOT NULL,

    -- User and timing
    user_id VARCHAR(255) NOT NULL,
    started_at TIMESTAMP DEFAULT NOW(),
    completed_at TIMESTAMP,

    -- Execution results
    status VARCHAR(50) NOT NULL,  -- AgentStatus enum
    phase_result VARCHAR(50),     -- PhaseResult enum
    from_cache BOOLEAN DEFAULT FALSE,

    -- Resource usage
    execution_time_ms INTEGER,
    tokens_used INTEGER,
    total_cost DECIMAL(10, 6),

    -- Execution stats
    recursion_depth INTEGER DEFAULT 0,
    tool_calls_count INTEGER DEFAULT 0,
    llm_calls_count INTEGER DEFAULT 0,

    -- Error tracking
    error_code VARCHAR(100),
    error_message TEXT,

    -- Indexing
    INDEX idx_correlation_id_meta (correlation_id),
    INDEX idx_user_id_meta (user_id),
    INDEX idx_intent_signature_meta (intent_signature),
    INDEX idx_started_at (started_at),
    INDEX idx_status (status)
);

-- User Policy Table
-- Stores per-user policy constraints based on tier
CREATE TABLE IF NOT EXISTS agent_user_policies (
    id SERIAL PRIMARY KEY,

    user_id VARCHAR(255) NOT NULL UNIQUE,
    tier VARCHAR(50) NOT NULL DEFAULT 'free',  -- free, pro, enterprise

    -- Policy constraints
    max_recursion_depth INTEGER DEFAULT 5,
    context_window_limit INTEGER DEFAULT 8000,
    max_tool_calls INTEGER DEFAULT 10,
    allowed_tools JSONB DEFAULT '[]'::jsonb,

    -- Rate limiting
    requests_per_minute INTEGER DEFAULT 10,
    requests_per_hour INTEGER DEFAULT 100,

    -- DCD access (monetized feature)
    dcd_access BOOLEAN DEFAULT FALSE,
    dcd_retention_days INTEGER DEFAULT 7,

    -- Metadata
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),

    INDEX idx_user_policy (user_id),
    INDEX idx_tier (tier)
);

-- Tool Execution Logs Table
-- Tracks individual tool calls for debugging and billing
CREATE TABLE IF NOT EXISTS agent_tool_executions (
    id SERIAL PRIMARY KEY,

    correlation_id UUID NOT NULL,
    tool_name VARCHAR(100) NOT NULL,

    -- Tool execution details
    arguments JSONB,
    result JSONB,

    -- Timing and cost
    started_at TIMESTAMP DEFAULT NOW(),
    completed_at TIMESTAMP,
    execution_time_ms INTEGER,
    cost DECIMAL(10, 6),

    -- Status
    status VARCHAR(50) NOT NULL,  -- success, error, timeout
    error_message TEXT,

    INDEX idx_correlation_id_tool (correlation_id),
    INDEX idx_tool_name (tool_name),
    INDEX idx_started_at_tool (started_at)
);

-- Create function to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger for agent_user_policies
CREATE TRIGGER update_agent_user_policies_updated_at
    BEFORE UPDATE ON agent_user_policies
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Create function to clean expired cache entries
CREATE OR REPLACE FUNCTION clean_expired_cache()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM agent_result_cache
    WHERE expires_at < NOW();

    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Comments for documentation
COMMENT ON TABLE agent_result_cache IS 'Caches agent execution results for idempotency, indexed by intent signature';
COMMENT ON TABLE agent_audit_logs IS 'Complete audit trail for Dynamic Context Debugger (DCD) - monetized feature';
COMMENT ON TABLE agent_execution_metadata IS 'High-level execution metadata for billing and analytics';
COMMENT ON TABLE agent_user_policies IS 'Per-user policy constraints based on subscription tier';
COMMENT ON TABLE agent_tool_executions IS 'Individual tool execution logs for debugging and cost attribution';

COMMENT ON COLUMN agent_result_cache.intent_signature IS 'SHA256 hash of stable job parameters for idempotency';
COMMENT ON COLUMN agent_audit_logs.correlation_id IS 'Groups all audit events for a single execution flow';
COMMENT ON COLUMN agent_user_policies.dcd_access IS 'Whether user has access to Dynamic Context Debugger';
