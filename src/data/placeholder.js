// ─── DEMO PROFILES ────────────────────────────────────────────────────────────
export const DEMO_PROFILES = {
  'admin@virtuecore.com': {
    id: 'admin-001',
    email: 'admin@virtuecore.com',
    full_name: 'Samuel Oyedeji',
    role: 'admin',
    avatar_url: null,
  },
  'client@virtuecore.com': {
    id: 'client-001',
    email: 'client@virtuecore.com',
    full_name: 'James Hartley',
    role: 'client',
    avatar_url: null,
    client_id: 'c-001',
  },
  'va@virtuecore.com': {
    id: 'va-001',
    email: 'va@virtuecore.com',
    full_name: 'Priya Sharma',
    role: 'va',
    avatar_url: null,
  },
}

export const DEMO_PASSWORD = 'demo1234'

// ─── CLIENTS ──────────────────────────────────────────────────────────────────
export const DEMO_CLIENTS = [
  {
    id: 'c-001',
    company_name: 'Hartley & Sons Roofing',
    contact_name: 'James Hartley',
    contact_email: 'james@hartleyroofing.co.uk',
    package_tier: 'Growth',
    monthly_retainer: 2500,
    revenue_share_percentage: 10,
    status: 'active',
    health_score: 'green',
    ad_spend_managed: 8400,
    last_contact_days: 2,
    outstanding_deliverables: 1,
    payment_status: 'paid',
    onboarding_started_at: '2025-10-01',
    created_at: '2025-10-01',
  },
  {
    id: 'c-002',
    company_name: 'Prestige Window Cleaning',
    contact_name: 'Sandra Webb',
    contact_email: 'sandra@prestigewindows.co.uk',
    package_tier: 'Starter',
    monthly_retainer: 1500,
    revenue_share_percentage: 0,
    status: 'active',
    health_score: 'amber',
    ad_spend_managed: 3200,
    last_contact_days: 8,
    outstanding_deliverables: 3,
    payment_status: 'overdue',
    onboarding_started_at: '2025-11-15',
    created_at: '2025-11-15',
  },
  {
    id: 'c-003',
    company_name: 'Clearview Plumbing',
    contact_name: 'Marcus Oduya',
    contact_email: 'marcus@clearviewplumbing.co.uk',
    package_tier: 'Premium',
    monthly_retainer: 4500,
    revenue_share_percentage: 12,
    status: 'active',
    health_score: 'green',
    ad_spend_managed: 14200,
    last_contact_days: 1,
    outstanding_deliverables: 0,
    payment_status: 'paid',
    onboarding_started_at: '2025-09-01',
    created_at: '2025-09-01',
  },
  {
    id: 'c-004',
    company_name: 'Apex Drainage Solutions',
    contact_name: 'Tracy Nwosu',
    contact_email: 'tracy@apexdrainage.co.uk',
    package_tier: 'Growth',
    monthly_retainer: 2500,
    revenue_share_percentage: 10,
    status: 'onboarding',
    health_score: 'amber',
    ad_spend_managed: 0,
    last_contact_days: 3,
    outstanding_deliverables: 5,
    payment_status: 'paid',
    onboarding_started_at: '2026-03-01',
    created_at: '2026-03-01',
  },
  {
    id: 'c-005',
    company_name: 'Swift Skip Hire',
    contact_name: 'Derek Pearce',
    contact_email: 'derek@swiftskip.co.uk',
    package_tier: 'Starter',
    monthly_retainer: 1500,
    revenue_share_percentage: 0,
    status: 'churned',
    health_score: 'red',
    ad_spend_managed: 2100,
    last_contact_days: 45,
    outstanding_deliverables: 0,
    payment_status: 'paid',
    onboarding_started_at: '2025-06-01',
    created_at: '2025-06-01',
  },
]

// ─── AD PERFORMANCE ───────────────────────────────────────────────────────────
export const DEMO_AD_PERFORMANCE = [
  { month: 'Oct', spend: 6800, leads: 42, cpl: 162, roas: 4.2 },
  { month: 'Nov', spend: 7200, leads: 48, cpl: 150, roas: 4.6 },
  { month: 'Dec', spend: 6500, leads: 38, cpl: 171, roas: 3.9 },
  { month: 'Jan', spend: 7800, leads: 55, cpl: 142, roas: 5.1 },
  { month: 'Feb', spend: 8100, leads: 61, cpl: 133, roas: 5.4 },
  { month: 'Mar', spend: 8400, leads: 67, cpl: 125, roas: 5.8 },
]

export const DEMO_CLIENT_METRICS = {
  ad_spend: 8400,
  leads: 67,
  cpl: 125,
  roas: 5.8,
  clicks: 1240,
  impressions: 84300,
  ctr: 1.47,
  platform_split: [
    { platform: 'Meta', spend: 5200, leads: 44 },
    { platform: 'Google', spend: 3200, leads: 23 },
  ],
}

