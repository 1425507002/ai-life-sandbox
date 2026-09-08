import { expect, test } from '@playwright/test'

test('desktop core life loop and settings', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'desktop-only flow')
  const errors: string[] = []
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()) })
  await page.goto('/')
  await expect(page).toHaveTitle('AI Life Worlds · 人生世界')
  await expect(page.getByRole('main').getByRole('heading', { name: '晨雾镇' })).toBeVisible()
  const before = await page.locator('.action-card').allTextContents()
  await page.locator('.action-card').first().click()
  await expect(page.locator('.action-feedback')).toBeVisible()
  const after = await page.locator('.action-card').allTextContents()
  expect(new Set(after).size).toBe(after.length)
  expect(after).not.toEqual(before)
  await page.locator('.nav-item').filter({ hasText: '角色' }).click()
  await page.getByRole('button', { name: '编辑档案' }).click()
  await expect(page.getByRole('heading', { name: '重新认识一下自己' })).toBeVisible()
  await page.getByLabel('名字').fill('旅人澄')
  await page.getByRole('button', { name: '保存档案' }).click()
  await expect(page.getByRole('heading', { name: '旅人澄' })).toBeVisible()
  await page.locator('.nav-item').filter({ hasText: '设置' }).click()
  await expect(page.getByLabel('模型预设')).toHaveValue('zhipu-flash')
  await page.getByLabel('模型预设').selectOption('qwen-flash')
  await expect(page.getByLabel('模型 Endpoint')).toHaveValue('https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions')
  await expect(page.getByLabel('模型名称')).toHaveValue('qwen-flash')
  await page.getByLabel('模型预设').selectOption('zhipu-flash')
  await page.getByRole('button', { name: '测试连接' }).click()
  await expect(page.locator('.connection-result')).toContainText('请先在此页面填写 API Key')
  await expect(page.locator('.provider-save-status')).toContainText('已自动保存到本设备')
  await page.locator('.action-mode-option').filter({ hasText: '自由行动' }).click()
  await page.locator('.nav-item').filter({ hasText: '当前场景' }).click()
  await expect(page.getByRole('textbox', { name: '输入你的行动' })).toBeVisible()
  await expect(page.locator('#script-switcher option')).toHaveCount(2)
  await page.locator('.nav-item').filter({ hasText: '角色' }).click()
  await page.getByRole('button', { name: '重新开始人生' }).click()
  await expect(page.getByRole('heading', { name: '开始一段新人生' })).toBeVisible()
  await page.getByLabel('名字').fill('港口澄')
  await page.locator('.life-map-option').filter({ hasText: '灰潮港' }).click()
  await page.getByLabel('年龄阶段').selectOption('adult')
  await page.getByRole('button', { name: '开始这段人生' }).click()
  await expect(page.getByRole('main').getByRole('heading', { name: '灰潮港' })).toBeVisible()
  await expect(page.getByRole('main').getByText('港口澄', { exact: true })).toBeVisible()
  await expect(page.locator('#life-switcher option')).toHaveCount(2)
  await page.locator('.nav-item').filter({ hasText: '设置' }).click()
  await page.locator('.action-mode-option').filter({ hasText: '选择优先' }).click()
  await page.locator('.nav-item').filter({ hasText: '当前场景' }).click()
  await page.getByRole('button', { name: /找一份附近的帮工/ }).click()
  await page.locator('.nav-item').filter({ hasText: '地图' }).click()
  await expect(page.locator('.location-row')).toHaveCount(2)
  await expect(page.locator('.location-list').getByText('船具店', { exact: true })).toBeVisible()
  await expect(page.getByText('旧灯塔', { exact: true })).not.toBeVisible()
  expect(errors).toEqual([])
})

test('mobile keeps action-first layout and bottom navigation', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile', 'mobile-only flow')
  await page.goto('/')
  await expect(page.locator('.bottom-nav')).toBeVisible()
  await expect(page.locator('.action-section')).toBeVisible()
  await expect(page.locator('.action-card').first()).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true)
})

