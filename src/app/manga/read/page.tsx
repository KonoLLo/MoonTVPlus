'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { type MouseEvent, useEffect, useMemo, useRef, useState } from 'react';

import { saveMangaReadRecord } from '@/lib/db.client';

import ProxyImage from '@/components/ProxyImage';

type ReadMode = 'single' | 'double' | 'vertical' | 'horizontal';
type ScaleMode = 'fit' | 'original';

const READ_MODE_STORAGE_KEY = 'mangaReadMode';
const SCALE_MODE_STORAGE_KEY = 'mangaScaleMode';
const PAGE_GAP_STORAGE_KEY = 'mangaPageGap';

const READ_MODE_OPTIONS: Array<{ value: ReadMode; label: string }> = [
  { value: 'single', label: '单页' },
  { value: 'double', label: '双页' },
  { value: 'vertical', label: '垂直滚动' },
  { value: 'horizontal', label: '水平滚动' },
];

const SCALE_MODE_OPTIONS: Array<{ value: ScaleMode; label: string }> = [
  { value: 'fit', label: '适配屏幕' },
  { value: 'original', label: '原始大小' },
];

export default function MangaReadPage() {
  const searchParams = useSearchParams();
  const mangaId = searchParams.get('mangaId') || '';
  const sourceId = searchParams.get('sourceId') || '';
  const chapterId = searchParams.get('chapterId') || '';
  const title = searchParams.get('title') || '漫画阅读';
  const cover = searchParams.get('cover') || '';
  const sourceName = searchParams.get('sourceName') || sourceId;
  const chapterName = searchParams.get('chapterName') || '章节';

  const [pages, setPages] = useState<string[]>([]);
  const [activePage, setActivePage] = useState(0);
  const [readMode, setReadMode] = useState<ReadMode>('vertical');
  const [scaleMode, setScaleMode] = useState<ScaleMode>('fit');
  const [pageGap, setPageGap] = useState(0);
  const [controlsVisible, setControlsVisible] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const verticalPageRefs = useRef<Array<HTMLDivElement | null>>([]);
  const horizontalContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const savedMode = window.localStorage.getItem(READ_MODE_STORAGE_KEY) as ReadMode | null;
    if (savedMode && READ_MODE_OPTIONS.some((item) => item.value === savedMode)) {
      setReadMode(savedMode);
    }
    const savedScaleMode = window.localStorage.getItem(SCALE_MODE_STORAGE_KEY) as ScaleMode | null;
    if (savedScaleMode && SCALE_MODE_OPTIONS.some((item) => item.value === savedScaleMode)) {
      setScaleMode(savedScaleMode);
    }
    const savedGap = Number(window.localStorage.getItem(PAGE_GAP_STORAGE_KEY) || 0);
    if (!Number.isNaN(savedGap)) {
      setPageGap(Math.min(Math.max(savedGap, 0), 48));
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(READ_MODE_STORAGE_KEY, readMode);
  }, [readMode]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(SCALE_MODE_STORAGE_KEY, scaleMode);
  }, [scaleMode]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(PAGE_GAP_STORAGE_KEY, String(pageGap));
  }, [pageGap]);

  useEffect(() => {
    const handleToggleSettings = () => {
      setSettingsOpen((prev) => !prev);
      setControlsVisible(false);
    };

    window.addEventListener('manga-read-toggle-settings', handleToggleSettings);
    return () => {
      window.removeEventListener('manga-read-toggle-settings', handleToggleSettings);
    };
  }, []);

  useEffect(() => {
    if (!chapterId) return;
    fetch(`/api/manga/pages?chapterId=${encodeURIComponent(chapterId)}`)
      .then((res) => res.json())
      .then((data) => setPages(data.pages || []))
      .catch(() => setPages([]));
  }, [chapterId]);

  useEffect(() => {
    setActivePage(0);
  }, [chapterId, readMode]);

  useEffect(() => {
    if (readMode !== 'vertical' || !pages.length || !mangaId || !sourceId || !chapterId) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (!visible) return;
        const index = Number((visible.target as HTMLElement).dataset.index || 0);
        setActivePage(index);
      },
      { rootMargin: '-15% 0px -70% 0px', threshold: 0.2 }
    );

    verticalPageRefs.current.forEach((node) => node && observer.observe(node));
    return () => observer.disconnect();
  }, [readMode, pages, mangaId, sourceId, chapterId]);

  useEffect(() => {
    if (readMode !== 'horizontal') return;
    const container = horizontalContainerRef.current;
    if (!container) return;

    const onScroll = () => {
      const width = container.clientWidth || 1;
      const nextPage = Math.round(container.scrollLeft / width);
      setActivePage(Math.min(Math.max(nextPage, 0), Math.max(pages.length - 1, 0)));
    };

    container.addEventListener('scroll', onScroll, { passive: true });
    return () => container.removeEventListener('scroll', onScroll);
  }, [readMode, pages.length]);

  useEffect(() => {
    if (!pages.length || !mangaId || !sourceId || !chapterId) return;
    const timer = window.setTimeout(() => {
      saveMangaReadRecord(sourceId, mangaId, {
        title,
        cover,
        sourceId,
        sourceName,
        mangaId,
        chapterId,
        chapterName,
        pageIndex: activePage,
        pageCount: pages.length,
        saveTime: Date.now(),
      }).catch(() => undefined);
    }, 300);

    return () => window.clearTimeout(timer);
  }, [activePage, chapterId, chapterName, cover, mangaId, pages.length, sourceId, sourceName, title]);

  const hideTransientUi = () => {
    setControlsVisible(false);
    setSettingsOpen(false);
  };

  const clampPage = (page: number) => {
    if (!pages.length) return 0;
    return Math.min(Math.max(page, 0), pages.length - 1);
  };

  const scrollHorizontalToPage = (page: number) => {
    const container = horizontalContainerRef.current;
    if (!container) return;
    container.scrollTo({
      left: container.clientWidth * page,
      behavior: 'smooth',
    });
  };

  const goPrev = () => {
    if (!pages.length) return;
    if (readMode === 'vertical') {
      window.scrollBy({ top: -window.innerHeight * 0.85, behavior: 'smooth' });
      hideTransientUi();
      return;
    }
    if (readMode === 'horizontal') {
      const nextPage = clampPage(activePage - 1);
      setActivePage(nextPage);
      scrollHorizontalToPage(nextPage);
      hideTransientUi();
      return;
    }
    setActivePage((prev) => clampPage(prev - (readMode === 'double' ? 2 : 1)));
    hideTransientUi();
  };

  const goNext = () => {
    if (!pages.length) return;
    if (readMode === 'vertical') {
      window.scrollBy({ top: window.innerHeight * 0.85, behavior: 'smooth' });
      hideTransientUi();
      return;
    }
    if (readMode === 'horizontal') {
      const nextPage = clampPage(activePage + 1);
      setActivePage(nextPage);
      scrollHorizontalToPage(nextPage);
      hideTransientUi();
      return;
    }
    setActivePage((prev) => clampPage(prev + (readMode === 'double' ? 2 : 1)));
    hideTransientUi();
  };

  const progress = useMemo(
    () => (pages.length ? Math.round(((activePage + 1) / pages.length) * 100) : 0),
    [activePage, pages.length]
  );

  const pagedItems = useMemo(() => {
    if (readMode === 'single') {
      return pages[activePage] ? [pages[activePage]] : [];
    }
    if (readMode === 'double') {
      return pages.slice(activePage, activePage + 2);
    }
    return [];
  }, [activePage, pages, readMode]);

  const imageClassName = useMemo(() => {
    if (scaleMode === 'original') {
      return 'mx-auto h-auto w-auto max-w-none object-none';
    }
    return 'h-auto w-full object-contain';
  }, [scaleMode]);

  const handleReaderClick = (event: MouseEvent<HTMLDivElement>) => {
    if (settingsOpen) return;
    const { clientX } = event;
    const width = window.innerWidth;
    const leftBoundary = width / 3;
    const rightBoundary = (width / 3) * 2;

    if (clientX < leftBoundary) {
      goPrev();
      return;
    }
    if (clientX > rightBoundary) {
      goNext();
      return;
    }
    setControlsVisible((prev) => !prev);
    setSettingsOpen(false);
  };

  return (
    <div className='mx-auto max-w-6xl'>
      {settingsOpen && (
        <div
          className='fixed inset-0 z-40 flex items-center justify-center bg-black/40 px-4'
          onClick={() => setSettingsOpen(false)}
        >
          <div
            className='w-full max-w-sm rounded-3xl border border-gray-200 bg-white p-5 shadow-xl dark:border-gray-700 dark:bg-gray-950'
            onClick={(e) => e.stopPropagation()}
          >
            <div className='mb-4'>
              <div className='text-base font-semibold text-gray-900 dark:text-gray-100'>阅读设置</div>
              <div className='mt-1 text-xs text-gray-500'>可继续扩展更多阅读参数</div>
            </div>

            <div className='space-y-5'>
              <div>
                <div className='mb-2 text-sm font-medium text-gray-700 dark:text-gray-200'>显示方式</div>
                <div className='grid grid-cols-2 gap-2'>
                  {READ_MODE_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type='button'
                      className={`rounded-2xl px-3 py-2 text-sm transition ${
                        readMode === option.value
                          ? 'bg-sky-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800'
                      }`}
                      onClick={() => setReadMode(option.value)}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className='mb-2 text-sm font-medium text-gray-700 dark:text-gray-200'>缩放类型</div>
                <div className='grid grid-cols-2 gap-2'>
                  {SCALE_MODE_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type='button'
                      className={`rounded-2xl px-3 py-2 text-sm transition ${
                        scaleMode === option.value
                          ? 'bg-sky-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800'
                      }`}
                      onClick={() => setScaleMode(option.value)}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className='mb-2 flex items-center justify-between text-sm font-medium text-gray-700 dark:text-gray-200'>
                  <span>图片间隔</span>
                  <span className='text-xs text-gray-500'>{pageGap}px</span>
                </div>
                <input
                  type='range'
                  min='0'
                  max='48'
                  step='2'
                  value={pageGap}
                  onChange={(e) => setPageGap(Number(e.target.value))}
                  className='w-full accent-sky-600'
                />
                <div className='mt-1 text-xs text-gray-500'>滚动阅读时，两张图片之间的间隔</div>
              </div>

              <div className='flex justify-end'>
                <button
                  type='button'
                  className='rounded-2xl bg-sky-600 px-4 py-2 text-sm font-medium text-white'
                  onClick={() => setSettingsOpen(false)}
                >
                  完成
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div
        className='relative min-h-[calc(100vh-5rem)] select-none px-2 py-3 sm:px-3'
        onClick={handleReaderClick}
      >
        <div
          className={`fixed right-3 top-1/2 z-20 h-40 w-1 -translate-y-1/2 overflow-hidden rounded-full bg-gray-200/80 transition-all duration-200 dark:bg-gray-700/80 ${
            controlsVisible ? 'opacity-100' : 'pointer-events-none opacity-0'
          }`}
        >
          <div
            className='absolute bottom-0 left-0 w-full rounded-full bg-sky-500 transition-all'
            style={{ height: `${progress}%` }}
          />
        </div>

        {pages.length === 0 ? (
          <div className='rounded-[24px] bg-gray-50 p-10 text-center text-sm text-gray-500 dark:bg-gray-900/50'>
            加载漫画图片中...
          </div>
        ) : readMode === 'vertical' ? (
          <div className='flex flex-col' style={{ gap: `${pageGap}px` }}>
            {pages.map((page, index) => (
              <div
                key={`${page}-${index}`}
                ref={(node) => {
                  verticalPageRefs.current[index] = node;
                }}
                data-index={index}
                className='overflow-hidden rounded-[24px] bg-gray-100 shadow-sm dark:bg-gray-900'
              >
                <ProxyImage originalSrc={page} alt={`${chapterName}-${index + 1}`} className={imageClassName} />
              </div>
            ))}
          </div>
        ) : readMode === 'horizontal' ? (
          <div
            ref={horizontalContainerRef}
            className='flex min-h-[calc(100vh-8rem)] snap-x snap-mandatory overflow-x-auto overflow-y-hidden scrollbar-hide'
            style={{ gap: `${pageGap}px` }}
          >
            {pages.map((page, index) => (
              <div key={`${page}-${index}`} className='flex min-w-full snap-center items-center justify-center px-1'>
                <div className='w-full overflow-hidden rounded-[24px] bg-gray-100 shadow-sm dark:bg-gray-900'>
                  <ProxyImage originalSrc={page} alt={`${chapterName}-${index + 1}`} className={imageClassName} />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className='flex min-h-[calc(100vh-8rem)] items-center justify-center'>
            <div className={`grid w-full max-w-6xl ${readMode === 'double' ? 'md:grid-cols-2' : 'grid-cols-1'}`} style={{ gap: `${pageGap}px` }}>
              {pagedItems.map((page, index) => (
                <div
                  key={`${page}-${index}`}
                  className='overflow-hidden rounded-[24px] bg-gray-100 shadow-sm dark:bg-gray-900'
                >
                  <ProxyImage
                    originalSrc={page}
                    alt={`${chapterName}-${activePage + index + 1}`}
                    className={imageClassName}
                  />
                </div>
              ))}
              {readMode === 'double' && pagedItems.length === 1 && (
                <div className='hidden rounded-[24px] bg-transparent md:block' />
              )}
            </div>
          </div>
        )}
      </div>

      <Link
        href={`/manga/detail?mangaId=${mangaId}&sourceId=${sourceId}&title=${encodeURIComponent(title)}&cover=${encodeURIComponent(cover)}&sourceName=${encodeURIComponent(sourceName)}`}
        className='sr-only'
      >
        返回详情
      </Link>
    </div>
  );
}
