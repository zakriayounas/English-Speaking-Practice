import { Suspense } from 'react';
import ExercisesBrowser from '../../components/ExercisesBrowser';
import { ExercisesHomeSkeleton } from '../../components/PageSkeletons';

export default function ExercisesPage() {
  return (
    <Suspense fallback={<ExercisesHomeSkeleton />}>
      <ExercisesBrowser />
    </Suspense>
  );
}
