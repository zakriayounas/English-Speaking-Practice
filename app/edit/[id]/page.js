'use client';

import { useParams } from 'next/navigation';
import ExerciseEditor from '../../../components/ExerciseEditor';

export default function EditExercise() {
  const { id } = useParams();
  return <ExerciseEditor mode="edit" exerciseId={id} />;
}
