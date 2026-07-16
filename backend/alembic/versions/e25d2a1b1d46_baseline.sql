--
-- PostgreSQL database dump
--


-- Dumped from database version 16.13
-- Dumped by pg_dump version 16.13


--
-- Name: anomaly_thresholds; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.anomaly_thresholds (
    id uuid NOT NULL,
    workspace_id character varying(255) NOT NULL,
    dimension_type character varying(100) NOT NULL,
    dimension_value character varying(500) NOT NULL,
    window_days integer DEFAULT 14 NOT NULL,
    sigma_threshold numeric(5,2) DEFAULT 3.0 NOT NULL,
    drift_threshold_pct numeric(5,2) DEFAULT 10.0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: api_keys; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.api_keys (
    id uuid NOT NULL,
    workspace_id character varying(255) NOT NULL,
    user_id uuid NOT NULL,
    name character varying(255) NOT NULL,
    key_hash character varying(64) NOT NULL,
    key_prefix character varying(16) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    last_used_at timestamp with time zone,
    revoked_at timestamp with time zone
);


--
-- Name: attribution_rules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.attribution_rules (
    id uuid NOT NULL,
    workspace_id character varying(255) NOT NULL,
    name character varying(255) NOT NULL,
    dimension character varying(100) NOT NULL,
    source_type character varying(50) NOT NULL,
    priority integer DEFAULT 0 NOT NULL,
    mapping_config jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: audit_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_events (
    id uuid NOT NULL,
    workspace_id character varying(255) NOT NULL,
    "user" character varying(255) NOT NULL,
    action character varying(100) NOT NULL,
    entity_type character varying(100) NOT NULL,
    entity_id character varying(500),
    before_value jsonb,
    after_value jsonb,
    details text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: automation_toggles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.automation_toggles (
    id uuid NOT NULL,
    workspace_id uuid NOT NULL,
    domain character varying(100) NOT NULL,
    paused boolean NOT NULL
);


--
-- Name: aws_accounts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.aws_accounts (
    id uuid NOT NULL,
    workspace_id character varying(255) NOT NULL,
    aws_account_id character varying(12) NOT NULL,
    alias character varying(255) NOT NULL,
    role_arn character varying(2048) NOT NULL,
    status character varying(20) DEFAULT 'disconnected'::character varying NOT NULL,
    environment_label character varying(50) DEFAULT 'production'::character varying NOT NULL,
    status_message character varying(1024),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    cur_s3_bucket character varying(255),
    cur_s3_prefix character varying(1024),
    cur_report_name character varying(255),
    aws_access_key_id character varying(255),
    aws_secret_access_key character varying(255),
    external_id character varying(255),
    cur_managed_by_numio boolean DEFAULT false NOT NULL
);


--
-- Name: budgets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.budgets (
    id uuid NOT NULL,
    workspace_id character varying(255) NOT NULL,
    name character varying(255) NOT NULL,
    amount numeric(20,2) NOT NULL,
    currency character varying(10) DEFAULT 'USD'::character varying NOT NULL,
    period character varying(20) NOT NULL,
    dimension character varying(100) NOT NULL,
    dimension_value character varying(255) NOT NULL,
    alert_thresholds jsonb DEFAULT '[50, 80, 100]'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: campaign_resources; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.campaign_resources (
    id uuid NOT NULL,
    campaign_id uuid NOT NULL,
    resource_id uuid NOT NULL,
    remediation_status character varying(50) DEFAULT 'pending'::character varying NOT NULL,
    inferred_owner character varying(255),
    violated_rules jsonb,
    tag_commands jsonb,
    resource_cost numeric(20,10) DEFAULT 0 NOT NULL,
    status_updated_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: chat_messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.chat_messages (
    id uuid NOT NULL,
    session_id uuid NOT NULL,
    role character varying(20) NOT NULL,
    content text NOT NULL,
    data jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: chat_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.chat_sessions (
    id uuid NOT NULL,
    workspace_id character varying(255) NOT NULL,
    title character varying(500),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    last_activity_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: cloud_resources; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cloud_resources (
    id uuid NOT NULL,
    workspace_id character varying(255) NOT NULL,
    account_id character varying(12) NOT NULL,
    region character varying(50) NOT NULL,
    service character varying(50) NOT NULL,
    resource_type character varying(100) NOT NULL,
    resource_id character varying(512) NOT NULL,
    arn character varying(2048),
    name character varying(512),
    state character varying(50),
    creation_date timestamp with time zone,
    tags jsonb,
    resource_metadata jsonb,
    first_seen_at timestamp with time zone DEFAULT now() NOT NULL,
    last_seen_at timestamp with time zone DEFAULT now() NOT NULL,
    terminated_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: compliance_results; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.compliance_results (
    id uuid NOT NULL,
    workspace_id character varying(255) NOT NULL,
    audit_run_id uuid NOT NULL,
    resource_id uuid NOT NULL,
    policy_id uuid NOT NULL,
    rule_id uuid NOT NULL,
    status character varying(50) NOT NULL,
    current_value character varying(512),
    resource_cost numeric(20,10) DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: compliance_snapshots; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.compliance_snapshots (
    id uuid NOT NULL,
    workspace_id character varying(255) NOT NULL,
    audit_run_id uuid NOT NULL,
    snapshot_date timestamp with time zone DEFAULT now() NOT NULL,
    dimension character varying(50) NOT NULL,
    dimension_value character varying(255),
    cost_weighted_score numeric(10,4) NOT NULL,
    total_cost numeric(20,10) DEFAULT 0 NOT NULL,
    compliant_cost numeric(20,10) DEFAULT 0 NOT NULL,
    total_resources integer DEFAULT 0 NOT NULL,
    compliant_resources integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: cost_records; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cost_records (
    id uuid NOT NULL,
    workspace_id character varying(255) NOT NULL,
    provider character varying(50) NOT NULL,
    data_source character varying(50) NOT NULL,
    tenant character varying(255),
    api_key character varying(255),
    line_item_id character varying(255) NOT NULL,
    billing_period date NOT NULL,
    payer_account_id character varying(50),
    usage_account_id character varying(50) NOT NULL,
    usage_start timestamp with time zone NOT NULL,
    usage_end timestamp with time zone NOT NULL,
    service character varying(255) NOT NULL,
    region character varying(100),
    availability_zone character varying(100),
    resource_id character varying(512),
    instance_type character varying(100),
    usage_type character varying(255),
    operation character varying(255),
    line_item_type character varying(50) NOT NULL,
    unblended_cost numeric(20,10) NOT NULL,
    blended_cost numeric(20,10),
    net_unblended_cost numeric(20,10),
    usage_amount numeric(20,10),
    currency character varying(10) NOT NULL,
    tags jsonb,
    cost_category jsonb,
    product_details jsonb,
    pricing jsonb,
    reservation jsonb,
    savings_plan jsonb,
    discount jsonb,
    bill_details jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: finding_transitions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.finding_transitions (
    id uuid NOT NULL,
    finding_id uuid NOT NULL,
    from_status character varying(20) NOT NULL,
    to_status character varying(20) NOT NULL,
    changed_by character varying(255),
    reason text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: findings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.findings (
    id uuid NOT NULL,
    workspace_id character varying(255) NOT NULL,
    type character varying(50) NOT NULL,
    severity character varying(20) NOT NULL,
    status character varying(20) DEFAULT 'open'::character varying NOT NULL,
    title character varying(500) NOT NULL,
    description text,
    resource_id character varying(500) NOT NULL,
    detection_source character varying(100) NOT NULL,
    suggested_action text,
    estimated_cost_impact numeric(20,10),
    suppression_reason text,
    detected_at timestamp with time zone DEFAULT now() NOT NULL,
    last_seen_at timestamp with time zone DEFAULT now() NOT NULL,
    acknowledged_at timestamp with time zone,
    resolved_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: infra_policies; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.infra_policies (
    id uuid NOT NULL,
    workspace_id character varying(255) NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    type character varying(50) NOT NULL,
    severity character varying(20) NOT NULL,
    rule jsonb NOT NULL,
    applicability jsonb DEFAULT '{}'::jsonb NOT NULL,
    is_guardrail boolean DEFAULT false NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    compliance_percentage numeric(5,2),
    last_evaluated_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: ingestion_statuses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ingestion_statuses (
    id uuid NOT NULL,
    workspace_id character varying(255) NOT NULL,
    account_id character varying(255) NOT NULL,
    data_source character varying(255) NOT NULL,
    last_sync_at timestamp with time zone,
    last_status character varying(50) DEFAULT '''never'''::character varying NOT NULL,
    record_count integer DEFAULT 0 NOT NULL,
    error_details text,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: job_run_accounts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.job_run_accounts (
    id uuid NOT NULL,
    job_run_id uuid NOT NULL,
    account_id character varying(255) NOT NULL,
    status character varying(50) NOT NULL,
    record_count integer DEFAULT 0 NOT NULL,
    error_details text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: job_runs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.job_runs (
    id uuid NOT NULL,
    workspace_id character varying(255) NOT NULL,
    job_type character varying(255) NOT NULL,
    status character varying(50) NOT NULL,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    finished_at timestamp with time zone,
    error_details text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: notification_preferences; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notification_preferences (
    id uuid NOT NULL,
    workspace_id character varying(255) NOT NULL,
    user_id character varying(255) NOT NULL,
    event_type character varying(50) NOT NULL,
    enabled boolean DEFAULT true NOT NULL
);


--
-- Name: notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notifications (
    id uuid NOT NULL,
    workspace_id character varying(255) NOT NULL,
    event_type character varying(50) NOT NULL,
    title character varying(500) NOT NULL,
    message text,
    entity_type character varying(100),
    entity_id character varying(500),
    is_read boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: onboarding_in_progress; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.onboarding_in_progress (
    id uuid NOT NULL,
    workspace_id uuid NOT NULL,
    label character varying(64) NOT NULL,
    step character varying(16) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: recommendations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.recommendations (
    id uuid NOT NULL,
    workspace_id character varying(255) NOT NULL,
    finding_id uuid,
    category character varying(50) NOT NULL,
    status character varying(20) DEFAULT 'open'::character varying NOT NULL,
    confidence character varying(20) DEFAULT 'medium'::character varying NOT NULL,
    title character varying(500) NOT NULL,
    description text,
    resource_id character varying(500) NOT NULL,
    remediation_commands text,
    estimated_monthly_savings numeric(20,10),
    actual_savings numeric(20,10),
    savings_data_label character varying(20),
    accepted_at timestamp with time zone,
    implemented_at timestamp with time zone,
    dismissed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: remediation_campaigns; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.remediation_campaigns (
    id uuid NOT NULL,
    workspace_id character varying(255) NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    deadline timestamp with time zone,
    target_compliance_goal numeric(5,2),
    status character varying(50) DEFAULT 'active'::character varying NOT NULL,
    before_compliance_score numeric(10,4),
    resource_count integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: tag_policies; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tag_policies (
    id uuid NOT NULL,
    workspace_id character varying(255) NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    priority integer,
    is_active boolean DEFAULT true NOT NULL,
    created_by character varying(255),
    updated_by character varying(255),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: tag_policy_rules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tag_policy_rules (
    id uuid NOT NULL,
    policy_id uuid NOT NULL,
    tag_name character varying(255) NOT NULL,
    value_type character varying(50) DEFAULT 'string'::character varying NOT NULL,
    allowed_values jsonb,
    default_value character varying(512),
    applicable_resource_types jsonb,
    applicable_accounts jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id uuid NOT NULL,
    workspace_id uuid NOT NULL,
    email character varying(255) NOT NULL,
    name character varying(255) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    role character varying(50) DEFAULT 'viewer'::character varying NOT NULL,
    cognito_sub character varying(255),
    is_active boolean DEFAULT true NOT NULL
);


--
-- Name: workspaces; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.workspaces (
    id uuid NOT NULL,
    name character varying(255) NOT NULL,
    slug character varying(255) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    default_currency character varying(10) DEFAULT 'USD'::character varying NOT NULL,
    timezone character varying(64) DEFAULT 'UTC'::character varying NOT NULL,
    data_retention_days integer DEFAULT 365 NOT NULL,
    automation_paused boolean DEFAULT false NOT NULL,
    external_id uuid DEFAULT gen_random_uuid() NOT NULL
);


--
-- Name: zombie_thresholds; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.zombie_thresholds (
    id uuid NOT NULL,
    workspace_id character varying(255) NOT NULL,
    threshold_key character varying(100) NOT NULL,
    threshold_value numeric(10,2) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: anomaly_thresholds anomaly_thresholds_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.anomaly_thresholds
    ADD CONSTRAINT anomaly_thresholds_pkey PRIMARY KEY (id);


--
-- Name: api_keys api_keys_key_hash_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.api_keys
    ADD CONSTRAINT api_keys_key_hash_key UNIQUE (key_hash);


--
-- Name: api_keys api_keys_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.api_keys
    ADD CONSTRAINT api_keys_pkey PRIMARY KEY (id);


--
-- Name: attribution_rules attribution_rules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attribution_rules
    ADD CONSTRAINT attribution_rules_pkey PRIMARY KEY (id);


--
-- Name: audit_events audit_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_events
    ADD CONSTRAINT audit_events_pkey PRIMARY KEY (id);


--
-- Name: automation_toggles automation_toggles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.automation_toggles
    ADD CONSTRAINT automation_toggles_pkey PRIMARY KEY (id);


--
-- Name: aws_accounts aws_accounts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.aws_accounts
    ADD CONSTRAINT aws_accounts_pkey PRIMARY KEY (id);


--
-- Name: budgets budgets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.budgets
    ADD CONSTRAINT budgets_pkey PRIMARY KEY (id);


--
-- Name: campaign_resources campaign_resources_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_resources
    ADD CONSTRAINT campaign_resources_pkey PRIMARY KEY (id);


--
-- Name: chat_messages chat_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_messages
    ADD CONSTRAINT chat_messages_pkey PRIMARY KEY (id);


--
-- Name: chat_sessions chat_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_sessions
    ADD CONSTRAINT chat_sessions_pkey PRIMARY KEY (id);


--
-- Name: cloud_resources cloud_resources_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cloud_resources
    ADD CONSTRAINT cloud_resources_pkey PRIMARY KEY (id);


--
-- Name: compliance_results compliance_results_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.compliance_results
    ADD CONSTRAINT compliance_results_pkey PRIMARY KEY (id);


--
-- Name: compliance_snapshots compliance_snapshots_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.compliance_snapshots
    ADD CONSTRAINT compliance_snapshots_pkey PRIMARY KEY (id);


--
-- Name: cost_records cost_records_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cost_records
    ADD CONSTRAINT cost_records_pkey PRIMARY KEY (id);


--
-- Name: finding_transitions finding_transitions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finding_transitions
    ADD CONSTRAINT finding_transitions_pkey PRIMARY KEY (id);


--
-- Name: findings findings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.findings
    ADD CONSTRAINT findings_pkey PRIMARY KEY (id);


--
-- Name: infra_policies infra_policies_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.infra_policies
    ADD CONSTRAINT infra_policies_pkey PRIMARY KEY (id);


--
-- Name: ingestion_statuses ingestion_statuses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ingestion_statuses
    ADD CONSTRAINT ingestion_statuses_pkey PRIMARY KEY (id);


--
-- Name: job_run_accounts job_run_accounts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_run_accounts
    ADD CONSTRAINT job_run_accounts_pkey PRIMARY KEY (id);


--
-- Name: job_runs job_runs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_runs
    ADD CONSTRAINT job_runs_pkey PRIMARY KEY (id);


--
-- Name: notification_preferences notification_preferences_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_preferences
    ADD CONSTRAINT notification_preferences_pkey PRIMARY KEY (id);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- Name: onboarding_in_progress onboarding_in_progress_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.onboarding_in_progress
    ADD CONSTRAINT onboarding_in_progress_pkey PRIMARY KEY (id);


--
-- Name: recommendations recommendations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recommendations
    ADD CONSTRAINT recommendations_pkey PRIMARY KEY (id);


--
-- Name: remediation_campaigns remediation_campaigns_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.remediation_campaigns
    ADD CONSTRAINT remediation_campaigns_pkey PRIMARY KEY (id);


--
-- Name: tag_policies tag_policies_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tag_policies
    ADD CONSTRAINT tag_policies_pkey PRIMARY KEY (id);


--
-- Name: tag_policy_rules tag_policy_rules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tag_policy_rules
    ADD CONSTRAINT tag_policy_rules_pkey PRIMARY KEY (id);


--
-- Name: onboarding_in_progress uq_onboarding_in_progress_workspace_id; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.onboarding_in_progress
    ADD CONSTRAINT uq_onboarding_in_progress_workspace_id UNIQUE (workspace_id);


--
-- Name: users users_cognito_sub_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_cognito_sub_key UNIQUE (cognito_sub);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: workspaces workspaces_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspaces
    ADD CONSTRAINT workspaces_pkey PRIMARY KEY (id);


--
-- Name: workspaces workspaces_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspaces
    ADD CONSTRAINT workspaces_slug_key UNIQUE (slug);


--
-- Name: zombie_thresholds zombie_thresholds_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.zombie_thresholds
    ADD CONSTRAINT zombie_thresholds_pkey PRIMARY KEY (id);


--
-- Name: ix_anomaly_thresholds_workspace_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_anomaly_thresholds_workspace_id ON public.anomaly_thresholds USING btree (workspace_id);


--
-- Name: ix_api_keys_key_hash; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_api_keys_key_hash ON public.api_keys USING btree (key_hash);


--
-- Name: ix_api_keys_workspace_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_api_keys_workspace_id ON public.api_keys USING btree (workspace_id);


--
-- Name: ix_attribution_rules_workspace_dimension; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_attribution_rules_workspace_dimension ON public.attribution_rules USING btree (workspace_id, dimension);


--
-- Name: ix_attribution_rules_workspace_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_attribution_rules_workspace_id ON public.attribution_rules USING btree (workspace_id);


--
-- Name: ix_audit_events_action; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_audit_events_action ON public.audit_events USING btree (action);


--
-- Name: ix_audit_events_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_audit_events_created_at ON public.audit_events USING btree (created_at);


--
-- Name: ix_audit_events_entity_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_audit_events_entity_type ON public.audit_events USING btree (entity_type);


--
-- Name: ix_audit_events_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_audit_events_user ON public.audit_events USING btree ("user");


--
-- Name: ix_audit_events_workspace_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_audit_events_workspace_id ON public.audit_events USING btree (workspace_id);


--
-- Name: ix_automation_toggles_workspace_domain; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ix_automation_toggles_workspace_domain ON public.automation_toggles USING btree (workspace_id, domain);


--
-- Name: ix_aws_accounts_workspace_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_aws_accounts_workspace_id ON public.aws_accounts USING btree (workspace_id);


--
-- Name: ix_budgets_dimension; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_budgets_dimension ON public.budgets USING btree (workspace_id, dimension);


--
-- Name: ix_budgets_workspace_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_budgets_workspace_id ON public.budgets USING btree (workspace_id);


--
-- Name: ix_campaign_resources_campaign_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_campaign_resources_campaign_id ON public.campaign_resources USING btree (campaign_id);


--
-- Name: ix_campaign_resources_resource_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_campaign_resources_resource_id ON public.campaign_resources USING btree (resource_id);


--
-- Name: ix_campaign_resources_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_campaign_resources_status ON public.campaign_resources USING btree (remediation_status);


--
-- Name: ix_chat_messages_session_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_chat_messages_session_id ON public.chat_messages USING btree (session_id);


--
-- Name: ix_chat_sessions_last_activity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_chat_sessions_last_activity ON public.chat_sessions USING btree (workspace_id, last_activity_at);


--
-- Name: ix_chat_sessions_workspace_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_chat_sessions_workspace_id ON public.chat_sessions USING btree (workspace_id);


--
-- Name: ix_cloud_resources_account_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_cloud_resources_account_id ON public.cloud_resources USING btree (account_id);


--
-- Name: ix_cloud_resources_resource_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_cloud_resources_resource_type ON public.cloud_resources USING btree (resource_type);


--
-- Name: ix_cloud_resources_service; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_cloud_resources_service ON public.cloud_resources USING btree (service);


--
-- Name: ix_cloud_resources_tags; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_cloud_resources_tags ON public.cloud_resources USING gin (tags);


--
-- Name: ix_cloud_resources_workspace_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_cloud_resources_workspace_id ON public.cloud_resources USING btree (workspace_id);


--
-- Name: ix_compliance_results_audit_run_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_compliance_results_audit_run_id ON public.compliance_results USING btree (audit_run_id);


--
-- Name: ix_compliance_results_policy_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_compliance_results_policy_id ON public.compliance_results USING btree (policy_id);


--
-- Name: ix_compliance_results_resource_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_compliance_results_resource_id ON public.compliance_results USING btree (resource_id);


--
-- Name: ix_compliance_results_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_compliance_results_status ON public.compliance_results USING btree (status);


--
-- Name: ix_compliance_results_workspace_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_compliance_results_workspace_id ON public.compliance_results USING btree (workspace_id);


--
-- Name: ix_compliance_snapshots_audit_run_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_compliance_snapshots_audit_run_id ON public.compliance_snapshots USING btree (audit_run_id);


--
-- Name: ix_compliance_snapshots_dimension; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_compliance_snapshots_dimension ON public.compliance_snapshots USING btree (dimension);


--
-- Name: ix_compliance_snapshots_snapshot_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_compliance_snapshots_snapshot_date ON public.compliance_snapshots USING btree (snapshot_date);


--
-- Name: ix_compliance_snapshots_workspace_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_compliance_snapshots_workspace_id ON public.compliance_snapshots USING btree (workspace_id);


--
-- Name: ix_cost_records_account_period; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_cost_records_account_period ON public.cost_records USING btree (usage_account_id, billing_period);


--
-- Name: ix_cost_records_provider; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_cost_records_provider ON public.cost_records USING btree (provider);


--
-- Name: ix_cost_records_service; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_cost_records_service ON public.cost_records USING btree (service);


--
-- Name: ix_cost_records_tags; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_cost_records_tags ON public.cost_records USING gin (tags);


--
-- Name: ix_cost_records_workspace_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_cost_records_workspace_id ON public.cost_records USING btree (workspace_id);


--
-- Name: ix_finding_transitions_finding_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_finding_transitions_finding_id ON public.finding_transitions USING btree (finding_id);


--
-- Name: ix_findings_detection_source; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_findings_detection_source ON public.findings USING btree (detection_source);


--
-- Name: ix_findings_severity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_findings_severity ON public.findings USING btree (severity);


--
-- Name: ix_findings_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_findings_status ON public.findings USING btree (status);


--
-- Name: ix_findings_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_findings_type ON public.findings USING btree (type);


--
-- Name: ix_findings_workspace_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_findings_workspace_id ON public.findings USING btree (workspace_id);


--
-- Name: ix_infra_policies_is_guardrail; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_infra_policies_is_guardrail ON public.infra_policies USING btree (workspace_id, is_guardrail);


--
-- Name: ix_infra_policies_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_infra_policies_type ON public.infra_policies USING btree (workspace_id, type);


--
-- Name: ix_infra_policies_workspace_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_infra_policies_workspace_id ON public.infra_policies USING btree (workspace_id);


--
-- Name: ix_ingestion_statuses_workspace_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_ingestion_statuses_workspace_id ON public.ingestion_statuses USING btree (workspace_id);


--
-- Name: ix_job_runs_workspace_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_job_runs_workspace_id ON public.job_runs USING btree (workspace_id);


--
-- Name: ix_notifications_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_notifications_created_at ON public.notifications USING btree (created_at);


--
-- Name: ix_notifications_event_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_notifications_event_type ON public.notifications USING btree (event_type);


--
-- Name: ix_notifications_is_read; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_notifications_is_read ON public.notifications USING btree (is_read);


--
-- Name: ix_notifications_workspace_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_notifications_workspace_id ON public.notifications USING btree (workspace_id);


--
-- Name: ix_recommendations_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_recommendations_category ON public.recommendations USING btree (category);


--
-- Name: ix_recommendations_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_recommendations_status ON public.recommendations USING btree (status);


--
-- Name: ix_recommendations_workspace_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_recommendations_workspace_id ON public.recommendations USING btree (workspace_id);


--
-- Name: ix_remediation_campaigns_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_remediation_campaigns_status ON public.remediation_campaigns USING btree (status);


--
-- Name: ix_remediation_campaigns_workspace_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_remediation_campaigns_workspace_id ON public.remediation_campaigns USING btree (workspace_id);


--
-- Name: ix_tag_policies_workspace_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_tag_policies_workspace_id ON public.tag_policies USING btree (workspace_id);


--
-- Name: ix_tag_policy_rules_policy_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_tag_policy_rules_policy_id ON public.tag_policy_rules USING btree (policy_id);


--
-- Name: ix_users_workspace_email; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ix_users_workspace_email ON public.users USING btree (workspace_id, email);


--
-- Name: ix_zombie_thresholds_workspace_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_zombie_thresholds_workspace_id ON public.zombie_thresholds USING btree (workspace_id);


--
-- Name: uq_anomaly_thresholds_dim; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_anomaly_thresholds_dim ON public.anomaly_thresholds USING btree (workspace_id, dimension_type, dimension_value);


--
-- Name: uq_budgets_workspace_name; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_budgets_workspace_name ON public.budgets USING btree (workspace_id, name);


--
-- Name: uq_campaign_resources_campaign_resource; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_campaign_resources_campaign_resource ON public.campaign_resources USING btree (campaign_id, resource_id);


--
-- Name: uq_cloud_resources_account_service_resource; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_cloud_resources_account_service_resource ON public.cloud_resources USING btree (account_id, service, resource_id);


--
-- Name: uq_cost_records_source_line_item; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_cost_records_source_line_item ON public.cost_records USING btree (data_source, line_item_id);


--
-- Name: uq_findings_dedup; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_findings_dedup ON public.findings USING btree (workspace_id, type, resource_id, detection_source);


--
-- Name: uq_infra_policies_workspace_name; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_infra_policies_workspace_name ON public.infra_policies USING btree (workspace_id, name);


--
-- Name: uq_notification_pref; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_notification_pref ON public.notification_preferences USING btree (workspace_id, user_id, event_type);


--
-- Name: uq_recommendations_finding; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_recommendations_finding ON public.recommendations USING btree (workspace_id, finding_id);


--
-- Name: uq_tag_policies_workspace_name; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_tag_policies_workspace_name ON public.tag_policies USING btree (workspace_id, name);


--
-- Name: uq_workspace_aws_account; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_workspace_aws_account ON public.aws_accounts USING btree (workspace_id, aws_account_id);


--
-- Name: uq_zombie_thresholds_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_zombie_thresholds_key ON public.zombie_thresholds USING btree (workspace_id, threshold_key);


--
-- Name: api_keys api_keys_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.api_keys
    ADD CONSTRAINT api_keys_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: automation_toggles automation_toggles_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.automation_toggles
    ADD CONSTRAINT automation_toggles_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: campaign_resources campaign_resources_campaign_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_resources
    ADD CONSTRAINT campaign_resources_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.remediation_campaigns(id) ON DELETE CASCADE;


--
-- Name: campaign_resources campaign_resources_resource_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_resources
    ADD CONSTRAINT campaign_resources_resource_id_fkey FOREIGN KEY (resource_id) REFERENCES public.cloud_resources(id) ON DELETE CASCADE;


--
-- Name: chat_messages chat_messages_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_messages
    ADD CONSTRAINT chat_messages_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.chat_sessions(id) ON DELETE CASCADE;


--
-- Name: compliance_results compliance_results_audit_run_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.compliance_results
    ADD CONSTRAINT compliance_results_audit_run_id_fkey FOREIGN KEY (audit_run_id) REFERENCES public.job_runs(id) ON DELETE CASCADE;


--
-- Name: compliance_results compliance_results_policy_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.compliance_results
    ADD CONSTRAINT compliance_results_policy_id_fkey FOREIGN KEY (policy_id) REFERENCES public.tag_policies(id) ON DELETE CASCADE;


--
-- Name: compliance_results compliance_results_resource_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.compliance_results
    ADD CONSTRAINT compliance_results_resource_id_fkey FOREIGN KEY (resource_id) REFERENCES public.cloud_resources(id) ON DELETE CASCADE;


--
-- Name: compliance_results compliance_results_rule_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.compliance_results
    ADD CONSTRAINT compliance_results_rule_id_fkey FOREIGN KEY (rule_id) REFERENCES public.tag_policy_rules(id) ON DELETE CASCADE;


--
-- Name: compliance_snapshots compliance_snapshots_audit_run_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.compliance_snapshots
    ADD CONSTRAINT compliance_snapshots_audit_run_id_fkey FOREIGN KEY (audit_run_id) REFERENCES public.job_runs(id) ON DELETE CASCADE;


--
-- Name: finding_transitions finding_transitions_finding_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finding_transitions
    ADD CONSTRAINT finding_transitions_finding_id_fkey FOREIGN KEY (finding_id) REFERENCES public.findings(id) ON DELETE CASCADE;


--
-- Name: job_run_accounts job_run_accounts_job_run_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_run_accounts
    ADD CONSTRAINT job_run_accounts_job_run_id_fkey FOREIGN KEY (job_run_id) REFERENCES public.job_runs(id) ON DELETE CASCADE;


--
-- Name: onboarding_in_progress onboarding_in_progress_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.onboarding_in_progress
    ADD CONSTRAINT onboarding_in_progress_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: recommendations recommendations_finding_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recommendations
    ADD CONSTRAINT recommendations_finding_id_fkey FOREIGN KEY (finding_id) REFERENCES public.findings(id) ON DELETE SET NULL;


--
-- Name: tag_policy_rules tag_policy_rules_policy_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tag_policy_rules
    ADD CONSTRAINT tag_policy_rules_policy_id_fkey FOREIGN KEY (policy_id) REFERENCES public.tag_policies(id) ON DELETE CASCADE;


--
-- Name: users users_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--


