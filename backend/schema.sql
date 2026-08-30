-- ============================================================
-- NOVAWARE AI SUPPORT — COMPLETE SCHEMA
-- Paste this entire file into Supabase SQL Editor → Run
-- ============================================================

-- =====================
-- 1. CUSTOMERS
-- =====================
-- Already created — IF NOT EXISTS so it won't break if run again.

CREATE TABLE IF NOT EXISTS customers (
    id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name                TEXT NOT NULL,
    email               TEXT UNIQUE NOT NULL,
    plan                TEXT DEFAULT 'free',
    account_status      TEXT DEFAULT 'active',
    payment_status      TEXT DEFAULT 'none',
    subscription_status TEXT DEFAULT 'free_plan',
    created_at          TIMESTAMPTZ DEFAULT now()
);

-- Test data (skip if already inserted)
INSERT INTO customers (name, email, plan, account_status, payment_status, subscription_status)
VALUES
    ('John Doe',   'john@example.com',   'premium',    'active',     'completed', 'active_premium'),
    ('Sarah Smith', 'sarah@example.com',  'free',       'active',     'none',      'free_plan'),
    ('Alex Kim',   'alex@example.com',   'premium',    'restricted', 'failed',    'inactive_payment_failed')
ON CONFLICT (email) DO NOTHING;


-- =====================
-- 2. USERS (support agents / admin)
-- =====================
-- For authentication. In production, use Supabase Auth instead.

CREATE TABLE IF NOT EXISTS users (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email       TEXT UNIQUE NOT NULL,
    full_name   TEXT NOT NULL,
    role        TEXT DEFAULT 'agent' CHECK (role IN ('admin', 'agent')),
    created_at  TIMESTAMPTZ DEFAULT now()
);

-- Test agents
INSERT INTO users (email, full_name, role)
VALUES
    ('admin@novaware.com', 'Admin User', 'admin'),
    ('agent@novaware.com', 'Support Agent', 'agent')
ON CONFLICT (email) DO NOTHING;


-- =====================
-- 3. SUPPORT TICKETS
-- =====================
-- The core entity. Every customer request becomes a ticket.
-- Tickets exist even if AI fails.

