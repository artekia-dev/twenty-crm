import { type RawAuthContext } from 'src/engine/core-modules/auth/types/raw-auth-context.type';
import { type UserWorkspaceAuthContext } from 'src/engine/core-modules/auth/types/workspace-auth-context.type';
import { type CompanyScope } from 'src/engine/twenty-orm/utils/company-scope.type';

type UserAuthContextInput = {
  workspace: NonNullable<RawAuthContext['workspace']>;
  userWorkspaceId: NonNullable<RawAuthContext['userWorkspaceId']>;
  user: NonNullable<RawAuthContext['user']>;
  workspaceMemberId: NonNullable<RawAuthContext['workspaceMemberId']>;
  workspaceMember: NonNullable<RawAuthContext['workspaceMember']>;
  companyScope?: CompanyScope;
};

export const buildUserAuthContext = (
  input: UserAuthContextInput,
): UserWorkspaceAuthContext => {
  return {
    type: 'user',
    workspace: input.workspace,
    userWorkspaceId: input.userWorkspaceId,
    user: input.user,
    workspaceMemberId: input.workspaceMemberId,
    workspaceMember: input.workspaceMember,
    companyScope: input.companyScope,
  };
};
