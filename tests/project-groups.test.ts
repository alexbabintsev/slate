import { describe, it, expect, beforeEach, vi } from 'vitest';
import { installFakeChrome } from './fake-chrome-windows';
import type { Project, ProjectGroup } from '../src/models/project';
import { DEFAULT_SETTINGS } from '../src/models/project';

function makeProject(id: string, overrides: Partial<Project> = {}): Project {
  return {
    id,
    name: id,
    icon: '',
    tabs: [],
    tabGroups: [],
    activeTabIndex: 0,
    createdAt: 1,
    updatedAt: 1,
    sortOrder: 1,
    ...overrides,
  };
}

describe('project groups', () => {
  let fake: ReturnType<typeof installFakeChrome>;

  beforeEach(async () => {
    fake = installFakeChrome();
    fake.setLocal('projectStore', {
      projects: {
        a: makeProject('a', { sortOrder: 1000 }),
        b: makeProject('b', { sortOrder: 2000 }),
        c: makeProject('c', { sortOrder: 3000 }),
      },
      settings: DEFAULT_SETTINGS,
    });
    vi.resetModules();
    await import('../src/background/service-worker');
  });

  const send = (msg: unknown) => fake.sendMessage(msg) as Promise<{ ok: boolean; data?: unknown; error?: string }>;
  const groups = () => (fake.getLocal('groups') ?? {}) as Record<string, ProjectGroup>;

  async function createGroup(name: string): Promise<ProjectGroup> {
    const res = await send({ type: 'CREATE_GROUP', name });
    expect(res.ok).toBe(true);
    return res.data as ProjectGroup;
  }

  it('creates groups in order and lists them sorted', async () => {
    const work = await createGroup('  Work  ');
    const home = await createGroup('Home');
    expect(work.name).toBe('Work');
    expect(groups()[work.id]).toEqual(work);

    const res = await send({ type: 'GET_ALL_GROUPS' });
    expect((res.data as ProjectGroup[]).map(g => g.name)).toEqual(['Work', 'Home']);

    await send({ type: 'REORDER_GROUPS', orderedIds: [home.id, work.id] });
    const reordered = await send({ type: 'GET_ALL_GROUPS' });
    expect((reordered.data as ProjectGroup[]).map(g => g.name)).toEqual(['Home', 'Work']);
  });

  it('rejects an empty group name', async () => {
    expect((await send({ type: 'CREATE_GROUP', name: '   ' })).ok).toBe(false);
    const g = await createGroup('Work');
    expect((await send({ type: 'UPDATE_GROUP', groupId: g.id, patch: { name: ' ' } })).ok).toBe(false);
    expect(groups()[g.id].name).toBe('Work');
  });

  it('renames and collapses a group', async () => {
    const g = await createGroup('Work');
    await send({ type: 'UPDATE_GROUP', groupId: g.id, patch: { name: 'Job', collapsed: true } });
    expect(groups()[g.id]).toMatchObject({ name: 'Job', collapsed: true });
    expect((await send({ type: 'UPDATE_GROUP', groupId: 'nope', patch: { collapsed: true } })).ok).toBe(false);
  });

  it('moves a project into a group, to its end, and back out', async () => {
    const g = await createGroup('Work');
    await send({ type: 'SET_PROJECT_GROUP', projectId: 'c', groupId: g.id });
    await send({ type: 'SET_PROJECT_GROUP', projectId: 'a', groupId: g.id });
    expect(fake.getProject('a')!.groupId).toBe(g.id);
    expect(fake.getProject('a')!.sortOrder).toBeGreaterThan(fake.getProject('c')!.sortOrder);

    await send({ type: 'SET_PROJECT_GROUP', projectId: 'a', groupId: null });
    expect(fake.getProject('a')!.groupId).toBeUndefined();
  });

  it('refuses a group that does not exist', async () => {
    const res = await send({ type: 'SET_PROJECT_GROUP', projectId: 'a', groupId: 'ghost' });
    expect(res.ok).toBe(false);
    expect(fake.getProject('a')!.groupId).toBeUndefined();

    const reorder = await send({
      type: 'REORDER_PROJECTS', orderedIds: ['b', 'a', 'c'], moved: { projectId: 'a', groupId: 'ghost' },
    });
    expect(reorder.ok).toBe(false);
    expect(fake.getProject('a')!.sortOrder).toBe(1000);
  });

  it('reorders and regroups a dragged project in one write', async () => {
    const g = await createGroup('Work');
    await send({ type: 'SET_PROJECT_GROUP', projectId: 'b', groupId: g.id });
    await send({
      type: 'REORDER_PROJECTS', orderedIds: ['c', 'a', 'b'], moved: { projectId: 'c', groupId: g.id },
    });
    expect(fake.getProject('c')!.groupId).toBe(g.id);
    expect(fake.getProject('c')!.sortOrder).toBeLessThan(fake.getProject('b')!.sortOrder);
  });

  it('deleting a group keeps its projects, ungrouped', async () => {
    const g = await createGroup('Work');
    await send({ type: 'SET_PROJECT_GROUP', projectId: 'a', groupId: g.id });
    await send({ type: 'DELETE_GROUP', groupId: g.id });
    expect(groups()[g.id]).toBeUndefined();
    expect(fake.getProject('a')).toBeDefined();
    expect(fake.getProject('a')!.groupId).toBeUndefined();
  });

  it('exports groups and imports them back, ungrouping projects whose group is missing', async () => {
    const g = await createGroup('Work');
    await send({ type: 'SET_PROJECT_GROUP', projectId: 'a', groupId: g.id });
    const exported = (await send({ type: 'EXPORT_PROJECTS' })).data as { groups: Record<string, ProjectGroup> };
    expect(exported.groups[g.id].name).toBe('Work');

    const res = await send({
      type: 'IMPORT_PROJECTS',
      store: {
        projects: {
          x: makeProject('x', { groupId: 'g2' }),
          y: makeProject('y', { groupId: 'missing' }),
          z: makeProject('z', { groupId: g.id }),
        },
        groups: {
          g2: { id: 'g2', name: 'Imported', collapsed: true, sortOrder: 5 },
          bad: { id: 'bad', name: '' },
        },
      },
    });
    expect(res.ok).toBe(true);
    expect(groups().g2).toEqual({ id: 'g2', name: 'Imported', collapsed: true, sortOrder: 5 });
    expect(groups().bad).toBeUndefined();
    expect(groups()[g.id]).toBeDefined();
    expect(fake.getProject('x')!.groupId).toBe('g2');
    expect(fake.getProject('y')!.groupId).toBeUndefined();
    expect(fake.getProject('z')!.groupId).toBe(g.id);
  });

  it('imports an old export without groups and leaves existing groups alone', async () => {
    const g = await createGroup('Work');
    await send({ type: 'IMPORT_PROJECTS', store: { projects: { x: makeProject('x') } } });
    expect(groups()[g.id]).toBeDefined();
  });
});
