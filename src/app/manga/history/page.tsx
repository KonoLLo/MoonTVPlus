'use client';

import { History } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { getAllMangaReadRecords } from '@/lib/db.client';
import { MangaReadRecord } from '@/lib/manga.types';

import MangaCard from '@/components/MangaCard';

export default function MangaHistoryPage() {
  const [history, setHistory] = useState<Record<string, MangaReadRecord>>({});

  useEffect(() => {
    getAllMangaReadRecords().then(setHistory).catch(() => undefined);
  }, []);

  const historyList = useMemo(
    () => Object.entries(history).sort(([, a], [, b]) => b.saveTime - a.saveTime),
    [history]
  );

  return (
    <section className='mx-auto max-w-6xl'>
      <div className='mb-4 flex items-center gap-2 text-sm text-gray-500'>
        <History className='h-4 w-4 text-violet-500' /> 共 {historyList.length} 条阅读记录
      </div>
      {historyList.length === 0 ? (
        <div className='rounded-2xl bg-gray-50 p-10 text-center text-sm text-gray-500 dark:bg-gray-900/50'>
          暂无阅读历史
        </div>
      ) : (
        <div className='grid grid-cols-2 gap-4 md:grid-cols-4 xl:grid-cols-6'>
          {historyList.map(([key, item]) => (
            <MangaCard
              key={key}
              item={item}
              href={`/manga/read?mangaId=${item.mangaId}&sourceId=${item.sourceId}&chapterId=${item.chapterId}&title=${encodeURIComponent(item.title)}&cover=${encodeURIComponent(item.cover)}&sourceName=${encodeURIComponent(item.sourceName)}&chapterName=${encodeURIComponent(item.chapterName)}`}
              subtitle={`${item.chapterName} · 第 ${item.pageIndex + 1}/${item.pageCount} 页`}
            />
          ))}
        </div>
      )}
    </section>
  );
}
