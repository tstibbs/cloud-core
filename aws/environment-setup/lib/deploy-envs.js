export * from '../src/runtime-envs.js'

export const DEV_MODE = process.env.DEV_MODE == 'true' //if not set, defaults to false
export const DEV_SUFFIX = DEV_MODE ? '-Dev' : '' //suffix concrete resource names in dev mode to prevent it conflicting with the actual stack
