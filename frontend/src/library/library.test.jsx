import React from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider, EntriesProvider, useAuth } from './state';
import Library from './Library';
import EntryEditor from './EntryEditor';
import { CreateShare, ImportShare } from './Shares';
import Discover from './Discover';
import PlaceMap from './PlaceMap';

const entry = {
  id: 'one', restaurant_name: '我的测试餐厅', restaurant_id: '', category: '家常菜',
  address: '测试地址', lat: 31, lng: 121, visited_on: '2026-08-01', rating: 4, spend: 50,
  content: '<img src=x onerror=alert(1)> 原文', tags: ['好吃'], favorite: false,
  would_return: 'yes', kind: 'own', author_name: '作者', source_title: '',
  created_at: 1780000000, updated_at: 1780000000,
};

function respond(data, status = 200) {
  return Promise.resolve({ ok: status < 400, status, json: () => Promise.resolve(data) });
}

function mount(Component, path = '/') {
  return render(<MemoryRouter initialEntries={[path]}><EntriesProvider><Routes><Route path="*" element={<Component />} /></Routes></EntriesProvider></MemoryRouter>);
}

beforeEach(() => { sessionStorage.clear(); vi.stubGlobal('fetch', vi.fn(() => respond({ entries: [entry], total: 1 }))); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

it('renders original text safely and filters by provenance', async () => {
  fetch.mockImplementation(() => respond({ entries: [entry, { ...entry, id: 'two', restaurant_name: '朋友的餐厅', kind: 'imported', author_name: '朋友' }] }));
  mount(Library);
  await screen.findByRole('heading', { name: '我的测试餐厅' });
  expect(document.querySelector('.experience-text img')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: '朋友分享', exact: true }));
  await screen.findByRole('heading', { name: '朋友的餐厅' });
  expect(screen.queryByRole('link', { name: '编辑体验' })).toBeNull();
  expect(screen.queryByRole('link', { name: '分享这条体验' })).toBeNull();
  expect(screen.getByText('作者评价')).toBeTruthy();
});

it('does not allow friend entries to be selected in a share', async () => {
  fetch.mockImplementation((path) => respond(path === '/api/library/entries' ? { entries: [entry, { ...entry, id: 'friend', kind: 'imported' }] } : { id: 'share', code: 'WTE-test-created', count: 1, title: '分享', expires_at: 1790000000 }));
  mount(CreateShare, '/shares/new?ids=one,friend');
  const button = await screen.findByRole('button', { name: '生成分享码（1）' });
  expect(screen.getAllByRole('checkbox')).toHaveLength(1);
  fireEvent.click(button);
  await screen.findByLabelText('新生成的分享码');
  const call = fetch.mock.calls.find(([path]) => path === '/api/library/shares');
  expect(JSON.parse(call[1].body).entry_ids).toEqual(['one']);
});

it('clears a preview when the code changes and reports expired shares', async () => {
  fetch.mockImplementation((path) => respond(path === '/api/library/entries' ? { entries: [] } : { title: '朋友的分享', entries: [entry], expires_at: 1790000000, is_owner: false }));
  mount(ImportShare);
  fireEvent.change(screen.getByLabelText('分享码'), { target: { value: 'WTE-first-share-code' } });
  fireEvent.click(screen.getByRole('button', { name: '预览分享' }));
  await screen.findByRole('button', { name: '导入个人库' });
  fireEvent.change(screen.getByLabelText('分享码'), { target: { value: 'WTE-other-share-code' } });
  expect(screen.queryByRole('button', { name: '导入个人库' })).toBeNull();
  fetch.mockImplementation(() => respond({ detail: '分享码已过期' }, 404));
  fireEvent.click(screen.getByRole('button', { name: '预览分享' }));
  await screen.findByText('分享码已过期');
});

it('saves new personal records without public review endpoints', async () => {
  fetch.mockImplementation((path) => respond(path === '/api/library/entries' ? { entries: [], id: 'new-entry' } : {}));
  mount(EntryEditor, '/entries/new');
  fireEvent.change(screen.getByLabelText('餐厅名称'), { target: { value: '新餐厅' } });
  fireEvent.change(screen.getByLabelText('体验记录'), { target: { value: '亲身体验' } });
  fireEvent.change(screen.getByLabelText('人均实付（元）'), { target: { value: '0' } });
  fireEvent.click(screen.getByRole('button', { name: '保存到个人库' }));
  await waitFor(() => expect(fetch.mock.calls.some(([, options]) => options?.method === 'POST')).toBe(true));
  const [path, options] = fetch.mock.calls.find(([, options]) => options?.method === 'POST');
  expect(path).toBe('/api/library/entries');
  expect(JSON.parse(options.body)).toMatchObject({ restaurant_name: '新餐厅', spend: 0, content: '亲身体验' });
});

it('queries real place metadata rather than public ratings', async () => {
  fetch.mockImplementation(() => respond({ places: [], message: '暂未取得真实餐厅资料' }));
  mount(Discover);
  fireEvent.click(screen.getByRole('button', { name: '查找餐厅' }));
  await screen.findByText('暂未取得真实餐厅资料');
  const call = fetch.mock.calls.find(([path]) => path === '/api/library/places');
  expect(JSON.parse(call[1].body)).toMatchObject({ lat: 31.2304, lng: 121.4737, category: '餐厅' });
  expect(JSON.parse(call[1].body)).not.toHaveProperty('scene');
});

it('creates and cleans up the map SDK, keeping marker selection interactive', async () => {
  const map = { add: vi.fn(), setCenter: vi.fn(), destroy: vi.fn() };
  const markers = [];
  const onSelect = vi.fn();
  vi.stubGlobal('AMap', {
    Map: vi.fn(function () { return map; }),
    Marker: vi.fn(function (options) { const marker = { options, on: vi.fn(), setIcon: vi.fn(), setzIndex: vi.fn() }; markers.push(marker); return marker; }),
    Icon: vi.fn(function () {}), Size: vi.fn(function () {}),
  });
  fetch.mockImplementation(() => respond({ enabled: true, amap_js_api_key: 'test' }));
  const place = { restaurant_id: 'place', restaurant_name: '地图餐厅', lat: 31, lng: 121 };
  const view = render(<PlaceMap places={[place]} center={{ lat: 31, lng: 121 }} selected={place} onSelect={onSelect} />);
  await waitFor(() => expect(map.add).toHaveBeenCalledOnce());
  act(() => markers[0].on.mock.calls[0][1]());
  expect(onSelect).toHaveBeenCalledWith('place');
  expect(map.setCenter).toHaveBeenCalledWith([121, 31]);
  view.unmount();
  expect(map.destroy).toHaveBeenCalledOnce();
});

it('invalidates the signed-in UI when a private API rejects the session', async () => {
  fetch.mockImplementation(() => respond({ id: 'user', display_name: '用户' }));
  function Observer() { const { user } = useAuth(); return <div>{user ? '已登录' : '未登录'}</div>; }
  render(<AuthProvider><Observer /></AuthProvider>);
  await screen.findByText('已登录');
  act(() => window.dispatchEvent(new Event('library:unauthorized')));
  expect(screen.getByText('未登录')).toBeTruthy();
});
