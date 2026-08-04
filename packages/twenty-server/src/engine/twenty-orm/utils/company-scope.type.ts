// Which companies the caller is allowed to see.
//
// Resolved once per request, next to the workspace member, and carried on the
// auth context. The query builder reads it without touching the database again:
// it runs on every single query and it is synchronous, so it could not do a
// lookup even if we wanted one.
//
// 'none' is the default for anyone with no access rows, and that is deliberate.
// An earlier version treated "no company assigned" as "sees everything", so
// forgetting to configure somebody silently handed them the whole group. A
// mistake should show too little, never too much.
export type CompanyScope =
  // Sees every company. Granted by holding the parent company.
  | { kind: 'all' }
  // Sees only these. Never empty: an empty list is 'none', not 'some'.
  | { kind: 'some'; companyIds: string[] }
  // Sees nothing.
  | { kind: 'none' };