test('history keeps the player action text after settlement', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'desktop-only history audit flow')
  await page.goto('/')
  await page.locator('.action-card').first().click()
  await expect(page.locator('.action-feedback')).toBeVisible()
  await page.getByRole('button', { name: '履历' }).click()
  await expect(page.locator('.timeline-input').first()).toContainText('你的行动：')
})

test('provider error details remain visible in settings', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'desktop-only provider proxy flow')
  await page.route('**/api/ai-proxy/zhipu', async (route) => {
    await route.fulfill({
      status: 401,
      contentType: 'application/json',
      body: JSON.stringify({ error: { code: 1214, message: '令牌已过期或验证不正确' } }),
    })
  })
  await page.goto('/')
  await page.locator('.nav-item').filter({ hasText: '设置' }).click()
  await page.getByLabel('模型 Endpoint').fill('http://127.0.0.1:4175/api/ai-proxy/zhipu')
  await page.getByLabel('模型 API Key').fill('invalid-test-key-only')
  await page.getByRole('button', { name: '测试连接' }).click()
  await expect(page.locator('.connection-result')).toContainText('服务器反馈：')
  await expect(page.locator('.connection-result')).toContainText(/令牌已过期或验证不正确|token expired or incorrect/)
  await expect(page.locator('.connection-result')).toContainText('HTTP 401')
  await expect(page.locator('.connection-result')).not.toContainText('API Key 未通过验证')
})

test('provider connection accepts compatible response shapes and explains unknown 200 responses', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'desktop-only provider proxy flow')
  let responseBody: unknown = { output: { choices: [{ message: { content: [{ type: 'text', text: '连接成功' }] } }] } }
  await page.route('**/api/ai-proxy/zhipu', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(responseBody) })
  })
  await page.goto('/')
  await page.locator('.nav-item').filter({ hasText: '设置' }).click()
  await page.getByLabel('模型 Endpoint').fill('http://127.0.0.1:4175/api/ai-proxy/zhipu')
  await page.getByLabel('模型 API Key').fill('test-key-only')
  await page.getByRole('button', { name: '测试连接' }).click()
  await expect(page.locator('.connection-result')).toContainText('连接成功')

  responseBody = { request_id: 'redacted-diagnostic', usage: { total_tokens: 1 } }
  await page.getByRole('button', { name: '测试连接' }).click()
  await expect(page.locator('.connection-result')).toContainText('未找到可识别的模型文本')
  await expect(page.locator('.connection-result')).toContainText('返回字段：request_id, usage')
})

test('slow model enhancement never blocks local action settlement beyond five seconds', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'desktop-only latency budget flow')
  await page.route('**/api/ai-proxy/zhipu', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 6000))
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ choices: [{ message: { content: '迟到的模型响应' } }] }) })
  })
  await page.goto('/')
  await page.locator('.nav-item').filter({ hasText: '设置' }).click()
  await page.getByLabel('模型 Endpoint').fill('http://127.0.0.1:4175/api/ai-proxy/zhipu')
  await page.getByLabel('模型 API Key').fill('latency-test-only')
  await page.locator('.nav-item').filter({ hasText: '当前场景' }).click()
  const startedAt = Date.now()
  await page.locator('.action-card').first().click()
  await expect(page.locator('.action-feedback')).toBeVisible()
  expect(Date.now() - startedAt).toBeLessThan(5000)
  await expect(page.locator('body')).toContainText('AI 增强超过')
  await expect(page.locator('.action-feedback')).toContainText('行动已经结算')
})

test('missing provider key never sends a model request', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'desktop-only provider preflight')
  let providerRequests = 0
  page.on('request', (request) => {
    if (request.url().includes('/api/ai-proxy/')) providerRequests += 1
  })
  await page.goto('/')
  await page.locator('.nav-item').filter({ hasText: '设置' }).click()
  await page.getByRole('button', { name: '测试连接' }).click()
  await expect(page.locator('.connection-result')).toContainText('请先在此页面填写 API Key')
  expect(providerRequests).toBe(0)
})

