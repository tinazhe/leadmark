-- Create profile row when a new user is created in auth.users
-- Fixes "new row violates row-level security policy for table profiles" on register
-- when the backend uses a key that is subject to RLS (e.g. anon key) or to avoid
-- relying on service role for the initial insert.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'User')
  );
  RETURN NEW;
END;
$$;

-- Trigger on auth.users so every new signup gets a profile row
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
