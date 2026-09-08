import { test, expect } from '@playwright/test';

const password = 'private-test-password-123';

async function register(page, username) {
  await page.goto('/login');
  await page.getByRole('button', { name: '注册', exact: true }).click();
  await page.getByLabel('称呼', { exact: true }).fill('地图体验者');
  await page.getByLabel('账号', { exact: true }).fill(username);
  await page.getByLabel('密码', { exact: true }).fill(password);
  await page.getByRole('button', { name: '创建个人库' }).click();
  await expect(page).toHaveURL(/\/$/);
}

test('public food map, optional public review, private views and sharing', async ({ page }) => {
  const suffix = Date.now().toString(36);
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));

  await page.goto('/');
  await expect(page.getByRole('heading', { name: '大家的美食地图' })).toBeVisible();
  await expect(page.getByRole('link', { name: '登录 / 注册' })).toBeVisible();
  expect(await page.getByLabel('餐厅关键词或菜系').inputValue()).toBe('');
  await page.getByRole('button', { name: '查找餐厅', exact: true }).click();
  await expect(page.getByText('附近，随便逛逛')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  await register(page, `map_author_${suffix}`);
  await page.getByRole('link', { name: '记一餐' }).click();
  await page.getByLabel('餐厅名称', { exact: true }).fill('地图上的小馆');
  await page.getByLabel('餐厅纬度', { exact: true }).fill('31.2304');
  await page.getByLabel('餐厅经度', { exact: true }).fill('121.4737');
  await page.getByLabel('公开到大家的美食地图', { exact: true }).check();
  await page.getByLabel('体验记录', { exact: true }).fill('公开体验：适合慢慢吃饭。');
  await page.getByRole('button', { name: '保存到个人库' }).click();
  await page.getByRole('button', { name: '我的', exact: true }).click();
  await expect(page.getByRole('heading', { name: '我的美食足迹' })).toBeVisible();
  await expect(page.getByText('地图上的小馆', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '融合', exact: true }).click();
  await expect(page.getByRole('heading', { name: '我们的美食拼图' })).toBeVisible();
  await page.getByRole('link', { name: '分享足迹' }).click();
  await expect(page.getByRole('heading', { name: '私下分享' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: '大家的美食地图' })).toBeVisible();
  await expect(page.getByRole('button', { name: '大家的', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: '../.impeccable/review/public-map-mobile.png', fullPage: true });
  expect(errors).toEqual([]);
});
