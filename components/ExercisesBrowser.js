'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '../lib/supabase';
import { useAppShell } from './AppShell';
import AppSelect from './AppSelect';
import { formatTarget } from '../lib/format';
import { CategoryGridSkeleton, ExerciseFiltersSkeleton } from './PageSkeletons';

const PAGE_SIZE = 15;
const READY_IMAGES = new Set();

function scorePercent(attempt) {
  if (!attempt?.max_score) return null;
  return Math.round(((attempt.score || 0) / attempt.max_score) * 100);
}

export default function ExercisesBrowser() {
  const router = useRouter();
  const params = useSearchParams();
  const shell = useAppShell();
  const [categories, setCategories] = useState([]);
  const [exercises, setExercises] = useState([]);
  const [counts, setCounts] = useState({});
  const [lastScores, setLastScores] = useState({});
  const [attemptedExerciseIds, setAttemptedExerciseIds] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchDraft, setSearchDraft] = useState(params.get('q') || '');
  const loadedRef = useRef(false);
  const requestRef = useRef(0);

  const categorySlug = (params.get('category') || '').split(',')[0].trim();
  const level = params.get('level') || 'all';
  const sort = params.get('sort') === 'title' ? 'title' : 'newest';
  const query = params.get('q') || '';
  const view = params.get('view') === 'grid' ? 'grid' : 'list';
  const page = Math.max(1, Number(params.get('page')) || 1);
  const user = shell?.user || null;

  function replaceParams(next) {
    const merged = { category: categorySlug, level, sort, q: query, view, page, ...next };
    const url = new URLSearchParams();
    if (merged.category) url.set('category', merged.category);
    if (merged.level && merged.level !== 'all') url.set('level', merged.level);
    if (merged.sort && merged.sort !== 'newest') url.set('sort', merged.sort);
    if (merged.q) url.set('q', merged.q);
    if (merged.view === 'grid') url.set('view', 'grid');
    if (merged.page > 1) url.set('page', String(merged.page));
    const search = url.toString();
    router.replace(search ? `/exercises?${search}` : '/exercises', { scroll: false });
  }

  async function load() {
    const request = ++requestRef.current;
    if (!loadedRef.current) setLoading(true);
    setError('');
    const exerciseQuery = supabase.from('exercises').select('id,title,level,visibility,target_seconds,category_id,created_at,questions(count)').order('created_at', { ascending: false });
    let categoryQuery = supabase.from('categories').select('id,slug,name,description,area,image_path,sort_order').eq('active', true).order('sort_order');
    const [firstCategories, exerciseResult] = await Promise.all([
      categoryQuery,
      exerciseQuery,
    ]);
    const categoryResult = firstCategories.error && /area/.test(firstCategories.error.message)
      ? await supabase.from('categories').select('id,slug,name,description,image_path,sort_order').eq('active', true).order('sort_order')
      : firstCategories;
    if (request !== requestRef.current) return;
    if (categoryResult.error || exerciseResult.error) {
      const detail = categoryResult.error?.message || exerciseResult.error?.message;
      setError(detail ? `Exercises could not be loaded. ${detail}` : 'Exercises could not be loaded.');
      setLoading(false);
      return;
    }
    const visible = (exerciseResult.data || []).filter(exercise => user || exercise.visibility === 'public');
    const nextCounts = {};
    (exerciseResult.data || []).forEach(exercise => {
      nextCounts[exercise.id] = exercise.questions?.[0]?.count || 0;
    });
    const scores = {};
    const attemptedIds = new Set();
    if (user) {
      for (let offset = 0; ; offset += 1000) {
        const { data: attempts, error: attemptsError } = await supabase.from('attempts')
          .select('exercise_id,score,max_score,submitted_at')
          .order('submitted_at', { ascending: false })
          .range(offset, offset + 999);
        if (request !== requestRef.current) return;
        if (attemptsError) {
          setError(`Your exercise history could not be loaded. ${attemptsError.message}`);
          setLoading(false);
          return;
        }
        (attempts || []).forEach(attempt => {
          if (!attempt.exercise_id) return;
          attemptedIds.add(attempt.exercise_id);
          if (scores[attempt.exercise_id] == null) scores[attempt.exercise_id] = scorePercent(attempt);
        });
        if (!attempts || attempts.length < 1000) break;
      }
    }
    if (request !== requestRef.current) return;
    setCategories(categoryResult.data || []);
    setExercises(visible);
    setCounts(nextCounts);
    setLastScores(scores);
    setAttemptedExerciseIds(attemptedIds);
    loadedRef.current = true;
    setLoading(false);
  }

  useEffect(() => {
    if (shell && !shell.ready) return undefined;
    load();
    return undefined;
  }, [shell?.ready, user?.id]);

  useEffect(() => setSearchDraft(query), [query]);

  const category = categories.find(item => item.slug === categorySlug) || null;
  const preferred = new Set(shell?.categoryIds || []);
  const preferredLevel = shell?.profile?.english_level || '';
  const hasPreferences = Boolean(preferredLevel || preferred.size);

  const recommendations = useMemo(() => {
    if (!hasPreferences) return [];
    return exercises
      .map(exercise => {
        const categoryMatch = preferred.has(exercise.category_id);
        const levelMatch = preferredLevel && exercise.level === preferredLevel;
        const rank = (categoryMatch ? 2 : 0) + (levelMatch ? 1 : 0);
        return { exercise, rank };
      })
      .filter(item => item.rank > 0 && !attemptedExerciseIds.has(item.exercise.id))
      .sort((a, b) => b.rank - a.rank || a.exercise.title.localeCompare(b.exercise.title))
      .slice(0, 4)
      .map(item => item.exercise);
  }, [attemptedExerciseIds, exercises, hasPreferences, preferred, preferredLevel]);

  const recommendationIds = new Set(recommendations.map(exercise => exercise.id));
  const categoryExercises = exercises.filter(exercise => {
    if (category && exercise.category_id !== category.id) return false;
    if (!category && recommendationIds.has(exercise.id)) return false;
    if (level !== 'all' && exercise.level !== level) return false;
    if (query && !exercise.title.toLowerCase().includes(query.toLowerCase())) return false;
    return true;
  });
  const sorted = [...categoryExercises].sort((a, b) => {
    if (sort === 'title') return a.title.localeCompare(b.title);
    return new Date(b.created_at || 0) - new Date(a.created_at || 0);
  });
  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const visibleExercises = sorted.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  function exerciseCard(exercise, index) {
    const target = formatTarget(exercise.target_seconds);
    const last = lastScores[exercise.id];
    return (
      <article className="exercise-card" key={exercise.id}>
        <Link className="exercise-card-link" href={`/exercise/${exercise.id}`}>
          <span className="card-number">{String(index + 1).padStart(2, '0')}</span>
          <span className="exercise-card-copy">
            <strong>{exercise.title}</strong>
            <small>
              {counts[exercise.id] || 0} questions
              {target ? ` • Target ${target}` : ''}
              {last != null ? ` • Last score ${last}%` : ''}
            </small>
          </span>
        </Link>
        <div className="exercise-card-footer">
          <span className="exercise-card-meta">
            {exercise.visibility === 'members' && <span className="lock-icon" title="Members only" aria-label="Members only">🔒</span>}
            <span className={`exercise-level-badge ${exercise.level}`}>{exercise.level}</span>
          </span>
          <span className="exercise-card-actions">
            <Link className="exercise-open-link" href={`/exercise/${exercise.id}`} aria-label={`Open ${exercise.title}`} title="Open exercise">↗</Link>
            {shell?.role === 'admin' && (
              <Link className="exercise-edit-link" href={`/edit/${exercise.id}`} aria-label={`Edit ${exercise.title}`} title="Edit exercise">
                <span className="edit-icon" aria-hidden="true">✎</span>
                <span className="edit-label">Edit</span>
              </Link>
            )}
          </span>
        </div>
      </article>
    );
  }

  return (
    <main className="dashboard">
      {!categorySlug && (
        <header className="page-intro">
          <h1>Choose a topic</h1>
          <p>Pick a category, then practice with a short exercise.</p>
        </header>
      )}
      {error && (
        <div className="section-empty-state">
          <strong>Something went wrong</strong>
          <p>{error}</p>
          <button type="button" className="primary-button inline-cta" onClick={load}>Retry</button>
        </div>
      )}
      {loading && !error && (categorySlug ? <ExerciseFiltersSkeleton view={view} /> : <CategoryGridSkeleton />)}
      {!loading && !error && !categorySlug && (
        <>
          {recommendations.length > 0 && (
            <section className="recommend-section">
              <div className="section-heading">
                <div>
                  <h2>New recommendations for you</h2>
                  <p>Untried exercises matched to your interests and level.</p>
                </div>
              </div>
              <div className="exercise-grid exercise-list-view">
                {recommendations.map((exercise, index) => exerciseCard(exercise, index))}
              </div>
            </section>
          )}
          {Array.from(categories.reduce((groups, item) => {
            const area = item.area || 'Categories';
            if (!groups.has(area)) groups.set(area, []);
            groups.get(area).push(item);
            return groups;
          }, new Map())).map(([area, items]) => (
            <section className="category-group" key={area} aria-label={area}>
              <div className="section-heading"><h2>{area}</h2></div>
              <div className="category-grid">
                {items.map(item => {
                  const related = exercises.filter(exercise => exercise.category_id === item.id);
                  const done = related.filter(exercise => lastScores[exercise.id] != null).length;
                  const showImage = item.image_path && READY_IMAGES.has(item.slug);
                  return (
                    <button key={item.id} type="button" className="category-card" onClick={() => replaceParams({ category: item.slug, page: 1 })}>
                      {showImage
                        ? <Image src={item.image_path} alt={`${item.name} exercises`} width={800} height={450} className="category-image" />
                        : <span className="category-fallback" aria-hidden="true" />}
                      <strong>{item.name}</strong>
                      <span>{item.description}</span>
                      <small>{related.length} {related.length === 1 ? 'exercise' : 'exercises'}</small>
                      {user && related.length > 0 && (
                        <span className="level-progress" aria-label={`${done} of ${related.length} practiced`}>
                          <span style={{ width: `${Math.round((done / related.length) * 100)}%` }} />
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </section>
          ))}
          {!categories.length && <div className="section-empty-state"><strong>No categories yet</strong><p>Add categories in the database, then refresh this page.</p></div>}
        </>
      )}
      {!loading && !error && categorySlug && (
        <>
          <div className="section-heading exercise-filters">
            <div className="exercise-toolbar">
              <div className="category-filter">
                <AppSelect instanceId="exercise-category-filter" inputId="exercise-category-filter" label="Category" options={categories.map(item => ({ value: item.slug, label: item.name }))} value={category?.slug || ''} onChange={next => replaceParams({ category: next, page: 1 })} placeholder="Choose a category" />
              </div>
              <label className="search-field" htmlFor="exercise-search">Search
                <input id="exercise-search" value={searchDraft} onChange={event => { setSearchDraft(event.target.value); replaceParams({ q: event.target.value, page: 1 }); }} placeholder="Search titles" />
              </label>
              <AppSelect instanceId="exercise-level-filter" inputId="exercise-level-filter" label="Level" options={[{ value: 'all', label: 'All levels' }, { value: 'beginner', label: 'Beginner' }, { value: 'intermediate', label: 'Intermediate' }, { value: 'advanced', label: 'Advanced' }]} value={level} onChange={next => replaceParams({ level: next, page: 1 })} />
              <AppSelect instanceId="exercise-sort" inputId="exercise-sort" label="Sort" options={[{ value: 'newest', label: 'Newest' }, { value: 'title', label: 'Title' }]} value={sort} onChange={next => replaceParams({ sort: next, page: 1 })} />
            </div>
            <div className="view-toggle" aria-label="Exercise view">
              <button type="button" className={view === 'list' ? 'active' : ''} aria-pressed={view === 'list'} aria-label="List view" onClick={() => replaceParams({ view: 'list', page: 1 })}>☰</button>
              <button type="button" className={view === 'grid' ? 'active' : ''} aria-pressed={view === 'grid'} aria-label="Grid view" onClick={() => replaceParams({ view: 'grid', page: 1 })}>▦</button>
            </div>
          </div>
          {sorted.length > 0 ? (
            <>
              <div className={`exercise-grid ${view === 'grid' ? 'exercise-grid-view' : 'exercise-list-view'}`}>
                {visibleExercises.map((exercise, index) => exerciseCard(exercise, (safePage - 1) * PAGE_SIZE + index))}
              </div>
              {totalPages > 1 && (
                <div className="pagination">
                  <button type="button" className="pager-button" disabled={safePage === 1} onClick={() => replaceParams({ page: safePage - 1 })}>Previous</button>
                  <div className="pager-numbers" aria-label="Page numbers">
                    {Array.from({ length: totalPages }, (_, index) => index + 1).map(pageNumber => (
                      <button key={pageNumber} type="button" className={`pager-page ${pageNumber === safePage ? 'active' : ''}`} aria-current={pageNumber === safePage ? 'page' : undefined} onClick={() => replaceParams({ page: pageNumber })}>{pageNumber}</button>
                    ))}
                  </div>
                  <button type="button" className="pager-button" disabled={safePage === totalPages} onClick={() => replaceParams({ page: safePage + 1 })}>Next</button>
                </div>
              )}
            </>
          ) : (
            <div className="section-empty-state">
              <strong>No exercises match</strong>
              <p>Try another level, a different search, or another category.</p>
            </div>
          )}
        </>
      )}
    </main>
  );
}
