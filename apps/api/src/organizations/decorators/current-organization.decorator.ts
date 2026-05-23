import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const CurrentOrganization = createParamDecorator((data: unknown, context: ExecutionContext) => {
  const request = context.switchToHttp().getRequest();
  return request.orgContext?.organization ?? null;
});
