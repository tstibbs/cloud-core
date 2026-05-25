const isPnpm = process.env.npm_config_user_agent?.startsWith('pnpm')

export const pkgManager = isPnpm ? 'pnpm' : 'npm'
export const pkgExec = isPnpm ? 'pnpm exec' : 'npx'
