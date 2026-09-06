import { describe, expect, it, vi } from 'vitest'
import { runActionWithRecovery } from './App'

describe('action recovery boundary', () => {
  it('always releases busy state when an action rejects', async () => {
    const events: string[] = []
    const onError = vi.fn(() => events.push('error'))
    const onFinally = vi.fn(() => events.push('finally'))

    await runActionWithRecovery(
      async () => { throw new Error('simulated action failure') },
      '测试行动',
      () => events.push('success'),
      onError,
      onFinally,
    )

    expect(events).toEqual(['error', 'finally'])
    expect(onError).toHaveBeenCalledOnce()
    expect(onFinally).toHaveBeenCalledOnce()
  })
})
