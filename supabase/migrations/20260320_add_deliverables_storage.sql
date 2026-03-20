-- Deliverables storage bucket and policies
-- Run in Supabase SQL editor

insert into storage.buckets (id, name, public)
values ('deliverables', 'deliverables', true)
on conflict (id) do nothing;

-- Allow admins to upload deliverable files
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Admins upload deliverables'
  ) THEN
    CREATE POLICY "Admins upload deliverables"
      ON storage.objects
      FOR INSERT
      TO authenticated
      WITH CHECK (
        bucket_id = 'deliverables'
        AND EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = auth.uid() AND p.role = 'admin'
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Admins update deliverables'
  ) THEN
    CREATE POLICY "Admins update deliverables"
      ON storage.objects
      FOR UPDATE
      TO authenticated
      USING (
        bucket_id = 'deliverables'
        AND EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = auth.uid() AND p.role = 'admin'
        )
      )
      WITH CHECK (
        bucket_id = 'deliverables'
        AND EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = auth.uid() AND p.role = 'admin'
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Admins delete deliverables'
  ) THEN
    CREATE POLICY "Admins delete deliverables"
      ON storage.objects
      FOR DELETE
      TO authenticated
      USING (
        bucket_id = 'deliverables'
        AND EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = auth.uid() AND p.role = 'admin'
        )
      );
  END IF;
END $$;