CREATE TABLE IF NOT EXISTS support_tickets (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    customer_id     BIGINT REFERENCES customers(id) ON DELETE SET NULL,
    conversation_id BIGINT DEFAULT NULL,
    subject         TEXT NOT NULL,
    message         TEXT NOT NULL,
    status          TEXT DEFAULT 'OPEN'
                        CHECK (status IN (
                            'OPEN', 'IN_PROGRESS', 'WAITING_FOR_CUSTOMER',
                            'RESOLVED', 'ESCALATED', 'CLOSED'
                        )),
    priority        TEXT DEFAULT 'MEDIUM'
                        CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
    category        TEXT DEFAULT 'OTHER'
                        CHECK (category IN (
                            'ACCOUNT', 'BILLING', 'TECHNICAL', 'REFUND',
                            'SECURITY', 'FEATURE_REQUEST', 'GENERAL', 'OTHER'
                        )),
    assigned_to     UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tickets_status   ON support_tickets(status);
CREATE INDEX IF NOT EXISTS idx_tickets_priority ON support_tickets(priority);
CREATE INDEX IF NOT EXISTS idx_tickets_customer ON support_tickets(customer_id);


-- =====================
-- 4. CONVERSATIONS
-- =====================
-- Live chat sessions. Can exist without a ticket.
-- When customer creates a ticket from chat, ticket_id gets set.

CREATE TABLE IF NOT EXISTS conversations (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    customer_email  TEXT NOT NULL,
    ticket_id       BIGINT DEFAULT NULL REFERENCES support_tickets(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ DEFAULT now()
);

-- Link support_tickets back to conversations
ALTER TABLE support_tickets
    ADD CONSTRAINT fk_ticket_conversation
    FOREIGN KEY (conversation_id) REFERENCES conversations(id)
    ON DELETE SET NULL;


-- =====================
-- 5. MESSAGES
-- =====================
-- Every message in a conversation — customer, AI, agent, or system.

CREATE TABLE IF NOT EXISTS messages (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    conversation_id BIGINT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    sender_type     TEXT NOT NULL CHECK (sender_type IN ('customer', 'ai', 'agent', 'system')),
    content         TEXT NOT NULL,
    created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);


-- =====================
-- 6. AI ANALYSES
-- =====================
-- One row per ticket AI analysis. This is the traceability layer.
-- Stores what AI decided, why, and what happened after.

CREATE TABLE IF NOT EXISTS ai_analyses (
    id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    ticket_id           BIGINT NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
    intent              TEXT,
    category            TEXT,
    priority            TEXT,
    confidence          REAL,
    reasoning_summary   TEXT,
    recommended_action  TEXT,
    final_decision      TEXT,
    suggested_response  TEXT,
    knowledge_used      TEXT[] DEFAULT '{}',
    model_used          TEXT DEFAULT 'gemini-3.6-flash',
    ai_failed           BOOLEAN DEFAULT false,
    created_at          TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_analyses_ticket ON ai_analyses(ticket_id);


-- =====================
-- 7. ACTIVITY LOGS
-- =====================
-- Audit trail. Records every significant action.

CREATE TABLE IF NOT EXISTS activity_logs (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    ticket_id   BIGINT REFERENCES support_tickets(id) ON DELETE SET NULL,
    actor       TEXT NOT NULL,
    action      TEXT NOT NULL,
    details     JSONB DEFAULT '{}',
    created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_activity_ticket ON activity_logs(ticket_id);


-- ============================================================
-- FUNCTIONS
-- ============================================================

-- Get customer by ID
CREATE OR REPLACE FUNCTION get_customer_by_id(p_customer_id BIGINT)
RETURNS SETOF customers
LANGUAGE sql STABLE
AS $$
    SELECT * FROM customers WHERE id = p_customer_id;
$$;

-- Get customer by email
CREATE OR REPLACE FUNCTION get_customer_by_email(p_email TEXT)
RETURNS SETOF customers
LANGUAGE sql STABLE
AS $$
    SELECT * FROM customers WHERE email = p_email;
$$;

-- Get customer history (previous tickets)
CREATE OR REPLACE FUNCTION get_customer_history(p_customer_id BIGINT)
RETURNS TABLE (
    ticket_id   BIGINT,
    subject     TEXT,
    status      TEXT,
    priority    TEXT,
    created_at  TIMESTAMPTZ
)
LANGUAGE sql STABLE
AS $$
    SELECT id, subject, status, priority, created_at
    FROM support_tickets
    WHERE customer_id = p_customer_id
    ORDER BY created_at DESC
    LIMIT 10;
$$;

-- Get ticket with its latest AI analysis
CREATE OR REPLACE FUNCTION get_ticket_with_analysis(p_ticket_id BIGINT)
RETURNS JSON
LANGUAGE plpgsql STABLE
AS $$
DECLARE
    result JSON;
BEGIN
    SELECT json_build_object(
        'ticket', json_build_object(
            'id', t.id,
            'subject', t.subject,
            'message', t.message,
            'status', t.status,
            'priority', t.priority,
            'category', t.category,
            'customer_id', t.customer_id,
            'created_at', t.created_at
        ),
        'customer', json_build_object(
            'id', c.id,
            'name', c.name,
            'email', c.email,
            'plan', c.plan,
            'payment_status', c.payment_status,
            'subscription_status', c.subscription_status
        ),
        'analysis', (
            SELECT json_build_object(
                'intent', a.intent,
                'category', a.category,
                'priority', a.priority,
                'confidence', a.confidence,
                'reasoning_summary', a.reasoning_summary,
                'recommended_action', a.recommended_action,
                'final_decision', a.final_decision,
                'suggested_response', a.suggested_response,
                'knowledge_used', a.knowledge_used,
                'ai_failed', a.ai_failed,
                'created_at', a.created_at
            )
            FROM ai_analyses a
            WHERE a.ticket_id = t.id
            ORDER BY a.created_at DESC
            LIMIT 1
        )
    ) INTO result
    FROM support_tickets t
    LEFT JOIN customers c ON t.customer_id = c.id
    WHERE t.id = p_ticket_id;

    RETURN result;
END;
$$;

-- Search tickets with filters
CREATE OR REPLACE FUNCTION search_tickets(
    p_status   TEXT DEFAULT NULL,
    p_priority TEXT DEFAULT NULL,
    p_category TEXT DEFAULT NULL,
    p_limit    INT  DEFAULT 50
)
RETURNS TABLE (
    ticket_id   BIGINT,
    customer_name TEXT,
    subject     TEXT,
    status      TEXT,
    priority    TEXT,
    category    TEXT,
    created_at  TIMESTAMPTZ
)
LANGUAGE sql STABLE
AS $$
    SELECT
        t.id,
        COALESCE(c.name, 'Unknown'),
        t.subject,
        t.status,
        t.priority,
        t.category,
        t.created_at
    FROM support_tickets t
    LEFT JOIN customers c ON t.customer_id = c.id
    WHERE
        (p_status   IS NULL OR t.status   = p_status) AND
        (p_priority IS NULL OR t.priority = p_priority) AND
        (p_category IS NULL OR t.category = p_category)
    ORDER BY t.created_at DESC
    LIMIT p_limit;
$$;

-- ============================================================
-- DONE. 7 tables, 6 functions, ready for the backend.
-- ============================================================
