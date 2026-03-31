---
name: code-quality
description: Enforces code quality, performance, accessibility, and reliability standards for all VirtueCore Next.js/React/Supabase/Vercel applications. Use this skill on EVERY task — whether creating new components, editing existing code, fixing bugs, refactoring, or reviewing. This is non-negotiable and always active. Triggers on any code-related task including building pages, components, API routes, database queries, styling, and deployment configuration.
---

# VirtueCore Code Quality Standards

These rules apply to ALL code written for VirtueCore products. Follow them every time, without exception.

## Pre-Flight Checklist

Before writing any code, verify:

1. Have I read the relevant design skill (vc-app-design or adint-design)?
2. Am I using the correct colour variables (never hardcode hex values)?
3. Am I following the component patterns already established in the codebase?
4. Will this work on mobile viewports?

## TypeScript Standards

### Strict typing — no shortcuts

- NEVER use `any` type. If you don't know the type, define an interface.
- NEVER use `@ts-ignore` or `@ts-expect-error`. Fix the actual type issue.
- All function parameters and return types must be explicitly typed.
- Use `interface` for object shapes, `type` for unions and intersections.
- All API responses must have typed interfaces.
```typescript
// BAD
const fetchData = async (id: any) => {
  const res = await fetch(`/api/clients/${id}`);
  return res.json();
};

// GOOD
interface Client {
  id: string;
  name: string;
  industry: string;
  plan: 'starter' | 'growth' | 'scale';
  healthScore: number;
  createdAt: string;
}

const fetchClient = async (id: string): Promise<Client> => {
  const res = await fetch(`/api/clients/${id}`);
  if (!res.ok) throw new Error(`Failed to fetch client: ${res.status}`);
  return res.json() as Promise<Client>;
};
```

### Null safety

- Always handle null/undefined cases explicitly.
- Use optional chaining (`?.`) and nullish coalescing (`??`) appropriately.
- Never assume API data will be present — always provide fallbacks.

## React & Next.js Standards

### Component structure

Every component follows this order:
1. Imports
2. Types/interfaces
3. Constants
4. Component function
5. Subcomponents (if small and tightly coupled)
```typescript
// Standard component template
'use client'; // only if client component

import { useState } from 'react';
import { cn } from '@/lib/utils';

interface MetricCardProps {
  label: string;
  value: number;
  delta?: number;
  format?: 'currency' | 'percentage' | 'number';
}

const CURRENCY_FORMATTER = new Intl.NumberFormat('en-GB', {
  style: 'currency',
  currency: 'GBP',
});

export function MetricCard({ label, value, delta, format = 'number' }: MetricCardProps) {
  // component logic
}
```

### Server vs Client components

- Default to Server Components. Only add 'use client' when you need:
  - useState, useEffect, useRef, or other hooks
  - onClick, onChange, or other event handlers
  - Browser APIs (localStorage, window, etc.)
- NEVER put 'use client' on a page.tsx that only fetches data.
- Data fetching happens in Server Components or API routes, NEVER in useEffect on the client.
```typescript
// BAD — fetching on the client when it could be server-side
'use client';
import { useEffect, useState } from 'react';

export default function ClientsPage() {
  const [clients, setClients] = useState([]);
  useEffect(() => {
    fetch('/api/clients').then(r => r.json()).then(setClients);
  }, []);
  // ...
}

// GOOD — server component with data fetching
import { createServerClient } from '@/lib/supabase/server';

export default async function ClientsPage() {
  const supabase = createServerClient();
  const { data: clients } = await supabase.from('clients').select('*');
  return <ClientList clients={clients ?? []} />;
}
```

### Performance rules (priority order)

1. **No request waterfalls.** Parallel fetch, never sequential.
```typescript
// BAD — waterfall
const clients = await fetchClients();
const metrics = await fetchMetrics();

// GOOD — parallel
const [clients, metrics] = await Promise.all([
  fetchClients(),
  fetchMetrics(),
]);
```

2. **Dynamic imports for heavy components.** Charts, rich text editors, modals.
```typescript
import dynamic from 'next/dynamic';
const Chart = dynamic(() => import('@/components/Chart'), {
  loading: () => <ChartSkeleton />,
  ssr: false,
});
```

3. **Image optimisation.** Always use next/image, never raw <img>.
```typescript
import Image from 'next/image';
<Image src={src} alt={alt} width={400} height={300} />
```

4. **Memoise expensive computations.**
```typescript
const sortedClients = useMemo(
  () => clients.sort((a, b) => b.healthScore - a.healthScore),
  [clients]
);
```

5. **Debounce search inputs.** Minimum 300ms.

### Loading and error states

EVERY page and data-dependent component MUST have:
- A loading state (skeleton screens, not spinners)
- An error state (user-friendly message + retry option)
- An empty state (friendly illustration + CTA)
```typescript
// Required pattern for all data pages
export default async function Page() {
  // ...data fetching...

  if (error) return <ErrorState message="Failed to load clients" onRetry={refetch} />;
  if (!data || data.length === 0) return <EmptyState title="No clients yet" cta="Add your first client" />;
  return <ClientList clients={data} />;
}
```

