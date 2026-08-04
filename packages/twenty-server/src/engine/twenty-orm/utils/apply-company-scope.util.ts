import { type ObjectLiteral, type SelectQueryBuilder } from 'typeorm';

import { type WorkspaceAuthContext } from 'src/engine/core-modules/auth/types/workspace-auth-context.type';
import { type CompanyScope } from 'src/engine/twenty-orm/utils/company-scope.type';

// Restricts every query to the company the caller belongs to.
//
// This is our own row scoping, written from scratch and deliberately narrow. It
// is NOT the upstream row-level permission engine, which is enterprise-licensed
// and stays untouched and switched off. Do not wire the two together: this file
// must keep working on a plain community build.
//
// WHY IT LIVES IN THE QUERY BUILDER
// ---------------------------------
// Because this is the only place every read funnels through. Filtering in a
// resolver, an endpoint or the front end leaves every other door open — REST,
// GraphQL, exports, the search index. Here there is one door.
//
// WHERE THE SCOPE COMES FROM
// --------------------------
// From the access rows of the caller, resolved once per request and carried on
// the auth context. It is never read from the request itself. A company id that
// arrives in a parameter is a claim, not a credential: accept one and anybody
// can read anybody else's records by editing a URL.
//
// IT FAILS CLOSED
// ---------------
// A caller with no resolved scope sees NOTHING, not everything. The earlier
// version of this file did the opposite — no company meant no filter — so
// forgetting to configure somebody silently handed them the whole group. The
// safe direction for a mistake is to show too little.

// Reads, updates and deletes all go through here.
//
// Filtering reads alone would be a mistake worth spelling out: a user could
// still update or delete another company's records by id, blindly but
// successfully, without ever being able to see them.
type ScopableQueryBuilder = {
  expressionMap: SelectQueryBuilder<ObjectLiteral>['expressionMap'];
  andWhere: (where: string, parameters?: ObjectLiteral) => unknown;
};

// The relation that says which company a record belongs to. An object is
// scoped if — and only if — it has this column.
const COMPANY_SCOPE_COLUMN = 'sociedadId';

const resolveScope = (authContext: WorkspaceAuthContext): CompanyScope => {
  // Only real people get scoped.
  //
  // API keys and system calls run unrestricted on purpose: they are how the
  // watcher ingests documents for every company at once. They are workspace
  // wide credentials that already read everything, so scoping them would break
  // ingestion without closing anything.
  if (authContext.type !== 'user') return { kind: 'all' };

  // Resolved once per request, next to the workspace member. If it is missing
  // the request never went through the resolver, and we do not guess: refusing
  // is recoverable, guessing "sees everything" is not.
  return authContext.companyScope ?? { kind: 'none' };
};

export const applyCompanyScope = ({
  queryBuilder,
  authContext,
  shouldBypassPermissionChecks,
}: {
  queryBuilder: ScopableQueryBuilder;
  authContext: WorkspaceAuthContext;
  shouldBypassPermissionChecks: boolean;
}): void => {
  if (shouldBypassPermissionChecks) return;

  const mainAlias = queryBuilder.expressionMap.mainAlias;

  // `hasMetadata` BEFORE `metadata`, and the order is not cosmetic: reading
  // `.metadata` on an alias that has none THROWS instead of returning nothing.
  // Twenty builds a subquery aliased `limited_relation_records` to load
  // one-to-many relations, and it carries no entity metadata, so touching
  // `.metadata` first broke every list in the application.
  //
  // Letting that subquery through is safe, and it is worth knowing why rather
  // than assuming it. It only collects candidate ids: the records themselves
  // are then fetched with `getMany()`, which does go through here and is
  // scoped. Nothing from another company survives to the response.
  //
  // What it can do is return FEWER records than it should. That inner query
  // takes the first N ids per parent without scoping, so another company's
  // records can crowd out the ones this user is entitled to see, and the
  // scoped fetch afterwards can only remove, never recover them. Missing rows,
  // never foreign ones. Fixing it properly means scoping `getQuery()` too,
  // which is not overridden today.
  if (!mainAlias?.name || !mainAlias.hasMetadata) return;

  // Ask the entity itself whether it is scoped, rather than keeping a list of
  // object names somewhere else. A list would need updating every time a new
  // scoped object appears, and the day someone forgets, that object is wide
  // open and looks fine.
  const isScoped = Boolean(mainAlias.metadata.findColumnWithPropertyPath(COMPANY_SCOPE_COLUMN));

  if (!isScoped) return;

  const scope = resolveScope(authContext);

  if (scope.kind === 'all') return;

  // Nothing to show. `1 = 0` rather than an empty IN list, which some drivers
  // render as invalid SQL, and rather than returning early — returning early
  // here would mean NO filter at all, the exact opposite of the intent.
  if (scope.kind === 'none') {
    queryBuilder.andWhere('1 = 0');

    return;
  }

  // A distinctive parameter name: query builders get merged, and a plain
  // ":companyIds" would eventually collide with somebody else's parameter and
  // be silently overwritten.
  queryBuilder.andWhere(
    `"${mainAlias.name}"."${COMPANY_SCOPE_COLUMN}" IN (:...twentyCompanyScopeIds)`,
    { twentyCompanyScopeIds: scope.companyIds },
  );
};
