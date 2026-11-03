// In-memory chrome.storage.StorageArea covering what Slate uses: get with a
// key, a key list or null, set, and remove. Values are cloned on the way in and
// out, as Chrome serializes them. Optional delays let tests provoke races.

export type FakeArea = {
  data: Record<string, unknown>;
  getDelayMs: number;
  setDelayMs: number;
  area: {
    get: (keys?: string | string[] | null) => Promise<Record<string, unknown>>;
    set: (items: Record<string, unknown>) => Promise<void>;
    remove: (keys: string | string[]) => Promise<void>;
    onChanged: { addListener: () => void; removeListener: () => void };
  };
};

export function createFakeArea(data: Record<string, unknown> = {}): FakeArea {
  const wait = (ms: number) => (ms > 0 ? new Promise<void>(r => setTimeout(r, ms)) : Promise.resolve());
  const fake: FakeArea = {
    data,
    getDelayMs: 0,
    setDelayMs: 0,
    area: {
      get: async keys => {
        await wait(fake.getDelayMs);
        const wanted = keys == null ? Object.keys(fake.data) : Array.isArray(keys) ? keys : [keys];
        const out: Record<string, unknown> = {};
        for (const k of wanted) if (k in fake.data) out[k] = structuredClone(fake.data[k]);
        return out;
      },
      set: async items => {
        await wait(fake.setDelayMs);
        for (const [k, v] of Object.entries(items)) fake.data[k] = structuredClone(v);
      },
      remove: async keys => {
        for (const k of Array.isArray(keys) ? keys : [keys]) delete fake.data[k];
      },
      onChanged: { addListener: () => {}, removeListener: () => {} },
    },
  };
  return fake;
}
