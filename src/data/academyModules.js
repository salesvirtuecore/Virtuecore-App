// Academy module content — shared by the VA Academy page (client-side) and
// the help-chat backend (server-side), so the chatbot can be grounded in the
// same material VAs are trained on.
export const ACADEMY_MODULES = [
  {
    id: 'mod-meta',
    title: 'Meta Ads Fundamentals',
    description:
      'Learn the core concepts behind Meta Ads — campaign structure, objectives, audience targeting, and what makes a high-converting lead generation campaign. Covers CPL, CTR, creative formats, and basic reporting.',
    estimated_minutes: 45,
    order_index: 1,
    video_url: null, // placeholder — real video URL goes here
    content_html: `
      <p>Meta Ads remains one of the most powerful platforms for generating leads for local service businesses. Understanding the campaign structure is fundamental to running profitable campaigns.</p>
      <h3>Campaign Objectives</h3>
      <p>Always match your objective to your goal. For lead generation, use the <strong>Lead Generation</strong> objective — it opens a native form inside Facebook/Instagram, removing the friction of leaving the app.</p>
      <h3>Key Metrics to Monitor</h3>
      <ul>
        <li><strong>CPL (Cost Per Lead)</strong> — total spend ÷ leads generated</li>
        <li><strong>CTR (Click-Through Rate)</strong> — clicks ÷ impressions × 100</li>
        <li><strong>ROAS (Return on Ad Spend)</strong> — revenue ÷ spend</li>
      </ul>
      <h3>Audience Targeting</h3>
      <p>Start with broad targeting for local businesses — a 10–25 mile radius around the service area, age 25–65, all genders. Let Meta optimise with its algorithm before narrowing.</p>
    `,
    quiz_questions: [
      {
        id: 'q1-meta',
        question: 'What does CPL stand for in Meta Ads?',
        options: [
          { id: 'a', text: 'Cost Per Lead' },
          { id: 'b', text: 'Click Per Landing' },
          { id: 'c', text: 'Campaign Per Lead' },
          { id: 'd', text: 'Cost Per Like' },
        ],
        correct_option_id: 'a',
        explanation: 'CPL stands for Cost Per Lead — calculated as total ad spend divided by the number of leads generated.',
      },
      {
        id: 'q2-meta',
        question: 'Which Meta Ads objective should you use to generate form submissions?',
        options: [
          { id: 'a', text: 'Brand Awareness' },
          { id: 'b', text: 'Traffic' },
          { id: 'c', text: 'Lead Generation' },
          { id: 'd', text: 'Reach' },
        ],
        correct_option_id: 'c',
        explanation: 'Lead Generation opens a native form inside Facebook/Instagram, making it the correct objective for capturing contact details.',
      },
      {
        id: 'q3-meta',
        question: 'What is a good benchmark CTR for Meta lead generation ads?',
        options: [
          { id: 'a', text: '0.1–0.5%' },
          { id: 'b', text: '1–3%' },
          { id: 'c', text: '5–10%' },
          { id: 'd', text: '15–20%' },
        ],
        correct_option_id: 'b',
        explanation: '1–3% CTR is a healthy benchmark for Meta lead generation ads. Below 1% suggests creative or audience issues; above 3% is excellent.',
      },
    ],
  },
  {
    id: 'mod-google',
    title: 'Google Ads Setup & Optimisation',
    description:
      'Master Google Search campaigns for local service businesses. Covers keyword match types, Quality Score, bidding strategies, ad copy best practices, and ongoing optimisation workflows.',
    estimated_minutes: 60,
    order_index: 2,
    video_url: null,
    content_html: `
      <p>Google Search Ads capture high-intent demand — people actively searching for your service. This makes them often the highest-converting channel for local service businesses.</p>
      <h3>Keyword Match Types</h3>
      <ul>
        <li><strong>Exact Match</strong> — only shows for that exact search (or very close variants)</li>
        <li><strong>Phrase Match</strong> — shows when the search includes the keyword phrase</li>
        <li><strong>Broad Match</strong> — shows for searches that include the meaning of your keyword</li>
      </ul>
      <h3>Quality Score</h3>
      <p>Quality Score (1–10) is based on three components: Expected CTR, Ad Relevance, and Landing Page Experience. Higher Quality Scores mean lower CPCs and better ad positions.</p>
      <h3>ROAS</h3>
      <p>Return on Ad Spend = Revenue ÷ Ad Spend. A ROAS of 4x means every £1 spent returns £4 in revenue.</p>
    `,
    quiz_questions: [
      {
        id: 'q1-google',
        question: 'What match type shows ads for searches that include the meaning of your keyword?',
        options: [
          { id: 'a', text: 'Exact Match' },
          { id: 'b', text: 'Phrase Match' },
          { id: 'c', text: 'Broad Match' },
          { id: 'd', text: 'Negative Match' },
        ],
        correct_option_id: 'c',
        explanation: 'Broad Match shows ads for searches that include the meaning or intent of your keyword, even if the exact words differ.',
      },
      {
        id: 'q2-google',
        question: 'What is Quality Score in Google Ads based on?',
        options: [
          { id: 'a', text: 'Ad spend only' },
          { id: 'b', text: 'Expected CTR, ad relevance, and landing page experience' },
          { id: 'c', text: 'Number of keywords' },
          { id: 'd', text: 'Campaign age' },
        ],
        correct_option_id: 'b',
        explanation: 'Quality Score is calculated from three factors: Expected CTR, Ad Relevance, and Landing Page Experience.',
      },
      {
        id: 'q3-google',
        question: 'What does ROAS stand for?',
        options: [
          { id: 'a', text: 'Return On Ad Spend' },
          { id: 'b', text: 'Rate Of Ad Sales' },
          { id: 'c', text: 'Revenue Of Advertising System' },
          { id: 'd', text: 'Return On Audience Spend' },
        ],
        correct_option_id: 'a',
        explanation: 'ROAS stands for Return On Ad Spend — calculated as revenue generated divided by the cost of the ads.',
      },
    ],
  },
  {
    id: 'mod-content',
    title: 'Content Creation for Social Media',
    description:
      'Learn how to create compelling social media content for local service businesses. Covers content pillars, caption writing, platform best practices, and scheduling workflows.',
    estimated_minutes: 30,
    order_index: 3,
    video_url: null,
    content_html: `
      <p>Consistent, high-quality social media content builds trust and keeps clients top of mind with their audience.</p>
      <h3>Content Pillars</h3>
      <p>Every service business needs 4 core content pillars: Before & After / Results, Educational Tips, Social Proof (reviews), and Behind the Scenes.</p>
      <h3>Caption Writing</h3>
      <p>Lead with the hook (first line must grab attention), provide value in the body, and close with a clear CTA. For service businesses, "Book a free survey" or "Call now for a free quote" are proven CTAs.</p>
    `,
    quiz_questions: [],
  },
  {
    id: 'mod-client-comms',
    title: 'Client Communication & Reporting',
    description:
      'Master professional client communication, report structure, and how to present results confidently. Covers monthly report templates, managing client expectations, and escalation procedures.',
    estimated_minutes: 30,
    order_index: 4,
    video_url: null,
    content_html: `
      <p>Clear, proactive communication is the foundation of long-term client retention.</p>
      <h3>Monthly Reporting</h3>
      <p>Every report should cover: Executive Summary, KPI summary table, platform breakdown, notable wins, areas for improvement, and next month's plan.</p>
      <h3>Managing Expectations</h3>
      <p>Always set expectations before a campaign launches. Share benchmarks, typical lead volumes for the market, and a ramp-up timeline (most campaigns need 2–4 weeks to optimise).</p>
    `,
    quiz_questions: [],
  },
  {
    id: 'mod-zapier',
    title: 'Zapier Automation Basics',
    description:
      'Learn how to use Zapier to automate repetitive tasks across VirtueCore workflows. Covers Zap structure, triggers, actions, and the key automations used in the VirtueCore system.',
    estimated_minutes: 45,
    order_index: 5,
    video_url: null,
    content_html: `
      <p>Zapier connects the tools we use and automates the manual work between them — saving hours every week.</p>
      <h3>Zap Structure</h3>
      <p>Every Zap has a <strong>Trigger</strong> (something that happens) and one or more <strong>Actions</strong> (things that happen as a result). Example: New lead in Facebook → Send Slack notification → Add to CRM.</p>
      <h3>Key VirtueCore Automations</h3>
      <ul>
        <li>New Facebook Lead → Create pipeline entry in VirtueCore</li>
        <li>Invoice Paid in Stripe → Update invoice status</li>
        <li>Task completed → Notify client via message</li>
      </ul>
    `,
    quiz_questions: [],
  },
]
