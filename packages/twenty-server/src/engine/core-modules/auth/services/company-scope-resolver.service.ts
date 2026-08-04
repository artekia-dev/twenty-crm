import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { Repository } from 'typeorm';

import { RoleTargetEntity } from 'src/engine/metadata-modules/role-target/role-target.entity';

import { GlobalWorkspaceOrmManager } from 'src/engine/twenty-orm/global-workspace-datasource/global-workspace-orm.manager';
import { type SystemWorkspaceAuthContext } from 'src/engine/core-modules/auth/types/workspace-auth-context.type';
import { type CompanyScope } from 'src/engine/twenty-orm/utils/company-scope.type';

// Works out which companies a person is allowed to see.
//
// Runs once per request, when the workspace member is resolved, and the answer
// travels on the auth context. The query builder cannot do this itself: it runs
// on every query and it is synchronous.
//
// The model, in one paragraph. A person gets one `accesoSociedad` row per
// company they may see, so several companies per person is the normal case and
// not a special one. A company can be marked `veTodoElGrupo`, and that mark is
// what opens the whole group — it lives on the parent company, so whoever is
// given that company sees everything. Anyone with no rows sees nothing.
@Injectable()
export class CompanyScopeResolverService {
  constructor(
    private readonly globalWorkspaceOrmManager: GlobalWorkspaceOrmManager,
    // eslint-disable-next-line twenty/prefer-workspace-scoped-repository
    @InjectRepository(RoleTargetEntity)
    private readonly roleTargetRepository: Repository<RoleTargetEntity>,
  ) {}

  async resolve({
    workspace,
    workspaceMemberId,
    userWorkspaceId,
  }: {
    workspace: SystemWorkspaceAuthContext['workspace'];
    workspaceMemberId: string;
    userWorkspaceId: string;
  }): Promise<CompanyScope> {
    // Administrators see everything, and they do not need access rows to do it.
    //
    // The check is on the permission, not on a role called "Admin": rename that
    // role or add a second one, and this still holds. It is the same permission
    // that lets them change these very rules, so withholding the records from
    // them would be theatre — they can grant themselves the access in two
    // clicks anyway.
    if (await this.isAdministrator(userWorkspaceId, workspace.id)) {
      return { kind: 'all' };
    }

    // This runs during authentication, before the request has a workspace
    // context, so the repository has to be opened inside one. A system context
    // is the right shape here: we are establishing who the caller is, so there
    // is no caller identity to borrow yet.
    return this.globalWorkspaceOrmManager.executeInWorkspaceContext(
      () => this.resolveInContext(workspace.id, workspaceMemberId),
      { type: 'system', workspace },
    );
  }

  private async isAdministrator(
    userWorkspaceId: string,
    workspaceId: string,
  ): Promise<boolean> {
    const roleTargets = await this.roleTargetRepository.find({
      where: { userWorkspaceId, workspaceId },
      relations: { role: true },
    });

    return roleTargets.some((roleTarget) => roleTarget.role?.canUpdateAllSettings === true);
  }

  private async resolveInContext(
    workspaceId: string,
    workspaceMemberId: string,
  ): Promise<CompanyScope> {
    // Reading the access rows must bypass permission checks, and this is not a
    // shortcut: the very filter being resolved here would otherwise apply to
    // the lookup that decides it. This repository reads nothing but the access
    // rows, and returns nothing but company ids.
    const repository = await this.globalWorkspaceOrmManager.getRepository(
      workspaceId,
      'accesoSociedad',
      { shouldBypassPermissionChecks: true },
    );

    const accesses = await repository.find({
      where: { miembroId: workspaceMemberId },
      relations: { sociedad: true },
    });

    if (accesses.length === 0) return { kind: 'none' };

    const companies = accesses
      .map((access) => (access as { sociedad?: { id?: string; veTodoElGrupo?: boolean } }).sociedad)
      .filter((company): company is { id?: string; veTodoElGrupo?: boolean } =>
        Boolean(company),
      );

    if (companies.some((company) => company.veTodoElGrupo === true)) return { kind: 'all' };

    const companyIds = [
      ...new Set(
        companies
          .map((company) => company.id)
          .filter((id): id is string => typeof id === 'string' && id.length > 0),
      ),
    ];

    return companyIds.length > 0 ? { kind: 'some', companyIds } : { kind: 'none' };
  }
}