// ─── TASKS ────────────────────────────────────────────────────────────────────
export const DEMO_TASKS = [
  {
    id: 't-001',
    title: 'Design March ad creatives — Meta',
    brief: 'Create 3x static and 2x video ad creatives for Hartley Roofing March campaign. Brand colours: navy and orange. USP: same-day callouts.',
    client_id: 'c-001',
    client_name: 'Hartley & Sons Roofing',
    assigned_va_id: 'va-001',
    status: 'in_progress',
    priority: 'urgent',
    deadline: '2026-03-18',
    time_logged_minutes: 90,
  },
  {
    id: 't-002',
    title: 'Write April email sequence — Clearview',
    brief: '5-email nurture sequence for Clearview plumbing leads. Tone: professional, local. CTA: book free survey.',
    client_id: 'c-003',
    client_name: 'Clearview Plumbing',
    assigned_va_id: 'va-001',
    status: 'not_started',
    priority: 'high',
    deadline: '2026-03-25',
    time_logged_minutes: 0,
  },
  {
    id: 't-003',
    title: 'Update Google Ads negative keywords — Prestige',
    brief: 'Review search term report and add 20+ negative keywords. Focus on reducing irrelevant commercial cleaning queries.',
    client_id: 'c-002',
    client_name: 'Prestige Window Cleaning',
    assigned_va_id: 'va-001',
    status: 'complete',
    priority: 'medium',
    deadline: '2026-03-14',
    time_logged_minutes: 45,
  },
  {
    id: 't-004',
    title: 'Build onboarding questionnaire — Apex',
    brief: 'Create Typeform onboarding questionnaire covering target area, competitors, USPs, tone of voice, and login credentials.',
    client_id: 'c-004',
    client_name: 'Apex Drainage Solutions',
    assigned_va_id: 'va-001',
    status: 'in_progress',
    priority: 'high',
    deadline: '2026-03-17',
    time_logged_minutes: 60,
  },
  {
    id: 't-005',
    title: 'Monthly performance report — Hartley',
    brief: 'Compile February performance report. Include spend, leads, CPL, ROAS, top-performing creatives, and March recommendations.',
    client_id: 'c-001',
    client_name: 'Hartley & Sons Roofing',
    assigned_va_id: 'va-001',
    status: 'not_started',
    priority: 'medium',
    deadline: '2026-03-20',
    time_logged_minutes: 0,
  },
]

// ─── DELIVERABLES ─────────────────────────────────────────────────────────────
export const DEMO_DELIVERABLES = [
  {
    id: 'd-001',
    client_id: 'c-001',
    title: 'February Performance Report',
    type: 'report',
    status: 'pending_review',
    created_at: '2026-03-10',
    file_url: '#',
    feedback: null,
  },
  {
    id: 'd-002',
    client_id: 'c-001',
    title: 'March Ad Creatives Pack',
    type: 'ad_creative',
    status: 'draft',
    created_at: '2026-03-14',
    file_url: '#',
    feedback: null,
  },
  {
    id: 'd-003',
    client_id: 'c-001',
    title: 'Q1 Content Calendar',
    type: 'content_calendar',
    status: 'approved',
    created_at: '2026-01-05',
    file_url: '#',
    feedback: null,
  },
  {
    id: 'd-004',
    client_id: 'c-001',
    title: 'Lead Magnet — "5 Signs You Need a New Roof"',
    type: 'lead_magnet',
    status: 'changes_requested',
    created_at: '2026-02-20',
    file_url: '#',
    feedback: 'Please update the CTA button colour to match our brand orange and add a phone number in the footer.',
  },
]

// ─── INVOICES ─────────────────────────────────────────────────────────────────
export const DEMO_INVOICES = [
  {
    id: 'inv-001',
    client_id: 'c-001',
    client_name: 'Hartley & Sons Roofing',
    amount: 2500,
    type: 'retainer',
    status: 'paid',
    due_date: '2026-03-01',
    paid_date: '2026-02-28',
    created_at: '2026-02-20',
  },
  {
    id: 'inv-002',
    client_id: 'c-001',
    client_name: 'Hartley & Sons Roofing',
    amount: 840,
    type: 'commission',
    status: 'paid',
    due_date: '2026-03-01',
    paid_date: '2026-02-28',
    created_at: '2026-02-20',
  },
  {
    id: 'inv-003',
    client_id: 'c-001',
    client_name: 'Hartley & Sons Roofing',
    amount: 2500,
    type: 'retainer',
    status: 'sent',
    due_date: '2026-04-01',
    paid_date: null,
    created_at: '2026-03-15',
  },
  {
    id: 'inv-004',
    client_id: 'c-002',
    client_name: 'Prestige Window Cleaning',
    amount: 1500,
    type: 'retainer',
    status: 'overdue',
    due_date: '2026-03-01',
    paid_date: null,
    created_at: '2026-02-20',
  },
]

