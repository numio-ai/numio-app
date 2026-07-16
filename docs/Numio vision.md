—----------------  
Date: 2026/03/04  
—----------------

# **Numio vision**

*A cost-control and FinOps observability agent for enterprise cloud and AI workloads.*

## **Overview**

Numio is a FinOps agent and co-pilot for continuous cloud cost monitoring, control, and management. It continuously tracks usage and costs, and explains what is happening in plain language, and helps operators enforce policies and trigger cost-saving actions. In simple, low-risk scenarios, Numio can also act autonomously when explicitly enabled.

Numio supports both classic enterprise workloads and modern AI-driven usage, including LLM APIs, GPUs, and Kubernetes. For AI/GenAI, it enforces practical governance: cost per 1,000 tokens / per inference, R\&D vs production boundaries, and GPU utilization / idle detection.

Teams typically adopt Numio in phases: connect and observe (read-only), define budgets and guardrails, run in recommendation mode, then enable guarded automation for narrow low-risk actions once policies and owners are in place.

### **Cost attribution, allocation, and organizational visibility**

Numio answers "what costs what and who owns it" across your entire cloud and AI footprint. This is the foundation for accountability and action.

* Attributes costs to teams, products, projects, environments, applications, and other configurable “dimensions”  
* Supports multi-cloud attribution (AWS, GCP, Azure) and AI API providers (OpenAI, Anthropic, etc.)  
* Enforces tagging standards and flags untagged or misattributed resources  
* Provides cost views with trend analysis per configurable dimensions, e.g. per-team, per-project, etc  
* Maps resource ownership so issues can be routed to the right people

### **Continuous cost monitoring and reporting**

Numio continuously monitors cloud and API spend to identify cost-saving opportunities. It:

* Detects spending spikes, anomalies, and cost drift  
* Identifies orphaned, idle or underutilized resources and resources missing required tags (“Zombie Hunter”)  
* Explains issues clearly: what changed, why it matters, and where costs originate  
* Generates recurring outputs such as monthly reviews and trend summaries

### **Cost optimization**

Numio analyzes cloud architecture and workload behavior to identify cost and efficiency improvements. It:

* Proposes concrete action items and cost-saving plans  
* Supports cross-cloud analysis and optimization decisions  
* Tracks spend, savings, and trends over time

### **Budgets and policy guardrails**

Numio helps teams govern spend using clear, enforceable policies. It:

* Maintains budgets and alerts on overruns  
* Enforces policy guardrails and flags violations  
* Answers natural-language questions about policies using internal documentation

### **Operations and management**

Numio supports continuous operational hygiene and cost control.

* Notifies and alerts users of cost and policy events  
* Opens tickets or routes issues to owners  
* Triggers cost-saving actions under human supervision  
* Suggests remediation commands under human supervision (for example, stopping idle GPU nodes, hibernating unused instances, or removing orphaned storage).  
* Acts autonomously in narrow, low-risk scenarios when explicitly enabled

---

## **Scenarios**

### **Cloud cost overview**

A VP of Engineering wants to know what the company spent last week and whether anything looks off — without logging into three consoles. Numio shows a single consolidated cost breakdown across AWS, GCP, and OpenAI. She asks “Why did costs jump in January?” and gets a direct answer in seconds.

### **Cloud cost overview**

A VP of Engineering wants to know what the company spent last week and whether anything looks off — without logging into three consoles. Numio shows a single consolidated cost breakdown across AWS, GCP, and OpenAI. She asks “Why did costs jump in January?” and gets a direct answer in seconds.

### **Cost Allocation Coverage**

A FinOps lead discovers that 35% of cloud spend cannot be tied to any team or project. Numio audits all resources, flags those with missing or inconsistent tags, notifies likely owners, and runs attribution campaigns until compliance is resolved. Leadership gets clean drill-down views — from company level to individual project.

### **Budget control and Overrun Prevention**

