function FieldSkeleton() {
  return (
    <span className="field-skeleton">
      <span className="skeleton-line field-skeleton-label" />
      <span className="skeleton-line field-skeleton-input" />
    </span>
  );
}

function CategoryCardSkeleton() {
  return (
    <article className="category-card category-card-skeleton" aria-hidden="true">
      <span className="skeleton-line category-skeleton-image" />
      <span className="skeleton-line category-skeleton-title" />
      <span className="skeleton-line category-skeleton-copy" />
      <span className="skeleton-line category-skeleton-count" />
    </article>
  );
}

const CATEGORY_GROUP_SIZES = [1, 3, 1, 2, 2, 1, 1];

export function CategoryGridSkeleton({ groups = CATEGORY_GROUP_SIZES }) {
  return (
    <>
      {groups.map((cards, group) => (
        <section className="category-group" key={group} aria-hidden="true">
          <div className="section-heading"><span className="skeleton-line category-group-skeleton-title" /></div>
          <div className="category-grid">
            {Array.from({ length: cards }, (_, index) => <CategoryCardSkeleton key={index} />)}
          </div>
        </section>
      ))}
    </>
  );
}

export function ExercisesHomeSkeleton() {
  return (
    <main className="dashboard" aria-busy="true" aria-label="Loading exercises">
      <header className="page-intro">
        <span className="skeleton-line page-skeleton-title" />
        <span className="skeleton-line page-skeleton-copy" />
      </header>
      <CategoryGridSkeleton />
    </main>
  );
}

export function ExerciseListSkeleton({ view = 'list' }) {
  const grid = view === 'grid';
  return (
    <div className={`exercise-grid ${grid ? 'exercise-grid-view' : 'exercise-list-view'}`} aria-hidden="true">
      {Array.from({ length: grid ? 6 : 5 }, (_, index) => (
        <article className="exercise-card exercise-card-skeleton" key={index}>
          <span className="skeleton-line exercise-skeleton-number" />
          <span className="exercise-card-copy">
            <span className="skeleton-line exercise-skeleton-title" />
            <span className="skeleton-line exercise-skeleton-meta" />
          </span>
          <span className="skeleton-line exercise-skeleton-badge" />
          <span className="skeleton-line exercise-skeleton-arrow" />
        </article>
      ))}
    </div>
  );
}

export function ExerciseFiltersSkeleton({ view = 'list' }) {
  return (
    <>
      <div className="section-heading exercise-filters" aria-hidden="true">
        <div className="exercise-toolbar">
          <span className="filter-skeleton category-filter"><span className="skeleton-line filter-skeleton-label" /><span className="skeleton-line filter-skeleton-control" /></span>
          <span className="filter-skeleton search-field"><span className="skeleton-line filter-skeleton-label" /><span className="skeleton-line filter-skeleton-control" /></span>
          <span className="filter-skeleton"><span className="skeleton-line filter-skeleton-label" /><span className="skeleton-line filter-skeleton-control" /></span>
          <span className="filter-skeleton"><span className="skeleton-line filter-skeleton-label" /><span className="skeleton-line filter-skeleton-control" /></span>
        </div>
        <span className="skeleton-line view-toggle-skeleton" />
      </div>
      <ExerciseListSkeleton view={view} />
    </>
  );
}

export function ProfileProgressSkeleton() {
  return (
    <div className="profile-progress-loading" aria-hidden="true">
      <div className="admin-stats">
        {Array.from({ length: 4 }, (_, index) => <div className="skeleton-card profile-stat-skeleton" key={index} />)}
      </div>
      <div className="profile-progress-sections">
        <section className="admin-section profile-chart-section">
          <span className="skeleton-line section-skeleton-heading" />
          <span className="skeleton-line profile-chart-skeleton" />
        </section>
        <section className="admin-section">
          <span className="skeleton-line section-skeleton-heading" />
          <span className="skeleton-line profile-row-skeleton" />
          <span className="skeleton-line profile-row-skeleton" />
        </section>
        <section className="admin-section">
          <span className="skeleton-line section-skeleton-heading" />
          <span className="skeleton-line profile-row-skeleton" />
          <span className="skeleton-line profile-row-skeleton" />
          <span className="skeleton-line profile-row-skeleton" />
        </section>
      </div>
    </div>
  );
}

export function ProgressPageSkeleton() {
  return (
    <main className="admin-page profile-page" aria-busy="true" aria-label="Loading progress">
      <header className="author-header">
        <div>
          <span className="skeleton-line progress-skeleton-title" />
          <span className="skeleton-line progress-skeleton-meta" />
        </div>
        <span className="skeleton-line admin-skeleton-button" />
      </header>
      <ProfileProgressSkeleton />
    </main>
  );
}

export function SettingsSkeleton() {
  return (
    <main className="dashboard" aria-busy="true" aria-label="Loading settings">
      <header className="page-intro"><span className="skeleton-line settings-skeleton-title" /></header>
      <section className="edit-exercise-card settings-form">
        <div className="settings-sections">
          <section className="settings-section">
            <span className="skeleton-line section-skeleton-heading" />
            <div className="settings-fields">
              <FieldSkeleton />
              <FieldSkeleton />
              <FieldSkeleton />
            </div>
          </section>
          <section className="settings-section">
            <span className="skeleton-line section-skeleton-heading" />
            <div className="settings-fields">
              <FieldSkeleton />
              <FieldSkeleton />
              <FieldSkeleton />
              <FieldSkeleton />
            </div>
            <span className="skeleton-line settings-check-skeleton" />
          </section>
        </div>
        <span className="skeleton-line settings-skeleton-button" />
      </section>
    </main>
  );
}