// ─── PIPELINE LEADS ───────────────────────────────────────────────────────────
export const DEMO_PIPELINE = [
  {
    id: 'p-001',
    name: 'Gary Ellis',
    company: 'Ellis Electrical',
    email: 'gary@elliselectrical.co.uk',
    source: 'Facebook Ad',
    score: 72,
    stage: 'captured',
    notes: 'Interested in Meta ads + website rebuild. Has £2k/mo budget.',
    created_at: '2026-03-14',
  },
  {
    id: 'p-002',
    name: 'Natasha Okafor',
    company: 'Okafor Landscaping',
    email: 'natasha@okaforlandscaping.co.uk',
    source: 'Referral',
    score: 88,
    stage: 'call_booked',
    notes: 'Referred by Hartley. Discovery call booked for 18th March 10am.',
    created_at: '2026-03-12',
  },
  {
    id: 'p-003',
    name: 'Phil Barnett',
    company: 'Barnett Pest Control',
    email: 'phil@barnettpc.co.uk',
    source: 'Google Ad',
    score: 65,
    stage: 'call_completed',
    notes: 'Good call. Wants Google Ads + monthly reporting. Sending proposal this week.',
    created_at: '2026-03-08',
  },
  {
    id: 'p-004',
    name: 'Yvonne Chukwu',
    company: 'YC Financial Planning',
    email: 'yvonne@ycfinancial.co.uk',
    source: 'LinkedIn',
    score: 91,
    stage: 'proposal_sent',
    notes: 'Sent Growth package proposal on 13th. Following up 17th.',
    created_at: '2026-03-05',
  },
  {
    id: 'p-005',
    name: 'Apex Drainage Solutions',
    company: 'Apex Drainage Solutions',
    email: 'tracy@apexdrainage.co.uk',
    source: 'Facebook Ad',
    score: 95,
    stage: 'onboarding',
    notes: 'Contract signed 1st March. Onboarding in progress.',
    created_at: '2026-02-25',
  },
]

// ─── MESSAGES ─────────────────────────────────────────────────────────────────
export const DEMO_MESSAGES = [
  {
    id: 'm-001',
    client_id: 'c-001',
    sender_id: 'admin-001',
    sender_name: 'Samuel — VirtueCore',
    sender_role: 'admin',
    content: 'Hi James — just flagging that your March creatives are in review. Should be with you by EOD Wednesday.',
    created_at: '2026-03-14T10:30:00Z',
  },
  {
    id: 'm-002',
    client_id: 'c-001',
    sender_id: 'client-001',
    sender_name: 'James Hartley',
    sender_role: 'client',
    content: 'Perfect, thanks Samuel. One thing — could we test a new angle this month? Something around emergency call-outs rather than general roofing.',
    created_at: '2026-03-14T11:15:00Z',
  },
  {
    id: 'm-003',
    client_id: 'c-001',
    sender_id: 'admin-001',
    sender_name: 'Samuel — VirtueCore',
    sender_role: 'admin',
    content: "Great idea — we'll mock up a version with that angle and run it alongside the main creative as an A/B test. I'll add a brief for the VA now.",
    created_at: '2026-03-14T11:42:00Z',
  },
]

// ─── CONTENT CALENDAR ─────────────────────────────────────────────────────────
export const DEMO_CONTENT_CALENDAR = [
  { id: 'cc-001', client_id: 'c-001', platform: 'Instagram', post_date: '2026-03-17', content: 'Before & after roofing transformation — Wythenshawe property. Emergency repair turned full re-roof. ✅', status: 'scheduled' },
  { id: 'cc-002', client_id: 'c-001', platform: 'Facebook', post_date: '2026-03-19', content: 'Did you know most roof leaks start at the flashing? Here\'s what to look for before it becomes a bigger problem...', status: 'scheduled' },
  { id: 'cc-003', client_id: 'c-001', platform: 'Instagram', post_date: '2026-03-21', content: '5-star review spotlight — "Called at 8am, on-site by 10am, sorted by noon. Incredible service." — David, Didsbury', status: 'draft' },
  { id: 'cc-004', client_id: 'c-001', platform: 'Facebook', post_date: '2026-03-24', content: 'Spring is here — the perfect time to get your roof inspected before summer storms. Book your free survey today.', status: 'draft' },
  { id: 'cc-005', client_id: 'c-001', platform: 'Instagram', post_date: '2026-03-03', content: 'New month, new campaign! February was our best month yet — 67 leads, £125 CPL. 🚀', status: 'published' },
  { id: 'cc-006', client_id: 'c-001', platform: 'Facebook', post_date: '2026-03-07', content: 'Storm damage? We offer emergency same-day callouts across Greater Manchester. No call-out fee.', status: 'published' },
  { id: 'cc-007', client_id: 'c-001', platform: 'Instagram', post_date: '2026-03-10', content: 'Meet the team behind the roofs — 14 years experience, 2,000+ projects completed across the North West.', status: 'published' },
]

