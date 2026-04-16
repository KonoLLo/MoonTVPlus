'use client';

import { Search } from 'lucide-react';
import { useEffect, useState } from 'react';

import { deleteMangaShelf, getAllMangaShelf, saveMangaShelf } from '@/lib/db.client';
import { MangaSearchItem, MangaShelfItem, MangaSource } from '@/lib/manga.types';

import MangaCard from '@/components/MangaCard';

export default function MangaPage() {
  const [query, setQuery] = useState('');
  const [sources, setSources] = useState<MangaSource[]>([]);
  const [sourceId, setSourceId] = useState('');
  const [results, setResults] = useState<MangaSearchItem[]>([]);
  const [shelf, setShelf] = useState<Record<string, MangaShelfItem>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/manga/sources')
      .then((res) => res.json())
      .then((data) => setSources(data.sources || []))
      .catch(() => undefined);

    getAllMangaShelf().then(setShelf).catch(() => undefined);
  }, []);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ q: query.trim() });
      if (sourceId) params.set('sourceId', sourceId);
      const res = await fetch(`/api/manga/search?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '搜索失败');
      setResults(data.results || []);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const toggleShelf = async (item: MangaSearchItem) => {
    const key = `${item.sourceId}+${item.id}`;
    if (shelf[key]) {
      await deleteMangaShelf(item.sourceId, item.id);
      setShelf((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
      return;
    }

    const shelfItem: MangaShelfItem = {
      title: item.title,
      cover: item.cover,
      sourceId: item.sourceId,
      sourceName: item.sourceName,
      mangaId: item.id,
      saveTime: Date.now(),
      description: item.description,
      author: item.author,
      status: item.status,
    };
    await saveMangaShelf(item.sourceId, item.id, shelfItem);
    setShelf((prev) => ({ ...prev, [key]: shelfItem }));
  };

  return (
    <div className='mx-auto max-w-6xl'>
      <form
        className='mx-auto mb-8 max-w-4xl'
        onSubmit={handleSearch}
      >
        <div className='flex flex-col gap-3 lg:flex-row'>
          <div className='flex-1'>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder='搜索漫画标题'
              className='w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none transition focus:border-sky-500 dark:border-gray-700 dark:bg-gray-900'
            />
          </div>
          <select
            value={sourceId}
            onChange={(e) => setSourceId(e.target.value)}
            className='rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm dark:border-gray-700 dark:bg-gray-900 lg:w-56'
          >
            <option value=''>全部来源</option>
            {sources.map((source) => (
              <option key={source.id} value={source.id}>
                {source.displayName || source.name}
              </option>
            ))}
          </select>
          <button className='inline-flex items-center justify-center gap-2 rounded-2xl bg-sky-600 px-6 py-3 text-sm font-medium text-white transition hover:bg-sky-700 lg:w-32'>
            <Search className='h-4 w-4' /> 搜索
          </button>
        </div>
      </form>

      <section>
        <div className='mb-4 flex items-center justify-between'>
          <h2 className='text-lg font-semibold'>搜索结果</h2>
          {loading && <span className='text-sm text-gray-500'>搜索中...</span>}
        </div>
        {error && <div className='mb-4 text-sm text-red-500'>{error}</div>}
        {results.length === 0 ? (
          <div className='rounded-2xl bg-gray-50 p-10 text-center text-sm text-gray-500 dark:bg-gray-900/50'>
            请输入关键词开始搜索漫画
          </div>
        ) : (
          <div className='grid grid-cols-2 gap-4 md:grid-cols-4 xl:grid-cols-6'>
            {results.map((item) => {
              const key = `${item.sourceId}+${item.id}`;
              return (
                <div key={key} className='space-y-2'>
                  <MangaCard
                    item={item}
                    href={`/manga/detail?mangaId=${item.id}&sourceId=${item.sourceId}&title=${encodeURIComponent(item.title)}&cover=${encodeURIComponent(item.cover)}&sourceName=${encodeURIComponent(item.sourceName)}&description=${encodeURIComponent(item.description || '')}&author=${encodeURIComponent(item.author || '')}&status=${encodeURIComponent(item.status || '')}`}
                    subtitle={item.author || item.status || item.description}
                  />
                  <button
                    onClick={() => toggleShelf(item)}
                    className='w-full rounded-2xl border border-gray-200 px-3 py-2 text-xs font-medium text-gray-700 transition hover:border-sky-500 hover:text-sky-600 dark:border-gray-700 dark:text-gray-200'
                  >
                    {shelf[key] ? '移出书架' : '加入书架'}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