Never show a blank white/black screen under any condition.

## Supabase Standards

### Row Level Security (RLS)

- EVERY table MUST have RLS policies. No exceptions.
- Never use the service role key on the client side.
- Client-side queries use the anon key with RLS enforcing access.

### Query patterns
```typescript
// Always handle errors from Supabase queries
const { data, error } = await supabase
  .from('clients')
  .select('id, name, industry, healthScore:health_score')
  .eq('user_id', userId)
  .order('created_at', { ascending: false });

if (error) {
  console.error('Failed to fetch clients:', error.message);
  throw new Error('Failed to load clients');
}
```

- Use column aliases to convert snake_case (DB) to camelCase (TypeScript).
- Always `.select()` only the columns you need — never `select('*')` in production components.
- Paginate large datasets. Default to 20 rows per page.

### Realtime subscriptions

- Always clean up subscriptions in useEffect return.
- Use channels, not deprecated subscription methods.
```typescript
useEffect(() => {
  const channel = supabase
    .channel('deliverables')
    .on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'deliverables',
      filter: `client_id=eq.${clientId}`,
    }, (payload) => {
      // handle update
    })
    .subscribe();

  return () => { supabase.removeChannel(channel); };
}, [clientId]);
```

## API Route Standards
```typescript
// Standard API route template
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

export async function GET(req: NextRequest) {
  try {
    const supabase = createServerClient();

    // Verify authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
    }

    // Your logic here
    const { data, error } = await supabase
      .from('clients')
      .select('id, name')
      .eq('user_id', user.id);

    if (error) {
      console.error('Database error:', error.message);
      return NextResponse.json({ error: 'Failed to fetch data' }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (err) {
    console.error('Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
```

Rules:
- ALWAYS verify authentication before any database operation.
- ALWAYS wrap in try/catch.
- ALWAYS return appropriate status codes (401, 403, 404, 500).
- NEVER expose internal error details to the client.
- Log errors server-side with context (which operation, which user if known).
- Validate request body/params with Zod or manual checks.

## Styling Standards

### Tailwind conventions

- Use the design system colour variables, not arbitrary Tailwind colours.
- Use the spacing scale defined in the design spec.
- Group Tailwind classes in this order: layout → sizing → spacing → typography → colours → effects.
```typescript
// BAD — arbitrary values, no order
<div className="text-white bg-[#1a1a1d] p-4 flex rounded-lg shadow-md gap-2 w-full">

// GOOD — using CSS variables, ordered, consistent
<div className="flex w-full gap-4 p-5 text-[var(--text-primary)] bg-[var(--bg-secondary)] rounded-lg shadow-md">
```

- NEVER use inline styles unless dynamically computed (e.g., chart widths).
- Extract repeated class combinations into components, not utility strings.

### Responsive design

- Mobile-first approach. Write base styles for mobile, add breakpoints for larger screens.
- Test at these breakpoints: 375px (small phone), 768px (tablet), 1280px (desktop).
- Admin views: optimise for desktop, degrade gracefully to tablet.
- Client views: must be fully functional on mobile.
- VA views: optimise for tablet and mobile.

## Security Checklist

Before ANY code goes live:
- [ ] No API keys, secrets, or credentials in client-side code
- [ ] No API keys hardcoded anywhere (use environment variables)
- [ ] All user inputs are validated server-side
- [ ] All database queries use parameterised inputs (Supabase handles this, but verify custom SQL)
- [ ] Authentication is checked on every protected API route
- [ ] RLS policies are active on every Supabase table
- [ ] CORS is configured correctly (not wildcard in production)
- [ ] Rate limiting on public API endpoints (especially the health check and auth routes)

## Error Handling Philosophy

1. **Catch early, handle gracefully.** Don't let errors bubble to a white screen.
2. **Log everything server-side.** Include context: what failed, what data was involved, timestamp.
3. **Show nothing sensitive client-side.** "Something went wrong" is better than a stack trace.
4. **Always offer a recovery path.** Retry button, go back, contact support — never a dead end.
5. **Fail open for non-critical features.** If the health score widget fails to load, the rest of the dashboard should still work.

## Git & Deployment

- Commit messages follow conventional commits: `feat:`, `fix:`, `chore:`, `refactor:`, `docs:`
- Never commit `.env` files. Use `.env.example` with placeholder values.
- Test the build locally before pushing: `npm run build` should complete with zero errors.
- Vercel preview deployments for every branch — check the preview URL before merging.

## Post-Build Verification

After building any new feature, verify:
1. Does it render correctly on desktop and mobile?
2. Does the loading state appear before data arrives?
3. Does it handle errors gracefully (test by temporarily breaking the API)?
4. Does it match the design spec (colours, fonts, spacing)?
5. Can you navigate to and from this page without breaking the app?
6. Are there any console errors or warnings?
7. Does the TypeScript compiler pass with zero errors?