// ─── VA MODULES (Academy) ─────────────────────────────────────────────────────
export const DEMO_MODULES = [
  { id: 'mod-001', title: 'VirtueCore Onboarding & Values', category: 'Foundations', duration: '25 min', completed: true, progress: 100 },
  { id: 'mod-002', title: 'Meta Ads — Campaign Structure', category: 'Paid Advertising', duration: '45 min', completed: true, progress: 100 },
  { id: 'mod-003', title: 'Meta Ads — Creative Best Practices', category: 'Paid Advertising', duration: '40 min', completed: false, progress: 60 },
  { id: 'mod-004', title: 'Google Ads — Search Campaigns', category: 'Paid Advertising', duration: '50 min', completed: false, progress: 0 },
  { id: 'mod-005', title: 'Copywriting for Service Businesses', category: 'Content', duration: '35 min', completed: false, progress: 0 },
  { id: 'mod-006', title: 'Client Communication Standards', category: 'Operations', duration: '20 min', completed: true, progress: 100 },
  { id: 'mod-007', title: 'Reporting & Data Interpretation', category: 'Operations', duration: '30 min', completed: false, progress: 0 },
]

// ─── SOPS ─────────────────────────────────────────────────────────────────────
export const DEMO_SOPS = [
  { id: 's-001', title: 'New Client Onboarding Checklist', category: 'Operations', updated: '2026-02-10', url: '#' },
  { id: 's-002', title: 'Meta Ad Account Setup — Step by Step', category: 'Paid Advertising', updated: '2026-01-20', url: '#' },
  { id: 's-003', title: 'Monthly Reporting Template & Guide', category: 'Operations', updated: '2026-02-28', url: '#' },
  { id: 's-004', title: 'Creative Brief Template', category: 'Content', updated: '2026-01-15', url: '#' },
  { id: 's-005', title: 'Google Ads Account Audit Checklist', category: 'Paid Advertising', updated: '2025-12-05', url: '#' },
  { id: 's-006', title: 'Zapier Automation Build Guide', category: 'Automation', updated: '2026-02-01', url: '#' },
  { id: 's-007', title: 'Client Communication Templates', category: 'Operations', updated: '2026-03-01', url: '#' },
  { id: 's-008', title: 'Lead Magnet Production Workflow', category: 'Content', updated: '2025-12-18', url: '#' },
]

// ─── BUSINESS OVERVIEW ────────────────────────────────────────────────────────
export const DEMO_BUSINESS_METRICS = {
  mrr: 12500,
  mrr_change: 8.3,
  active_clients: 4,
  pipeline_value: 18400,
  total_ad_spend: 25800,
  ad_spend_change: 14.2,
  outstanding_invoices: 1500,
}

export const DEMO_MRR_CHART = [
  { month: 'Oct', mrr: 8500 },
  { month: 'Nov', mrr: 9500 },
  { month: 'Dec', mrr: 9500 },
  { month: 'Jan', mrr: 11000 },
  { month: 'Feb', mrr: 11500 },
  { month: 'Mar', mrr: 12500 },
]

// ─── VA LIST ──────────────────────────────────────────────────────────────────
export const DEMO_VAS = [
  {
    id: 'va-001',
    full_name: 'Priya Sharma',
    email: 'priya@virtuecore.com',
    tasks_assigned: 4,
    tasks_completed_this_week: 2,
    hours_this_week: 18.5,
    performance_score: 92,
    training_completion: 71,
    status: 'active',
  },
  {
    id: 'va-002',
    full_name: 'Kofi Mensah',
    email: 'kofi@virtuecore.com',
    tasks_assigned: 3,
    tasks_completed_this_week: 3,
    hours_this_week: 22,
    performance_score: 97,
    training_completion: 100,
    status: 'active',
  },
]

// ─── VA TRAINING PROGRESS (for Admin VA Management) ───────────────────────────
export const DEMO_VA_TRAINING = {
  'va-001': {
    modules_completed: 3,
    modules_total: 5,
    avg_score: 82,
    last_activity: '2026-03-14',
  },
  'va-002': {
    modules_completed: 5,
    modules_total: 5,
    avg_score: 94,
    last_activity: '2026-03-10',
  },
}
