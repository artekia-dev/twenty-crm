import { type ObjectLiteral, type SelectQueryBuilder } from 'typeorm';

import { type WorkspaceAuthContext } from 'src/engine/core-modules/auth/types/workspace-auth-context.type';
import {
  PermissionsException,
  PermissionsExceptionCode,
} from 'src/engine/metadata-modules/permissions/permissions.exception';

/**
 * Restricts every query to the company the caller belongs to.
 *
 * This is our own row scoping, written from scratch and deliberately narrow. It
 * is NOT the upstream row-level permission engine, which is enterprise-licensed
 * and stays untouched and switched off. Do not wire the two together: this file
 * must keep working on a plain community build.
 *
 * WHY IT LIVES IN THE QUERY BUILDER
 * ---------------------------------
 * Because this is the only place every read funnels through. Filtering in a
 * resolver, an endpoint or the front end leaves every other door open — REST,
 * GraphQL, exports, the search index. Here there is one door.
 *
 * WHERE THE SCOPE COMES FROM
 * --------------------------
 * From the caller's own workspace member record, which the auth context already
 * carries. It is never read from the request. A company id that arrives in a
 * parameter is a claim, not a credential: accept one and anybody can read
 * anybody else's records by editing a URL.
 *
 * IT FAILS CLOSED
 * ---------------
 * If the object is scoped but the caller's company cannot be determined, the
 * query throws instead of running unfiltered. A loud failure gets fixed; a
 * silent one leaks every company's invoices and nobody notices for months.
 */

/**
 * The relation that says which company a record belongs to. An object is
 * scoped if — and only if — it has this column.
 */
const COMPANY_SCOPE_COLUMN = 'sociedadId';

/**
 * Members with no company see everything. That is the head office and the
 * holding, who are meant to.
 *
 * Note the difference from a MISSING value, handled below: "no company" is an
 * answer, "cannot tell" is not. Collapsing the two is how an identification bug
 * turns into full access with no trace.
 */
type CompanyScope = { restricted: false } | { restricted: true; companyId: string };

const resolveScope = (authContext: WorkspaceAuthContext): CompanyScope | 'unknown' => {
  // Only real people get scoped.
  //
  // API keys and system calls run unrestricted on purpose: they are how the
  // watcher ingests documents for every company at once. They are workspace
  // wide credentials that already read everything, so scoping them would break
  // ingestion without closing anything. Keep them out of reach of end users.
  if (authContext.type !== 'user') return { restricted: false };

  const member = authContext.workspaceMember as
    | (Record<string, unknown> & { sociedadId?: string | null })
    | undefined;

  // The property is absent, not empty: the record was not loaded with its
  // custom fields and we genuinely do not know. Say so.
  if (!member || !(COMPANY_SCOPE_COLUMN in member)) return 'unknown';

  const companyId = member[COMPANY_SCOPE_COLUMN];

  if (companyId === null || companyId === undefined) return { restricted: false };

  if (typeof companyId !== 'string' || companyId.length === 0) return 'unknown';

  return { restricted: true, companyId };
};

/**
 * Reads, updates and deletes all go through here.
 *
 * Filtering reads alone would be a mistake worth spelling out: a user could
 * still update or delete another company's records by id, blindly but
 * successfully, without ever being able to see them.
 */
type ScopableQueryBuilder = {
  expressionMap: SelectQueryBuilder<ObjectLiteral>['expressionMap'];
  andWhere: (where: string, parameters?: ObjectLiteral) => unknown;
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

  if (scope === 'unknown') {
    throw new PermissionsException(
      'Cannot determine which company this user belongs to, so the query was refused.',
      PermissionsExceptionCode.PERMISSION_DENIED,
    );
  }

  if (!scope.restricted) return;

  // A distinctive parameter name: query builders are reused and merged, and a
  // plain ":companyId" would eventually collide with somebody else's parameter
  // and be silently overwritten.
  queryBuilder.andWhere(`"${mainAlias.name}"."${COMPANY_SCOPE_COLUMN}" = :twentyCompanyScopeId`, {
    twentyCompanyScopeId: scope.companyId,
  });
};
