import { useState, useEffect, useRef } from 'react';
import { supabase } from '@services/supabase';

type JobStatus = 'pending' | 'processing' | 'done' | 'error';

export type ImportJobResult = {
  name: string;
  ingredients: string[];
  instructions: string[];
  servings: number;
  prep_time: number | null;
  cook_time: number | null;
  difficulty: 'facile' | 'moyen' | 'difficile';
  low_confidence_fields: string[];
  macros: {
    kcal: number;
    proteines: number;
    glucides: number;
    lipides: number;
  };
};

type ImportJobState = {
  status: JobStatus | null;
  result: ImportJobResult | null;
  errorCode: string | null;
  errorMessage: string | null;
};

export function useImportJob(jobId: string | null): ImportJobState {
  const [state, setState] = useState<ImportJobState>({
    status: null,
    result: null,
    errorCode: null,
    errorMessage: null,
  });
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!jobId) return;

    const poll = async () => {
      const { data, error } = await supabase
        .from('import_jobs')
        .select('status, result, error_code, error_message')
        .eq('id', jobId)
        .single();
      if (error || !data) return;

      setState({
        status: data.status as JobStatus,
        result: data.result as ImportJobResult | null,
        errorCode: data.error_code,
        errorMessage: data.error_message,
      });

      if (data.status === 'done' || data.status === 'error') {
        if (intervalRef.current) clearInterval(intervalRef.current);
      }
    };

    poll();
    intervalRef.current = setInterval(poll, 3000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [jobId]);

  return state;
}
