// Static step config for the client onboarding video walkthrough.
// video_url is a YouTube (unlisted) or Loom embed link — paste the real link
// per step once it's recorded. TEMPORARY: every step currently points at a
// public YouTube placeholder (the first-ever YouTube video) purely so the
// onboarding page's layout/embed behavior can be previewed — replace each
// with the real recording. Step 7 also shows the credentials handoff form
// below its video (see Onboarding.jsx).
export const ONBOARDING_STEPS = [
  {
    id: 'domain',
    order: 1,
    title: 'Buy a Domain',
    video_url: 'https://www.youtube.com/watch?v=jNQXAC9IVRw',
    description: 'How to register a domain for your business if you don’t already have one.',
  },
  {
    id: 'workspace',
    order: 2,
    title: 'Google Workspace Setup',
    video_url: 'https://www.youtube.com/watch?v=jNQXAC9IVRw',
    description: 'Setting up Google Workspace (email, docs, drive) on your new domain.',
  },
  {
    id: 'supabase',
    order: 3,
    title: 'Supabase Project Setup',
    video_url: 'https://www.youtube.com/watch?v=jNQXAC9IVRw',
    description: 'Creating a free Supabase project so we can set up your data/backend.',
  },
  {
    id: 'anthropic',
    order: 4,
    title: 'Get an Anthropic API Key',
    video_url: 'https://www.youtube.com/watch?v=jNQXAC9IVRw',
    description: 'Creating an Anthropic account and generating an API key for AI features.',
  },
  {
    id: 'meta',
    order: 5,
    title: 'Meta Ads Account Setup',
    video_url: 'https://www.youtube.com/watch?v=jNQXAC9IVRw',
    description: 'Setting up your Meta Business Manager and Ads account.',
  },
  {
    id: 'passwords',
    order: 6,
    title: 'Where to Find Your Passwords',
    video_url: 'https://www.youtube.com/watch?v=jNQXAC9IVRw',
    description: 'A walkthrough of where to find the logins/passwords you’ll need to hand over in the next step.',
  },
  {
    id: 'submit',
    order: 7,
    title: 'Submit Your Credentials',
    video_url: 'https://www.youtube.com/watch?v=jNQXAC9IVRw',
    description: 'Upload a document (or paste a Google Doc link) with the logins we’ll need to get started.',
  },
]