A business unit is burning through its monthly budget 40% faster than expected, but the only alert is set to fire at 100% — too late to act. Numio detects the run-rate trend early, identifies the three services driving it, and alerts both engineering and finance with a concise action plan. Leadership intervenes before the breach.

### **LLM usage and AI cost governance**

A company runs OpenAI, Anthropic, and Google Vertex AI across multiple teams — and receives three separate invoices with no breakdown by team or application. Numio's LMGate proxy captures usage in real time, attributes cost by team and use case, and flags inefficient applications. The next month's AI spend drops without any reduction in capability.

### **Enforcing attribution discipline**

A cloud environment has hundreds of resources with missing or stale tags, making cost attribution unreliable and compliance impossible. Numio continuously audits resources against tagging policy, identifies violations by cost impact, and launches targeted campaigns to resolve them — automated outreach, self-service tagging, and escalation for unresolved cases. Tag compliance goes from 61% to 91% in 30 days.

### **Zombie Resource Cleanup**

Over two years of growth, a company accumulates layers of abandoned infrastructure — old snapshots, idle VMs, forgotten dev instances — that collectively cost $18K/month. No single resource is large enough to notice. Numio scans continuously, clusters zombies by cost and likely owner, and generates cleanup tickets with full context. Owners approve; Numio executes with a full audit trail. First campaign eliminates $14K in monthly waste in two weeks.

### **Unexpected API Cost Surge**

Overnight, LLM API spend runs 8× higher than usual. By morning the bill exceeds a week's normal spend. Numio detects the spike in real time, traces it to a code change that removed a rate limit, and routes an alert — with a throttle recommendation — to the on-call engineer and finance lead simultaneously. The fix ships within the hour. The quarter's forecast stays intact.

### **Idle GPU Waste**

An ML team finishes a training run on Friday and forgets to terminate the GPU cluster. Over the weekend, 16 A100 instances run at full cost with zero utilization. Numio detects the idle cluster within hours, notifies the owner, waits out the configured grace period, then suspends it automatically. When the engineer returns Monday, she sees a notification and can resume in one click.

### **Policy Drift Guardrails**

Under deadline pressure, a team deploys a new microservice on an unapproved instance type with missing cost-center tags. Numio evaluates the deployment against infrastructure policy within minutes, flags each violation, and opens a remediation ticket assigned to the service owner. The engineer corrects it the same day — without FinOps ever getting involved manually.

### **Cross-team cost accountability *(new)***

Three product teams share a single AWS account. When the monthly bill spikes, everyone assumes it belongs to someone else. Numio maps every resource to a team, product, and environment, giving each lead a scoped cost view. When spend rises, the right owner is notified immediately. The monthly finance review becomes a 15-minute conversation instead of a two-day investigation.

### **End-of-quarter cost review *(new)***

A VP of Finance needs to close the quarter: actuals vs. budget by team, variance explanations for the CFO, and a savings summary — work that historically takes three days and two analysts. Numio generates the full review on demand from live billing data with attribution already applied. She's done in under an hour.

---

## **Technology (How)**

Numio connects to your cloud accounts, then runs a continuous observe → decide → act loop.

* **Observe** – Ingests billing, usage, and tagging data from AWS, GCP, Azure, AI providers for reporting and attribution.  
* **Decide** – Evaluates spendings and costs drift against FinOps policies, budgets, , and tag requirements.  
* **Act** – Alerts, opens tickets or PR comments, suggests remediation actions, or acts automatically in low-risk scenarios — always with human-in-the-loop approvals.

### **Trust model & safety controls**

Numio is policy-first. Every proposed or automated action is evaluated against: budgets, environment (prod vs non-prod), risk level, and impact thresholds.

Action tiers:

* Inform: detect \+ explain \+ notify  
* Recommend: propose a concrete remediation plan  
* Execute (guarded): low-risk actions only, when explicitly enabled  
* Escalate: require approval for high-impact changes

Operators can pause automation globally or per domain (Andon cord). Automation is narrow by default and expands only as policies and ownership mature.

### **What makes Numio an agent (not a dashboard)**