test('provider settings survive a browser reload through IndexedDB', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'desktop-only persistence flow')
  await page.goto('/')
  await page.locator('.nav-item').filter({ hasText: '设置' }).click()
  await page.getByLabel('模型 Endpoint').fill('https://example.test/v1/chat/completions')
  await page.getByLabel('模型名称').fill('persist-test-model')
  await page.getByLabel('模型 API Key').fill('persist-test-key-only')
  await page.reload()
  await page.locator('.nav-item').filter({ hasText: '设置' }).click()
  await expect(page.getByLabel('模型 Endpoint')).toHaveValue('https://example.test/v1/chat/completions')
  await expect(page.getByLabel('模型名称')).toHaveValue('persist-test-model')
  await expect(page.getByLabel('模型 API Key')).toHaveValue('persist-test-key-only')
})

test('a baby life does not start with adult NPC relationships', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'desktop-only flow')
  await page.goto('/')
  await page.getByRole('button', { name: '开始一段新人生' }).click()
  await page.getByLabel('名字').fill('新生儿测试')
  await page.locator('.life-map-option').filter({ hasText: '灰潮港' }).click()
  await page.getByLabel('年龄阶段').selectOption('baby')
  await page.getByRole('button', { name: '开始这段人生' }).click()
  await expect(page.locator('body')).toContainText('接受照料')
  await expect(page.locator('body')).not.toContainText('凉了一半的茶')
  await page.locator('.nav-item').filter({ hasText: '地图' }).click()
  await expect(page.locator('.location-row')).toHaveCount(1)
  await expect(page.getByRole('button', { name: '灯塔街' })).toBeVisible()
  await expect(page.getByText('船具店', { exact: true })).not.toBeVisible()
  await page.locator('.nav-item').filter({ hasText: '人物' }).click()
  await expect(page.getByRole('heading', { name: '他们也在过自己的生活' })).toBeVisible()
  const cards = page.locator('.person-card')
  await expect(cards).toHaveCount(0)
  await expect(page.getByText('还没有认识这里的人')).toBeVisible()
})

test('verified script library loads urban life and previews an AI stage draft', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'desktop-only script library flow')
  await page.route('**/api/ai-proxy/zhipu', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ choices: [{ message: { content: JSON.stringify({ opening: ['新的都市清晨'], currentFocus: '从社区公告开始认识城市' }) } }] }),
    })
  })
  await page.goto('/')
  await page.locator('.nav-item').filter({ hasText: '设置' }).click()
  await expect(page.getByRole('heading', { name: '剧本库' })).toBeVisible()
  await expect(page.getByRole('heading', { name: '霓虹城的人生' })).toBeVisible()
  await expect(page.getByText('85.5 分通过')).toBeVisible()
  await page.getByRole('button', { name: '加载这个剧本' }).click()
  await expect(page.getByRole('main').getByRole('heading', { name: '霓虹城' })).toBeVisible()

  await page.locator('.nav-item').filter({ hasText: '设置' }).click()
  await page.getByLabel('模型 Endpoint').fill('http://127.0.0.1:4175/api/ai-proxy/zhipu')
  await page.getByLabel('模型名称').fill('urban-script-test-model')
  await page.getByLabel('模型 API Key').fill('ui-stage-test-key-only')
  await page.getByRole('button', { name: '生成阶段草稿' }).click()
  await expect(page.locator('.script-draft-preview')).toContainText('已通过校验')
  await expect(page.locator('.draft-summary')).toContainText('urban-life')
  await page.getByRole('button', { name: '确认并加载为剧本版本' }).click()
  await expect(page.getByRole('main').getByRole('heading', { name: '霓虹城' })).toBeVisible()
})
