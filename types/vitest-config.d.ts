declare module 'vitest/config' {
  import { UserConfig } from 'vitest'
  export function defineConfig(c: UserConfig): UserConfig
}

declare module 'vitest' {
  export type UserConfig = any
  export function describe(...args: any[]): any
  export function it(...args: any[]): any
  export function test(...args: any[]): any
  export function expect(...args: any[]): any
  export function beforeEach(...args: any[]): any
  export function afterEach(...args: any[]): any
}