Numio runs continuously, maintains state (history, baselines, budgets, policies), and uses that context to decide what to do next. It detects drift, reasons over goals and constraints, and triggers workflows or actions under guardrails.

### **Continuous improvement loop**

Every recommendation and action is logged with context, decision rationale, and measured outcome (including savings impact). Outcomes can be labeled (good/neutral/harmful) and fed back into:

* policy refinement  
* safer automation expansion  
* better prioritization and routing  
* improved decision quality over time

---

## **FAQ**

### **How do we allocate and understand cloud and AI costs?**

Numio attributes costs to teams, services, projects, environments, and owners across cloud and AI usage. It enforces tagging standards, flags attribution gaps, and explains cost drivers in plain language.

### **How do we govern cloud and AI spend?**

Through explicit budgets and policies. Numio continuously evaluates usage against them, flags drift early, and routes issues to the right owners before they become problems.

### **How is AI / GenAI usage handled?**

Numio tracks AI-specific costs and utilization — tokens, inferences, GPUs — and enforces R\&D vs production boundaries and experiment lifecycle controls.

### **Does Numio take actions automatically?**

Only when explicitly enabled. The default mode is detect and recommend. Automation is limited to low-risk actions under defined policy guardrails.

### **How do we retain control?**

No silent changes. The default operating model is human-in-the-loop: Numio detects and recommends, but acts only after user approval. All actions are logged. Automation must be enabled explicitly and can be paused globally or per domain at any time.

### **What is the MVP scope?**

MVP is AWS only. Numio surfaces findings and suggests concrete remediation commands (AWS CLI) for operators to review and apply. Autonomous execution is out of scope for MVP and will be introduced in a later phase. Future scope expands to GCP, then AI provider billing visibility (OpenAI, Anthropic) for reporting and attribution.

---

## **Appendix: Open Questions**

### **Tag policy configuration**

* For each required tag: name, type (string, numeric, enum, email, date), allowed values (for enum), default value (optional), and applicability rules (resource types, accounts/environments)
* Multiple policies can coexist (e.g., company-wide + team-specific). Policies are evaluated independently — no merging of allowed values across policies. A resource must satisfy all applicable policies to be fully compliant. Compliance is reported per-policy and in aggregate.
* Policies may carry a numeric priority for display ordering and future exemption logic, but priority does not alter rule evaluation — each policy's constraints stand alone.
* Cost-weighted compliance: `Σ(cost of fully compliant resources) / Σ(total cost of policy-applicable resources) × 100`. "Fully compliant" = all required tags present and valid across all applicable policies. Also report per-tag and per-policy scores. Resources with no cost data are treated as $0 (zero weight in cost scores, still counted in resource-count metrics).  
* Tag policy lives in Numio UI for MVP; future: policy-as-code via Git

### **Zombie Hunter scope (v0)**

* Missing or invalid required tags  
* Orphaned resources (canonical list TBD)  
* Suspected idle or underutilized compute (informational only in MVP)

### **Remediation outputs**

* MVP: AWS CLI only  
* Future: Terraform and other formats

### **Notifications**

* Default: Numio dashboard  
* Optional: email, webhook, ticketing integrations  
* Routing per account or OU with global fallback

### **Cost precision**

* Cost Explorer vs CUR vs heuristics — decision pending  
* UI labeling must distinguish estimated vs exact costs

### **Findings management**

* Lifecycle states: open, acknowledged, resolved, suppressed  
* Suppression semantics TBD

### **Chat and integrations**

* Chat is analytics-only in MVP  
* MCP server for external chat integration (endpoints and auth TBD)

### **Scope sequencing**

* MVP: AWS  
* Next: GCP  
* Later: OpenAI / Anthropic billing visibility

### **Policy and governance (AI-specific)**

* Define unit metrics: cost per token, per inference  
* Environment segmentation: R\&D vs production boundaries  
* Cluster utilization and idle detection  
* Examples of future guardrails:  
  * No unapproved GPU instance types in production  
  *   
*   
  * Any training run over $X requires pre-approval and business case

